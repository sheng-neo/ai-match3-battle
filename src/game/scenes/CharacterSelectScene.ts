import Phaser from 'phaser';
import { CHARACTERS, otherCharacters } from '../../battle/characters';
import { GAME_H, GAME_W, UI_FONT } from '../../config';
import { sfx } from '../audio/sfx';

export class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super('CharacterSelect');
  }

  create(): void {
    this.add
      .text(GAME_W / 2, 110, '选择你的出战模型', {
        fontFamily: UI_FONT,
        fontSize: '52px',
        fontStyle: 'bold',
        color: '#fffffe',
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_W / 2, 170, '对手将从其余模型中随机迎战', { fontFamily: UI_FONT, fontSize: '24px', color: '#a7a9be' })
      .setOrigin(0.5);

    CHARACTERS.forEach((c, i) => {
      const y = 330 + i * 300;
      const card = this.add.container(GAME_W / 2, y);
      const bg = this.add.rectangle(0, 0, 640, 264, 0x1f1d33, 1).setStrokeStyle(3, 0x7f5af0, 1);
      const avatar = this.add.image(-240, -40, `avatar-${c.id}`).setDisplaySize(120, 120);
      const name = this.add
        .text(-150, -92, `${c.name}`, { fontFamily: UI_FONT, fontSize: '34px', fontStyle: 'bold', color: '#fffffe' })
        .setOrigin(0, 0.5);
      const title = this.add
        .text(-150, -52, `${c.title} · ${c.flavor}`, {
          fontFamily: UI_FONT,
          fontSize: '20px',
          color: '#a7a9be',
          wordWrap: { width: 440 },
        })
        .setOrigin(0, 0.5);
      const passive = this.add
        .text(-290, 16, c.passiveDesc, { fontFamily: UI_FONT, fontSize: '23px', color: '#2cb67d', wordWrap: { width: 580 } })
        .setOrigin(0, 0.5);
      const ult = this.add
        .text(-290, 76, `大招「${c.ultName}」：${c.ultDesc}`, {
          fontFamily: UI_FONT,
          fontSize: '23px',
          color: '#ffd803',
          wordWrap: { width: 580 },
        })
        .setOrigin(0, 0.5);
      card.add([bg, avatar, name, title, passive, ult]);

      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setFillStyle(0x2a2545, 1));
      bg.on('pointerout', () => bg.setFillStyle(0x1f1d33, 1));
      bg.on('pointerdown', () => {
        sfx.click();
        const others = otherCharacters(c.id);
        const opp = others[Math.floor(Math.random() * others.length)];
        this.registry.set('myChar', c.id);
        this.registry.set('oppChar', opp.id);
        this.showVs(c.emoji, opp.emoji, () => this.scene.start('Battle'));
      });
    });

    const back = this.add
      .text(GAME_W / 2, GAME_H - 70, '← 返回', { fontFamily: UI_FONT, fontSize: '28px', color: '#a7a9be' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('Menu'));
  }

  private showVs(me: string, opp: string, done: () => void): void {
    const veil = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0f0e17, 0.92).setDepth(90);
    const t = this.add
      .text(GAME_W / 2, GAME_H / 2, `${me}  VS  ${opp}`, {
        fontFamily: UI_FONT,
        fontSize: '90px',
        fontStyle: 'bold',
        color: '#fffffe',
      })
      .setOrigin(0.5)
      .setDepth(91)
      .setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 280, ease: 'Back.easeOut' });
    sfx.ult();
    this.time.delayedCall(900, () => {
      veil.destroy();
      t.destroy();
      done();
    });
  }
}
