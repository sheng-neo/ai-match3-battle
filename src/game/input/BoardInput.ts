import Phaser from 'phaser';
import { Pos, adjacent } from '../../engine/types';
import type { BoardView } from '../ui/BoardView';

export interface BoardInputOpts {
  onSwapIntent: (a: Pos, b: Pos) => void;
  onLockTap: (p: Pos) => void;
  isLocked: (p: Pos) => boolean;
  /** false 时忽略手势（动画中 / 对局结束） */
  canAct: () => boolean;
}

/**
 * 统一处理两种交换方式：滑动（偏移 > 0.35 格）与点选两下。
 * 点击锁格 = 解锁点击。全局监听，拖出棋盘也不丢事件。
 */
export class BoardInput {
  private downCell: Pos | null = null;
  private downX = 0;
  private downY = 0;
  private consumed = false;
  private selected: Pos | null = null;
  private marker: Phaser.GameObjects.Rectangle;

  constructor(
    private scene: Phaser.Scene,
    private view: BoardView,
    private opts: BoardInputOpts,
  ) {
    this.marker = scene.add
      .rectangle(0, 0, view.cell - 4, view.cell - 4)
      .setStrokeStyle(4, 0xfffffe, 0.95)
      .setFillStyle(0xffffff, 0.08)
      .setVisible(false);
    view.container.add(this.marker);

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off('pointerdown', this.onDown, this);
      scene.input.off('pointermove', this.onMove, this);
      scene.input.off('pointerup', this.onUp, this);
    });
  }

  clearSelection(): void {
    this.selected = null;
    this.marker.setVisible(false);
  }

  private showMarker(p: Pos): void {
    const { x, y } = this.view.cellXY(p);
    this.marker.setPosition(x, y).setVisible(true);
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    const cell = this.view.cellFromPoint(pointer.x, pointer.y);
    if (!cell) return;
    this.downCell = cell;
    this.downX = pointer.x;
    this.downY = pointer.y;
    this.consumed = false;
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (!this.downCell || this.consumed || !pointer.isDown) return;
    const dx = pointer.x - this.downX;
    const dy = pointer.y - this.downY;
    const threshold = this.view.cell * 0.35;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
    this.consumed = true;
    if (!this.opts.canAct()) return;
    const from = this.downCell;
    if (this.opts.isLocked(from)) {
      this.opts.onLockTap(from);
      this.clearSelection();
      return;
    }
    const dir =
      Math.abs(dx) > Math.abs(dy)
        ? { x: Math.sign(dx), y: 0 }
        : { x: 0, y: Math.sign(dy) };
    const to = { x: from.x + dir.x, y: from.y + dir.y };
    if (to.x < 0 || to.x > 7 || to.y < 0 || to.y > 7) return;
    this.clearSelection();
    this.opts.onSwapIntent(from, to);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    const down = this.downCell;
    this.downCell = null;
    if (!down || this.consumed) return;
    const cell = this.view.cellFromPoint(pointer.x, pointer.y);
    if (!cell || cell.x !== down.x || cell.y !== down.y) return; // 拖出后松手不算点选
    if (!this.opts.canAct()) return;

    if (this.opts.isLocked(cell)) {
      this.opts.onLockTap(cell);
      this.clearSelection();
      return;
    }
    if (this.selected) {
      if (this.selected.x === cell.x && this.selected.y === cell.y) {
        this.clearSelection();
        return;
      }
      if (adjacent(this.selected, cell)) {
        const a = this.selected;
        this.clearSelection();
        this.opts.onSwapIntent(a, cell);
        return;
      }
    }
    this.selected = cell;
    this.showMarker(cell);
  }
}
