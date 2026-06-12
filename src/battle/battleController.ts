import { BATTLE } from '../config';
import { MatchEngine } from '../engine/engine';
import { mulberry32, type RNG } from '../engine/rng';
import { Pos, StepEvent, SwapResult } from '../engine/types';
import type { TauntEventType } from '../shared/tauntProtocol';
import { CharacterDef } from './characters';
import { AttackPlan, attackPlan, computeDamage, energyGain, hasAttack } from './damage';

export type Side = 'p1' | 'p2';

export interface SideStats {
  damageDealt: number;
  maxCombo: number;
  ultsCast: number;
  attacksSent: number;
  garbagePurged: number;
  swaps: number;
}

export interface CombatantState {
  side: Side;
  engine: MatchEngine;
  char: CharacterDef;
  hp: number;
  energy: number;
  lastSwapAt: number;
  rateLimitedUntil: number;
  shieldUntil: number;
  stats: SideStats;
  lowHpNotified: boolean;
}

export type RejectReason = 'over' | 'cooldown' | 'energy' | 'invalid';

export interface BattleEvents {
  steps: { side: Side; steps: StepEvent[] };
  damage: { side: Side; amount: number; hp: number; from: Side };
  energy: { side: Side; energy: number };
  combo: { side: Side; combo: number; cleared: number; fusion: boolean };
  attack: { from: Side; to: Side; plan: AttackPlan; reflected: boolean; dodged: boolean };
  skill: { side: Side; char: CharacterDef };
  debuff: { side: Side; type: 'ratelimit' | 'shield'; ms: number };
  rejected: { side: Side; reason: RejectReason };
  tick: { timeLeftMs: number };
  gameOver: { winner: Side | 'draw'; byTimeout: boolean };
  taunt: { type: TauntEventType; combo: number };
}

type Listener<K extends keyof BattleEvents> = (payload: BattleEvents[K]) => void;

export interface BattleConfig {
  p1: { char: CharacterDef; seed: number };
  p2: { char: CharacterDef; seed: number };
  rngSeed: number;
  durationMs?: number;
}

export class BattleController {
  readonly duration: number;
  elapsed = 0;
  over = false;
  winner: Side | 'draw' | null = null;

  private readonly combatants: Record<Side, CombatantState>;
  private readonly rng: RNG;
  private listeners: { [K in keyof BattleEvents]?: Listener<K>[] } = {};

  constructor(cfg: BattleConfig) {
    this.duration = cfg.durationMs ?? BATTLE.durationMs;
    this.rng = mulberry32(cfg.rngSeed);
    const mk = (side: Side, char: CharacterDef, seed: number): CombatantState => ({
      side,
      engine: new MatchEngine({ seed }),
      char,
      hp: BATTLE.maxHp,
      energy: 0,
      lastSwapAt: -99999,
      rateLimitedUntil: 0,
      shieldUntil: 0,
      stats: { damageDealt: 0, maxCombo: 0, ultsCast: 0, attacksSent: 0, garbagePurged: 0, swaps: 0 },
      lowHpNotified: false,
    });
    this.combatants = {
      p1: mk('p1', cfg.p1.char, cfg.p1.seed),
      p2: mk('p2', cfg.p2.char, cfg.p2.seed),
    };
  }

  on<K extends keyof BattleEvents>(event: K, cb: Listener<K>): void {
    (this.listeners[event] ??= []).push(cb);
  }

  private emit<K extends keyof BattleEvents>(event: K, payload: BattleEvents[K]): void {
    for (const cb of this.listeners[event] ?? []) cb(payload);
  }

  state(side: Side): Readonly<CombatantState> {
    return this.combatants[side];
  }

  private opp(side: Side): Side {
    return side === 'p1' ? 'p2' : 'p1';
  }

  get timeLeftMs(): number {
    return Math.max(0, this.duration - this.elapsed);
  }

  /** 由场景每帧驱动；无头模拟可用大步长快进 */
  update(dtMs: number): void {
    if (this.over) return;
    this.elapsed += Math.min(dtMs, 250);
    this.emit('tick', { timeLeftMs: this.timeLeftMs });
    if (this.elapsed >= this.duration) {
      const d1 = this.combatants.p1.stats.damageDealt;
      const d2 = this.combatants.p2.stats.damageDealt;
      this.finish(d1 === d2 ? 'draw' : d1 > d2 ? 'p1' : 'p2', true);
    }
  }

  /** 限流期内交换有强制冷却 */
  inputBlocked(side: Side): boolean {
    if (this.over) return true;
    const c = this.combatants[side];
    return this.elapsed < c.rateLimitedUntil && this.elapsed - c.lastSwapAt < BATTLE.rateLimitSwapCdMs;
  }

  submitSwap(side: Side, a: Pos, b: Pos): SwapResult | { rejected: RejectReason } {
    if (this.over) return { rejected: 'over' };
    if (this.inputBlocked(side)) {
      this.emit('rejected', { side, reason: 'cooldown' });
      return { rejected: 'cooldown' };
    }
    const c = this.combatants[side];
    const r = c.engine.trySwap(a, b);
    if (r.steps.length) this.emit('steps', { side, steps: r.steps });
    c.lastSwapAt = this.elapsed;
    if (r.summary.valid) {
      c.stats.swaps++;
      this.applyOutcome(side, r);
    }
    return r;
  }

  submitTap(side: Side, p: Pos): SwapResult | { rejected: RejectReason } {
    if (this.over) return { rejected: 'over' };
    const c = this.combatants[side];
    const r = c.engine.tapLocked(p);
    if (r.steps.length) this.emit('steps', { side, steps: r.steps });
    if (r.summary.valid && r.summary.totalCleared > 0) this.applyOutcome(side, r);
    return r;
  }

