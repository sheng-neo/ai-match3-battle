import Phaser from 'phaser';
import { BattleController, type Side, type SideStats } from '../../battle/battleController';
import { charById, type CharacterDef } from '../../battle/characters';
import { BotPlayer } from '../../bot/botPlayer';
import {
  BATTLE,
  BOARD_X,
  BOARD_Y,
  CELL,
  DIFFICULTIES,
  GAME_H,
  GAME_W,
  MINI_CELL,
  MINI_SPEED,
  UI_FONT,
} from '../../config';
import type { PersonaId, TauntState } from '../../shared/tauntProtocol';
import { modeLabel, type BattleSetup } from '../flow';
import { TauntDirector } from '../../taunt/tauntDirector';
import { sfx } from '../audio/sfx';
import { BoardInput } from '../input/BoardInput';
import { BoardView } from '../ui/BoardView';
import { EnergyBar } from '../ui/EnergyBar';
import { HpBar } from '../ui/HpBar';
import { StepPlayer } from '../ui/StepPlayer';
import { TauntBubble } from '../ui/TauntBubble';

export interface ResultPayload {
  outcome: 'win' | 'lose' | 'draw';
  byTimeout: boolean;
  myCharId: PersonaId;
  oppCharId: PersonaId;
  difficultyId: string;
  difficultyLabel: string;
  myStats: SideStats;
  oppStats: SideStats;
  myHp: number;
  myMaxHp: number;
  oppHp: number;
  elapsedSec: number;
  setup: BattleSetup;
}

export class BattleScene extends Phaser.Scene {
  private ctrl!: BattleController;
  private bot!: BotPlayer;
  private myChar!: CharacterDef;
  private oppChar!: CharacterDef;
  private mainView!: BoardView;
  private miniView!: BoardView;
  private mainPlayer!: StepPlayer;
  private miniPlayer!: StepPlayer;
  private input2!: BoardInput;
  private director!: TauntDirector;
  private bubble!: TauntBubble;
  private myHpBar!: HpBar;
  private oppHpBar!: HpBar;
  private energyBar!: EnergyBar;
  private oppEnergyFill!: Phaser.GameObjects.Rectangle;
  private timerText!: Phaser.GameObjects.Text;
  private ultBtnBg!: Phaser.GameObjects.Arc;
  private ultReady = false;
  private lastCombo = 0;
  private ending = false;
  private toastText?: Phaser.GameObjects.Text;
  private setup!: BattleSetup;

  constructor() {
    super('Battle');
  }

