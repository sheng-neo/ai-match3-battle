import type { BattleModifiers } from '../battle/battleController';
import type { DifficultyDef } from '../config';
import { DIFFICULTIES } from '../config';
import type { PersonaId } from '../shared/tauntProtocol';

/** 无尽模式：波次间继承 HP 并小幅回复，对手逐波变强 */
export const ENDLESS_HEAL = 35;

export interface WaveConfig {
  wave: number;
  oppChar: PersonaId;
  difficulty: DifficultyDef;
  intervalMul: number;
  mods: BattleModifiers;
}

const ROTATION: PersonaId[] = ['cheap', 'scholar', 'hallucin', 'omni', 'alpaca', 'twin'];

export function waveConfig(wave: number, carryHp: number): WaveConfig {
  const w = Math.max(1, Math.round(wave));
  const difficulty = DIFFICULTIES.find((d) => d.id === (w <= 2 ? 'easy' : w <= 5 ? 'normal' : 'hard'))!;
  const mods: BattleModifiers = {
    p1StartHp: carryHp,
    p2HpMul: Number((1 + (w - 1) * 0.06).toFixed(2)),
    p2DamageMul: Number((1 + (w - 1) * 0.05).toFixed(2)),
  };
  return {
    wave: w,
    oppChar: ROTATION[(w - 1) % ROTATION.length],
    difficulty,
    intervalMul: Number(Math.max(0.55, 1 - Math.max(0, w - 6) * 0.05).toFixed(2)),
    mods,
  };
}
