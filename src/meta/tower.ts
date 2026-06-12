import type { BattleModifiers } from '../battle/battleController';
import type { DifficultyDef } from '../config';
import { DIFFICULTIES } from '../config';
import type { PersonaId } from '../shared/tauntProtocol';

export const TOWER_MAX = 100;

/** 通关解锁：打赢该层即解锁对应模型 */
export const TOWER_UNLOCKS: Partial<Record<number, PersonaId>> = {
  8: 'hallucin',
  20: 'twin',
  35: 'alpaca',
};

export interface FloorConfig {
  floor: number;
  oppChar: PersonaId;
  difficulty: DifficultyDef;
  /** bot 行动间隔倍率，<1 加速 */
  intervalMul: number;
  mods: BattleModifiers;
  isBoss: boolean;
  /** 规则描述（塔层界面展示） */
  rules: string[];
  unlocks?: PersonaId;
}

const OPP_ROTATION: PersonaId[] = ['scholar', 'cheap', 'omni', 'hallucin', 'twin', 'alpaca'];

function diffById(id: 'easy' | 'normal' | 'hard'): DifficultyDef {
  return DIFFICULTIES.find((d) => d.id === id)!;
}

/** 确定性生成第 N 层配置：难度/对手轮换/数值爬坡/每 10 层 Boss 特规 */
export function floorConfig(floor: number): FloorConfig {
  const f = Math.max(1, Math.min(TOWER_MAX, Math.round(floor)));
  const isBoss = f % 10 === 0;
  const difficulty = f <= 7 ? diffById('easy') : f <= 22 ? diffById('normal') : diffById('hard');

  // 深层手速渐进加快（最快 0.6×）
  let intervalMul = f <= 22 ? 1 : Math.max(0.6, 1 - (f - 22) * 0.008);
  const mods: BattleModifiers = {};
  const rules: string[] = [];

  // 血量/伤害爬坡
  const hpMul = 1 + Math.floor(f / 5) * 0.04; // 每 5 层 +4%
  const dmgMul = 1 + Math.floor(f / 8) * 0.04;
  if (hpMul > 1) {
    mods.p2HpMul = Number(hpMul.toFixed(2));
    rules.push(`对手 HP ×${mods.p2HpMul}`);
  }
  if (dmgMul > 1) {
    mods.p2DamageMul = Number(dmgMul.toFixed(2));
    rules.push(`对手伤害 ×${mods.p2DamageMul}`);
  }

  if (isBoss) {
    mods.p2HpMul = Number(((mods.p2HpMul ?? 1) * 1.25).toFixed(2));
    rules.push('👑 BOSS 层：对手 HP 额外 +25%');
    const bossKind = (f / 10 - 1) % 5;
    switch (bossKind) {
      case 0:
        mods.startGarbageP1 = 4;
        rules.push('开局：你方棋盘混入 4 块脏数据');
        break;
      case 1:
        mods.startLocksP1 = 2;
        rules.push('开局：你方棋盘被锁 2 格验证码');
        break;
      case 2:
        intervalMul *= 0.72;
        rules.push('对手超频：手速 +40%');
        break;
      case 3:
        mods.durationMs = 100_000;
        rules.push('限时速决：本层只有 100 秒');
        break;
      case 4:
        mods.p2DamageMul = Number(((mods.p2DamageMul ?? 1) * 1.3).toFixed(2));
        rules.push('对手火力全开：伤害额外 +30%');
        break;
    }
  }

  return {
    floor: f,
    oppChar: OPP_ROTATION[(f - 1) % OPP_ROTATION.length],
    difficulty,
    intervalMul: Number(intervalMul.toFixed(2)),
    mods,
    isBoss,
    rules,
    unlocks: TOWER_UNLOCKS[f],
  };
}
