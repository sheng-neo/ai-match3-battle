import Phaser from 'phaser';
import { charById } from '../../battle/characters';
import { GAME_H, GAME_W, UI_FONT } from '../../config';
import { checkAchievements } from '../../meta/achievements';
import { ENDLESS_HEAL, waveConfig } from '../../meta/endless';
import { loadProfile, saveProfile, unlock, type Profile } from '../../meta/save';
import { TOWER_MAX, TOWER_UNLOCKS } from '../../meta/tower';
import { todayKey } from '../../meta/daily';
import { fetchTaunt } from '../../taunt/tauntClient';
import type { BattleSetup, FlowState } from '../flow';
import { sfx } from '../audio/sfx';
import { buildShareCard, downloadCanvas } from '../share/shareCard';
import type { ResultPayload } from './BattleScene';

function yesterdayOf(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return todayKey(dt);
}

export class ResultScene extends Phaser.Scene {
  private quote = '……';
  private quoteSource: 'ai' | 'fallback' = 'fallback';

  constructor() {
    super('Result');
  }

  create(data: ResultPayload): void {
    const setup = data.setup;
    const myChar = charById(data.myCharId);
    const oppChar = charById(data.oppCharId);
    const win = data.outcome === 'win';

    if (win) sfx.win();
    else if (data.outcome === 'lose') sfx.lose();

    // ---------- 存档结算 ----------
    const profile = loadProfile();
    const badges = this.applyProgress(profile, data);
    saveProfile(profile);

    // ---------- 标题与对阵 ----------
    const outcomeText = win ? '🏆 胜 利' : data.outcome === 'lose' ? '💀 惜 败' : '🤝 平 局';
    const outcomeColor = win ? '#2cb67d' : data.outcome === 'lose' ? '#e53170' : '#ffd803';
    const big = this.add
      .text(GAME_W / 2, 150, outcomeText, {
        fontFamily: UI_FONT,
        fontSize: '88px',
        fontStyle: 'bold',
        color: outcomeColor,
        stroke: '#000',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScale(0.3);
    this.tweens.add({ targets: big, scale: 1, duration: 380, ease: 'Back.easeOut' });

    const subParts: string[] = [];
    if (setup.modeType === 'tower') subParts.push(`🗼 第 ${setup.floor} 层`);
    if (setup.modeType === 'endless') subParts.push(`♾️ 第 ${setup.wave} 波`);
    if (setup.modeType === 'daily') subParts.push(`📅 每日挑战 · 连胜 ${profile.daily.streak} 天`);
    if (data.byTimeout) subParts.push('时间到 · 按总伤害判定');
    if (subParts.length) {
      this.add
        .text(GAME_W / 2, 218, subParts.join('　'), { fontFamily: UI_FONT, fontSize: '24px', color: '#a7a9be' })
        .setOrigin(0.5);
    }

    this.add.image(GAME_W / 2 - 170, 330, `avatar-${myChar.id}`).setDisplaySize(104, 104);
    this.add.image(GAME_W / 2 + 170, 330, `avatar-${oppChar.id}`).setDisplaySize(104, 104);
    this.add
      .text(GAME_W / 2, 330, 'VS', { fontFamily: UI_FONT, fontSize: '40px', fontStyle: 'bold', color: '#fffffe' })
      .setOrigin(0.5);
    this.add
      .text(GAME_W / 2 - 170, 400, '我方', { fontFamily: UI_FONT, fontSize: '21px', color: '#a7a9be' })
      .setOrigin(0.5);
    this.add
      .text(GAME_W / 2 + 170, 400, oppChar.name, { fontFamily: UI_FONT, fontSize: '21px', color: '#a7a9be' })
      .setOrigin(0.5);

    // ---------- 战绩 ----------
    const rows: [string, string, string][] = [
      ['总伤害', `${data.myStats.damageDealt}`, `${data.oppStats.damageDealt}`],
      ['最大连击', `×${data.myStats.maxCombo}`, `×${data.oppStats.maxCombo}`],
      ['大招 / 融合', `${data.myStats.ultsCast} / ${data.myStats.fusions}`, `${data.oppStats.ultsCast} / ${data.oppStats.fusions}`],
      ['剩余 HP', `${data.myHp}/${data.myMaxHp}`, `${data.oppHp}`],
    ];
    rows.forEach(([k, mine, theirs], i) => {
      const y = 468 + i * 46;
      this.add.text(GAME_W / 2, y, k, { fontFamily: UI_FONT, fontSize: '24px', color: '#5e5c70' }).setOrigin(0.5);
      this.add
        .text(GAME_W / 2 - 160, y, mine, { fontFamily: UI_FONT, fontSize: '26px', fontStyle: 'bold', color: '#fffffe' })
        .setOrigin(0.5);
      this.add
        .text(GAME_W / 2 + 160, y, theirs, { fontFamily: UI_FONT, fontSize: '26px', color: '#a7a9be' })
        .setOrigin(0.5);
    });

    // ---------- 对手赛后锐评 ----------
    this.add.rectangle(GAME_W / 2, 760, 640, 150, 0x7f5af0, 0.12).setStrokeStyle(2, 0x7f5af0, 0.7);
    const tag = this.add
      .text(GAME_W / 2, 702, `${oppChar.emoji} 对手赛后锐评`, { fontFamily: UI_FONT, fontSize: '22px', color: '#a786ff' })
      .setOrigin(0.5);
    const quoteText = this.add
      .text(GAME_W / 2, 768, '对手正在打字…', {
        fontFamily: UI_FONT,
        fontSize: '26px',
        color: '#fffffe',
        align: 'center',
        // useAdvancedWrap：中文按字符断行，杜绝整句横向溢出
        wordWrap: { width: 580, useAdvancedWrap: true },
        lineSpacing: 7,
      })
      .setOrigin(0.5);
    void fetchTaunt({
      personaId: oppChar.id,
      event: 'result',
      state: {
        myHp: data.oppHp,
        oppHp: data.myHp,
        combo: data.oppStats.maxCombo,
        timeLeftSec: 0,
        difficulty: data.difficultyId,
        result: data.outcome === 'win' ? 'lose' : data.outcome === 'lose' ? 'win' : 'draw',
      },
    }).then((res) => {
      if (!this.scene.isActive()) return;
      this.quote = res.line;
      this.quoteSource = res.source;
      // 自适应：长句逐级缩字，仍放不下则截断，绝不溢出面板
      let fontSize = 26;
      quoteText.setFontSize(fontSize);
      quoteText.setText(`「${res.line}」`);
      while (quoteText.height > 128 && fontSize > 19) {
        fontSize -= 2;
        quoteText.setFontSize(fontSize);
      }
      if (quoteText.height > 132) {
        quoteText.setText(`「${[...res.line].slice(0, 56).join('')}…」`);
      }
      if (res.source === 'ai') tag.setText(`${oppChar.emoji} 对手赛后锐评 ✨Claude 即兴`);
    });

    // ---------- 成就 / 解锁播报 ----------
    badges.forEach((b, i) => {
      this.time.delayedCall(500 + i * 900, () => {
        sfx.charge();
        const t = this.add
          .text(GAME_W / 2, 64, b, {
            fontFamily: UI_FONT,
            fontSize: '26px',
            fontStyle: 'bold',
            color: '#0f0e17',
            backgroundColor: '#ffd803',
            padding: { x: 16, y: 10 },
          })
          .setOrigin(0.5)
          .setDepth(95)
          .setAlpha(0);
        this.tweens.add({ targets: t, alpha: 1, y: 84, duration: 240, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: t, alpha: 0, delay: 2300, duration: 320, onComplete: () => t.destroy() });
      });
    });

    // ---------- 按钮 ----------
    this.buildButtons(data, profile);
  }

  /** 战绩入档 + 模式进度 + 成就检查，返回播报文案 */
  private applyProgress(profile: Profile, data: ResultPayload): string[] {
    const setup = data.setup;
    const badges: string[] = [];
    const win = data.outcome === 'win';

    // 全局统计（每日重赛同样计入全局，仅每日记录只记首次）
    const st = profile.stats;
    if (win) st.wins++;
    else if (data.outcome === 'lose') st.losses++;
    st.totalDamage += data.myStats.damageDealt;
    st.maxCombo = Math.max(st.maxCombo, data.myStats.maxCombo);
    st.fusions += data.myStats.fusions;
    st.ults += data.myStats.ultsCast;
    st.purified += data.myStats.garbagePurged;
    if (win) st.winsByChar[data.myCharId] = (st.winsByChar[data.myCharId] ?? 0) + 1;

    switch (setup.modeType) {
      case 'tower': {
        const floor = setup.floor ?? 1;
        if (win && floor === profile.towerFloor) {
          profile.towerBest = Math.max(profile.towerBest, floor);
          profile.towerFloor = Math.min(TOWER_MAX, floor + 1);
          if (floor === TOWER_MAX) badges.push('🌌 通天塔 100 层全通关！');
          const u = TOWER_UNLOCKS[floor];
          if (u && unlock(profile, u)) {
            const c = charById(u);
            badges.push(`🎁 解锁新模型：${c.emoji} ${c.name}`);
          }
        }
        break;
      }
      case 'endless': {
        const wave = setup.wave ?? 1;
        const reached = win ? wave : wave - 1;
        if (reached > profile.endlessBest) {
          profile.endlessBest = reached;
          if (reached > 0) badges.push(`♾️ 无尽新纪录：${reached} 波`);
        }
        break;
      }
      case 'daily': {
        const key = setup.dailyKey ?? todayKey();
        if (profile.daily.lastPlayedDate !== key) {
          profile.daily.lastPlayedDate = key;
          profile.daily.played++;
          if (win) {
            profile.daily.won++;
            profile.daily.streak = profile.daily.lastWinDate === yesterdayOf(key) ? profile.daily.streak + 1 : 1;
            profile.daily.lastWinDate = key;
            badges.push(`📅 每日挑战完成！连胜 ${profile.daily.streak} 天`);
          } else {
            profile.daily.streak = 0;
          }
        }
        break;
      }
      default:
        break;
    }

    for (const a of checkAchievements(profile)) {
      badges.push(`🏅 成就达成：${a.emoji} ${a.name}`);
    }
    return badges;
  }

  private buildButtons(data: ResultPayload, profile: Profile): void {
    const setup = data.setup;
    const win = data.outcome === 'win';

    const mkBtn = (x: number, y: number, w: number, label: string, color: number, onClick: () => void): void => {
      const bg = this.add.rectangle(x, y, w, 84, color, 1).setStrokeStyle(3, 0xfffffe, 0.7);
      this.add
        .text(x, y, label, { fontFamily: UI_FONT, fontSize: '28px', fontStyle: 'bold', color: '#fffffe' })
        .setOrigin(0.5);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        sfx.click();
        onClick();
      });
    };
    const toMenu = (): void => {
      this.scene.start('Menu');
    };
    const Y1 = 1020;
    const Y2 = 1118;
    const Y3 = 1216;

    // 💊 复活再战：失败且本局未复活过（每日挑战除外，保持公平），对手保留剩余血量
    const canRevive = data.outcome === 'lose' && !setup.revived && setup.modeType !== 'daily' && data.oppHp > 0;
    const reviveBtn = (y: number): void => {
      mkBtn(GAME_W / 2, y, 460, `💊 复活再战（对手仅剩 ${data.oppHp} HP）`, 0xb8860b, () => {
        const revivedSetup: BattleSetup = {
          ...setup,
          revived: true,
          mods: { ...setup.mods, p2StartHp: data.oppHp },
        };
        this.registry.set('setup', revivedSetup);
        this.scene.start('Battle');
      });
    };

    switch (setup.modeType) {
      case 'tower': {
        if (win) {
          const next = Math.min(profile.towerFloor, TOWER_MAX);
          mkBtn(GAME_W / 2, Y1, 460, profile.towerBest >= TOWER_MAX ? '🗼 回到塔层' : `⬆️ 继续爬塔（第 ${next} 层）`, 0x7f5af0, () =>
            this.scene.start('Tower'),
          );
          mkBtn(GAME_W / 2, Y2, 460, '🏠 主菜单', 0x1f1d33, toMenu);
        } else if (canRevive) {
          reviveBtn(Y1);
          mkBtn(GAME_W / 2 - 120, Y2, 220, '🔁 重战本层', 0x7f5af0, () => this.scene.start('Tower'));
          mkBtn(GAME_W / 2 + 130, Y2, 220, '🏠 主菜单', 0x1f1d33, toMenu);
        } else {
          mkBtn(GAME_W / 2, Y1, 460, '🔁 重整旗鼓，再战本层', 0x7f5af0, () => this.scene.start('Tower'));
          mkBtn(GAME_W / 2, Y2, 460, '🏠 主菜单', 0x1f1d33, toMenu);
        }
        break;
      }
      case 'endless': {
        if (win) {
          const nextWave = (setup.wave ?? 1) + 1;
          const carry = Math.min(100, data.myHp + ENDLESS_HEAL);
          mkBtn(GAME_W / 2, Y1, 460, `▶ 迎战第 ${nextWave} 波（回复至 ${carry} HP）`, 0x2cb67d, () => {
            const w = waveConfig(nextWave, carry);
            const nextSetup: BattleSetup = {
              modeType: 'endless',
              myCharId: setup.myCharId,
              oppCharId: w.oppChar === setup.myCharId ? setup.oppCharId : w.oppChar,
              difficultyId: w.difficulty.id,
              intervalMul: w.intervalMul,
              mods: w.mods,
              wave: nextWave,
            };
            this.registry.set('setup', nextSetup);
            this.scene.start('Battle');
          });
          mkBtn(GAME_W / 2, Y2, 460, `💾 见好就收（纪录 ${profile.endlessBest} 波）`, 0x1f1d33, toMenu);
        } else if (canRevive) {
          reviveBtn(Y1);
          mkBtn(GAME_W / 2 - 120, Y2, 220, '🔁 重新开始', 0x2cb67d, () => {
            this.registry.set('flow', { type: 'endless' } satisfies FlowState);
            this.scene.start('CharacterSelect');
          });
          mkBtn(GAME_W / 2 + 130, Y2, 220, '🏠 主菜单', 0x1f1d33, toMenu);
        } else {
          mkBtn(GAME_W / 2, Y1, 460, '🔁 重新挑战', 0x2cb67d, () => {
            this.registry.set('flow', { type: 'endless' } satisfies FlowState);
            this.scene.start('CharacterSelect');
          });
          mkBtn(GAME_W / 2, Y2, 460, '🏠 主菜单', 0x1f1d33, toMenu);
        }
        break;
      }
      case 'daily': {
        mkBtn(GAME_W / 2, Y1, 460, '🏠 主菜单', 0x7f5af0, toMenu);
        mkBtn(GAME_W / 2, Y2, 460, '🔁 再打一把（不计连胜）', 0x1f1d33, () => {
          this.registry.set('setup', setup);
          this.scene.start('Battle');
        });
        break;
      }
      default: {
        if (canRevive) {
          reviveBtn(Y1);
          mkBtn(GAME_W / 2 - 120, Y2, 220, '⚔️ 再来一局', 0x7f5af0, () => {
            this.registry.set('flow', { type: 'quick' } satisfies FlowState);
            this.scene.start('CharacterSelect');
          });
          mkBtn(GAME_W / 2 + 130, Y2, 220, '🏠 主菜单', 0x1f1d33, toMenu);
        } else {
          mkBtn(GAME_W / 2 - 120, Y1, 220, '⚔️ 再来一局', 0x7f5af0, () => {
            this.registry.set('flow', { type: 'quick' } satisfies FlowState);
            this.scene.start('CharacterSelect');
          });
          mkBtn(GAME_W / 2 + 130, Y1, 220, '🏠 主菜单', 0x1f1d33, toMenu);
          mkBtn(GAME_W / 2, Y2, 470, '🗼 去爬塔解锁新模型', 0x2cb67d, () => this.scene.start('Tower'));
        }
      }
    }

    mkBtn(GAME_W / 2, Y3, 470, '📸 保存战报卡（可分享）', 0x16424f, () => {
      const canvas = buildShareCard({
        outcome: data.outcome,
        myChar: charById(data.myCharId),
        oppChar: charById(data.oppCharId),
        difficultyLabel: data.difficultyLabel,
        myStats: data.myStats,
        elapsedSec: data.elapsedSec,
        quote: this.quote,
        quoteSource: this.quoteSource,
      });
      downloadCanvas(canvas, `AI大乱斗战报-${Date.now()}.png`);
    });
  }
}
