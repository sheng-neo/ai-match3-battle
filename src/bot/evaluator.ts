import { swapCells } from '../engine/board';
import { MatchEngine } from '../engine/engine';
import { buildGroups } from '../engine/matcher';
import { classifyFusion, type FusionKind } from '../engine/specials';
import { Color, PieceKind, Pos, posKey } from '../engine/types';
import { DEFAULT_WEIGHTS, type CharWeights } from './botStyles';

export interface ScoredMove {
  a: Pos;
  b: Pos;
  score: number;
}

const FUSION_SCORE: Record<FusionKind, number> = {
  nuke: 60,
  colorDetonate: 45,
  colorClear: 30,
  bigCross: 28,
  fivexfive: 26,
  cross: 22,
};

const SHAPE_BONUS: Record<string, number> = { line3: 0, line4: 8, LT: 10, line5: 16 };

/**
 * 轻量评估：临时交换 → 检测匹配组打分 → 换回。
 * 不执行级联、不消耗 rng（级联收益视为噪声），~112 次评估 <1ms。
 * weights：角色打法风格（伤害流/特殊块流/本命色流/净化流）。
 */
export function scoreMoves(engine: MatchEngine, mainColor: Color, weights?: Partial<CharWeights>): ScoredMove[] {
  const w: CharWeights = { ...DEFAULT_WEIGHTS, ...(weights ?? {}) };
  const grid = engine.getGrid();
  const out: ScoredMove[] = [];

  for (const { a, b } of engine.findLegalSwaps()) {
    const pa = grid[a.y][a.x]!;
    const pb = grid[b.y][b.x]!;
    const fusion = classifyFusion(pa, pb);
    if (fusion) {
      out.push({ a, b, score: FUSION_SCORE[fusion] * w.special });
      continue;
    }

    swapCells(grid, a, b);
    const groups = buildGroups(grid, [b, a]);
    let score = 0;
    if (groups.length) {
      const cells = new Map<number, Pos>();
      for (const g of groups) {
        score += (SHAPE_BONUS[g.shape] ?? 0) * w.special;
        for (const c of g.cells) cells.set(posKey(c), c);
      }
      let mainCount = 0;
      let garbageAdj = 0;
      const garbageSeen = new Set<number>();
      for (const c of cells.values()) {
        const p = grid[c.y][c.x];
        if (p && p.color === mainColor) mainCount++;
        // 相邻脏数据净化收益
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = c.x + dx;
          const ny = c.y + dy;
          if (nx < 0 || nx > 7 || ny < 0 || ny > 7) continue;
          const np = grid[ny][nx];
          if (np && np.kind === PieceKind.Garbage && !garbageSeen.has(np.id)) {
            garbageSeen.add(np.id);
            garbageAdj++;
          }
        }
      }
      score += cells.size * w.damage + mainCount * 1.5 * w.main + garbageAdj * 4 * w.purify;
    }
    swapCells(grid, a, b); // 还原

    if (score > 0) out.push({ a, b, score });
  }

  out.sort((m, n) => n.score - m.score);
  return out;
}
