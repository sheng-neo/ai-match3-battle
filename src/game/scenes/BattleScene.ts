import Phaser from 'phaser';
import { BattleController, type Side, type SideStats } from '../../battle/battleController';
import { charById, type CharacterDef } from '../../battle/characters';
import { BotPlayer } from '../../bot/botPlayer';
import {
  BATTLE,
  BOARD_X,
  BOARD_Y,
  CELL,
  COLOR_NAME,
  DIFFICULTIES,
  GAME_H,
  GAME_W,
  MINI_CELL,
  MINI_SPEED,
  UI_FONT,
} from '../../config';
import type { PersonaId, TauntState } from '../../shared/tauntProtocol';
import { BOT_STYLES } from '../../bot/botStyles';
import { scoreMoves } from '../../bot/evaluator';
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
  // 道具 / 提示 / 演出状态
  private items = { hammer: 1, patch: 1, unplug: 1 };
  private itemSetUsed: Record<string, () => void> = {};
  private aimMode = false;
  private aimText?: Phaser.GameObjects.Text;
  private botFrozenUntil = 0;
  private freezeText?: Phaser.GameObjects.Text;
  private lastActAt = 0;
  private hintTweens: Phaser.Tweens.Tween[] = [];
  private hintSprites: Phaser.GameObjects.Container[] = [];
  private oppAvatar!: Phaser.GameObjects.Image;
  private oppFullRing?: Phaser.GameObjects.Arc;
  private hurtVignette!: Phaser.GameObjects.Image;
  private lastVignetteAt = -99999;

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
    this.oppAvatar = this.add.image(70, 105, `avatar-${this.oppChar.id}`).setDisplaySize(108, 108);
    this.add
      .text(140, 62, this.oppChar.name, { fontFamily: UI_FONT, fontSize: '30px', fontStyle: 'bold', color: '#fffffe' })
      .setOrigin(0, 0.5);
    this.add
      .text(140, 98, `${diff.label} · 被动「${this.oppChar.passiveName}」`, {
        fontFamily: UI_FONT,
        fontSize: '20px',
        color: '#a7a9be',
      })
      .setOrigin(0, 0.5);
    this.oppHpBar = new HpBar(this, 140, 136, 330, 30, 0xe53170, this.ctrl.state('p2').maxHp);
    const oppEnergyBg = this.add.rectangle(140, 162, 330, 10, 0x000000, 0.5).setOrigin(0, 0.5);
    oppEnergyBg.setStrokeStyle(1, 0x2e2e3e, 1);
    this.oppEnergyFill = this.add.rectangle(141, 162, 0.001, 6, 0x7f5af0, 1).setOrigin(0, 0.5);

    // 对手迷你盘
    this.miniView = new BoardView(this, { x: GAME_W - MINI_CELL * 8 - 28, y: 28, cell: MINI_CELL, mini: true });
    this.miniPlayer = new StepPlayer(this, this.miniView, { speed: MINI_SPEED, effects: false });
    this.miniView.init(this.ctrl.state('p2').engine.getGrid());

    // 嘴炮气泡（锚到对手名一侧，长文向下展开也不压住我方血条）
    this.bubble = new TauntBubble(this, 36, 126, 430);

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
      canAct: () => !this.ctrl.over && (this.aimMode || !this.mainPlayer.busy),
      isLocked: (p) => (this.ctrl.state('p1').engine.pieceAt(p)?.lockHits ?? 0) > 0,
      onAnyTap: (p) => {
        if (!this.aimMode) return false;
        this.exitAim();
        if (this.items.hammer > 0) {
          this.items.hammer = 0;
          this.itemSetUsed.hammer?.();
          this.markAct();
          this.ctrl.useHammer('p1', p);
        }
        return true;
      },
      onLockTap: (p) => {
        this.markAct();
        this.ctrl.submitTap('p1', p);
      },
      onSwapIntent: (a, b) => {
        this.markAct();
        const r = this.ctrl.submitSwap('p1', a, b);
        if ('rejected' in r && r.rejected === 'cooldown') this.toast('🐌 被限流中，操作冷却…');
      },
    });

    // ---------- 底部：能量 + 大招 ----------
    this.energyBar = new EnergyBar(this, BOARD_X, 1075, 470, 46);
    this.add
      .text(BOARD_X, 1118, `本命色「${COLOR_NAME[this.myChar.mainColor]}」充能翻倍`, {
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
        this.markAct();
        this.ctrl.castSkill('p1');
      } else {
        this.toast('能量不足，先消除攒能量');
      }
    });
    void ultEmoji;

    // ---------- 道具栏（每局各 1 次） ----------
    this.buildItemBar();

    // 受击红晕（替代全屏爆闪：中心透明、边缘泛红，重击才触发）
    this.hurtVignette = this.add
      .image(GAME_W / 2, GAME_H / 2, 'vignette')
      .setDisplaySize(GAME_W, GAME_H)
      .setAlpha(0)
      .setDepth(52);

    // ---------- 控制器事件接线 ----------
    this.wireController(difficultyId, diff.label);

    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__battle = this;
    }

    // 开场提示对手打法风格（角色差异第一感知点）
    this.lastActAt = this.time.now;
    this.time.delayedCall(1500, () => {
      if (!this.ctrl.over) this.toast(`⚔️ 对手风格：${BOT_STYLES[this.oppChar.id].styleDesc}`, 3200);
    });

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
      if (side === 'p1') {
        this.stopHint(); // 棋盘将变化，提示位置作废
        this.mainPlayer.enqueue(steps);
      } else {
        this.miniPlayer.enqueue(steps);
      }
    });

    this.ctrl.on('damage', ({ side, amount, hp }) => {
      if (side === 'p1') {
        this.myHpBar.set(hp);
        this.floatText(BOARD_X + 330, 240, `-${amount}`, '#e53170', 34);
        sfx.hurt();
        // 重击才出红晕，且 1.2s 节流 —— 避免磨血时高频闪屏
        if (amount >= 6 && this.time.now - this.lastVignetteAt > 1200) {
          this.lastVignetteAt = this.time.now;
          this.tweens.killTweensOf(this.hurtVignette);
          this.hurtVignette.setAlpha(Math.min(0.6, 0.22 + amount * 0.015));
          this.tweens.add({ targets: this.hurtVignette, alpha: 0, duration: 380, ease: 'Quad.easeOut' });
        }
      } else {
        this.oppHpBar.set(hp);
        this.floatText(300, 136, `-${amount}`, '#ffd803', 30);
      }
    });

    this.ctrl.on('energy', ({ side, energy }) => {
      if (side === 'p1') {
        this.energyBar.set(energy);
      } else {
        this.oppEnergyFill.displayWidth = Math.max(0.001, 328 * (energy / BATTLE.energyMax));
        // 对手大招蓄满：红圈警告
        if (energy >= BATTLE.energyMax && !this.oppFullRing) {
          this.oppFullRing = this.add.circle(70, 105, 62).setStrokeStyle(5, 0xe53170, 1).setDepth(20);
          this.tweens.add({
            targets: this.oppFullRing,
            alpha: { from: 1, to: 0.25 },
            scale: { from: 1, to: 1.14 },
            yoyo: true,
            repeat: -1,
            duration: 380,
          });
          this.toast('⚠️ 对手大招已蓄满！');
        } else if (energy < BATTLE.energyMax && this.oppFullRing) {
          this.tweens.killTweensOf(this.oppFullRing);
          this.oppFullRing.destroy();
          this.oppFullRing = undefined;
        }
      }
    });

    this.ctrl.on('combo', ({ side, combo, cleared, fusion }) => {
      if (side === 'p1') {
        this.lastCombo = combo;
        if (combo >= 2 || fusion) {
          const msg = fusion ? '⚡ FUSION!' : `COMBO ×${combo}`;
          this.comboPop(msg, combo);
        }
      } else if (combo >= 3 || fusion) {
        this.oppComboWarn(combo);
      }
      void cleared;
    });

    this.ctrl.on('heal', ({ side, amount, hp }) => {
      if (side === 'p1') {
        this.myHpBar.set(hp);
        this.floatText(BOARD_X + 300, 268, `+${amount}`, '#2cb67d', 32);
      } else {
        this.oppHpBar.set(hp);
      }
    });

    this.ctrl.on('passiveProc', ({ side, text }) => {
      if (side === 'p1') this.floatText(GAME_W / 2, BOARD_Y + 240, text, '#2cb67d', 24);
      else this.toast(text);
    });

    this.ctrl.on('skill', ({ side, char }) => {
      sfx.ult();
      this.cameras.main.shake(220, 0.006);
      const accent = `#${char.accent.toString(16).padStart(6, '0')}`;
      this.banner(`${char.emoji}「${char.ultName}」`, accent, side === 'p2' ? char.ultDesc : undefined);
    });

    this.ctrl.on('debuff', ({ side, type, ms }) => {
      if (type === 'ratelimit' && side === 'p1') this.toast(`🐌 被限流 ${Math.round(ms / 1000)} 秒！交换变慢`);
      if (type === 'shield') this.toast(side === 'p1' ? '🛡 对齐护盾展开！' : '🛡 对手展开了护盾…');
    });

    this.ctrl.on('attack', ({ to, plan, reflected, dodged }) => {
      if (dodged) return; // passiveProc 已播报
      if (reflected) {
        this.toast(to === 'p1' ? '🛡 干扰被反弹回来了！' : '🛡 护盾反弹成功！');
        return;
      }
      if (to === 'p1') {
        const parts: string[] = [];
        if (plan.garbage) parts.push(`💩×${plan.garbage}`);
        if (plan.locks) parts.push('🔒验证码');
        if (plan.ratelimit) parts.push('🐌限流');
        this.attackProjectile(parts.join(' '));
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
    this.exitAim();
    this.stopHint();
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

  update(time: number, delta: number): void {
    if (!this.ending) {
      this.ctrl.update(delta);
      // 拔网线期间对手不行动
      if (time >= this.botFrozenUntil) {
        this.bot.update(delta);
        if (this.freezeText) {
          this.freezeText.destroy();
          this.freezeText = undefined;
          this.oppAvatar.setAlpha(1);
          this.toast('对手已重新连线…');
        }
      } else if (this.freezeText) {
        this.freezeText.setText(`📵 离线 ${Math.ceil((this.botFrozenUntil - time) / 1000)}s`);
      }
      // 发呆 5 秒：抖一抖可行步
      if (
        !this.ctrl.over &&
        !this.hintTweens.length &&
        !this.mainPlayer.busy &&
        time - this.lastActAt > BATTLE.hintIdleMs
      ) {
        this.startHint();
      }
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

  // ---------- 道具栏 ----------
  private buildItemBar(): void {
    const defs: { key: 'hammer' | 'patch' | 'unplug'; emoji: string; name: string; onClick: () => void }[] = [
      {
        key: 'hammer',
        emoji: '🔨',
        name: '人工干预',
        onClick: () => {
          if (this.aimMode) {
            this.exitAim();
            this.toast('已取消瞄准');
            return;
          }
          this.aimMode = true;
          this.aimText = this.add
            .text(GAME_W / 2, BOARD_Y - 34, '🎯 点击棋盘任意格，引爆 3×3（再点按钮取消）', {
              fontFamily: UI_FONT,
              fontSize: '24px',
              color: '#0f0e17',
              backgroundColor: '#ffd803',
              padding: { x: 12, y: 6 },
            })
            .setOrigin(0.5)
            .setDepth(62);
        },
      },
      {
        key: 'patch',
        emoji: '🩹',
        name: '热修复',
        onClick: () => {
          if (this.ctrl.useHeal('p1', BATTLE.itemHealAmount)) {
            this.items.patch = 0;
            this.itemSetUsed.patch?.();
            sfx.unlock();
            this.markAct();
          } else {
            this.toast('血量已满，不用修');
          }
        },
      },
      {
        key: 'unplug',
        emoji: '🔌',
        name: '拔网线',
        onClick: () => {
          this.items.unplug = 0;
          this.itemSetUsed.unplug?.();
          this.botFrozenUntil = this.time.now + BATTLE.itemUnplugMs;
          sfx.glitch();
          this.toast(`🔌 已拔对手网线 ${Math.round(BATTLE.itemUnplugMs / 1000)} 秒！趁现在猛打！`, 2200);
          this.freezeText = this.add
            .text(70, 178, '📵 离线中', {
              fontFamily: UI_FONT,
              fontSize: '20px',
              fontStyle: 'bold',
              color: '#0f0e17',
              backgroundColor: '#e53170',
              padding: { x: 8, y: 3 },
            })
            .setOrigin(0.5)
            .setDepth(40);
          this.oppAvatar.setAlpha(0.4);
          this.director.notify('botLocked'); // 它会为此破防
          this.markAct();
        },
      },
    ];
    defs.forEach((d, i) => {
      const x = 86 + i * 112;
      const y = 1196;
      const circle = this.add.circle(x, y, 42, 0x1f1d33).setStrokeStyle(3, 0x2cb67d, 1);
      const emoji = this.add.text(x, y - 4, d.emoji, { fontSize: '36px' }).setOrigin(0.5);
      this.add
        .text(x, y + 58, d.name, { fontFamily: UI_FONT, fontSize: '18px', color: '#a7a9be' })
        .setOrigin(0.5);
      circle.setInteractive({ useHandCursor: true });
      circle.on('pointerdown', () => {
        if (this.ctrl.over) return;
        if (this.items[d.key] <= 0) {
          sfx.invalid();
          this.toast('本局道具已用完');
          return;
        }
        sfx.click();
        d.onClick();
      });
      this.itemSetUsed[d.key] = () => {
        circle.setFillStyle(0x141320, 1).setStrokeStyle(2, 0x2e2e3e, 0.6);
        emoji.setAlpha(0.25);
      };
    });
  }

  private exitAim(): void {
    this.aimMode = false;
    this.aimText?.destroy();
    this.aimText = undefined;
  }

  // ---------- 闲置提示（发呆 5 秒抖一抖最优步） ----------
  private markAct(): void {
    this.lastActAt = this.time.now;
    this.stopHint();
  }

  private startHint(): void {
    const engine = this.ctrl.state('p1').engine;
    const move = scoreMoves(engine, this.myChar.mainColor)[0];
    if (!move) return;
    for (const pos of [move.a, move.b]) {
      const id = this.mainView.pieceIdAt(pos);
      if (id === null) continue;
      const pv = this.mainView.spriteOf(id);
      if (!pv) continue;
      this.hintSprites.push(pv.root);
      this.hintTweens.push(
        this.tweens.add({
          targets: pv.root,
          angle: { from: -7, to: 7 },
          scale: { from: 1, to: 1.08 },
          yoyo: true,
          repeat: -1,
          duration: 150,
          ease: 'Sine.easeInOut',
        }),
      );
    }
  }

  private stopHint(): void {
    for (const t of this.hintTweens) t.remove();
    for (const s of this.hintSprites) s.setAngle(0).setScale(1);
    this.hintTweens = [];
    this.hintSprites = [];
  }

  // ---------- 对手高光演出 ----------
  private oppComboWarn(combo: number): void {
    // 放棋盘上部中央，不与顶部 HUD/气泡同区
    this.floatText(GAME_W / 2, BOARD_Y + 150, `⚠️ 对手连击 ×${combo}`, '#e53170', 36);
    sfx.glitch();
    this.tweens.add({ targets: this.oppAvatar, scale: { from: 1, to: 1.22 }, yoyo: true, repeat: 1, duration: 130 });
  }

  /** 攻击可视化：红色光弹从对手头像飞向你的棋盘，命中点浮出干扰内容 */
  private attackProjectile(label: string): void {
    const tx = GAME_W / 2;
    const ty = BOARD_Y + CELL * 4;
    const orb = this.add.circle(70, 105, 13, 0xe53170, 0.95).setDepth(58).setBlendMode(Phaser.BlendModes.ADD);
    const halo = this.add.circle(70, 105, 24, 0xe53170, 0.35).setDepth(57).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: [orb, halo],
      x: tx,
      y: ty,
      duration: 330,
      ease: 'Quad.easeIn',
      onComplete: () => {
        orb.destroy();
        halo.destroy();
        this.cameras.main.shake(110, 0.004);
        const boom = this.add.circle(tx, ty, 18, 0xe53170, 0.7).setDepth(58).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: boom, scale: 4.5, alpha: 0, duration: 300, onComplete: () => boom.destroy() });
        if (label) this.floatText(tx, ty - 20, `⚠️ ${label}`, '#e53170', 30);
      },
    });
  }

  // ---------- 小部件 ----------
  private toast(msg: string, holdMs = 2300): void {
    this.toastText?.destroy();
    // 放在棋盘内上沿：不与血条/模式标签/气泡同区
    const t = this.add
      .text(GAME_W / 2, BOARD_Y + 36, msg, {
        fontFamily: UI_FONT,
        fontSize: '26px',
        color: '#fffffe',
        backgroundColor: 'rgba(15,14,23,0.92)',
        padding: { x: 14, y: 8 },
        wordWrap: { width: 640, useAdvancedWrap: true },
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(60);
    this.toastText = t;
    this.tweens.add({ targets: t, alpha: 0, delay: holdMs, duration: 320, onComplete: () => t.destroy() });
  }

  private floatText(x: number, y: number, msg: string, color: string, size: number): void {
    const t = this.add
      .text(x, y, msg, { fontFamily: UI_FONT, fontSize: `${size}px`, fontStyle: 'bold', color, stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(55);
    // 先停留再缓慢上飘，留足阅读时间
    this.tweens.add({
      targets: t,
      y: y - 46,
      alpha: 0,
      delay: 700,
      duration: 900,
      ease: 'Quad.easeOut',
      onComplete: () => t.destroy(),
    });
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
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 40, delay: 950, duration: 360, onComplete: () => t.destroy() });
  }

  private banner(msg: string, color: string, sub?: string): void {
    const h = sub ? 200 : 150;
    const veil = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, h, 0x0f0e17, 0.82).setDepth(70);
    const t = this.add
      .text(GAME_W / 2, GAME_H / 2 - (sub ? 24 : 0), msg, {
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
    const subText = sub
      ? this.add
          .text(GAME_W / 2, GAME_H / 2 + 38, sub, {
            fontFamily: UI_FONT,
            fontSize: '24px',
            color: '#fffffe',
            wordWrap: { width: 640, useAdvancedWrap: true },
            align: 'center',
          })
          .setOrigin(0.5)
          .setDepth(71)
      : null;
    this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.time.delayedCall(sub ? 2100 : 1300, () => {
      const targets = subText ? [veil, t, subText] : [veil, t];
      this.tweens.add({
        targets,
        alpha: 0,
        duration: 240,
        onComplete: () => {
          veil.destroy();
          t.destroy();
          subText?.destroy();
        },
      });
    });
  }
}
