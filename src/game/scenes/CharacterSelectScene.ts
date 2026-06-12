import Phaser from 'phaser';
import { CHARACTERS, charById, otherCharacters, type CharacterDef } from '../../battle/characters';
import { DIFFICULTIES, GAME_H, GAME_W, UI_FONT } from '../../config';
import { waveConfig } from '../../meta/endless';
import { isUnlocked, loadProfile } from '../../meta/save';
import { TOWER_MAX, TOWER_UNLOCKS, floorConfig } from '../../meta/tower';
import type { PersonaId } from '../../shared/tauntProtocol';
import type { BattleSetup, FlowState } from '../flow';
import { sfx } from '../audio/sfx';

function unlockHint(id: PersonaId): string {
  for (const [floor, pid] of Object.entries(TOWER_UNLOCKS)) {
    if (pid === id) return `通过爬塔第 ${floor} 层解锁`;
  }
  return '暂未解锁';
}

export class CharacterSelectScene extends Phaser.Scene {
  private toastText?: Phaser.GameObjects.Text;

  constructor() {
    super('CharacterSelect');
  }

  create(): void {
    const flow = (this.registry.get('flow') as FlowState | undefined) ?? { type: 'quick' };
    const profile = loadProfile();

    const titles: Record<string, string> = {
      quick: '⚡ 快速对战 · 选择出战模型',
      tower: `🗼 第 ${Math.min(profile.towerFloor, TOWER_MAX)} 层 · 选择出战模型`,
      endless: '♾️ 无尽挑战 · 选择出战模型',
      daily: '选择出战模型',
    };
    this.add
      .text(GAME_W / 2, 86, titles[flow.type], {
        fontFamily: UI_FONT,
        fontSize: '40px',
        fontStyle: 'bold',
        color: '#fffffe',
      })
      .setOrigin(0.5);

    // 快速对战：难度档
    if (flow.type === 'quick') {
      if (!this.registry.has('difficulty')) this.registry.set('difficulty', 'normal');
      const chips: Phaser.GameObjects.Rectangle[] = [];
      DIFFICULTIES.forEach((d, i) => {
        const x = GAME_W / 2 + (i - 1) * 215;
        const bg = this.add.rectangle(x, 160, 200, 62, 0x1f1d33, 1);
        this.add
          .text(x, 160, d.label, { fontFamily: UI_FONT, fontSize: '22px', color: '#fffffe' })
          .setOrigin(0.5);
        bg.setData('id', d.id);
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => {
          sfx.click();
          this.registry.set('difficulty', d.id);
          refresh();
        });
        chips.push(bg);
      });
      const refresh = (): void => {
        const cur = this.registry.get('difficulty') as string;
        for (const c of chips) {
          const mine = c.getData('id') === cur;
          c.setStrokeStyle(mine ? 4 : 2, mine ? 0xffd803 : 0x2e2e3e, 1);
          c.setFillStyle(mine ? 0x2a2545 : 0x1f1d33, 1);
        }
      };
      refresh();
    } else {
      this.add
        .text(GAME_W / 2, 152, '本模式的对手与规则由关卡决定', { fontFamily: UI_FONT, fontSize: '22px', color: '#a7a9be' })
        .setOrigin(0.5);
    }

    // 2×3 角色卡
    const colX = [GAME_W / 2 - 178, GAME_W / 2 + 178];
    const startY = 330;
    const rowH = 304;
    CHARACTERS.forEach((c, i) => {
      const x = colX[i % 2];
      const y = startY + Math.floor(i / 2) * rowH;
      this.drawCard(c, x, y, isUnlocked(profile, c.id), flow);
    });

    const back = this.add
      .text(GAME_W / 2, GAME_H - 52, '← 返回', { fontFamily: UI_FONT, fontSize: '26px', color: '#a7a9be' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start(flow.type === 'tower' ? 'Tower' : 'Menu'));
  }

