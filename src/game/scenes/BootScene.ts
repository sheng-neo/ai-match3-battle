import Phaser from 'phaser';
import { GAME_H, GAME_W, UI_FONT } from '../../config';
import { bakeAllTextures } from '../textures/emojiTextures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const hint = this.add
      .text(GAME_W / 2, GAME_H / 2, '模型加载中…', {
        fontFamily: UI_FONT,
        fontSize: '32px',
        color: '#a7a9be',
      })
      .setOrigin(0.5);

    const ready: Promise<unknown> =
      typeof document !== 'undefined' && document.fonts ? document.fonts.ready : Promise.resolve();
    void ready.then(() => {
      // emoji 只在这里被栅格化一次，之后全游戏只认纹理 key
      bakeAllTextures(this);
      hint.destroy();
      this.scene.start('Menu');
    });
  }
}
