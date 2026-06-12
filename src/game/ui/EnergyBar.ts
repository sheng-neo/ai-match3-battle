import Phaser from 'phaser';
import { BATTLE, UI_FONT } from '../../config';

export class EnergyBar {
  readonly container: Phaser.GameObjects.Container;
  private fill: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private glow: Phaser.GameObjects.Rectangle;
  private full = false;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    private width: number,
    private height: number,
  ) {
    const bg = scene.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0, 0.5);
    bg.setStrokeStyle(2, 0x2e2e3e, 1);
    this.glow = scene.add
      .rectangle(-4, 0, width + 8, height + 8, 0x7f5af0, 0.0)
      .setOrigin(0, 0.5)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.fill = scene.add.rectangle(2, 0, 0.001, height - 6, 0x7f5af0, 1).setOrigin(0, 0.5);
    this.label = scene.add
      .text(width / 2, 0, '能量 0%', {
        fontFamily: UI_FONT,
        fontSize: `${Math.round(height * 0.6)}px`,
        color: '#fffffe',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.container = scene.add.container(x, y, [this.glow, bg, this.fill, this.label]);
  }

  set(energy: number): void {
    const ratio = Math.max(0, Math.min(1, energy / BATTLE.energyMax));
    this.scene.tweens.add({ targets: this.fill, displayWidth: Math.max(0.001, (this.width - 4) * ratio), duration: 200, ease: 'Quad.easeOut' });
    this.label.setText(ratio >= 1 ? '⚡ 能量满！点大招' : `能量 ${Math.round(ratio * 100)}%`);
    const nowFull = ratio >= 1;
    if (nowFull && !this.full) {
      this.scene.tweens.add({ targets: this.glow, alpha: { from: 0.5, to: 0.1 }, yoyo: true, repeat: -1, duration: 500 });
    } else if (!nowFull && this.full) {
      this.scene.tweens.killTweensOf(this.glow);
      this.glow.setAlpha(0);
    }
    this.full = nowFull;
  }
}
