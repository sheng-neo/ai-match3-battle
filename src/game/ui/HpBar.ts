import Phaser from 'phaser';
import { BATTLE, UI_FONT } from '../../config';

export class HpBar {
  readonly container: Phaser.GameObjects.Container;
  private fill: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private value: number;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    private width: number,
    private height: number,
    private color = 0x2cb67d,
    private max = BATTLE.maxHp,
  ) {
    this.value = this.max;
    const bg = scene.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0, 0.5);
    bg.setStrokeStyle(2, 0x2e2e3e, 1);
    this.fill = scene.add.rectangle(2, 0, width - 4, height - 6, color, 1).setOrigin(0, 0.5);
    this.label = scene.add
      .text(width / 2, 0, `${this.max}`, {
        fontFamily: UI_FONT,
        fontSize: `${Math.round(height * 0.72)}px`,
        color: '#fffffe',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.container = scene.add.container(x, y, [bg, this.fill, this.label]);
  }

  set(hp: number): void {
    const clamped = Math.max(0, Math.min(this.max, hp));
    const ratio = clamped / this.max;
    this.value = clamped;
    this.label.setText(`${clamped}`);
    this.scene.tweens.add({ targets: this.fill, displayWidth: Math.max(0.001, (this.width - 4) * ratio), duration: 220, ease: 'Quad.easeOut' });
    const low = ratio <= 0.3;
    this.fill.setFillStyle(low ? 0xe53170 : this.color, 1);
    if (low) {
      this.scene.tweens.add({ targets: this.fill, alpha: { from: 1, to: 0.6 }, yoyo: true, duration: 120, repeat: 2 });
    }
  }

  get(): number {
    return this.value;
  }
}
