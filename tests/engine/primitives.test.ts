import { describe, expect, it } from 'vitest';
import { engineFromAscii } from '../helpers/boardFixture';
import { Special } from '../../src/engine/types';
import type { MatchEngine } from '../../src/engine/engine';

const BASE = ['01010101', '42323232', '41010101', '55123232', '41500101', '23232323', '01010101', '23232323'];

function expectStable(engine: MatchEngine): void {
  expect(engine.hasPendingMatches()).toBe(false);
  const grid = JSON.parse(engine.snapshot()) as unknown[][];
  for (const row of grid) for (const cell of row) expect(cell).not.toBeNull();
}

describe('v2 引擎原语', () => {
  it('scrambleColors：恰好 n 格变色且必然换色，结果稳定', () => {
    const engine = engineFromAscii(BASE);
    const before = new Map<number, number | null>();
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const p = engine.pieceAt({ x, y })!;
        before.set(p.id, p.color);
      }
    }
    const steps = engine.scrambleColors(8);
    const recolor = steps.find((s) => s.t === 'recolor');
    expect(recolor && recolor.t === 'recolor' ? recolor.cells.length : 0).toBe(8);
    if (recolor && recolor.t === 'recolor') {
      for (const c of recolor.cells) {
        expect(c.color).not.toBe(before.get(c.pieceId));
      }
    }
    expectStable(engine);
  });

  it('promoteSpecials：原地升格、颜色保留、不引发匹配', () => {
    const engine = engineFromAscii(BASE);
    const snapshotBefore = engine.snapshot();
    const steps = engine.promoteSpecials([Special.RowLaser, Special.ColLaser, Special.Kernel]);
    const promote = steps.find((s) => s.t === 'promote');
    expect(promote && promote.t === 'promote' ? promote.cells.length : 0).toBe(3);
    expect(steps.some((s) => s.t === 'match')).toBe(false);
    if (promote && promote.t === 'promote') {
      for (const c of promote.cells) {
        const p = engine.pieceAt(c.at)!;
        expect(p.special).toBe(c.special);
        expect(p.color).not.toBeNull();
      }
    }
    expect(engine.snapshot()).not.toBe(snapshotBefore);
    expectStable(engine);
  });

  it('promoteSpecials：奇点请求被降级为卷积核', () => {
    const engine = engineFromAscii(BASE);
    const steps = engine.promoteSpecials([Special.Singularity]);
    const promote = steps.find((s) => s.t === 'promote');
    expect(promote && promote.t === 'promote' ? promote.cells[0].special : null).toBe(Special.Kernel);
  });

  it('clearGivenCells：引爆底部两行', () => {
    const engine = engineFromAscii(BASE);
    const cells = [];
    for (let y = 6; y < 8; y++) for (let x = 0; x < 8; x++) cells.push({ x, y });
    const r = engine.clearGivenCells(cells);
    expect(r.summary.valid).toBe(true);
    expect(r.summary.totalCleared).toBeGreaterThanOrEqual(16);
    expectStable(engine);
  });

  it('clearGivenCells：升格后的特殊块被引爆会触发连锁', () => {
    const engine = engineFromAscii(BASE);
    engine.promoteSpecials([Special.RowLaser]);
    // 全盘引爆必然命中该激光
    const all = [];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) all.push({ x, y });
    const r = engine.clearGivenCells(all);
    expect(r.summary.specialsTriggered).toContain(Special.RowLaser);
    expectStable(engine);
  });
});
