import Phaser from 'phaser';
import { COLOR_NAME, GAME_H, GAME_W, UI_FONT } from '../../config';
import { ACHIEVEMENTS } from '../../meta/achievements';
import { dailyConfig, todayKey } from '../../meta/daily';
import { loadProfile } from '../../meta/save';
import { TOWER_MAX } from '../../meta/tower';
import type { BattleSetup, FlowState } from '../flow';
import { sfx, unlockAudio } from '../audio/sfx';

type CardKey = 'tower' | 'quick' | 'endless' | 'daily' | 'ach';

interface CardDef {
  key: CardKey;
  accent: number;
  emoji: string;
  title: string;
  sub: string;
  badge?: string;
  onClick: () => void;
}

const cssHex = (n: number): string => '#' + n.toString(16).padStart(6, '0');
const lighten = (n: number, t = 0.5): string => {
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const f = (c: number): number => Math.round(c + (255 - c) * t);
  return '#' + ((f(r) << 16) | (f(g) << 8) | f(b)).toString(16).padStart(6, '0');
};

export class MenuScene extends Phaser.Scene {
  private witnessText?: Phaser.GameObjects.Text;

  constructor() {
    super('Menu');
  }

  create(): void {
    const profile = loadProfile();
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0b0a14).setDepth(-10);

