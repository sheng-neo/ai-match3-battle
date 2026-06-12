import { Grid } from './board';
import type { RNG } from './rng';
import { COLOR_COUNT, Color, PieceKind, Pos, SIZE, Special, StepEvent } from './types';

type GravityMove = { pieceId: number; from: Pos; to: Pos };
type RefillSpawn = { pieceId: number; at: Pos; color: Color };

/** 逐列自底向上压实。锁/垃圾随棋子一起下落。 */
export function applyGravity(grid: Grid): GravityMove[] {
  const moves: GravityMove[] = [];
  for (let x = 0; x < SIZE; x++) {
    let write = SIZE - 1;
    for (let y = SIZE - 1; y >= 0; y--) {
      const p = grid[y][x];
      if (!p) continue;
      if (y !== write) {
        grid[write][x] = p;
        grid[y][x] = null;
        moves.push({ pieceId: p.id, from: { x, y }, to: { x, y: write } });
      }
      write--;
    }
  }
  return moves;
}

/**
 * 顶部补充。★rng 消耗顺序固定：列 0→7，每列自顶向下 —— 确定性关键，勿改。
 */
export function refill(grid: Grid, rng: RNG, nextId: () => number, colors = COLOR_COUNT): RefillSpawn[] {
  const spawns: RefillSpawn[] = [];
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) {
      if (grid[y][x]) continue;
      const color = rng.nextInt(colors) as Color;
      const piece = { id: nextId(), kind: PieceKind.Normal, color, special: Special.None, lockHits: 0 };
      grid[y][x] = piece;
      spawns.push({ pieceId: piece.id, at: { x, y }, color });
    }
  }
  return spawns;
}

/** 压实 + 补充，按需追加事件 */
export function collapse(grid: Grid, rng: RNG, nextId: () => number, steps: StepEvent[]): void {
  const moves = applyGravity(grid);
  if (moves.length) steps.push({ t: 'gravity', moves });
  const spawns = refill(grid, rng, nextId);
  if (spawns.length) steps.push({ t: 'refill', spawns });
}
