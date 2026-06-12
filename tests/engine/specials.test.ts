import { describe, expect, it } from 'vitest';
import { engineFromAscii } from '../helpers/boardFixture';
import { Special } from '../../src/engine/types';

// 基础局面（无天然三连），交换 (2,3)↔(2,4) 完成 y3 行的 555
const BASE = ['01010101', '42323232', '41010101', '55123232', '41500101', '23232323', '01010101', '23232323'];

const withRow = (rows: string[], y: number, row: string) => {
  const out = [...rows];
  out[y] = row;
  return out;
};

describe('specials: 生成', () => {
  it('横 4 连生成列激光（落点处）', () => {
    const engine = engineFromAscii(withRow(BASE, 3, '55153232'));
    const r = engine.trySwap({ x: 2, y: 3 }, { x: 2, y: 4 });
    expect(r.summary.valid).toBe(true);
    const spawn = r.steps.find((s) => s.t === 'spawnSpecial');
    expect(spawn && spawn.t === 'spawnSpecial' ? spawn.special : null).toBe(Special.ColLaser);
    expect(spawn && spawn.t === 'spawnSpecial' ? spawn.at : null).toEqual({ x: 2, y: 3 });
    expect(r.summary.specialsCreated).toContain(Special.ColLaser);
  });

  it('5 连生成奇点（color 为 null）', () => {
    const engine = engineFromAscii(withRow(BASE, 3, '55155232'));
    const r = engine.trySwap({ x: 2, y: 3 }, { x: 2, y: 4 });
    const spawn = r.steps.find((s) => s.t === 'spawnSpecial');
    expect(spawn && spawn.t === 'spawnSpecial' ? spawn.special : null).toBe(Special.Singularity);
    expect(spawn && spawn.t === 'spawnSpecial' ? spawn.color : 0).toBeNull();
  });
});

describe('specials: 激活与链式', () => {
  it('行激光被匹配消除时清整行（锁格幸存）', () => {
    const engine = engineFromAscii(BASE, {
      specials: [{ at: { x: 0, y: 3 }, special: Special.RowLaser }],
      locks: [{ at: { x: 7, y: 3 }, hits: 3 }],
    });
    const r = engine.trySwap({ x: 2, y: 3 }, { x: 2, y: 4 });
    expect(r.summary.specialsTriggered).toContain(Special.RowLaser);
    // 行 8 格减 1 个锁格，至少 7 格被清
    expect(r.summary.totalCleared).toBeGreaterThanOrEqual(7);
    expect(engine.findLockedCells()).toHaveLength(1);
  });

  it('卷积核 3x3 爆破', () => {
    const engine = engineFromAscii(BASE, { specials: [{ at: { x: 1, y: 3 }, special: Special.Kernel }] });
    const r = engine.trySwap({ x: 2, y: 3 }, { x: 2, y: 4 });
    expect(r.summary.specialsTriggered).toContain(Special.Kernel);
    expect(r.summary.totalCleared).toBeGreaterThanOrEqual(9);
  });
});

describe('specials: fusion 组合', () => {
  it('奇点 + 普通色块 = 全消该色', () => {
    const engine = engineFromAscii(BASE, { specials: [{ at: { x: 2, y: 3 }, special: Special.Singularity }] });
    const r = engine.trySwap({ x: 2, y: 3 }, { x: 2, y: 4 }); // (2,4) 是 5 色
    expect(r.summary.valid).toBe(true);
    expect(r.summary.fusion).toBe(true);
    expect(r.summary.specialsTriggered).toContain(Special.Singularity);
    expect(r.summary.totalCleared).toBeGreaterThanOrEqual(4);
  });

  it('激光 + 激光 = 十字', () => {
    const engine = engineFromAscii(BASE, {
      specials: [
        { at: { x: 3, y: 3 }, special: Special.RowLaser },
        { at: { x: 3, y: 4 }, special: Special.ColLaser },
      ],
    });
    const r = engine.trySwap({ x: 3, y: 3 }, { x: 3, y: 4 });
    expect(r.summary.fusion).toBe(true);
    expect(r.summary.totalCleared).toBeGreaterThanOrEqual(15);
  });

  it('奇点 + 奇点 = 全盘清除', () => {
    const engine = engineFromAscii(BASE, {
      specials: [
        { at: { x: 3, y: 3 }, special: Special.Singularity },
        { at: { x: 3, y: 4 }, special: Special.Singularity },
      ],
    });
    const r = engine.trySwap({ x: 3, y: 3 }, { x: 3, y: 4 });
    expect(r.summary.fusion).toBe(true);
    expect(r.summary.totalCleared).toBeGreaterThanOrEqual(64);
  });

  it('奇点 + 特殊块 = 全消一色并逐格引爆', () => {
    const engine = engineFromAscii(BASE, {
      specials: [
        { at: { x: 3, y: 3 }, special: Special.Singularity },
        { at: { x: 3, y: 4 }, special: Special.Kernel },
      ],
    });
    const r = engine.trySwap({ x: 3, y: 3 }, { x: 3, y: 4 });
    expect(r.summary.fusion).toBe(true);
    // 至少触发 1 次奇点 + 若干次卷积核引爆
    expect(r.summary.specialsTriggered.filter((s) => s === Special.Kernel).length).toBeGreaterThanOrEqual(1);
  });
});

describe('specials: 脏数据净化', () => {
  it('与消除相邻的脏数据被净化', () => {
    const engine = engineFromAscii(withRow(BASE, 3, '551X3232'));
    const r = engine.trySwap({ x: 2, y: 3 }, { x: 2, y: 4 });
    expect(r.summary.valid).toBe(true);
    expect(r.summary.garbagePurged).toBeGreaterThanOrEqual(1);
    expect(engine.countGarbage()).toBe(0);
  });
});