  castSkill(side: Side): boolean {
    if (this.over) return false;
    const c = this.combatants[side];
    if (c.energy < BATTLE.energyMax) {
      this.emit('rejected', { side, reason: 'energy' });
      return false;
    }
    c.energy = 0;
    c.stats.ultsCast++;
    const oppSide = this.opp(side);
    const o = this.combatants[oppSide];

    switch (c.char.ult) {
      case 'overfit_storm': {
        const own = c.engine.clearRandomCells(BATTLE.overfitStormCells);
        if (own.steps.length) this.emit('steps', { side, steps: own.steps });
        const theirs = o.engine.clearRandomCells(BATTLE.overfitStormCells);
        if (theirs.steps.length) this.emit('steps', { side: oppSide, steps: theirs.steps });
        // 己方部分照常计伤与充能；对方棋盘只是被搅乱
        this.applyOutcome(side, own);
        break;
      }
      case 'distill': {
        const steal = Math.floor(o.energy * BATTLE.distillRatio);
        o.energy -= steal;
        c.energy = Math.min(BATTLE.energyMax, c.energy + steal);
        this.emit('energy', { side: oppSide, energy: o.energy });
        break;
      }
      case 'align_shield': {
        c.shieldUntil = this.elapsed + BATTLE.shieldMs;
        this.emit('debuff', { side, type: 'shield', ms: BATTLE.shieldMs });
        break;
      }
    }
    this.emit('energy', { side, energy: c.energy });
    this.emit('skill', { side, char: c.char });
    this.emit('taunt', { type: side === 'p2' ? 'botUltimate' : 'playerUltimate', combo: 0 });
    return true;
  }

  private applyOutcome(side: Side, r: SwapResult): void {
    const s = r.summary;
    const me = this.combatants[side];
    const oppSide = this.opp(side);
    const o = this.combatants[oppSide];

    // 伤害
    const dmg = computeDamage(s, me.char.passive.damageMul ?? 1);
    if (dmg > 0 && !this.over) {
      o.hp = Math.max(0, o.hp - dmg);
      me.stats.damageDealt += dmg;
      this.emit('damage', { side: oppSide, amount: dmg, hp: o.hp, from: side });
      if (oppSide === 'p2' && dmg >= BATTLE.bigHitAt) this.emit('taunt', { type: 'botHurt', combo: s.maxCombo });
    }

    // 充能
    const gain = energyGain(s, me.char.mainColor, me.char.passive.energyMul ?? 1);
    if (gain > 0) {
      me.energy = Math.min(BATTLE.energyMax, me.energy + gain);
      this.emit('energy', { side, energy: me.energy });
    }

    me.stats.maxCombo = Math.max(me.stats.maxCombo, s.maxCombo);
    me.stats.garbagePurged += s.garbagePurged;
    this.emit('combo', { side, combo: s.maxCombo, cleared: s.totalCleared, fusion: s.fusion });
    if (s.maxCombo >= 4 || s.fusion) {
      this.emit('taunt', { type: side === 'p1' ? 'playerBigCombo' : 'botBigCombo', combo: s.maxCombo });
    }

    // 干扰攻击
    const plan = attackPlan(s);
    if (hasAttack(plan) && !this.over) this.applyInterference(side, oppSide, plan);

    this.checkLowHp();
    if (o.hp <= 0 && !this.over) this.finish(side, false);
  }

  private applyInterference(from: Side, to: Side, plan: AttackPlan): void {
    let target = to;
    let reflected = false;
    let dodged = false;
    const victim0 = this.combatants[to];

    if (victim0.shieldUntil > this.elapsed) {
      target = from;
      reflected = true;
    } else if (victim0.char.passive.dodge && this.rng.next() < victim0.char.passive.dodge) {
      dodged = true;
    }

    if (!dodged) {
      const t = this.combatants[target];
      if (plan.garbage > 0) {
        const steps = t.engine.applyGarbage(plan.garbage);
        if (steps.length) this.emit('steps', { side: target, steps });
      }
      if (plan.locks > 0) {
        const steps = t.engine.applyLocks(plan.locks, BATTLE.lockHits);
        if (steps.length) this.emit('steps', { side: target, steps });
        if (target === 'p2') this.emit('taunt', { type: 'botLocked', combo: 0 });
      }
      if (plan.ratelimit) {
        t.rateLimitedUntil = this.elapsed + BATTLE.rateLimitMs;
        this.emit('debuff', { side: target, type: 'ratelimit', ms: BATTLE.rateLimitMs });
      }
      // 被攻击补偿能量
      t.energy = Math.min(BATTLE.energyMax, t.energy + BATTLE.energyOnHit);
      this.emit('energy', { side: target, energy: t.energy });
    }

    this.combatants[from].stats.attacksSent++;
    this.emit('attack', { from, to: target, plan, reflected, dodged });
  }

  private checkLowHp(): void {
    for (const side of ['p1', 'p2'] as Side[]) {
      const c = this.combatants[side];
      if (!c.lowHpNotified && c.hp > 0 && c.hp <= BATTLE.lowHpAt) {
        c.lowHpNotified = true;
        this.emit('taunt', { type: side === 'p1' ? 'playerLowHp' : 'botLowHp', combo: 0 });
      }
    }
  }

  private finish(winner: Side | 'draw', byTimeout: boolean): void {
    if (this.over) return;
    this.over = true;
    this.winner = winner;
    this.emit('gameOver', { winner, byTimeout });
  }
}
