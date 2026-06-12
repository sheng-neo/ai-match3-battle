import { describe, expect, it } from 'vitest';
import { applyGravity, refill } from '../../src/engine/gravity';
import { mulberry32 } from '../../src/engine/rng';
import { fromAscii } from '../helpers/boardFixture';

const HOLES = ['01230123', '........', '12301230', '........', '01230123', '........', '12301230', '........'];

describe('gravity & refill', () => {
  it('逐列压实，全部下落到底部', () => {
    const grid = fromAscii(HOLES);
    const moves = applyGravity(grid);
    expect(moves).toHaveLength(32); // 32 个棋子全部下移
    for (const m of moves) {
      expect(m.from.x).toBe(m.to.x);
      expect(m.to.y).toBeGreaterThan(m.from.y);
    }
    for (let y = 4; y < 8; y++) for (let x = 0; x < 8; x++) expect(grid[y][x]).toBeTruthy();
    for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) expect(grid[y][x]).toBeNull();
  });

  it('refill 顺序固定（列 0→7、自顶向下），同种子完全一致', () => {
    const mk = () => {
      const g = fromAscii(HOLES);
      applyGravity(g);
      let id = 100;
      return refill(g, mulberry32(7), () => ++id);
    };
    const s1 = mk();
    const s2 = mk();
    expect(s1).toHaveLength(32);
    expect(JSON.stringify(s1)).toBe(JSON.stringify(s2));
    // 顺序：col0 的 y0..y3，然后 col1 ...
    expect(s1[0].at).toEqual({ x: 0, y: 0 });
    expect(s1[1].at).toEqual({ x: 0, y: 1 });
    expect(s1[4].at).toEqual({ x: 1, y: 0 });
  });
});
