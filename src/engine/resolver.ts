import { Grid, isSwappable, orthoNeighbors, swapCells } from './board';
import { buildGroups } from './matcher';
import { collapse } from './gravity';
import { hasLegalMove, reshuffleMoves } from './deadlock';
import {
  FusionKind,
  blastCells,
  cellsOfColor,
  classifyFusion,
  shapeToSpecial,
  singularityTargetColor,
} from './specials';
import type { RNG } from './rng';
import {
  ClearedPiece,
  Color,
  PieceKind,
  Pos,
  ResolveSummary,
  SIZE,
  Special,
  StepEvent,
  SwapResult,
  adjacent,
  newSummary,
  posKey,
} from './types';

export interface Ctx {
  grid: Grid;
  rng: RNG;
  nextId(): number;
}

interface SpawnPlan {
  at: Pos;
  special: Special;
  color: Color | null;
}

/**
 * 一波清除：以 seed 为起点，链式激活被波及的特殊块（BFS 去重），
 * 净化相邻脏数据，发 match 事件，从棋盘移除，再放置本波生成的特殊块。
 */
function clearWave(
  ctx: Ctx,
  seed: Pos[],
  combo: number,
  steps: StepEvent[],
  summary: ResolveSummary,
  opts: { spawnPlan?: SpawnPlan[]; noTrigger?: Set<number> } = {},
): number {
  const { grid } = ctx;
  const noTrigger = opts.noTrigger ?? new Set<number>();
  const cleared = new Map<number, ClearedPiece>();
  const queue: Pos[] = [];

  const addClear = (pos: Pos, byPurge = false): void => {
    const k = posKey(pos);
    if (cleared.has(k)) return;
    const piece = grid[pos.y][pos.x];
    if (!piece) return;
    if (piece.lockHits > 0) return; // 锁格免疫清除，只能点击解锁
    cleared.set(k, {
      pieceId: piece.id,
      at: pos,
      color: piece.color,
      special: piece.special,
      kind: piece.kind,
      byPurge,
    });
    if (piece.special !== Special.None && !noTrigger.has(k)) queue.push(pos);
  };

  for (const p of seed) addClear(p);

  // 链式激活
  while (queue.length) {
    const pos = queue.shift()!;
    const info = cleared.get(posKey(pos))!;
    const affected = blastCells(grid, pos, info.special, ctx.rng);
    summary.specialsTriggered.push(info.special);
    steps.push({ t: 'specialTrigger', source: pos, special: info.special, affected });
    for (const a of affected) addClear(a);
  }

  // 净化：与本波清除集合正交相邻的脏数据（单轮，不连锁传播）
  const snapshot = [...cleared.values()];
  for (const info of snapshot) {
    for (const n of orthoNeighbors(info.at)) {
      const p = grid[n.y][n.x];
      if (p && p.kind === PieceKind.Garbage && !cleared.has(posKey(n))) addClear(n, true);
    }
  }

  if (!cleared.size) return 0;

  const clearedList = [...cleared.values()];
  steps.push({ t: 'match', combo, cleared: clearedList });

  summary.totalCleared += clearedList.length;
  summary.maxCombo = Math.max(summary.maxCombo, combo);
  for (const info of clearedList) {
    if (info.kind === PieceKind.Garbage) {
      summary.garbagePurged++;
    } else if (info.color !== null) {
      summary.clearedByColor[info.color] = (summary.clearedByColor[info.color] ?? 0) + 1;
    }
  }

  // 移除
  for (const info of clearedList) grid[info.at.y][info.at.x] = null;

  // 放置本波生成的特殊块
  if (opts.spawnPlan) {
    const seen = new Set<number>();
    for (const sp of opts.spawnPlan) {
      const k = posKey(sp.at);
      if (seen.has(k)) continue;
      seen.add(k);
      const piece = {
        id: ctx.nextId(),
        kind: PieceKind.Normal,
        color: sp.color,
        special: sp.special,
        lockHits: 0,
      };
      grid[sp.at.y][sp.at.x] = piece;
      summary.specialsCreated.push(sp.special);
      steps.push({ t: 'spawnSpecial', at: sp.at, pieceId: piece.id, special: sp.special, color: sp.color });
    }
  }

  return clearedList.length;
}

/** 由匹配组驱动的一波：先算生成计划，再清除 */
function processGroups(
  ctx: Ctx,
  groups: ReturnType<typeof buildGroups>,
  combo: number,
  steps: StepEvent[],
  summary: ResolveSummary,
): void {
  const spawnPlan: SpawnPlan[] = [];
  const seedMap = new Map<number, Pos>();
  for (const g of groups) {
    for (const c of g.cells) seedMap.set(posKey(c), c);
    if (g.shape !== 'line3' && g.spawnAt) {
      const special = shapeToSpecial(g.shape, g.vertical);
      spawnPlan.push({
        at: g.spawnAt,
        special,
        color: special === Special.Singularity ? null : g.color,
      });
    }
  }
  clearWave(ctx, [...seedMap.values()], combo, steps, summary, { spawnPlan });
}

