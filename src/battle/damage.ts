import { BATTLE } from '../config';
import { ResolveSummary, Special } from '../engine/types';

export function specialMulOf(s: ResolveSummary): number {
  const { specialMul } = BATTLE;
  let m = 1;
  if (s.specialsTriggered.includes(Special.RowLaser) || s.specialsTriggered.includes(Special.ColLaser)) {
    m = Math.max(m, specialMul.laser);
  }
  if (s.specialsTriggered.includes(Special.Kernel)) m = Math.max(m, specialMul.kernel);
  if (s.specialsTriggered.includes(Special.Singularity)) m = Math.max(m, specialMul.singularity);
  if (s.fusion) m *= specialMul.fusionExtra;
  return m;
}

/** 一次操作对对方造成的伤害 */
export function computeDamage(s: ResolveSummary, damageMul = 1): number {
  if (!s.valid || s.totalCleared <= 0) return 0;
  const comboMul = 1 + BATTLE.comboMulStep * (s.maxCombo - 1);
  return Math.ceil(s.totalCleared * comboMul * specialMulOf(s) * damageMul * BATTLE.damageScale);
}

export interface AttackPlan {
  garbage: number;
  locks: number;
  ratelimit: boolean;
}

export function attackPlan(s: ResolveSummary): AttackPlan {
  if (!s.valid) return { garbage: 0, locks: 0, ratelimit: false };
  const c = s.maxCombo;
  return {
    garbage: c >= BATTLE.garbageComboAt ? Math.min(BATTLE.garbageMax, c - (BATTLE.garbageComboAt - 1)) : 0,
    locks: c >= BATTLE.lockComboAt ? 1 : 0,
    ratelimit: c >= BATTLE.rateLimitComboAt || s.fusion,
  };
}

export function hasAttack(p: AttackPlan): boolean {
  return p.garbage > 0 || p.locks > 0 || p.ratelimit;
}

/** 充能：每格 +1，本命色每格额外 +1，乘角色被动 */
export function energyGain(s: ResolveSummary, mainColor: number, energyMul = 1): number {
  if (!s.valid || s.totalCleared <= 0) return 0;
  const mainCells = s.clearedByColor[mainColor as keyof typeof s.clearedByColor] ?? 0;
  const base = s.totalCleared * BATTLE.energyPerCell + mainCells * BATTLE.energyMainColorBonus;
  return Math.round(base * energyMul);
}
