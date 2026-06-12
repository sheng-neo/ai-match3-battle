import Phaser from 'phaser';
import { GAME_H, GAME_W, UI_FONT } from '../../config';
import { ACHIEVEMENTS } from '../../meta/achievements';
import { loadProfile } from '../../meta/save';
import { sfx } from '../audio/sfx';

export class AchievementsScene extends Phaser.Scene {
  constructor() {
    super('Achievements');
  }

  create(): void {
    const profile = loadProfile();
    const unlocked = new Set(profile.achievements);

    this.add
      .text(GAME_W / 2, 90, '🏅 成就殿堂', { fontFamily: UI_FONT, fontSize: '52px', fontStyle: 'bold', color: '#fffffe' })
      .setOrigin(0.5);
    this.add
      .text(GAME_W / 2, 150, `已点亮 ${profile.achievements.length} / ${ACHIEVEMENTS.length}`, {
        fontFamily: UI_FONT,
        fontSize: '24px',
        color: '#a7a9be',
      })
      .setOrigin(0.5);

    // 两列网格
    const colX = [GAME_W / 2 - 172, GAME_W / 2 + 172];
    const startY = 230;
    const rowH = 88;
    ACHIEVEMENTS.forEach((a, i) => {
      const x = colX[i % 2];
      const y = startY + Math.floor(i / 2) * rowH;
      const got = unlocked.has(a.id);
      this.add
        .rectangle(x, y, 330, 76, got ? 0x2a2545 : 0x16161f, 1)
        .setStrokeStyle(2, got ? 0xffd803 : 0x2e2e3e, 1);
      this.add
        .text(x - 145, y, got ? a.emoji : '🔒', { fontSize: '30px' })
        .setOrigin(0.5)
        .setAlpha(got ? 1 : 0.55);
      this.add
        .text(x - 112, y - 16, a.name, {
          fontFamily: UI_FONT,
          fontSize: '21px',
          fontStyle: 'bold',
          color: got ? '#fffffe' : '#5e5c70',
        })
        .setOrigin(0, 0.5);
      this.add
        .text(x - 112, y + 16, a.desc, { fontFamily: UI_FONT, fontSize: '16px', color: got ? '#a7a9be' : '#44424f' })
        .setOrigin(0, 0.5);
    });

    const back = this.add
      .text(GAME_W / 2, GAME_H - 56, '← 返回主菜单', { fontFamily: UI_FONT, fontSize: '28px', color: '#a7a9be' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => {
      sfx.click();
      this.scene.start('Menu');
    });
  }
}
