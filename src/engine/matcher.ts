import { Grid, matchColorOf } from './board';
import { Color, MatchGroup, MatchShape, Pos, SIZE, posKey } from './types';

export interface Segment {
  color: Color;
  cells: Pos[];
  vertical: boolean;
}

/** 扫描全盘，返回所有 ≥3 的同色直线段（横、竖） */
export function findSegments(grid: Grid): Segment[] {
  const segs: Segment[] = [];
  // 横向
  for (let y = 0; y < SIZE; y++) {
    let x = 0;
    while (x < SIZE) {
      const c = matchColorOf(grid[y][x]);
      if (c === null) {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < SIZE && matchColorOf(grid[y][end]) === c) end++;
      if (end - x >= 3) {
        const cells: Pos[] = [];
        for (let i = x; i < end; i++) cells.push({ x: i, y });
        segs.push({ color: c, cells, vertical: false });
      }
      x = end;
    }
  }
  // 纵向
  for (let x = 0; x < SIZE; x++) {
    let y = 0;
    while (y < SIZE) {
      const c = matchColorOf(grid[y][x]);
      if (c === null) {
        y++;
        continue;
      }
      let end = y + 1;
      while (end < SIZE && matchColorOf(grid[end][x]) === c) end++;
      if (end - y >= 3) {
        const cells: Pos[] = [];
        for (let i = y; i < end; i++) cells.push({ x, y: i });
        segs.push({ color: c, cells, vertical: true });
      }
      y = end;
    }
  }
  return segs;
}

function segMid(cells: Pos[]): Pos {
  return cells[Math.floor((cells.length - 1) / 2)];
}

function pickSpawn(cells: Pos[], hints: Pos[], fallback: Pos): Pos {
  for (const h of hints) {
    if (cells.some((c) => c.x === h.x && c.y === h.y)) return h;
  }
  return fallback;
}

/**
 * 把线段合并为匹配组并确定特殊块生成点。
 * 判型优先级：line5 > LT > line4 > line3。
 * hints（本次交换的两个落点）优先作为生成位置。
 */
export function buildGroups(grid: Grid, hints: Pos[] = []): MatchGroup[] {
  const segs = findSegments(grid);
  if (!segs.length) return [];
  const groups: MatchGroup[] = [];
  const used = new Array(segs.length).fill(false);

  // line5+
  segs.forEach((s, i) => {
    if (s.cells.length >= 5) {
      used[i] = true;
      groups.push({
        color: s.color,
        cells: [...s.cells],
        shape: 'line5',
        vertical: s.vertical,
        spawnAt: pickSpawn(s.cells, hints, segMid(s.cells)),
      });
    }
  });

  // LT 交叉合并（剩余 3/4 长度段）
  for (let i = 0; i < segs.length; i++) {
    if (used[i] || segs[i].vertical) continue;
    for (let j = 0; j < segs.length; j++) {
      if (used[j] || !segs[j].vertical) continue;
      const h = segs[i];
      const v = segs[j];
      const crossSet = new Set(h.cells.map(posKey));
      const cross = v.cells.find((c) => crossSet.has(posKey(c)));
      if (!cross) continue;
      used[i] = true;
      used[j] = true;
      const cellMap = new Map<number, Pos>();
      for (const c of [...h.cells, ...v.cells]) cellMap.set(posKey(c), c);
      const cells = [...cellMap.values()];
      groups.push({
        color: h.color,
        cells,
        shape: 'LT',
        vertical: false,
        spawnAt: pickSpawn(cells, hints, cross),
      });
      break;
    }
  }

  // 剩余直线段
  segs.forEach((s, i) => {
    if (used[i]) return;
    const shape: MatchShape = s.cells.length >= 4 ? 'line4' : 'line3';
    groups.push({
      color: s.color,
      cells: [...s.cells],
      shape,
      vertical: s.vertical,
      spawnAt: shape === 'line4' ? pickSpawn(s.cells, hints, segMid(s.cells)) : undefined,
    });
  });

  return groups;
}

/** 快速检查：经过 pos 的横/竖向是否存在 ≥3 同色（用于合法步判定，避免全盘扫描） */
export function hasMatchAt(grid: Grid, pos: Pos): boolean {
  const c = matchColorOf(grid[pos.y][pos.x]);
  if (c === null) return false;
  // 横
  let count = 1;
  for (let x = pos.x - 1; x >= 0 && matchColorOf(grid[pos.y][x]) === c; x--) count++;
  for (let x = pos.x + 1; x < SIZE && matchColorOf(grid[pos.y][x]) === c; x++) count++;
  if (count >= 3) return true;
  // 竖
  count = 1;
  for (let y = pos.y - 1; y >= 0 && matchColorOf(grid[y][pos.x]) === c; y--) count++;
  for (let y = pos.y + 1; y < SIZE && matchColorOf(grid[y][pos.x]) === c; y++) count++;
  return count >= 3;
}
