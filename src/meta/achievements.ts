import { CHARACTERS } from '../battle/characters';
import type { Profile } from './save';

export interface AchievementDef {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  check: (p: Profile) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_win', emoji: '🎉', name: '首杀', desc: '赢下第一局对战', check: (p) => p.stats.wins >= 1 },
  { id: 'wins_10', emoji: '⚔️', name: '十连斩', desc: '累计获胜 10 局', check: (p) => p.stats.wins >= 10 },
  { id: 'wins_50', emoji: '🗡️', name: '模型猎人', desc: '累计获胜 50 局', check: (p) => p.stats.wins >= 50 },
  { id: 'wins_100', emoji: '👑', name: '人类之光', desc: '累计获胜 100 局', check: (p) => p.stats.wins >= 100 },
  { id: 'combo_5', emoji: '🔥', name: '梯度起飞', desc: '单次操作打出 5 连锁', check: (p) => p.stats.maxCombo >= 5 },
  { id: 'combo_7', emoji: '🌋', name: '链式反应', desc: '单次操作打出 7 连锁', check: (p) => p.stats.maxCombo >= 7 },
  { id: 'combo_9', emoji: '☄️', name: '梯度爆炸', desc: '单次操作打出 9 连锁', check: (p) => p.stats.maxCombo >= 9 },
  { id: 'fusion_1', emoji: '⚡', name: '初次融合', desc: '触发一次特殊块组合技', check: (p) => p.stats.fusions >= 1 },
  { id: 'fusion_20', emoji: '🧬', name: '融合大师', desc: '累计触发 20 次组合技', check: (p) => p.stats.fusions >= 20 },
  { id: 'ults_25', emoji: '💥', name: '大招狂魔', desc: '累计释放 25 次大招', check: (p) => p.stats.ults >= 25 },
  { id: 'purified_50', emoji: '🧹', name: '数据清洗工', desc: '累计净化 50 块脏数据', check: (p) => p.stats.purified >= 50 },
  { id: 'purified_200', emoji: '🛁', name: '数据治理专家', desc: '累计净化 200 块脏数据', check: (p) => p.stats.purified >= 200 },
  { id: 'damage_5k', emoji: '📈', name: '高吞吐', desc: '累计造成 5000 点伤害', check: (p) => p.stats.totalDamage >= 5000 },
  { id: 'damage_20k', emoji: '🚀', name: '算力霸权', desc: '累计造成 20000 点伤害', check: (p) => p.stats.totalDamage >= 20000 },
  { id: 'tower_10', emoji: '🗼', name: '初登塔', desc: '爬塔通过第 10 层', check: (p) => p.towerBest >= 10 },
  { id: 'tower_30', emoji: '🏯', name: '塔中行者', desc: '爬塔通过第 30 层', check: (p) => p.towerBest >= 30 },
  { id: 'tower_60', emoji: '🌆', name: '高层访客', desc: '爬塔通过第 60 层', check: (p) => p.towerBest >= 60 },
  { id: 'tower_100', emoji: '🌌', name: '通天塔征服者', desc: '通关 100 层爬塔', check: (p) => p.towerBest >= 100 },
  { id: 'endless_3', emoji: '♾️', name: '续航测试', desc: '无尽模式撑过 3 波', check: (p) => p.endlessBest >= 3 },
  { id: 'endless_6', emoji: '🔋', name: '长上下文', desc: '无尽模式撑过 6 波', check: (p) => p.endlessBest >= 6 },
  { id: 'endless_10', emoji: '🧿', name: '永不宕机', desc: '无尽模式撑过 10 波', check: (p) => p.endlessBest >= 10 },
  { id: 'daily_3', emoji: '📅', name: '日更选手', desc: '每日挑战连胜 3 天', check: (p) => p.daily.streak >= 3 },
  { id: 'daily_7', emoji: '🗓️', name: '七日打卡', desc: '每日挑战连胜 7 天', check: (p) => p.daily.streak >= 7 },
  {
    id: 'char_all',
    emoji: '🎭',
    name: '全模型驾驶证',
    desc: '用全部 6 个模型各赢一局',
    check: (p) => CHARACTERS.every((c) => (p.stats.winsByChar[c.id] ?? 0) >= 1),
  },
];

/** 返回新解锁的成就（并写入 profile.achievements） */
export function checkAchievements(p: Profile): AchievementDef[] {
  const fresh: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (p.achievements.includes(a.id)) continue;
    if (a.check(p)) {
      p.achievements.push(a.id);
      fresh.push(a);
    }
  }
  return fresh;
}
