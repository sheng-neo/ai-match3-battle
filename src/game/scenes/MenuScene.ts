import Phaser from 'phaser';
import { COLOR_EMOJI, GAME_H, GAME_W, UI_FONT } from '../../config';
import { ACHIEVEMENTS } from '../../meta/achievements';
import { dailyConfig, todayKey } from '../../meta/daily';
import { loadProfile } from '../../meta/save';
import { TOWER_MAX } from '../../meta/tower';
import type { BattleSetup, FlowState } from '../flow';
import { sfx, unlockAudio } from '../audio/sfx';

interface ModeCard {
  emoji: string;
  title: string;
  sub: string;
  accent: number;
  onClick: () => void;
}

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    const profile = loadProfile();

    // 漂浮棋子背景
    for (let i = 0; i < 12; i++) {
      const x = Phaser.Math.Between(40, GAME_W - 40);
      const y = Phaser.Math.Between(100, GAME_H - 80);
      const img = this.add
        .image(x, y, `tile-${i % 6}`)
        .setDisplaySize(60, 60)
        .setAlpha(0.13)
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
      .text(GAME_W / 2, 120, '🧠⚡ AI 大乱斗 🔮💾', { fontFamily: UI_FONT, fontSize: '34px', color: '#a7a9be' })
      .setOrigin(0.5);
    const title = this.add
      .text(GAME_W / 2, 205, '消消乐', {
        fontFamily: UI_FONT,
        fontSize: '96px',
        fontStyle: 'bold',
        color: '#fffffe',
        stroke: '#7f5af0',
        strokeThickness: 9,
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: title, scale: { from: 1, to: 1.035 }, yoyo: true, repeat: -1, duration: 1200, ease: 'Sine.easeInOut' });
    this.add
      .text(GAME_W / 2, 290, '消除 AI 资源 · 对战大模型 · 接受它的嘴炮锐评', {
        fontFamily: UI_FONT,
        fontSize: '24px',
        color: '#a7a9be',
      })
      .setOrigin(0.5);

    const dailyDone = profile.daily.lastPlayedDate === todayKey();
    const cards: ModeCard[] = [
      {
        emoji: '🗼',
        title: '闯关爬塔',
        sub:
          profile.towerBest >= TOWER_MAX
            ? '已通关 100 层！可重温任意荣耀'
            : `当前第 ${Math.min(profile.towerFloor, TOWER_MAX)} / ${TOWER_MAX} 层 · 解锁新模型`,
        accent: 0x7f5af0,
        onClick: () => this.scene.start('Tower'),
      },
      {
        emoji: '⚡',
        title: '快速对战',
        sub: '自选模型与难度，随便打打',
        accent: 0x3da9fc,
        onClick: () => {
          this.registry.set('flow', { type: 'quick' } satisfies FlowState);
          this.scene.start('CharacterSelect');
        },
      },
      {
        emoji: '♾️',
        title: '无尽挑战',
        sub: profile.endlessBest > 0 ? `最佳战绩：${profile.endlessBest} 波` : '一口气能撑几波？',
        accent: 0x2cb67d,
        onClick: () => {
          this.registry.set('flow', { type: 'endless' } satisfies FlowState);
          this.scene.start('CharacterSelect');
        },
      },
      {
        emoji: '📅',
        title: '每日挑战',
        sub: dailyDone
          ? `今日已挑战 ✓ · 连胜 ${profile.daily.streak} 天`
          : `今日棋局已就绪 · 连胜 ${profile.daily.streak} 天`,
        accent: 0xffd803,
        onClick: () => this.startDaily(),
      },
      {
        emoji: '🏅',
        title: '成就殿堂',
        sub: `已点亮 ${profile.achievements.length} / ${ACHIEVEMENTS.length}`,
        accent: 0xff8906,
        onClick: () => this.scene.start('Achievements'),
      },
    ];

    cards.forEach((c, i) => {
      const y = 420 + i * 152;
      const bg = this.add.rectangle(GAME_W / 2, y, 620, 128, 0x1f1d33, 1).setStrokeStyle(3, c.accent, 0.9);
      this.add.text(110, y, c.emoji, { fontSize: '56px' }).setOrigin(0.5);
      this.add
        .text(170, y - 24, c.title, { fontFamily: UI_FONT, fontSize: '34px', fontStyle: 'bold', color: '#fffffe' })
        .setOrigin(0, 0.5);
      this.add
        .text(170, y + 24, c.sub, { fontFamily: UI_FONT, fontSize: '21px', color: '#a7a9be' })
        .setOrigin(0, 0.5);
      this.add
        .text(GAME_W - 110, y, '▶', { fontFamily: UI_FONT, fontSize: '34px', color: '#5e5c70' })
        .setOrigin(0.5);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setFillStyle(0x2a2545, 1));
      bg.on('pointerout', () => bg.setFillStyle(0x1f1d33, 1));
      bg.on('pointerdown', () => {
        unlockAudio();
        sfx.click();
        c.onClick();
      });
    });

    this.add
      .text(
        GAME_W / 2,
        GAME_H - 50,
        `${COLOR_EMOJI[0]}数据 ${COLOR_EMOJI[1]}算力 ${COLOR_EMOJI[2]}参数 ${COLOR_EMOJI[3]}能量 ${COLOR_EMOJI[4]}显存 ${COLOR_EMOJI[5]}Token`,
        { fontFamily: UI_FONT, fontSize: '22px', color: '#5e5c70' },
      )
      .setOrigin(0.5);
  }

  /** 每日挑战：直接组装对局开打（当日固定棋局，可试用未解锁模型） */
  private startDaily(): void {
    const cfg = dailyConfig();
    const setup: BattleSetup = {
      modeType: 'daily',
      myCharId: cfg.myChar,
      oppCharId: cfg.oppChar,
      difficultyId: cfg.difficulty.id,
      intervalMul: 1,
      mods: {},
      seed: cfg.seed,
      dailyKey: cfg.dateKey,
    };
    this.registry.set('setup', setup);
    this.scene.start('Battle');
  }
}
