import { Grid, cloneGrid, emptyGrid, generateBoard, pieceAt } from './board';
import { findLegalSwaps, hasLegalMove, reshuffleMoves } from './deadlock';
import {
  applyGarbage,
  applyLocks,
  clearRandomCells,
  resolveSwap,
  tapLocked,
  type Ctx,
} from './resolver';
import { buildGroups } from './matcher';
import { mulberry32, type RNG } from './rng';
import { Piece, PieceKind, Pos, SIZE, StepEvent, SwapResult } from './types';

export interface EngineConfig {
  seed: number;
}

/**
 * 纯逻辑三消引擎门面。零 Phaser 依赖，全确定性：
 * 同种子 + 同操作序列 ⇒ 完全相同的事件流与棋盘状态。
 */
export class MatchEngine {
  private grid: Grid;
  private rng: RNG;
  private idCounter = 0;

  constructor(cfg: EngineConfig) {
    this.rng = mulberry32(cfg.seed);
    this.grid = emptyGrid();
    generateBoard(this.grid, this.rng, () => this.nextId());
    // 初始盘必须有合法步（生成规则已保证无天然三连）
    if (!hasLegalMove(this.grid)) {
      const shuffle = reshuffleMoves(this.grid, this.rng);
      void shuffle; // 初始洗牌无需对外发事件，init 前完成
    }
  }

  // 原型方法而非箭头属性：clone() 用 Object.create 绕过构造器，必须能从原型取到
  private nextId(): number {
    return ++this.idCounter;
  }

  private ctx(): Ctx {
    return { grid: this.grid, rng: this.rng, nextId: () => this.nextId() };
  }

  /** 渲染层初始化用。返回内部引用 —— 仅可读，勿在引擎外修改。 */
  getGrid(): Grid {
    return this.grid;
  }

  pieceAt(p: Pos): Piece | null {
    return pieceAt(this.grid, p);
  }

  trySwap(a: Pos, b: Pos): SwapResult {
    return resolveSwap(this.ctx(), a, b);
  }

  tapLocked(p: Pos): SwapResult {
    return tapLocked(this.ctx(), p);
  }

  applyGarbage(count: number): StepEvent[] {
    return applyGarbage(this.ctx(), count);
  }

  applyLocks(count: number, hits = 3): StepEvent[] {
    return applyLocks(this.ctx(), count, hits);
  }

  clearRandomCells(n: number): SwapResult {
    return clearRandomCells(this.ctx(), n);
  }

  findLegalSwaps(): { a: Pos; b: Pos }[] {
    return findLegalSwaps(this.grid);
  }

  hasLegalMove(): boolean {
    return hasLegalMove(this.grid);
  }

  findLockedCells(): Pos[] {
    const out: Pos[] = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const p = this.grid[y][x];
        if (p && p.lockHits > 0) out.push({ x, y });
      }
    }
    return out;
  }

  countGarbage(): number {
    let n = 0;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (this.grid[y][x]?.kind === PieceKind.Garbage) n++;
      }
    }
    return n;
  }

  /** bot 试算 / 联机校验用：深拷贝（含 rng 状态与 id 计数器），绝不影响本体 */
  clone(): MatchEngine {
    const c = Object.create(MatchEngine.prototype) as MatchEngine;
    c.grid = cloneGrid(this.grid);
    c.rng = mulberry32(this.rng.state());
    c.idCounter = this.idCounter;
    return c;
  }

  /** 调试 / 黄金快照用 */
  snapshot(): string {
    return JSON.stringify(this.grid);
  }

  /** 不变量自检（测试用）：稳定态应无待消匹配 */
  hasPendingMatches(): boolean {
    return buildGroups(this.grid).length > 0;
  }

  /** 测试用：直接替换棋盘（fixture 注入） */
  __setGridForTest(grid: Grid, idCounter: number): void {
    this.grid = grid;
    this.idCounter = idCounter;
  }
}
