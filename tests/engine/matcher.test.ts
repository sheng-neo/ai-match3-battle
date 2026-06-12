import { describe, expect, it } from 'vitest';
import { buildGroups, findSegments, hasMatchAt } from '../../src/engine/matcher';
import { fromAscii } from '../helpers/boardFixture';

// 基底图案：2x2 分块平铺，横竖均无 3 连
const BASE = ['00112233', '22334455', '00112233', '22334455', '00112233', '22334455', '00112233', '22334455'];

function withRow(rows: string[], y: number, row: string): string[] {
  const out = [...rows];
  out[y] = row;
  return out;
}

describe('matcher', () => {
  it('基底图案无任何匹配', () => {
    expect(findSegments(fromAscii(BASE))).toHaveLength(0);
  });

  it('检测横向 3 连', () => {
    const grid = fromAscii(withRow(BASE, 0, '55512233'));
    const segs = findSegments(grid);
    expect(segs).toHaveLength(1);
    expect(segs[0].color).toBe(5);
    expect(segs[0].vertical).toBe(false);
    expect(segs[0].cells).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
  });

  it('L 形合并为 LT 组，生成点在交叉格', () => {
    let rows = withRow(BASE, 0, '55512233');
    rows = withRow(rows, 1, '52334455');
    rows = withRow(rows, 2, '50112233');
    const grid = fromAscii(rows);
    const groups = buildGroups(grid);
    expect(groups).toHaveLength(1);
    expect(groups[0].shape).toBe('LT');
    expect(groups[0].cells).toHaveLength(5);
    expect(groups[0].spawnAt).toEqual({ x: 0, y: 0 });
  });

  it('4 连为 line4，默认生成点取中（靠左）', () => {
    const grid = fromAscii(withRow(BASE, 0, '55552233'));
    const groups = buildGroups(grid);
    expect(groups).toHaveLength(1);
    expect(groups[0].shape).toBe('line4');
    expect(groups[0].spawnAt).toEqual({ x: 1, y: 0 });
  });

  it('4 连 hint 优先作为生成点', () => {
    const grid = fromAscii(withRow(BASE, 0, '55552233'));
    const groups = buildGroups(grid, [{ x: 3, y: 0 }]);
    expect(groups[0].spawnAt).toEqual({ x: 3, y: 0 });
  });

  it('5 连为 line5，优先于 LT', () => {
    let rows = withRow(BASE, 0, '55555233');
    rows = withRow(rows, 1, '52334455');
    rows = withRow(rows, 2, '50112233');
    const grid = fromAscii(rows);
    const groups = buildGroups(grid);
    const five = groups.find((g) => g.shape === 'line5');
    expect(five).toBeTruthy();
    expect(five!.cells).toHaveLength(5);
  });

  it('锁格不参与匹配', () => {
    const grid = fromAscii(withRow(BASE, 0, '55512233'), { locks: [{ at: { x: 1, y: 0 }, hits: 3 }] });
    expect(findSegments(grid)).toHaveLength(0);
  });

  it('hasMatchAt 快速判定', () => {
    const grid = fromAscii(withRow(BASE, 0, '55512233'));
    expect(hasMatchAt(grid, { x: 1, y: 0 })).toBe(true);
    expect(hasMatchAt(grid, { x: 5, y: 5 })).toBe(false);
  });
});