/** 匹配级联循环：detect → wave → collapse，直到无匹配。返回最终 combo 计数。 */
function cascade(
  ctx: Ctx,
  startCombo: number,
  steps: StepEvent[],
  summary: ResolveSummary,
  firstHints: Pos[] = [],
): number {
  let combo = startCombo;
  for (;;) {
    const groups = buildGroups(ctx.grid, combo === startCombo ? firstHints : []);
    if (!groups.length) break;
    processGroups(ctx, groups, combo, steps, summary);
    collapse(ctx.grid, ctx.rng, ctx.nextId, steps);
    combo++;
  }
  return combo;
}

/**
 * 收尾保险：洗牌可能引入天然三连（放宽模式），级联清掉；清完可能又死局……
 * 循环直到「无匹配且有合法步」或达到保护上限。
 */
export function stabilize(ctx: Ctx, steps: StepEvent[], summary: ResolveSummary): void {
  for (let guard = 0; guard < 12; guard++) {
    if (buildGroups(ctx.grid).length) {
      cascade(ctx, Math.max(1, summary.maxCombo + 1), steps, summary);
      continue;
    }
    if (!hasLegalMove(ctx.grid)) {
      const shuffle = reshuffleMoves(ctx.grid, ctx.rng);
      if (!shuffle) break; // 没有可洗的棋子，放弃（极端局面，等计时结束）
      steps.push(shuffle);
      continue;
    }
    break;
  }
}

/** fusion：发对应视觉触发事件并返回 seed 集（含两个源棋子位置） */
function fusionSeed(
  ctx: Ctx,
  kind: FusionKind,
  a: Pos,
  b: Pos,
  steps: StepEvent[],
  summary: ResolveSummary,
): { seed: Pos[]; noTrigger: Set<number> } {
  const { grid } = ctx;
  const seedMap = new Map<number, Pos>();
  const add = (p: Pos) => seedMap.set(posKey(p), p);
  add(a);
  add(b);
  const emit = (source: Pos, special: Special, affected: Pos[]) => {
    summary.specialsTriggered.push(special);
    steps.push({ t: 'specialTrigger', source, special, affected });
    for (const p of affected) add(p);
  };
  const rowCells = (y: number): Pos[] => {
    const out: Pos[] = [];
    if (y < 0 || y >= SIZE) return out;
    for (let x = 0; x < SIZE; x++) out.push({ x, y });
    return out;
  };
  const colCells = (x: number): Pos[] => {
    const out: Pos[] = [];
    if (x < 0 || x >= SIZE) return out;
    for (let y = 0; y < SIZE; y++) out.push({ x, y });
    return out;
  };

  switch (kind) {
    case 'cross':
      emit(b, Special.RowLaser, rowCells(b.y));
      emit(b, Special.ColLaser, colCells(b.x));
      break;
    case 'bigCross':
      for (let d = -1; d <= 1; d++) emit({ x: b.x, y: b.y + d }, Special.RowLaser, rowCells(b.y + d));
      for (let d = -1; d <= 1; d++) emit({ x: b.x + d, y: b.y }, Special.ColLaser, colCells(b.x + d));
      break;
    case 'fivexfive': {
      const cells: Pos[] = [];
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const x = b.x + dx;
          const y = b.y + dy;
          if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) cells.push({ x, y });
        }
      }
      emit(b, Special.Kernel, cells);
      break;
    }
    case 'colorClear': {
      const pa = grid[a.y][a.x];
      const pb = grid[b.y][b.x];
      const normal = pa && pa.special === Special.Singularity ? pb : pa;
      const color = normal?.color ?? singularityTargetColor(grid, ctx.rng);
      const affected = color === null ? [] : cellsOfColor(grid, color);
      emit(b, Special.Singularity, affected);
      break;
    }
    case 'colorDetonate': {
      const pa = grid[a.y][a.x];
      const pb = grid[b.y][b.x];
      const other = pa && pa.special === Special.Singularity ? pb : pa;
      const otherSpecial = other && other.special !== Special.None ? other.special : Special.Kernel;
      const color = singularityTargetColor(grid, ctx.rng);
      const affected = color === null ? [] : cellsOfColor(grid, color);
      emit(b, Special.Singularity, affected);
      // 前 12 个目标格按 other 的特殊类型逐格引爆（扫描序，确定性）
      const detonateSpecial = otherSpecial === Special.Singularity ? Special.Kernel : otherSpecial;
      for (const cell of affected.slice(0, 12)) {
        emit(cell, detonateSpecial, blastCells(grid, cell, detonateSpecial, ctx.rng));
      }
      break;
    }
    case 'nuke': {
      const cells: Pos[] = [];
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) cells.push({ x, y });
      emit(b, Special.Singularity, cells);
      break;
    }
  }
  // 两个源棋子已被 fusion 消耗，clearWave 中不再各自二次激活
  return { seed: [...seedMap.values()], noTrigger: new Set([posKey(a), posKey(b)]) };
}

