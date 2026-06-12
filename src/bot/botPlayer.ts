import { BATTLE, type DifficultyDef } from '../config';
import { mulberry32, type RNG } from '../engine/rng';
import type { BattleController, Side } from '../battle/battleController';
import { pickMove, rollCastDelay, rollInterval } from './difficulty';
import { scoreMoves } from './evaluator';

/**
 * 启发式 Bot：按"思考间隔"行动 —— 解锁验证码 / 攒满放大招 / 选步交换。
 * 自带独立 rng（与引擎、对战层分离），同种子完全可复现。
 */
export class BotPlayer {
  private rng: RNG;
  private timer: number;
  private castAt: number | null = null;

  constructor(
    private ctrl: BattleController,
    private side: Side,
    private diff: DifficultyDef,
    seed: number,
    /** 模式修饰：<1 加速（爬塔深层/无尽后期），>1 减速 */
    private intervalMul = 1,
  ) {
    this.rng = mulberry32(seed);
    this.timer = rollInterval(diff, this.rng) * this.intervalMul;
  }

  update(dtMs: number): void {
    if (this.ctrl.over) return;
    this.timer -= dtMs;
    if (this.timer > 0) return;
    this.act();
    this.timer = rollInterval(this.diff, this.rng) * this.intervalMul;
  }

  private act(): void {
    const me = this.ctrl.state(this.side);
    const engine = me.engine;

    // 1. 验证码锁：按倾向概率优先处理（一次行动连点解完一个锁）
    const locked = engine.findLockedCells();
    if (locked.length && this.rng.next() < this.diff.unlockBias) {
      const target = locked[this.rng.nextInt(locked.length)];
      const hits = engine.pieceAt(target)?.lockHits ?? 0;
      for (let i = 0; i < hits; i++) this.ctrl.submitTap(this.side, target);
      return;
    }

    // 2. 大招：能量满后按难度延迟释放
    if (me.energy >= BATTLE.energyMax) {
      if (this.castAt === null) {
        this.castAt = this.ctrl.elapsed + rollCastDelay(this.diff, this.rng);
      }
      if (this.ctrl.elapsed >= this.castAt) {
        this.castAt = null;
        this.ctrl.castSkill(this.side);
        return;
      }
    } else {
      this.castAt = null;
    }

    // 3. 选步交换
    if (this.ctrl.inputBlocked(this.side)) return; // 限流中，这次思考作废
    const moves = scoreMoves(engine, me.char.mainColor);
    if (!moves.length) return; // 引擎 stabilize 兜底，不应出现
    const m = pickMove(this.diff.id, moves, this.rng);
    this.ctrl.submitSwap(this.side, m.a, m.b);
  }
}
