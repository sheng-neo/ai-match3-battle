import { Grid, isSwappable, swapCells } from './board';
import { buildGroups, hasMatchAt } from './matcher';
import { classifyFusion } from './specials';
import type { RNG } from './rng';
import { shuffleInPlace } from './rng';
import { Piece, PieceKind, Pos, SIZE, Special, StepEvent } from './types';

export interface SwapPair {
  a: Pos;
  b: Pos;
}

function swapCreatesMatch(grid: Grid, a: Pos, b: Pos): boolean {
  swapCells(grid, a, b);
  const ok = hasMatchAt(grid, a) || hasMatchAt(grid, b);
  swapCells(grid, a, b);
  return ok;
}

function pairLegal(grid: Grid, a: Pos, b: Pos): boolean {
  const pa = grid[a.y][a.x];
  const pb = grid[b.y][b.x];
  if (!isSwappable(pa) || !isSwappable(pb)) return false;
  if (classifyFusion(pa, pb) !== null) return true;
  return swapCreatesMatch(grid, a, b);
}

/** 枚举全部合法交换（右邻 + 下邻，共 ≤112 对） */
export function findLegalSwaps(grid: Grid): SwapPair[] {
  const out: SwapPair[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (x + 1 < SIZE) {
        const a = { x, y };
        const b = { x: x + 1, y };
        if (pairLegal(grid, a, b)) out.push({ a, b });
      }
      if (y + 1 < SIZE) {
        const a = { x, y };
        const b = { x, y: y + 1 };
        if (pairLegal(grid, a, b)) out.push({ a, b });
      }
    }
  }
  return out;
}

export function hasLegalMove(grid: Grid): boolean {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (x + 1 < SIZE && pairLegal(grid, { x, y }, { x: x + 1, y })) return true;
      if (y + 1 < SIZE && pairLegal(grid, { x, y }, { x, y: y + 1 })) return true;
    }
  }
  return false;
}

/**
 * 死局洗牌：只移动「普通、未锁、非特殊」棋子的位置（整子搬移，渲染层好做位移动画）。
 * 目标：洗后无天然三连且有合法步；80 次内达不到则放宽（容许天然三连，由 stabilize 级联消掉）。
 */
export function reshuffleMoves(grid: Grid, rng: RNG): StepEvent | null {
  const cells: Pos[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const p = grid[y][x];
      if (p && p.kind === PieceKind.Normal && p.lockHits === 0 && p.special === Special.None) {
        cells.push({ x, y });
      }
    }
  }
  if (cells.length < 2) return null;

  const originalPos = new Map<number, Pos>();
  for (const c of cells) originalPos.set(grid[c.y][c.x]!.id, c);

  let pieces: Piece[] = cells.map((c) => grid[c.y][c.x]!);
  let relaxed: Piece[] | null = null;

  for (let attempt = 0; attempt < 80; attempt++) {
    pieces = shuffleInPlace([...pieces], rng);
    cells.forEach((c, i) => {
      grid[c.y][c.x] = pieces[i];
    });
    const legal = hasLegalMove(grid);
    const natural = buildGroups(grid).length > 0;
    if (legal && !natural) {
      relaxed = null;
      break;
    }
    if (legal && !relaxed) relaxed = [...pieces]; // 备选：有步但有天然三连
  }
  if (relaxed) {
    cells.forEach((c, i) => {
      grid[c.y][c.x] = relaxed![i];
    });
  }

  const moves: { pieceId: number; from: Pos; to: Pos }[] = [];
  for (const c of cells) {
    const p = grid[c.y][c.x]!;
    const from = originalPos.get(p.id)!;
    if (from.x !== c.x || from.y !== c.y) moves.push({ pieceId: p.id, from, to: c });
  }
  return moves.length ? { t: 'shuffle', moves } : null;
}