export function resolveSwap(ctx: Ctx, a: Pos, b: Pos): SwapResult {
  const steps: StepEvent[] = [];
  const summary = newSummary();
  const { grid } = ctx;

  const pa = grid[a.y]?.[a.x];
  const pb = grid[b.y]?.[b.x];
  if (!adjacent(a, b) || !isSwappable(pa ?? null) || !isSwappable(pb ?? null)) {
    summary.valid = false;
    return { summary, steps };
  }

  const fusion = classifyFusion(pa!, pb!);
  swapCells(grid, a, b);
  steps.push({ t: 'swap', a, b, revert: false });

  if (fusion) {
    summary.fusion = true;
    const { seed, noTrigger } = fusionSeed(ctx, fusion, a, b, steps, summary);
    clearWave(ctx, seed, 1, steps, summary, { noTrigger });
    collapse(grid, ctx.rng, ctx.nextId, steps);
    cascade(ctx, 2, steps, summary);
  } else {
    const groups = buildGroups(grid, [b, a]);
    if (!groups.length) {
      swapCells(grid, a, b);
      steps.push({ t: 'swap', a, b, revert: true });
      summary.valid = false;
      return { summary, steps };
    }
    cascade(ctx, 1, steps, summary, [b, a]);
  }

  stabilize(ctx, steps, summary);
  return { summary, steps };
}

/** 技能用：清除指定格子（可命中特殊块并触发连锁），用于"引爆底部两行"类大招 */
export function clearGivenCells(ctx: Ctx, cells: Pos[]): SwapResult {
  const steps: StepEvent[] = [];
  const summary = newSummary();
  const seed = cells.filter((p) => {
    const piece = ctx.grid[p.y]?.[p.x];
    return !!piece && piece.lockHits === 0;
  });
  if (!seed.length) {
    summary.valid = false;
    return { summary, steps };
  }
  clearWave(ctx, seed, 1, steps, summary, {});
  collapse(ctx.grid, ctx.rng, ctx.nextId, steps);
  cascade(ctx, 2, steps, summary);
  stabilize(ctx, steps, summary);
  return { summary, steps };
}

/** 干扰/技能：随机改写 n 个普通棋子的颜色（保证变色），可能引发级联由 stabilize 收尾 */
export function scrambleColors(ctx: Ctx, count: number): StepEvent[] {
  const steps: StepEvent[] = [];
  const eligible: Pos[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const p = ctx.grid[y][x];
      if (p && p.kind === PieceKind.Normal && p.lockHits === 0 && p.special === Special.None && p.color !== null) {
        eligible.push({ x, y });
      }
    }
  }
  const n = Math.min(count, eligible.length);
  if (!n) return steps;
  const cells: { at: Pos; pieceId: number; color: Color }[] = [];
  for (let i = 0; i < n; i++) {
    const j = i + ctx.rng.nextInt(eligible.length - i);
    const tmp = eligible[i];
    eligible[i] = eligible[j];
    eligible[j] = tmp;
    const at = eligible[i];
    const piece = ctx.grid[at.y][at.x]!;
    const old = piece.color as number;
    const next = ((old + 1 + ctx.rng.nextInt(5)) % 6) as Color;
    piece.color = next;
    cells.push({ at, pieceId: piece.id, color: next });
  }
  steps.push({ t: 'recolor', cells });
  const summary = newSummary();
  stabilize(ctx, steps, summary);
  return steps;
}

/** 技能：把随机普通棋子原地升格为特殊块（颜色不变，不会引发匹配） */
export function promoteSpecials(ctx: Ctx, specs: Special[]): StepEvent[] {
  const steps: StepEvent[] = [];
  const eligible: Pos[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const p = ctx.grid[y][x];
      if (p && p.kind === PieceKind.Normal && p.lockHits === 0 && p.special === Special.None && p.color !== null) {
        eligible.push({ x, y });
      }
    }
  }
  const n = Math.min(specs.length, eligible.length);
  if (!n) return steps;
  const cells: { at: Pos; pieceId: number; special: Special }[] = [];
  for (let i = 0; i < n; i++) {
    const j = i + ctx.rng.nextInt(eligible.length - i);
    const tmp = eligible[i];
    eligible[i] = eligible[j];
    eligible[j] = tmp;
    const at = eligible[i];
    const piece = ctx.grid[at.y][at.x]!;
    // 奇点为无色棋子，升格仅支持激光/卷积核，避免色彩语义冲突
    const spec = specs[i] === Special.Singularity ? Special.Kernel : specs[i];
    piece.special = spec;
    cells.push({ at, pieceId: piece.id, special: spec });
  }
  steps.push({ t: 'promote', cells });
  return steps;
}

