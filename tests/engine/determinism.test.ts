import { describe, expect, it } from 'vitest';
import { MatchEngine } from '../../src/engine/engine';
import { mulberry32 } from '../../src/engine/rng';
import type { StepEvent } from '../../src/engine/types';

/**
 * 防回归总闸：同种子 + 同操作脚本 ⇒ 事件流逐字节一致、终盘一致。
 * 任何隐藏的 Math.random / 迭代序不稳定都会在这里爆掉。
 */
function runScript(seed: number, ops = 160): { events: string; snapshot: string } {
  const engine = new MatchEngine({ seed });
  const driver = mulberry32(7777);
  const all: StepEvent[] = [];
  for (let i = 0; i < ops; i++) {
    const roll = driver.nextInt(10);
    if (roll <= 6) {
      const swaps = engine.findLegalSwaps();
      if (!swaps.length) continue;
      const pick = swaps[driver.nextInt(swaps.length)];
      all.push(...engine.trySwap(pick.a, pick.b).steps);
    } else if (roll === 7) {
      all.push(...engine.applyGarbage(1 + driver.nextInt(3)));
    } else if (roll === 8) {
      all.push(...engine.applyLocks(1, 3));
    } else {
      const locked = engine.findLockedCells();
      if (locked.length) all.push(...engine.tapLocked(locked[0]).steps);
    }
  }
  return { events: JSON.stringify(all), snapshot: engine.snapshot() };
}

describe('determinism 黄金快照', () => {
  it('两次独立运行完全一致', () => {
    const r1 = runScript(42);
    const r2 = runScript(42);
    expect(r1.snapshot).toBe(r2.snapshot);
    expect(r1.events).toBe(r2.events);
  });

  it('不同种子产生不同棋局', () => {
    expect(runScript(42).snapshot).not.toBe(runScript(43).snapshot);
  });

  it('脚本结束后棋盘满格且稳定', () => {
    const { snapshot } = runScript(42);
    const grid = JSON.parse(snapshot) as unknown[][];
    for (const row of grid) for (const cell of row) expect(cell).not.toBeNull();
  });

  it('clone 不污染本体 rng 流', () => {
    const a = new MatchEngine({ seed: 99 });
    const b = new MatchEngine({ seed: 99 });
    // 对 a 的克隆做大量操作
    const c = a.clone();
    for (let i = 0; i < 5; i++) {
      const swaps = c.findLegalSwaps();
      if (swaps.length) c.trySwap(swaps[0].a, swaps[0].b);
    }
    // a 与 b 此后应保持一致
    const sa = a.findLegalSwaps();
    const sb = b.findLegalSwaps();
    expect(JSON.stringify(sa)).toBe(JSON.stringify(sb));
    if (sa.length) {
      a.trySwap(sa[0].a, sa[0].b);
      b.trySwap(sb[0].a, sb[0].b);
      expect(a.snapshot()).toBe(b.snapshot());
    }
  });
});
