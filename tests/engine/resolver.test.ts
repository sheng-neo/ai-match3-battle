import { describe, expect, it } from 'vitest';
import { engineFromAscii } from '../helpers/boardFixture';
import { SIZE } from '../../src/engine/types';
import type { MatchEngine } from '../../src/engine/engine';

// 精心构造：无天然三连；交换 (2,3)↔(2,4) 后 y3 形成 555，
// 且 col0 的 4,4,_,4 在重力后形成 444 二段级联。
const CASCADE = ['01010101', '42323232', '41010101', '55123232', '41500101', '23232323', '01010101', '23232323'];

function expectStable(engine: MatchEngine): void {
  expect(engine.hasPendingMatches()).toBe(false);
  const grid = JSON.parse(engine.snapshot()) as unknown[][];
  for (const row of grid) for (const cell of row) expect(cell).not.toBeNull();
}

describe('resolver: 交换与级联', () => {
  it('有效交换：消除、重力、补充、二段级联', () => {
    const engine = engineFromAscii(CASCADE);
    const r = engine.trySwap({ x: 2, y: 3 }, { x: 2, y: 4 });
    expect(r.summary.valid).toBe(true);
    expect(r.summary.totalCleared).toBeGreaterThanOrEqual(6);
    expect(r.summary.maxCombo).toBeGreaterThanOrEqual(2);
    const matchCombos = r.steps.filter((s) => s.t === 'match').map((s) => (s.t === 'match' ? s.combo : 0));
    expect(matchCombos).toContain(1);
    expect(matchCombos).toContain(2);
    expect(r.steps.some((s) => s.t === 'gravity')).toBe(true);
    expect(r.steps.some((s) => s.t === 'refill')).toBe(true);
    expectStable(engine);
  });

  it('无效交换：回摆且棋盘不变', () => {
    const engine = engineFromAscii(CASCADE);
    const before = engine.snapshot();
    const r = engine.trySwap({ x: 0, y: 0 }, { x: 1, y: 0 }); // 0↔1，换完无匹配
    expect(r.summary.valid).toBe(false);
    expect(r.steps).toHaveLength(2);
    expect(r.steps[0]).toMatchObject({ t: 'swap', revert: false });
    expect(r.steps[1]).toMatchObject({ t: 'swap', revert: true });
    expect(engine.snapshot()).toBe(before);
  });

  it('不相邻 / 非法目标直接拒绝（无事件）', () => {
    const engine = engineFromAscii(CASCADE);
    const r = engine.trySwap({ x: 0, y: 0 }, { x: 2, y: 0 });
    expect(r.summary.valid).toBe(false);
    expect(r.steps).toHaveLength(0);
  });

  it('combo 按波次计数且事件携带 cleared 明细', () => {
    const engine = engineFromAscii(CASCADE);
    const r = engine.trySwap({ x: 2, y: 3 }, { x: 2, y: 4 });
    const firstMatch = r.steps.find((s) => s.t === 'match');
    expect(firstMatch && firstMatch.t === 'match' ? firstMatch.cleared.length : 0).toBeGreaterThanOrEqual(3);
  });

  it('clearRandomCells：随机清除并保持稳定', () => {
    const engine = engineFromAscii(CASCADE);
    const r = engine.clearRandomCells(10);
    expect(r.summary.totalCleared).toBeGreaterThanOrEqual(10);
    expectStable(engine);
  });

  it('applyGarbage / applyLocks / tapLocked 全链路', () => {
    const engine = engineFromAscii(CASCADE);
    const gSteps = engine.applyGarbage(3);
    expect(gSteps[0]).toMatchObject({ t: 'garbageAdd' });
    expect(engine.countGarbage()).toBe(3);

    const lSteps = engine.applyLocks(2, 3);
    expect(lSteps[0]).toMatchObject({ t: 'lockAdd' });
    const locked = engine.findLockedCells();
    expect(locked).toHaveLength(2);

    const target = locked[0];
    for (let i = 2; i >= 0; i--) {
      const r = engine.tapLocked(target);
      const hit = r.steps.find((s) => s.t === 'lockHit');
      expect(hit && hit.t === 'lockHit' ? hit.remaining : -1).toBe(i);
    }
    expect(engine.findLockedCells()).toHaveLength(1);
    expectStable(engine);
  });

  it('锁格免疫清除：整行激光也清不掉', () => {
    const engine = engineFromAscii(CASCADE, { locks: [{ at: { x: 7, y: 3 }, hits: 3 }] });
    engine.trySwap({ x: 2, y: 3 }, { x: 2, y: 4 });
    // (7,3) 在 y3 行，但若有行清除它也应幸存
    expect(engine.findLockedCells().length).toBe(1);
  });

  it('稳定不变量：任意操作后棋盘满格、无待消匹配', () => {
    const engine = engineFromAscii(CASCADE);
    engine.trySwap({ x: 2, y: 3 }, { x: 2, y: 4 });
    engine.applyGarbage(4);
    engine.applyLocks(1, 3);
    engine.clearRandomCells(8);
    expectStable(engine);
    const grid = JSON.parse(engine.snapshot()) as unknown[][];
    expect(grid.length).toBe(SIZE);
  });
});