  private drawCard(c: CharacterDef, x: number, y: number, unlocked: boolean, flow: FlowState): void {
    const bg = this.add
      .rectangle(x, y, 340, 280, unlocked ? 0x1f1d33 : 0x141320, 1)
      .setStrokeStyle(3, unlocked ? c.accent : 0x2e2e3e, 1);
    this.add.image(x - 110, y - 92, `avatar-${c.id}`).setDisplaySize(86, 86).setAlpha(unlocked ? 1 : 0.35);
    this.add
      .text(x - 52, y - 112, c.name, {
        fontFamily: UI_FONT,
        fontSize: '21px',
        fontStyle: 'bold',
        color: unlocked ? '#fffffe' : '#5e5c70',
        wordWrap: { width: 200 },
      })
      .setOrigin(0, 0.5);
    this.add
      .text(x - 52, y - 78, c.title, { fontFamily: UI_FONT, fontSize: '17px', color: unlocked ? '#a7a9be' : '#44424f' })
      .setOrigin(0, 0.5);

    if (unlocked) {
      this.add
        .text(x - 152, y - 28, `🟢 ${c.passiveName}：${c.passiveDesc}`, {
          fontFamily: UI_FONT,
          fontSize: '17px',
          color: '#2cb67d',
          wordWrap: { width: 304 },
          lineSpacing: 4,
        })
        .setOrigin(0, 0);
      this.add
        .text(x - 152, y + 40, `🌟 ${c.ultName}：${c.ultDesc}`, {
          fontFamily: UI_FONT,
          fontSize: '17px',
          color: '#ffd803',
          wordWrap: { width: 304 },
          lineSpacing: 4,
        })
        .setOrigin(0, 0);
    } else {
      this.add.text(x, y + 10, '🔒', { fontSize: '46px' }).setOrigin(0.5);
      this.add
        .text(x, y + 70, unlockHint(c.id), { fontFamily: UI_FONT, fontSize: '19px', color: '#5e5c70' })
        .setOrigin(0.5);
    }

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => unlocked && bg.setFillStyle(0x2a2545, 1));
    bg.on('pointerout', () => unlocked && bg.setFillStyle(0x1f1d33, 1));
    bg.on('pointerdown', () => {
      if (!unlocked) {
        sfx.invalid();
        this.toast(`🔒 ${unlockHint(c.id)}（每日挑战偶尔可试用）`);
        return;
      }
      sfx.click();
      this.pick(c, flow);
    });
  }

  private pick(c: CharacterDef, flow: FlowState): void {
    const profile = loadProfile();
    let setup: BattleSetup;
    switch (flow.type) {
      case 'tower': {
        const cfg = floorConfig(Math.min(profile.towerFloor, TOWER_MAX));
        setup = {
          modeType: 'tower',
          myCharId: c.id,
          oppCharId: cfg.oppChar,
          difficultyId: cfg.difficulty.id,
          intervalMul: cfg.intervalMul,
          mods: cfg.mods,
          floor: cfg.floor,
          rules: cfg.rules,
        };
        break;
      }
      case 'endless': {
        const w = waveConfig(1, 100);
        setup = {
          modeType: 'endless',
          myCharId: c.id,
          oppCharId: w.oppChar === c.id ? otherCharacters(c.id)[0].id : w.oppChar,
          difficultyId: w.difficulty.id,
          intervalMul: w.intervalMul,
          mods: w.mods,
          wave: 1,
        };
        break;
      }
      default: {
        const others = otherCharacters(c.id);
        const opp = others[Math.floor(Math.random() * others.length)];
        setup = {
          modeType: 'quick',
          myCharId: c.id,
          oppCharId: opp.id,
          difficultyId: (this.registry.get('difficulty') as BattleSetup['difficultyId']) ?? 'normal',
          intervalMul: 1,
          mods: {},
        };
      }
    }
    this.registry.set('setup', setup);
    this.showVs(c.emoji, charById(setup.oppCharId).emoji, () => this.scene.start('Battle'));
  }

  private toast(msg: string): void {
    this.toastText?.destroy();
    const t = this.add
      .text(GAME_W / 2, 226, msg, {
        fontFamily: UI_FONT,
        fontSize: '22px',
        color: '#fffffe',
        backgroundColor: 'rgba(15,14,23,0.92)',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(80);
    this.toastText = t;
    this.tweens.add({ targets: t, alpha: 0, delay: 1500, duration: 300, onComplete: () => t.destroy() });
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