    // 背景漂浮资源图标
    for (let i = 0; i < 10; i++) {
      const x = Phaser.Math.Between(40, GAME_W - 40);
      const y = Phaser.Math.Between(120, GAME_H - 80);
      const img = this.add
        .image(x, y, `tile-${i % 6}`)
        .setDisplaySize(54, 54)
        .setAlpha(0.08)
        .setAngle(Phaser.Math.Between(-20, 20))
        .setDepth(-5);
      this.tweens.add({
        targets: img,
        y: y - Phaser.Math.Between(20, 50),
        duration: Phaser.Math.Between(2800, 4800),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // 门环 + 标题
    const portal = this.add.image(GAME_W / 2, 300, 'menu-portal').setDisplaySize(620, 203).setAlpha(0.85);
    this.tweens.add({
      targets: portal,
      alpha: { from: 0.85, to: 0.5 },
      scaleX: { from: portal.scaleX, to: portal.scaleX * 1.05 },
      yoyo: true,
      repeat: -1,
      duration: 2200,
      ease: 'Sine.easeInOut',
    });

    this.add
      .text(GAME_W / 2, 108, '🧠 ⚡ AI 大乱斗 🔮 💾', { fontFamily: UI_FONT, fontSize: '34px', color: '#a7b0d0' })
      .setOrigin(0.5);
    const title = this.add.image(GAME_W / 2, 232, 'menu-title').setDisplaySize(460, 180);
    this.tweens.add({
      targets: title,
      scale: { from: title.scale, to: title.scale * 1.03 },
      yoyo: true,
      repeat: -1,
      duration: 1600,
      ease: 'Sine.easeInOut',
    });

    this.add
      .text(GAME_W / 2, 362, '消除 AI 资源 · 对战大模型 · 接受它的嘴炮锐评', {
        fontFamily: UI_FONT,
        fontSize: '23px',
        color: '#c3c8e0',
      })
      .setOrigin(0.5);

    // 见证者计数（异步填充）
    this.witnessText = this.add
      .text(GAME_W / 2, 406, '', { fontFamily: UI_FONT, fontSize: '21px', color: '#7fd0ff', align: 'center' })
      .setOrigin(0.5);
    this.witnessText.setShadow(0, 0, '#3da9fc', 8);
    void this.loadWitness();

    const dailyDone = profile.daily.lastPlayedDate === todayKey();
    const towerFloor = Math.min(profile.towerFloor, TOWER_MAX);
    const cleared = profile.towerBest >= TOWER_MAX;
    const defs: CardDef[] = [
      {
        key: 'tower',
        accent: 0x9b6cff,
        emoji: '🗼',
        title: '闯关爬塔',
        badge: cleared ? '已通关' : `${towerFloor}/100 层`,
        sub: cleared ? '已登顶 · 可重温任意层' : `当前第 ${towerFloor} / 100 层 · 解锁新模型`,
        onClick: () => this.scene.start('Tower'),
      },
      {
        key: 'quick',
        accent: 0x3da9fc,
        emoji: '⚡',
        title: '快速对战',
        sub: '自选模型与难度，随便打打',
        onClick: () => {
          this.registry.set('flow', { type: 'quick' } satisfies FlowState);
          this.scene.start('CharacterSelect');
        },
      },
      {
        key: 'endless',
        accent: 0x2cd4c0,
        emoji: '♾️',
        title: '无尽挑战',
        sub: profile.endlessBest > 0 ? `最佳 ${profile.endlessBest} 波 · 一口气能撑几波？` : '一口气能撑几波？',
        onClick: () => {
          this.registry.set('flow', { type: 'endless' } satisfies FlowState);
          this.scene.start('CharacterSelect');
        },
      },
      {
        key: 'daily',
        accent: 0xffc23d,
        emoji: '📅',
        title: '每日挑战',
        badge: `连胜 ${profile.daily.streak} 天`,
        sub: dailyDone ? '今日已挑战 ✓ 明日再来' : '今日棋局已就绪',
        onClick: () => this.startDaily(),
      },
      {
        key: 'ach',
        accent: 0xff8c42,
        emoji: '🏅',
        title: '成就殿堂',
        badge: `${profile.achievements.length} / ${ACHIEVEMENTS.length}`,
        sub: '点亮成就，见证实力',
        onClick: () => this.scene.start('Achievements'),
      },
    ];

    const startY = 486;
    const pitch = 150;
    defs.forEach((d, i) => this.drawCard(d, startY + i * pitch));

    this.drawResourceBar();
  }

  private drawCard(d: CardDef, y: number): void {
    const cont = this.add.container(GAME_W / 2, y);
    const card = this.add.image(0, 0, `mcard-${d.key}`).setDisplaySize(672, 159);
    const icon = this.add.text(-258, 0, d.emoji, { fontSize: '56px' }).setOrigin(0.5);
    const title = this.add
      .text(-188, -26, d.title, { fontFamily: UI_FONT, fontSize: '35px', fontStyle: 'bold', color: '#fffffe' })
      .setOrigin(0, 0.5);
    title.setShadow(0, 0, cssHex(d.accent), 10);
    const sub = this.add
      .text(-188, 26, d.sub, {
        fontFamily: UI_FONT,
        fontSize: '20px',
        color: '#aeb4cc',
        wordWrap: { width: 388, useAdvancedWrap: true },
      })
      .setOrigin(0, 0.5);
    const chev = this.add.image(258, 0, `mchev-${d.key}`).setDisplaySize(76, 76);
    cont.add([card, icon, title, sub, chev]);

    if (d.badge) {
      const bt = this.add
        .text(0, 0, d.badge, {
          fontFamily: UI_FONT,
          fontSize: '19px',
          fontStyle: 'bold',
          color: lighten(d.accent, 0.55),
        })
        .setOrigin(0, 0.5);
      const bx = -188 + title.width + 16;
      const bw = bt.width + 22;
      bt.setPosition(bx + 11, -26);
      const bg = this.add.graphics();
      bg.fillStyle(d.accent, 0.22);
      bg.fillRoundedRect(bx, -42, bw, 32, 16);
      bg.lineStyle(2, d.accent, 0.85);
      bg.strokeRoundedRect(bx, -42, bw, 32, 16);
      cont.add(bg);
      cont.add(bt);
    }

    cont.setSize(672, 159);
    cont.setInteractive(new Phaser.Geom.Rectangle(-336, -79, 672, 159), Phaser.Geom.Rectangle.Contains);
    cont.on('pointerover', () => this.tweens.add({ targets: cont, scale: 1.025, duration: 110 }));
    cont.on('pointerout', () => this.tweens.add({ targets: cont, scale: 1, duration: 110 }));
    cont.on('pointerdown', () => {
      unlockAudio();
      sfx.click();
      this.tweens.add({ targets: cont, scale: { from: 0.97, to: 1 }, duration: 130 });
      d.onClick();
    });
  }

  private drawResourceBar(): void {
    const y = 1286;
    const g = this.add.graphics();
    g.fillStyle(0x14131f, 0.85);
    g.fillRoundedRect(28, y - 40, GAME_W - 56, 80, 16);
    g.lineStyle(2, 0x2e2e44, 1);
    g.strokeRoundedRect(28, y - 40, GAME_W - 56, 80, 16);
    const n = 6;
    const inner = GAME_W - 56 - 24;
    const slot = inner / n;
    for (let i = 0; i < n; i++) {
      const cx = 40 + slot * (i + 0.5);
      this.add.image(cx - 24, y, `tile-${i}`).setDisplaySize(38, 38);
      this.add
        .text(cx + 2, y, COLOR_NAME[i], { fontFamily: UI_FONT, fontSize: '18px', color: '#9aa0bd' })
        .setOrigin(0, 0.5);
    }
  }

  /** 每日挑战：直接组装对局（当日固定棋局，可试用未解锁模型） */
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

  /** 见证者计数：首次访问 +1，之后只读；失败则用本地缓存或隐藏 */
  private async loadWitness(): Promise<void> {
    try {
      const seen = localStorage.getItem('m3_witnessed');
      const resp = await fetch('/api/witness', { method: seen ? 'GET' : 'POST' });
      if (!resp.ok) throw new Error('no');
      const j = (await resp.json()) as { count: number };
      if (!seen) localStorage.setItem('m3_witnessed', '1');
      localStorage.setItem('m3_witness_count', String(j.count));
      this.showWitness(j.count);
    } catch {
      const cached = localStorage.getItem('m3_witness_count');
      if (cached) this.showWitness(Number(cached));
    }
  }

  private showWitness(count: number): void {
    if (!this.witnessText || !Number.isFinite(count) || count <= 0) return;
    const start = Math.max(0, count - 18);
    this.tweens.addCounter({
      from: start,
      to: count,
      duration: 1000,
      ease: 'Cubic.easeOut',
      onUpdate: (tw) => {
        const v = Math.floor(tw.getValue() ?? count);
        this.witnessText?.setText(`🛰 已有 ${v.toLocaleString()} 位见证者一起对战 AI`);
      },
    });
  }
}
