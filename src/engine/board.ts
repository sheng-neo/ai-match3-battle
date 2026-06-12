import type { RNG } from './rng';
import { COLOR_COUNT, Color, Piece, PieceKind, Pos, SIZE, Special } from './types';

export type Grid = (Piece | null)[][]; // grid[y][x]

export function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array<Piece | null>(SIZE).fill(null));
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

export function pieceAt(grid: Grid, p: Pos): Piece | null {
  return inBounds(p.x, p.y) ? grid[p.y][p.x] : null;
}

/** 可被玩家/bot 交换：普通棋子且未上锁（含特殊块；脏数据与锁格不可动） */
export function isSwappable(p: Piece | null): p is Piece {
  return !!p && p.kind === PieceKind.Normal && p.lockHits === 0;
}

/** 参与同色匹配：普通、未锁、有颜色（奇点 color=null 不参与） */
export function matchColorOf(p: Piece | null): Color | null {
  if (!p || p.kind !== PieceKind.Normal || p.lockHits > 0) return null;
  return p.color;
}

export function clonePiece(p: Piece): Piece {
  return { ...p };
}

export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => row.map((p) => (p ? { ...p } : null)));
}

export function swapCells(grid: Grid, a: Pos, b: Pos): void {
  const tmp = grid[a.y][a.x];
  grid[a.y][a.x] = grid[b.y][b.x];
  grid[b.y][b.x] = tmp;
}

/** 选一个不会与左侧/上方形成三连的颜色（行优先扫描时使用） */
function allowedColorAt(grid: Grid, x: number, y: number, rng: RNG, colors: number): Color {
  const banned = new Set<Color>();
  if (x >= 2) {
    const a = grid[y][x - 1];
    const b = grid[y][x - 2];
    if (a && b && a.color !== null && a.color === b.color) banned.add(a.color);
  }
  if (y >= 2) {
    const a = grid[y - 1][x];
    const b = grid[y - 2][x];
    if (a && b && a.color !== null && a.color === b.color) banned.add(a.color);
  }
  const allowed: Color[] = [];
  for (let c = 0; c < colors; c++) {
    if (!banned.has(c as Color)) allowed.push(c as Color);
  }
  return allowed[rng.nextInt(allowed.length)];
}

/** 行优先（y 外层）填满整盘，保证无天然三连。rng 消耗顺序固定。 */
export function generateBoard(grid: Grid, rng: RNG, nextId: () => number, colors = COLOR_COUNT): void {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      grid[y][x] = {
        id: nextId(),
        kind: PieceKind.Normal,
        color: allowedColorAt(grid, x, y, rng, colors),
        special: Special.None,
        lockHits: 0,
      };
    }
  }
}

export function allPositions(): Pos[] {
  const out: Pos[] = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) out.push({ x, y });
  return out;
}

export function orthoNeighbors(p: Pos): Pos[] {
  const out: Pos[] = [];
  if (p.x > 0) out.push({ x: p.x - 1, y: p.y });
  if (p.x < SIZE - 1) out.push({ x: p.x + 1, y: p.y });
  if (p.y > 0) out.push({ x: p.x, y: p.y - 1 });
  if (p.y < SIZE - 1) out.push({ x: p.x, y: p.y + 1 });
  return out;
}
