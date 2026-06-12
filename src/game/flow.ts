import type { BattleModifiers } from '../battle/battleController';
import type { PersonaId } from '../shared/tauntProtocol';

export type ModeType = 'quick' | 'tower' | 'endless' | 'daily';
export type DifficultyId = 'easy' | 'normal' | 'hard';

/** 一局对战的完整配置：由各模式入口组装，BattleScene 只消费（registry key: 'setup'） */
export interface BattleSetup {
  modeType: ModeType;
  myCharId: PersonaId;
  oppCharId: PersonaId;
  difficultyId: DifficultyId;
  /** bot 行动间隔倍率 */
  intervalMul: number;
  mods: BattleModifiers;
  /** 每日挑战固定种子；其余模式随机 */
  seed?: number;
  floor?: number;
  wave?: number;
  dailyKey?: string;
  rules?: string[];
}

/** CharacterSelect 的来路（registry key: 'flow'） */
export interface FlowState {
  type: ModeType;
}

export function modeLabel(setup: BattleSetup): string {
  switch (setup.modeType) {
    case 'tower':
      return `🗼 通天塔 · 第 ${setup.floor} 层`;
    case 'endless':
      return `♾️ 无尽挑战 · 第 ${setup.wave} 波`;
    case 'daily':
      return `📅 每日挑战 · ${setup.dailyKey}`;
    default:
      return '⚡ 快速对战';
  }
}
