import Phaser from 'phaser';
import type { Grid } from '../../engine/board';
import { PieceKind, Pos, SIZE, Special } from '../../engine/types';
import { COLOR_HEX } from '../../config';

export interface PieceLike {
  id: number;
  kind: PieceKind;
  color: number | null;
  special: Special;
  lockHits: number;
}

/** 单个棋子的显示对象组：底块 + 特殊覆盖层 + 锁层 */
export class PieceView {
  root: Phaser.GameObjects.Container;
  tile: Phaser.GameObjects.Image;
  overlay: Phaser.GameObjects.Image;
  lock: Phaser.GameObjects.Image;
  pieceId = -1;

  constructor(scene: Phaser.Scene, displaySize: number) {
    this.tile = scene.add.image(0, 0, 'tile-0').setDisplaySize(displaySize, displaySize);
    this.overlay = scene.add.image(0, 0, 'ov-row').setDisplaySize(displaySize, displaySize).setVisible(false);
    this.lock = scene.add.image(0, 0, 'ov-lock3').setDisplaySize(displaySize, displaySize).setVisible(false);
    this.root = scene.add.container(0, 0, [this.tile, this.overlay, this.lock]);
  }

  apply(piece: PieceLike): void {
    this.pieceId = piece.id;
    if (piece.kind === PieceKind.Garbage) {
      this.tile.setTexture('tile-garbage');
      this.overlay.setVisible(false);
    } else if (piece.special === Special.Singularity) {
      this.tile.setTexture('tile-sing');
      this.overlay.setVisible(false);
    } else {
      this.tile.setTexture(`tile-${piece.color ?? 0}`);
      if (piece.special === Special.RowLaser) this.overlay.setTexture('ov-row').setVisible(true);
      else if (piece.special === Special.ColLaser) this.overlay.setTexture('ov-col').setVisible(true);
      else if (piece.special === Special.Kernel) this.overlay.setTexture('ov-kernel').setVisible(true);
      else this.overlay.setVisible(false);
    }
    this.setLock(piece.lockHits);
  }

  setLock(hits: number): void {
    if (hits > 0) {
      this.lock.setTexture(`ov-lock${Math.min(3, Math.max(1, hits))}`).setVisible(true);
    } else {
      this.lock.setVisible(false);
    }
  }

  reset(): void {
    this.root.setScale(1).setAlpha(1).setAngle(0).setVisible(true);
  }
}

export interface BoardViewOpts {
  x: number;
  y: number;
  cell: number;
  mini?: boolean;
}

/**
 * 棋盘渲染：维护 pieceId→sprite 与格子索引（由 StepPlayer 按事件驱动更新）。
 */
export class BoardView {
  readonly container: Phaser.GameObjects.Container;
  readonly opts: BoardViewOpts;
  private sprites = new Map<number, PieceView>();
  private index: (number | null)[][];
  private pool: PieceView[] = [];
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private burstTint = 0xffffff;

  constructor(
    private scene: Phaser.Scene,
    opts: BoardViewOpts,
  ) {
    this.opts = opts;
    this.index = Array.from({ length: SIZE }, () => Array<number | null>(SIZE).fill(null));
    this.container = scene.add.container(opts.x, opts.y);

    // 背板 + 网格
    const g = scene.add.graphics();
    const w = opts.cell * SIZE;
    g.fillStyle(0x16161f, 0.92);
    g.fillRoundedRect(-6, -6, w + 12, w + 12, 14);
    g.lineStyle(2, 0x2e2e3e, 1);
    g.strokeRoundedRect(-6, -6, w + 12, w + 12, 14);
    g.lineStyle(1, 0x232331, 1);
    for (let i = 1; i < SIZE; i++) {
      g.lineBetween(i * opts.cell, 0, i * opts.cell, w);
      g.lineBetween(0, i * opts.cell, w, i * opts.cell);
    }
    this.container.add(g);

    if (!opts.mini) {
      this.emitter = scene.add.particles(0, 0, 'spark', {
        speed: { min: 70, max: 260 },
        scale: { start: 0.9, end: 0 },
        lifespan: 380,
        gravityY: 700,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
        tint: { onEmit: () => this.burstTint },
      });
      this.container.add(this.emitter);
    }
  }

  get cell(): number {
    return this.opts.cell;
  }

  cellXY(p: Pos): { x: number; y: number } {
    return { x: p.x * this.opts.cell + this.opts.cell / 2, y: p.y * this.opts.cell + this.opts.cell / 2 };
  }

  /** 游戏坐标 → 格子坐标（出界返回 null） */
  cellFromPoint(gx: number, gy: number): Pos | null {
    const lx = gx - this.opts.x;
    const ly = gy - this.opts.y;
    const x = Math.floor(lx / this.opts.cell);
    const y = Math.floor(ly / this.opts.cell);
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return null;
    return { x, y };
  }

  init(grid: Grid): void {
    for (const pv of this.sprites.values()) this.releaseView(pv);
    this.sprites.clear();
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        this.index[y][x] = null;
        const piece = grid[y][x];
        if (piece) this.addPiece(piece, { x, y });
      }
    }
  }

  private acquire(): PieceView {
    const pv = this.pool.pop();
    if (pv) {
      pv.reset();
      return pv;
    }
    const fresh = new PieceView(this.scene, this.opts.cell - 6);
    this.container.add(fresh.root);
    return fresh;
  }

  private releaseView(pv: PieceView): void {
    pv.root.setVisible(false);
    this.pool.push(pv);
  }

  addPiece(piece: PieceLike, pos: Pos): PieceView {
    const pv = this.acquire();
    pv.apply(piece);
    const { x, y } = this.cellXY(pos);
    pv.root.setPosition(x, y);
    this.sprites.set(piece.id, pv);
    this.index[pos.y][pos.x] = piece.id;
    return pv;
  }

  removePiece(pieceId: number): void {
    const pv = this.sprites.get(pieceId);
    if (!pv) return;
    this.sprites.delete(pieceId);
    this.releaseView(pv);
  }

  spriteOf(pieceId: number): PieceView | undefined {
    return this.sprites.get(pieceId);
  }

  pieceIdAt(p: Pos): number | null {
    return this.index[p.y][p.x];
  }

  setIndex(p: Pos, id: number | null): void {
    this.index[p.y][p.x] = id;
  }

  burst(pos: Pos, tint: number, count: number): void {
    if (!this.emitter) return;
    this.burstTint = tint;
    const { x, y } = this.cellXY(pos);
    this.emitter.explode(count, x, y);
  }

  burstColor(pos: Pos, color: number | null, count: number): void {
    this.burst(pos, color !== null ? (COLOR_HEX[color] ?? 0xffffff) : 0xffffff, count);
  }
}
