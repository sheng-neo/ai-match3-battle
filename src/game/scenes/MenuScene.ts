import Phaser from 'phaser';
import { COLOR_EMOJI, DIFFICULTIES, GAME_H, GAME_W, UI_FONT } from '../../config';
import { sfx, unlockAudio } from '../audio/sfx';

function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  opts: { fontSize?: number; fill?: number; stroke?: number } = {},
): { container: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text } {
  const bg = scene.add
    .rectangle(0, 0, w, h, opts.fill ?? 0x1f1d33, 1)
    .setStrokeStyle(3, opts.stroke ?? 0x7f5af0, 1);
  const text = scene.add
    .text(0, 0, label, { fontFamily: UI_FONT, fontSize: `${opts.fontSize ?? 30}px`, color: '#fffffe', align: 'center' })
    .setOrigin(0.5);
  const container = scene.add.container(x, y, [bg, text]);
  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerdown', () => {
    unlockAudio();
    sfx.click();
    scene.tweens.add({ targets: container, scale: { from: 0.94, to: 1 }, duration: 120 });
    onClick();
  });
  return { container, bg, text };
}

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    if (!this.registry.has('difficulty')) this.registry.set('difficulty', 'normal');

    // 漂浮棋子背景
    for (let i = 0; i < 14; i++) {
      const x = Phaser.Math.Between(40, GAME_W - 40);
      const y = Phaser.Math.Between(120, GAME_H - 80);
      const img = this.add
        .image(x, y, `tile-${i % 6}`)
        .setDisplaySize(64, 64)
        .setAlpha(0.16)
        .setAngle(Phaser.Math.Between(-20, 20));
      this.tweens.add({
        targets: img,
        y: y - Phaser.Math.Between(20, 60),
        angle: img.angle + Phaser.Math.Between(-15, 15),
        duration: Phaser.Math.Between(2600, 4600),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    this.add
      .text(GAME_W / 2, 200, '🧠⚡ AI 大乱斗 🔮💾', { fontFamily: UI_FONT, fontSize: '40px', color: '#a7a9be' })
      .setOrigin(0.5);
    const title = this.add
      .text(GAME_W / 2, 300, '消消乐', {
        fontFamily: UI_FONT,
        fontSize: '120px',
        fontStyle: 'bold',
        color: '#fffffe',
        stroke: '#7f5af0',
        strokeThickness: 10,
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: title, scale: { from: 1, to: 1.04 }, yoyo: true, repeat: -1, duration: 1200, ease: 'Sine.easeInOut' });
    this.add
      .text(GAME_W / 2, 408, '消除 AI 资源 · 对战大模型 · 接受它的嘴炮锐评', {
        fontFamily: UI_FONT,
        fontSize: '26px',
        color: '#a7a9be',
      })
      .setOrigin(0.5);

    // 难度选择
    this.add
      .text(GAME_W / 2, 540, '— 选择对手参数量 —', { fontFamily: UI_FONT, fontSize: '28px', color: '#a7a9be' })
      .setOrigin(0.5);
    const buttons: Phaser.GameObjects.Rectangle[] = [];
    DIFFICULTIES.forEach((d, i) => {
      const y = 630 + i * 116;
      const { bg } = makeButton(
        this,
        GAME_W / 2,
        y,
        520,
        96,
        `${d.label}\n${d.desc}`,
        () => {
          this.registry.set('difficulty', d.id);
          refresh();
        },
        { fontSize: 26 },
      );
      bg.setData('diff', d.id);
      buttons.push(bg);
    });
    const refresh = (): void => {
      const cur = this.registry.get('difficulty') as string;
      for (const b of buttons) {
        const mine = b.getData('diff') === cur;
        b.setStrokeStyle(mine ? 5 : 3, mine ? 0xffd803 : 0x7f5af0, 1);
        b.setFillStyle(mine ? 0x2a2545 : 0x1f1d33, 1);
      }
    };
    refresh();

    makeButton(this, GAME_W / 2, 1110, 420, 110, '⚔️ 开始对战', () => this.scene.start('CharacterSelect'), {
      fontSize: 40,
      fill: 0x7f5af0,
      stroke: 0xfffffe,
    });

    this.add
      .text(GAME_W / 2, 1240, `${COLOR_EMOJI[0]}数据 ${COLOR_EMOJI[1]}算力 ${COLOR_EMOJI[2]}参数 ${COLOR_EMOJI[3]}能量 ${COLOR_EMOJI[4]}显存 ${COLOR_EMOJI[5]}Token`, {
        fontFamily: UI_FONT,
        fontSize: '24px',
        color: '#5e5c70',
      })
      .setOrigin(0.5);
  }
}
