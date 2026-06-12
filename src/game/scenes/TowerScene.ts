import Phaser from 'phaser';
import { charById } from '../../battle/characters';
import { GAME_H, GAME_W, UI_FONT } from '../../config';
import { loadProfile } from '../../meta/save';
import { TOWER_MAX, floorConfig } from '../../meta/tower';
import type { FlowState } from '../flow';
import { sfx } from '../audio/sfx';

export class TowerScene extends Phaser.Scene {
  constructor() {
    super('Tower');
  }

  create(): void {
    const profile = loadProfile();
    const floor = Math.min(profile.towerFloor, TOWER_MAX);
    const cfg = floorConfig(floor);
    const opp = charById(cfg.oppChar);
    const cleared = profile.towerBest >= TOWER_MAX;

    this.add
      .text(GAME_W / 2, 110, '🗼 通天塔', { fontFamily: UI_FONT, fontSize: '60px', fontStyle: 'bold', color: '#fffffe' })
      .setOrigin(0.5);
    this.add
      .text(GAME_W / 2, 178, cleared ? '你已登顶！仍可继续挑战巅峰层' : '一百层，一层一个大模型', {
        fontFamily: UI_FONT,
        fontSize: '24px',
        color: '#a7a9be',
      })
      .setOrigin(0.5);

    // 进度条
    const barW = 560;
    this.add.rectangle(GAME_W / 2, 240, barW, 18, 0x000000, 0.6).setStrokeStyle(2, 0x2e2e3e, 1);
    const ratio = Math.min(1, profile.towerBest / TOWER_MAX);
    this.add
      .rectangle(GAME_W / 2 - barW / 2 + 2, 240, Math.max(0.001, (barW - 4) * ratio), 12, 0x7f5af0, 1)
      .setOrigin(0, 0.5);
    this.add
      .text(GAME_W / 2, 274, `最高通过：第 ${profile.towerBest} 层`, { fontFamily: UI_FONT, fontSize: '20px', color: '#5e5c70' })
      .setOrigin(0.5);

    // 本层信息卡
    const cardY = 470;
    this.add
      .rectangle(GAME_W / 2, cardY, 640, 320, 0x1f1d33, 1)
      .setStrokeStyle(4, cfg.isBoss ? 0xe53170 : 0x7f5af0, 1);
    this.add
      .text(GAME_W / 2, cardY - 128, cfg.isBoss ? `👑 第 ${floor} 层 · BOSS` : `第 ${floor} 层`, {
        fontFamily: UI_FONT,
        fontSize: '42px',
        fontStyle: 'bold',
        color: cfg.isBoss ? '#e53170' : '#fffffe',
      })
      .setOrigin(0.5);
    this.add.image(GAME_W / 2 - 220, cardY - 20, `avatar-${opp.id}`).setDisplaySize(110, 110);
    this.add
      .text(GAME_W / 2 - 140, cardY - 48, opp.name, { fontFamily: UI_FONT, fontSize: '30px', fontStyle: 'bold', color: '#fffffe' })
      .setOrigin(0, 0.5);
    this.add
      .text(GAME_W / 2 - 140, cardY - 10, `${cfg.difficulty.label} · 手速 ×${(1 / cfg.intervalMul).toFixed(2)}`, {
        fontFamily: UI_FONT,
        fontSize: '22px',
        color: '#a7a9be',
      })
      .setOrigin(0, 0.5);
    const rules = cfg.rules.length ? cfg.rules : ['标准规则，放心开打'];
    rules.slice(0, 3).forEach((r, i) => {
      this.add
        .text(GAME_W / 2 - 290, cardY + 46 + i * 36, `· ${r}`, { fontFamily: UI_FONT, fontSize: '22px', color: '#ffd803' })
        .setOrigin(0, 0.5);
    });
    if (cfg.unlocks) {
      const u = charById(cfg.unlocks);
      this.add
        .text(GAME_W / 2, cardY + 146, `🎁 通过本层解锁新模型：${u.emoji} ${u.name}`, {
          fontFamily: UI_FONT,
          fontSize: '22px',
          color: '#2cb67d',
        })
        .setOrigin(0.5);
    }

    // 按钮
    const start = this.add.rectangle(GAME_W / 2, 760, 460, 104, 0x7f5af0, 1).setStrokeStyle(3, 0xfffffe, 0.8);
    this.add
      .text(GAME_W / 2, 760, '⚔️ 开始挑战', { fontFamily: UI_FONT, fontSize: '38px', fontStyle: 'bold', color: '#fffffe' })
      .setOrigin(0.5);
    start.setInteractive({ useHandCursor: true });
    start.on('pointerdown', () => {
      sfx.click();
      this.registry.set('flow', { type: 'tower' } satisfies FlowState);
      this.scene.start('CharacterSelect');
    });

    const back = this.add
      .text(GAME_W / 2, GAME_H - 80, '← 返回主菜单', { fontFamily: UI_FONT, fontSize: '28px', color: '#a7a9be' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => {
      sfx.click();
      this.scene.start('Menu');
    });
  }
}
