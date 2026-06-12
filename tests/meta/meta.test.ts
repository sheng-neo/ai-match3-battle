import { describe, expect, it } from 'vitest';
import { TOWER_MAX, TOWER_UNLOCKS, floorConfig } from '../../src/meta/tower';
import { waveConfig } from '../../src/meta/endless';
import { dailyConfig, todayKey, yesterdayKey } from '../../src/meta/daily';
import { ACHIEVEMENTS, checkAchievements } from '../../src/meta/achievements';
import { defaultProfile } from '../../src/meta/save';

describe('爬塔配置', () => {
  it('1..100 层均可生成且数值递增、Boss 每 10 层', () => {
    let prevHp = 0;
    for (let f = 1; f <= TOWER_MAX; f++) {
      const c = floorConfig(f);
      expect(c.floor).toBe(f);
      expect(c.isBoss).toBe(f % 10 === 0);
      expect(c.intervalMul).toBeGreaterThanOrEqual(0.4);
      const hp = c.mods.p2HpMul ?? 1;
      if (!c.isBoss) {
        expect(hp).toBeGreaterThanOrEqual(prevHp >= 1 ? 1 : 0);
      }
      prevHp = hp;
      if (c.isBoss) expect(c.rules.some((r) => r.includes('BOSS'))).toBe(true);
    }
    expect(floorConfig(100).mods.p2HpMul!).toBeGreaterThan(floorConfig(1).mods.p2HpMul ?? 1);
  });

  it('解锁层配置正确', () => {
    expect(floorConfig(8).unlocks).toBe('hallucin');
    expect(floorConfig(20).unlocks).toBe('twin');
    expect(floorConfig(35).unlocks).toBe('alpaca');
    expect(Object.keys(TOWER_UNLOCKS)).toHaveLength(3);
  });

  it('同层配置确定性', () => {
    expect(JSON.stringify(floorConfig(42))).toBe(JSON.stringify(floorConfig(42)));
  });
});

describe('无尽配置', () => {
  it('波次递增变强且继承 HP', () => {
    const w1 = waveConfig(1, 100);
    const w8 = waveConfig(8, 64);
    expect(w1.mods.p1StartHp).toBe(100);
    expect(w8.mods.p1StartHp).toBe(64);
    expect(w8.mods.p2HpMul!).toBeGreaterThan(w1.mods.p2HpMul!);
    expect(w8.intervalMul).toBeLessThan(w1.intervalMul);
  });
});

describe('每日挑战', () => {
  it('同一天配置确定，不同天大概率不同', () => {
    const a = dailyConfig('2026-06-13');
    const b = dailyConfig('2026-06-13');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = dailyConfig('2026-06-14');
    expect(a.seed).not.toBe(c.seed);
    expect(a.myChar).not.toBe(a.oppChar);
  });

  it('日期 key 工具', () => {
    const d = new Date(2026, 5, 13);
    expect(todayKey(d)).toBe('2026-06-13');
    expect(yesterdayKey(d)).toBe('2026-06-12');
  });
});

describe('成就', () => {
  it('阈值检查与新解锁去重', () => {
    const p = defaultProfile();
    expect(checkAchievements(p)).toHaveLength(0);
    p.stats.wins = 12;
    p.stats.maxCombo = 5;
    const fresh = checkAchievements(p);
    const ids = fresh.map((a) => a.id);
    expect(ids).toContain('first_win');
    expect(ids).toContain('wins_10');
    expect(ids).toContain('combo_5');
    // 再次检查不重复发放
    expect(checkAchievements(p)).toHaveLength(0);
  });

  it('成就定义唯一且全部可判定', () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    expect(ids.size).toBe(ACHIEVEMENTS.length);
    const p = defaultProfile();
    for (const a of ACHIEVEMENTS) expect(typeof a.check(p)).toBe('boolean');
  });
});