  create(): void {
    this.ending = false;
    this.lastCombo = 0;
    this.ultReady = false;

    const setup: BattleSetup = (this.registry.get('setup') as BattleSetup | undefined) ?? {
      modeType: 'quick',
      myCharId: 'omni',
      oppCharId: 'scholar',
      difficultyId: 'normal',
      intervalMul: 1,
      mods: {},
    };
    this.setup = setup;
    const difficultyId = setup.difficultyId;
    const diff = DIFFICULTIES.find((d) => d.id === difficultyId) ?? DIFFICULTIES[1];
    this.myChar = charById(setup.myCharId);
    this.oppChar = charById(setup.oppCharId);

    const seed = setup.seed ?? Math.floor(Math.random() * 2 ** 31);
    this.ctrl = new BattleController({
      p1: { char: this.myChar, seed: seed + 1 },
      p2: { char: this.oppChar, seed: seed + 2 },
      rngSeed: seed + 3,
      mods: setup.mods,
    });
    this.bot = new BotPlayer(this.ctrl, 'p2', diff, seed + 4, setup.intervalMul);

    // ---------- 顶部对手区 ----------
    this.add.image(70, 105, `avatar-${this.oppChar.id}`).setDisplaySize(108, 108);
    this.add
      .text(140, 62, this.oppChar.name, { fontFamily: UI_FONT, fontSize: '30px', fontStyle: 'bold', color: '#fffffe' })
      .setOrigin(0, 0.5);
    this.add
      .text(140, 98, `${diff.label} · ${this.oppChar.title}`, { fontFamily: UI_FONT, fontSize: '20px', color: '#a7a9be' })
      .setOrigin(0, 0.5);
    this.oppHpBar = new HpBar(this, 140, 136, 330, 30, 0xe53170, this.ctrl.state('p2').maxHp);
    const oppEnergyBg = this.add.rectangle(140, 162, 330, 10, 0x000000, 0.5).setOrigin(0, 0.5);
    oppEnergyBg.setStrokeStyle(1, 0x2e2e3e, 1);
    this.oppEnergyFill = this.add.rectangle(141, 162, 0.001, 6, 0x7f5af0, 1).setOrigin(0, 0.5);

    // 对手迷你盘
    this.miniView = new BoardView(this, { x: GAME_W - MINI_CELL * 8 - 28, y: 28, cell: MINI_CELL, mini: true });
    this.miniPlayer = new StepPlayer(this, this.miniView, { speed: MINI_SPEED, effects: false });
    this.miniView.init(this.ctrl.state('p2').engine.getGrid());

    // 嘴炮气泡
    this.bubble = new TauntBubble(this, 36, 196, 430);

    // ---------- 我方信息行 ----------
    this.add
      .text(BOARD_X, 268, `${this.myChar.emoji} 我方`, { fontFamily: UI_FONT, fontSize: '24px', color: '#a7a9be' })
      .setOrigin(0, 0.5);
    this.myHpBar = new HpBar(this, BOARD_X + 110, 268, 380, 34, 0x2cb67d, this.ctrl.state('p1').maxHp);
    if (this.ctrl.state('p1').hp < this.ctrl.state('p1').maxHp) this.myHpBar.set(this.ctrl.state('p1').hp);
    // 模式标签（爬塔层数/无尽波次/每日）
    this.add
      .text(GAME_W / 2, 302, modeLabel(this.setup), { fontFamily: UI_FONT, fontSize: '19px', color: '#5e5c70' })
      .setOrigin(0.5);
    this.timerText = this.add
      .text(GAME_W - BOARD_X, 268, '150', {
        fontFamily: UI_FONT,
        fontSize: '40px',
        fontStyle: 'bold',
        color: '#fffffe',
      })
      .setOrigin(1, 0.5);

    // ---------- 主棋盘 ----------
    this.mainView = new BoardView(this, { x: BOARD_X, y: BOARD_Y, cell: CELL });
    this.mainPlayer = new StepPlayer(this, this.mainView, {
      effects: true,
      onSfx: (name, combo) => {
        const fn = (sfx as unknown as Record<string, (c?: number) => void>)[name];
        if (fn) fn(combo);
      },
      onShake: (strength) => this.cameras.main.shake(130, strength),
    });
    this.mainView.init(this.ctrl.state('p1').engine.getGrid());

    this.input2 = new BoardInput(this, this.mainView, {
      canAct: () => !this.ctrl.over && !this.mainPlayer.busy,
      isLocked: (p) => (this.ctrl.state('p1').engine.pieceAt(p)?.lockHits ?? 0) > 0,
      onLockTap: (p) => {
        this.ctrl.submitTap('p1', p);
      },
      onSwapIntent: (a, b) => {
        const r = this.ctrl.submitSwap('p1', a, b);
        if ('rejected' in r && r.rejected === 'cooldown') this.toast('🐌 被限流中，操作冷却…');
      },
    });

    // ---------- 底部：能量 + 大招 ----------
    this.energyBar = new EnergyBar(this, BOARD_X, 1075, 470, 46);
    this.add
      .text(BOARD_X, 1118, `本命色 ${['📊', '⚡', '🧠', '🔋', '💾', '🔮'][this.myChar.mainColor]} 充能翻倍`, {
        fontFamily: UI_FONT,
        fontSize: '20px',
        color: '#5e5c70',
      })
      .setOrigin(0, 0.5);

    this.ultBtnBg = this.add.circle(GAME_W - 110, 1105, 74, 0x1f1d33).setStrokeStyle(4, 0x5e5c70, 1);
    const ultEmoji = this.add
      .text(GAME_W - 110, 1092, this.myChar.emoji, { fontSize: '56px' })
      .setOrigin(0.5);
    this.add
      .text(GAME_W - 110, 1148, this.myChar.ultName, { fontFamily: UI_FONT, fontSize: '20px', color: '#a7a9be' })
      .setOrigin(0.5);
    this.ultBtnBg.setInteractive({ useHandCursor: true });
    this.ultBtnBg.on('pointerdown', () => {
      if (this.ctrl.over) return;
      if (this.ctrl.state('p1').energy >= BATTLE.energyMax) {
        this.ctrl.castSkill('p1');
      } else {
        this.toast('能量不足，先消除攒能量');
      }
    });
    void ultEmoji;

    // ---------- 控制器事件接线 ----------
    this.wireController(difficultyId, diff.label);

    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__battle = this;
    }

