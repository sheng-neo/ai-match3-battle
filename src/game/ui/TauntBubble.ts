import Phaser from 'phaser';
import { TAUNT, UI_FONT } from '../../config';

/**
 * 对手嘴炮气泡：打字机逐字显示，自动淡出。
 * source='ai' 时带 ✨ 标记（真·大模型即兴锐评）。
 */
export class TauntBubble {
  readonly container: Phaser.GameObjects.Container;
  private g: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private badge: Phaser.GameObjects.Text;
  private typeTimer?: Phaser.Time.TimerEvent;
  private hideTimer?: Phaser.Time.TimerEvent;
  private readonly width: number;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    width = 400,
  ) {
    this.width = width;
    this.g = scene.add.graphics();
    this.text = scene.add.text(16, 12, '', {
      fontFamily: UI_FONT,
      fontSize: '26px',
      color: '#0f0e17',
      // useAdvancedWrap：中文无空格必须按字符断行，否则整句溢出
      wordWrap: { width: width - 32, useAdvancedWrap: true },
      lineSpacing: 6,
    });
    this.badge = scene.add
      .text(width - 10, -10, '✨AI', {
        fontFamily: UI_FONT,
        fontSize: '18px',
        color: '#7f5af0',
        backgroundColor: '#fffffe',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(1, 0.5)
      .setVisible(false);
    this.container = scene.add.container(x, y, [this.g, this.text, this.badge]);
    this.container.setVisible(false).setDepth(50);
  }

  show(line: string, source: 'ai' | 'fallback'): void {
    if (!line) return;
    this.typeTimer?.remove();
    this.hideTimer?.remove();
    this.scene.tweens.killTweensOf(this.container);

    this.badge.setVisible(source === 'ai');
    // 自适应：先按默认字号排版，过高则逐级缩小，仍超高则截断兜底
    let fontSize = 26;
    this.text.setFontSize(fontSize);
    this.text.setText(line);
    while (this.text.getBounds().height > 150 && fontSize > 20) {
      fontSize -= 2;
      this.text.setFontSize(fontSize);
    }
    if (this.text.getBounds().height > 170) {
      this.text.setText([...line].slice(0, 52).join('') + '…');
    }
    const bounds = this.text.getBounds();
    const h = Math.max(54, bounds.height + 24);
    this.g.clear();
    this.g.fillStyle(0xfffffe, 0.96);
    this.g.fillRoundedRect(0, 0, this.width, h, 14);
    // 指向头像的小三角
    this.g.fillTriangle(26, 0, 50, 0, 30, -14);
    this.g.lineStyle(2, 0x7f5af0, 0.6);
    this.g.strokeRoundedRect(0, 0, this.width, h, 14);

    this.container.setVisible(true).setAlpha(0).setScale(0.92);
    this.scene.tweens.add({ targets: this.container, alpha: 1, scale: 1, duration: 140, ease: 'Back.easeOut' });

    // 打字机
    const chars = [...line];
    let i = 0;
    this.text.setText('');
    this.typeTimer = this.scene.time.addEvent({
      delay: 1000 / TAUNT.typewriterCps,
      repeat: chars.length - 1,
      callback: () => {
        i++;
        this.text.setText(chars.slice(0, i).join(''));
      },
    });

    this.hideTimer = this.scene.time.delayedCall(TAUNT.bubbleMs + chars.length * (1000 / TAUNT.typewriterCps), () => {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: 240,
        onComplete: () => this.container.setVisible(false),
      });
    });
  }
}