/** 技能用：随机清除 n 个未锁棋子（可命中特殊块并触发连锁） */
export function clearRandomCells(ctx: Ctx, n: number): SwapResult {
  const steps: StepEvent[] = [];
  const summary = newSummary();
  const candidates: Pos[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const p = ctx.grid[y][x];
      if (p && p.lockHits === 0) candidates.push({ x, y });
    }
  }
  if (!candidates.length) {
    summary.valid = false;
    return { summary, steps };
  }
  // 部分 Fisher–Yates 取前 n 个
  const picked: Pos[] = [];
  const pool = [...candidates];
  const count = Math.min(n, pool.length);
  for (let i = 0; i < count; i++) {
    const j = i + ctx.rng.nextInt(pool.length - i);
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
    picked.push(pool[i]);
  }
  clearWave(ctx, picked, 1, steps, summary, {});
  collapse(ctx.grid, ctx.rng, ctx.nextId, steps);
  cascade(ctx, 2, steps, summary);
  stabilize(ctx, steps, summary);
  return { summary, steps };
}

/** 受击：注入脏数据（替换随机普通棋子） */
export function applyGarbage(ctx: Ctx, count: number): StepEvent[] {
  const steps: StepEvent[] = [];
  const eligible: Pos[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const p = ctx.grid[y][x];
      if (p && p.kind === PieceKind.Normal && p.lockHits === 0 && p.special === Special.None) {
        eligible.push({ x, y });
      }
    }
  }
  const n = Math.min(count, eligible.length);
  if (!n) return steps;
  const cells: { at: Pos; pieceId: number; replacedId: number }[] = [];
  for (let i = 0; i < n; i++) {
    const j = i + ctx.rng.nextInt(eligible.length - i);
    const tmp = eligible[i];
    eligible[i] = eligible[j];
    eligible[j] = tmp;
    const at = eligible[i];
    const old = ctx.grid[at.y][at.x]!;
    const piece = { id: ctx.nextId(), kind: PieceKind.Garbage, color: null, special: Special.None, lockHits: 0 };
    ctx.grid[at.y][at.x] = piece;
    cells.push({ at, pieceId: piece.id, replacedId: old.id });
  }
  steps.push({ t: 'garbageAdd', cells });
  const summary = newSummary();
  stabilize(ctx, steps, summary);
  return steps;
}

/** 受击：验证码锁格（锁随机普通棋子，需连点 hits 次解锁） */
export function applyLocks(ctx: Ctx, count: number, hits: number): StepEvent[] {
  const steps: StepEvent[] = [];
  const eligible: Pos[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const p = ctx.grid[y][x];
      if (p && p.kind === PieceKind.Normal && p.lockHits === 0 && p.special === Special.None) {
        eligible.push({ x, y });
      }
    }
  }
  const n = Math.min(count, eligible.length);
  if (!n) return steps;
  const cells: { at: Pos; pieceId: number; hits: number }[] = [];
  for (let i = 0; i < n; i++) {
    const j = i + ctx.rng.nextInt(eligible.length - i);
    const tmp = eligible[i];
    eligible[i] = eligible[j];
    eligible[j] = tmp;
    const at = eligible[i];
    const piece = ctx.grid[at.y][at.x]!;
    piece.lockHits = hits;
    cells.push({ at, pieceId: piece.id, hits });
  }
  steps.push({ t: 'lockAdd', cells });
  const summary = newSummary();
  stabilize(ctx, steps, summary);
  return steps;
}

/** 点击锁格。解锁完成可能即刻形成三连，按级联结算（返回 summary 供对战层计伤/充能）。 */
export function tapLocked(ctx: Ctx, p: Pos): SwapResult {
  const steps: StepEvent[] = [];
  const summary = newSummary();
  const piece = ctx.grid[p.y]?.[p.x];
  if (!piece || piece.lockHits <= 0) {
    summary.valid = false;
    return { summary, steps };
  }
  piece.lockHits--;
  steps.push({ t: 'lockHit', at: p, pieceId: piece.id, remaining: piece.lockHits });
  if (piece.lockHits === 0) stabilize(ctx, steps, summary);
  return { summary, steps };
}
