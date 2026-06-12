import { describe, expect, it } from 'vitest';
import { attackPlan, computeDamage, energyGain, specialMulOf } from '../../src/battle/damage';
import { BATTLE } from '../../src/config';
import { Color, ResolveSummary, Special, newSummary } from '../../src/engine/types';

function summary(over: Partial<ResolveSummary>): ResolveSummary {
  return { ...newSummary(), ...over };
}

describe('damage 公式', () => {
  it('基础：3 消 combo1 无特殊', () => {
    const s = summary({ totalCleared: 3, maxCombo: 1 });
    expect(computeDamage(s)).toBe(Math.ceil(3 * 1 * 1 * BATTLE.damageScale));
  });

  it('combo 倍率线性递增', () => {
    const s = summary({ totalCleared: 10, maxCombo: 4 });
    const expected = Math.ceil(10 * (1 + BATTLE.comboMulStep * 3) * BATTLE.damageScale);
    expect(computeDamage(s)).toBe(expected);
  });

  it('特殊倍率取触发中最高档，fusion 额外乘算', () => {
    expect(specialMulOf(summary({ specialsTriggered: [Special.RowLaser] }))).toBe(1.3);
    expect(specialMulOf(summary({ specialsTriggered: [Special.RowLaser, Special.Kernel] }))).toBe(1.5);
    expect(specialMulOf(summary({ specialsTriggered: [Special.Singularity, Special.Kernel] }))).toBe(2.0);
    expect(specialMulOf(summary({ specialsTriggered: [Special.Kernel], fusion: true }))).toBeCloseTo(1.5 * 1.5);
  });

  it('无效/零消除不产生伤害', () => {
    expect(computeDamage(summary({ valid: false, totalCleared: 5, maxCombo: 1 }))).toBe(0);
    expect(computeDamage(summary({ totalCleared: 0, maxCombo: 0 }))).toBe(0);
  });

  it('被动伤害倍率参与计算', () => {
    const s = summary({ totalCleared: 10, maxCombo: 1 });
    expect(computeDamage(s, 1.1)).toBe(Math.ceil(10 * 1.1 * BATTLE.damageScale));
  });
});

describe('attackPlan 干扰触发', () => {
  it('combo<3 无干扰', () => {
    const p = attackPlan(summary({ totalCleared: 3, maxCombo: 2 }));
    expect(p).toEqual({ garbage: 0, locks: 0, ratelimit: false });
  });

  it('combo3 → 1 脏数据；combo4 → 2 脏 + 1 锁；combo5 → 上限脏 + 锁 + 限流', () => {
    expect(attackPlan(summary({ maxCombo: 3 }))).toEqual({ garbage: 1, locks: 0, ratelimit: false });
    expect(attackPlan(summary({ maxCombo: 4 }))).toEqual({ garbage: 2, locks: 1, ratelimit: false });
    expect(attackPlan(summary({ maxCombo: 5 }))).toEqual({ garbage: 3, locks: 1, ratelimit: true });
    expect(attackPlan(summary({ maxCombo: 8 })).garbage).toBe(BATTLE.garbageMax);
  });

  it('fusion 必触发限流', () => {
    expect(attackPlan(summary({ maxCombo: 1, fusion: true })).ratelimit).toBe(true);
  });
});

describe('energyGain 充能', () => {
  it('本命色每格额外 +1，被动倍率生效', () => {
    const s = summary({ totalCleared: 6, maxCombo: 1, clearedByColor: { [Color.Param]: 2 } });
    expect(energyGain(s, Color.Param, 1)).toBe(8); // 6 + 2
    expect(energyGain(s, Color.Compute, 1)).toBe(6);
    expect(energyGain(s, Color.Param, 1.25)).toBe(10);
  });
});