    // 开场嘴炮
    this.director = new TauntDirector({
      persona: this.oppChar.id,
      now: () => this.time.now,
      getState: (): TauntState => ({
        myHp: this.ctrl.state('p2').hp,
        oppHp: this.ctrl.state('p1').hp,
        combo: this.lastCombo,
        timeLeftSec: Math.ceil(this.ctrl.timeLeftMs / 1000),
        difficulty: difficultyId,
      }),
      display: (line, source) => this.bubble.show(line, source),
    });
    this.time.delayedCall(900, () => this.director.notify('opening'));
  }

  private wireController(difficultyId: string, difficultyLabel: string): void {
    this.ctrl.on('steps', ({ side, steps }) => {
      if (side === 'p1') this.mainPlayer.enqueue(steps);
      else this.miniPlayer.enqueue(steps);
    });

    this.ctrl.on('damage', ({ side, amount, hp }) => {
      if (side === 'p1') {
        this.myHpBar.set(hp);
        this.floatText(BOARD_X + CELL * 4, BOARD_Y - 24, `-${amount}`, '#e53170', 34);
        sfx.hurt();
        this.cameras.main.flash(90, 229, 49, 112, false);
      } else {
        this.oppHpBar.set(hp);
        this.floatText(300, 136, `-${amount}`, '#ffd803', 30);
      }
    });

    this.ctrl.on('energy', ({ side, energy }) => {
      if (side === 'p1') this.energyBar.set(energy);
      else this.oppEnergyFill.displayWidth = Math.max(0.001, 328 * (energy / BATTLE.energyMax));
    });

    this.ctrl.on('combo', ({ side, combo, cleared, fusion }) => {
      if (side !== 'p1') return;
      this.lastCombo = combo;
      if (combo >= 2 || fusion) {
        const msg = fusion ? '⚡ FUSION!' : `COMBO ×${combo}`;
        this.comboPop(msg, combo);
      }
      void cleared;
    });

    this.ctrl.on('skill', ({ side, char }) => {
      sfx.ult();
      this.cameras.main.shake(220, 0.006);
      this.banner(`${char.emoji}「${char.ultName}」`, side === 'p1' ? '#ffd803' : '#e53170');
    });

    this.ctrl.on('debuff', ({ side, type, ms }) => {
      if (type === 'ratelimit' && side === 'p1') this.toast(`🐌 被限流 ${Math.round(ms / 1000)} 秒！交换变慢`);
      if (type === 'shield') this.toast(side === 'p1' ? '🛡 对齐护盾展开！' : '🛡 对手展开了护盾…');
    });

    this.ctrl.on('attack', ({ to, plan, reflected, dodged }) => {
      if (dodged) {
        this.toast(to === 'p1' ? '✋ 宪法审查：干扰被无效化' : '对手闪避了你的干扰');
        return;
      }
      if (reflected) {
        this.toast(to === 'p1' ? '🛡 干扰被反弹回来了！' : '🛡 护盾反弹成功！');
        return;
      }
      if (to === 'p1') {
        const parts: string[] = [];
        if (plan.garbage) parts.push(`💩脏数据×${plan.garbage}`);
        if (plan.locks) parts.push('🔒验证码锁');
        if (plan.ratelimit) parts.push('🐌限流');
        this.toast(`⚠️ 受到干扰：${parts.join(' ')}`);
      }
    });

    this.ctrl.on('rejected', ({ side, reason }) => {
      if (side === 'p1' && reason === 'cooldown') this.toast('🐌 被限流中…');
    });

    this.ctrl.on('taunt', ({ type, combo }) => {
      if (combo) this.lastCombo = combo;
      this.director.notify(type);
    });

    this.ctrl.on('gameOver', ({ winner, byTimeout }) => {
      this.endBattle(winner, byTimeout, difficultyId, difficultyLabel);
    });
  }

  private endBattle(winner: Side | 'draw', byTimeout: boolean, difficultyId: string, difficultyLabel: string): void {
    if (this.ending) return;
    this.ending = true;
    this.director.dispose();
    const payload: ResultPayload = {
      outcome: winner === 'draw' ? 'draw' : winner === 'p1' ? 'win' : 'lose',
      byTimeout,
      myCharId: this.myChar.id,
      oppCharId: this.oppChar.id,
      difficultyId,
      difficultyLabel,
      myStats: { ...this.ctrl.state('p1').stats },
      oppStats: { ...this.ctrl.state('p2').stats },
      myHp: this.ctrl.state('p1').hp,
      myMaxHp: this.ctrl.state('p1').maxHp,
      oppHp: this.ctrl.state('p2').hp,
      elapsedSec: Math.round(this.ctrl.elapsed / 1000),
      setup: this.setup,
    };
    // 等两侧动画排空再切结算（6s 兜底超时：任何演出停滞都不允许软锁结算）
    const idle = Promise.all([this.mainPlayer.waitIdle(), this.miniPlayer.waitIdle()]);
    const timeout = new Promise<void>((res) => this.time.delayedCall(6000, res));
    void Promise.race([idle, timeout]).then(() => {
      this.time.delayedCall(450, () => {
        if (this.scene.isActive()) this.scene.start('Result', payload);
      });
    });
  }

  update(_time: number, delta: number): void {
    if (!this.ending) {
      this.ctrl.update(delta);
      this.bot.update(delta);
    }
    this.director?.update();

    const sec = Math.ceil(this.ctrl.timeLeftMs / 1000);
    this.timerText.setText(`${sec}`);
    this.timerText.setColor(sec <= 15 ? '#e53170' : '#fffffe');

    const ready = this.ctrl.state('p1').energy >= BATTLE.energyMax && !this.ctrl.over;
    if (ready !== this.ultReady) {
      this.ultReady = ready;
      this.ultBtnBg.setStrokeStyle(ready ? 6 : 4, ready ? 0xffd803 : 0x5e5c70, 1);
      if (ready) {
        sfx.charge();
        this.tweens.add({ targets: this.ultBtnBg, scale: { from: 1, to: 1.08 }, yoyo: true, repeat: -1, duration: 360 });
      } else {
        this.tweens.killTweensOf(this.ultBtnBg);
        this.ultBtnBg.setScale(1);
      }
    }
  }

  // ---------- 小部件 ----------
  private toast(msg: string): void {
    this.toastText?.destroy();
    const t = this.add
      .text(GAME_W / 2, BOARD_Y - 70, msg, {
        fontFamily: UI_FONT,
        fontSize: '26px',
        color: '#fffffe',
        backgroundColor: 'rgba(15,14,23,0.9)',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(60);
    this.toastText = t;
    this.tweens.add({ targets: t, alpha: 0, delay: 1500, duration: 320, onComplete: () => t.destroy() });
  }

  private floatText(x: number, y: number, msg: string, color: string, size: number): void {
    const t = this.add
      .text(x, y, msg, { fontFamily: UI_FONT, fontSize: `${size}px`, fontStyle: 'bold', color, stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(55);
    this.tweens.add({ targets: t, y: y - 56, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  private comboPop(msg: string, combo: number): void {
    const t = this.add
      .text(GAME_W / 2, BOARD_Y + CELL * 3.2, msg, {
        fontFamily: UI_FONT,
        fontSize: `${Math.min(46 + combo * 5, 84)}px`,
        fontStyle: 'bold',
        color: '#ffd803',
        stroke: '#7f5af0',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(55)
      .setScale(0.4)
      .setAlpha(0.95);
    this.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 40, delay: 520, duration: 320, onComplete: () => t.destroy() });
  }

  private banner(msg: string, color: string): void {
    const veil = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, 150, 0x0f0e17, 0.78).setDepth(70);
    const t = this.add
      .text(GAME_W / 2, GAME_H / 2, msg, {
        fontFamily: UI_FONT,
        fontSize: '56px',
        fontStyle: 'bold',
        color,
        stroke: '#000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(71)
      .setScale(0.5);
    this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.time.delayedCall(950, () => {
      this.tweens.add({ targets: [veil, t], alpha: 0, duration: 240, onComplete: () => { veil.destroy(); t.destroy(); } });
    });
  }
}
