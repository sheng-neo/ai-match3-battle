import { describe, expect, it } from 'vitest';
import { hasLegalMove, findLegalSwaps, reshuffleMoves } from '../../src/engine/deadlock';
import { mulberry32 } from '../../src/engine/rng';
import { fromAscii } from '../helpers/boardFixture';
import { Special } from '../../src/engine/types';

// 2x2 色块平铺：可证明无任何合法交换
const DEAD = ['00110011', '00110011', '22332233', '22332233', '00110011', '00110011', '22332233', '22332233'];

describe('deadlock', () => {
  it('识别死局', () => {
    const grid = fromAscii(DEAD);
    expect(hasLegalMove(grid)).toBe(false);
    expect(findLegalSwaps(grid)).toHaveLength(0);
  });

  it('洗牌后恢复合法步', () => {
    const grid = fromAscii(DEAD);
    const ev = reshuffleMoves(grid, mulberry32(1));
    expect(ev).toBeTruthy();
    expect(ev!.t).toBe('shuffle');
    expect(hasLegalMove(grid)).toBe(true);
  });

  it('奇点与任意普通色块相邻即有合法步', () => {
    const grid = fromAscii(DEAD, { specials: [{ at: { x: 0, y: 0 }, special: Special.Singularity }] });
    expect(hasLegalMove(grid)).toBe(true);
  });
});
