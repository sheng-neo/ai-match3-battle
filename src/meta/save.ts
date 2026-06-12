import type { PersonaId } from '../shared/tauntProtocol';

/** 本地存档：进度、解锁、成就、统计 */
export interface ProfileStats {
  wins: number;
  losses: number;
  totalDamage: number;
  maxCombo: number;
  fusions: number;
  ults: number;
  purified: number;
  winsByChar: Partial<Record<PersonaId, number>>;
}

export interface DailyRecord {
  lastPlayedDate: string;
  lastWinDate: string;
  streak: number;
  played: number;
  won: number;
}

export interface Profile {
  /** 当前待挑战层（1-based） */
  towerFloor: number;
  towerBest: number;
  endlessBest: number;
  unlocked: PersonaId[];
  achievements: string[];
  daily: DailyRecord;
  stats: ProfileStats;
}

const KEY = 'ai-match3-profile-v1';

export function defaultProfile(): Profile {
  return {
    towerFloor: 1,
    towerBest: 0,
    endlessBest: 0,
    unlocked: ['omni', 'cheap', 'scholar'],
    achievements: [],
    daily: { lastPlayedDate: '', lastWinDate: '', streak: 0, played: 0, won: 0 },
    stats: {
      wins: 0,
      losses: 0,
      totalDamage: 0,
      maxCombo: 0,
      fusions: 0,
      ults: 0,
      purified: 0,
      winsByChar: {},
    },
  };
}

export function loadProfile(): Profile {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw) as Partial<Profile>;
    const base = defaultProfile();
    return {
      ...base,
      ...parsed,
      daily: { ...base.daily, ...(parsed.daily ?? {}) },
      stats: { ...base.stats, ...(parsed.stats ?? {}), winsByChar: { ...(parsed.stats?.winsByChar ?? {}) } },
      unlocked: parsed.unlocked?.length ? parsed.unlocked : base.unlocked,
      achievements: parsed.achievements ?? [],
    };
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(p: Profile): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // 存档失败不致命（隐私模式等）
  }
}

export function isUnlocked(p: Profile, id: PersonaId): boolean {
  return p.unlocked.includes(id);
}

export function unlock(p: Profile, id: PersonaId): boolean {
  if (p.unlocked.includes(id)) return false;
  p.unlocked.push(id);
  return true;
}
