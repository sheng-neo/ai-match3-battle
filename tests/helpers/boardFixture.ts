import { Grid, emptyGrid } from '../../src/engine/board';
import { MatchEngine } from '../../src/engine/engine';
import { Color, Piece, PieceKind, Pos, SIZE, Special } from '../../src/engine/types';

/**
 * ASCII 字符画 ⇄ 棋盘。
 * '0'-'5' = 六色普通棋子；'X' = 脏数据；'.' = 空。
 * 特殊块/锁通过 opts 按坐标叠加。
 */
export interface FixtureOpts {
  specials?: { at: Pos; special: Special }[];
  locks?: { at: Pos; hits: number }[];
}

export function fromAscii(rows: string[], opts: FixtureOpts = {}): Grid {
  if (rows.length !== SIZE) throw new Error(`fixture 需要 ${SIZE} 行，got ${rows.length}`);
  const grid = emptyGrid();
  let id = 0;
  for (let y = 0; y < SIZE; y++) {
    const row = rows[y].replace(/\s+/g, '');
    if (row.length !== SIZE) throw new Error(`第 ${y} 行长度应为 ${SIZE}：'${row}'`);
    for (let x = 0; x < SIZE; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      let piece: Piece;
      if (ch === 'X') {
        piece = { id: ++id, kind: PieceKind.Garbage, color: null, special: Special.None, lockHits: 0 };
      } else {
        const c = Number(ch);
        if (!(c >= 0 && c <= 5)) throw new Error(`非法字符 '${ch}'`);
        piece = { id: ++id, kind: PieceKind.Normal, color: c as Color, special: Special.None, lockHits: 0 };
      }
      grid[y][x] = piece;
    }
  }
  for (const s of opts.specials ?? []) {
    const p = grid[s.at.y][s.at.x];
    if (!p) throw new Error(`special 位置为空 (${s.at.x},${s.at.y})`);
    p.special = s.special;
    if (s.special === Special.Singularity) p.color = null;
  }
  for (const l of opts.locks ?? []) {
    const p = grid[l.at.y][l.at.x];
    if (!p) throw new Error(`lock 位置为空 (${l.at.x},${l.at.y})`);
    p.lockHits = l.hits;
  }
  return grid;
}

export function toAscii(grid: Grid): string[] {
  const rows: string[] = [];
  for (let y = 0; y < SIZE; y++) {
    let row = '';
    for (let x = 0; x < SIZE; x++) {
      const p = grid[y][x];
      if (!p) row += '.';
      else if (p.kind === PieceKind.Garbage) row += 'X';
      else if (p.color === null) row += 'S'; // 奇点
      else row += String(p.color);
    }
    rows.push(row);
  }
  return rows;
}

/** 用 fixture 棋盘构建引擎（seed 控制后续 refill 颜色） */
export function engineFromAscii(rows: string[], opts: FixtureOpts = {}, seed = 12345): MatchEngine {
  const engine = new MatchEngine({ seed });
  const grid = fromAscii(rows, opts);
  let maxId = 1000; // fixture id 从 1 起；给后续生成留空间，避免冲突
  engine.__setGridForTest(grid, maxId);
  return engine;
}
