import { Grid, inBounds, matchColorOf } from './board';
import type { RNG } from './rng';
import { Color, MatchShape, Piece, PieceKind, Pos, SIZE, Special } from './types';

export function shapeToSpecial(shape: MatchShape, vertical: boolean): Special {
  switch (shape) {
    case 'line5':
      return Special.Singularity;
    case 'LT':
      return Special.Kernel;
    case 'line4':
      // 与连线方向垂直：横 4 连出列激光，竖 4 连出行激光
      return vertical ? Special.RowLaser : Special.ColLaser;
    default:
      return Special.None;
  }
}

/** 奇点选色：在场上现存颜色中确定性排序后由 rng 选一个 */
export function singularityTargetColor(grid: Grid, rng: RNG): Color | null {
  const present = new Set<Color>();
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const c = matchColorOf(grid[y][x]);
      if (c !== null) present.add(c);
    }
  }
  if (!present.size) return null;
  const sorted = [...present].sort((a, b) => a - b);
  return sorted[rng.nextInt(sorted.length)];
}

export function cellsOfColor(grid: Grid, color: Color): Pos[] {
  const out: Pos[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (matchColorOf(grid[y][x]) === color) out.push({ x, y });
    }
  }
  return out;
}

/** 特殊块激活时的波及范围（不做可清除性过滤，由 clearWave 统一过滤） */
export function blastCells(grid: Grid, pos: Pos, special: Special, rng: RNG): Pos[] {
  switch (special) {
    case Special.RowLaser: {
      const out: Pos[] = [];
      for (let x = 0; x < SIZE; x++) out.push({ x, y: pos.y });
      return out;
    }
    case Special.ColLaser: {
      const out: Pos[] = [];
      for (let y = 0; y < SIZE; y++) out.push({ x: pos.x, y });
      return out;
    }
    case Special.Kernel: {
      const out: Pos[] = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = pos.x + dx;
          const y = pos.y + dy;
          if (inBounds(x, y)) out.push({ x, y });
        }
      }
      return out;
    }
    case Special.Singularity: {
      const color = singularityTargetColor(grid, rng);
      return color === null ? [] : cellsOfColor(grid, color);
    }
    default:
      return [];
  }
}

export type FusionKind =
  | 'cross' // 激光+激光：十字
  | 'bigCross' // 激光+卷积核：3 行 + 3 列
  | 'fivexfive' // 卷积核×2：5x5
  | 'colorClear' // 奇点+普通色块：全消该色
  | 'colorDetonate' // 奇点+特殊块：全消一色并逐格引爆（上限 12）
  | 'nuke'; // 奇点×2：全盘清除

export function classifyFusion(pa: Piece, pb: Piece): FusionKind | null {
  const sa = pa.special;
  const sb = pb.special;
  const isLaser = (s: Special) => s === Special.RowLaser || s === Special.ColLaser;
  if (sa === Special.Singularity && sb === Special.Singularity) return 'nuke';
  if (sa === Special.Singularity || sb === Special.Singularity) {
    const other = sa === Special.Singularity ? pb : pa;
    if (other.special !== Special.None) return 'colorDetonate';
    if (other.kind === PieceKind.Normal && other.color !== null) return 'colorClear';
    return null;
  }
  if (sa !== Special.None && sb !== Special.None) {
    const lasers = Number(isLaser(sa)) + Number(isLaser(sb));
    if (lasers === 2) return 'cross';
    if (lasers === 1) return 'bigCross';
    return 'fivexfive';
  }
  return null;
}
