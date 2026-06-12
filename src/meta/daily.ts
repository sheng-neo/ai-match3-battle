import type { DifficultyDef } from '../config';
import { DIFFICULTIES } from '../config';
import { CHARACTERS } from '../battle/characters';
import type { PersonaId } from '../shared/tauntProtocol';

/** 本地日期 key（每日挑战以玩家本地时区为准） */
export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function yesterdayKey(d = new Date()): string {
  const y = new Date(d);
  y.setDate(y.getDate() - 1);
  return todayKey(y);
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface DailyConfig {
  dateKey: string;
  seed: number;
  /** 当日指定出战模型（即使未解锁也可试用——每日挑战的福利） */
  myChar: PersonaId;
  oppChar: PersonaId;
  difficulty: DifficultyDef;
}

/** 同一天全球同配置：固定种子 + 固定出战/对手/难度 */
export function dailyConfig(dateKey = todayKey()): DailyConfig {
  const h = hashStr(dateKey);
  const myChar = CHARACTERS[h % CHARACTERS.length].id;
  let oppIdx = (h >>> 4) % CHARACTERS.length;
  if (CHARACTERS[oppIdx].id === myChar) oppIdx = (oppIdx + 1) % CHARACTERS.length;
  const diffIdx = (h >>> 8) % 5; // easy:1/5, normal:2/5, hard:2/5
  const difficulty = DIFFICULTIES[diffIdx === 0 ? 0 : diffIdx <= 2 ? 1 : 2];
  return {
    dateKey,
    seed: h,
    myChar,
    oppChar: CHARACTERS[oppIdx].id,
    difficulty,
  };
}
