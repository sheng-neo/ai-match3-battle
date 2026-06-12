import Phaser from 'phaser';
import { charById } from '../../battle/characters';
import { GAME_H, GAME_W, UI_FONT } from '../../config';
import { fetchTaunt } from '../../taunt/tauntClient';
import { sfx } from '../audio/sfx';
import { buildShareCard, downloadCanvas } from '../share/shareCard';
import type { ResultPayload } from './BattleScene';

export class ResultScene extends Phaser.Scene {
  private quote = '……';
  private quoteSource: 'ai' | 'fallback' = 'fallback';

  constructor() {
    super('Result');
  }

  create(data: ResultPayload): void {
    const myChar = charById(data.myCharId);
    const oppChar = charById(data.oppCharId);

    if (data.outcome === 'win') sfx.win();
    else if (data.outcome === 'lose') sfx.lose();

    const outcomeText = data.outcome === 'win' ? '🏆 胜 利' : data.outcome === 'lose' ? '💀 惜 败' : '🤝 平 局';
    const outcomeColor = data.outcome === 'win' ? '#2cb67d' : data.outcome === 'lose' ? '#e53170' : '#ffd803';
    const big = this.add
      .text(GAME_W / 2, 170, outcomeText, {
        fontFamily: UI_FONT,
        fontSize: '96px',
        fontStyle: 'bold',
        color: outcomeColor,
        stroke: '#000',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScale(0.3);
    this.tweens.add({ targets: big, scale: 1, duration: 380, ease: 'Back.easeOut' });
    if (data.byTimeout) {
      this.add
        .text(GAME_W / 2, 248, '时间到 · 按总伤害判定', { fontFamily: UI_FONT, fontSize: '24px', color: '#a7a9be' })
        .setOrigin(0.5);
    }

    // 对阵
    this.add.image(GAME_W / 2 - 170, 360, `avatar-${myChar.id}`).setDisplaySize(110, 110);
    this.add.image(GAME_W / 2 + 170, 360, `avatar-${oppChar.id}`).setDisplaySize(110, 110);
    this.add
      .text(GAME_W / 2, 360, 'VS', { fontFamily: UI_FONT, fontSize: '44px', fontStyle: 'bold', color: '#fffffe' })
      .setOrigin(0.5);
    this.add
      .text(GAME_W / 2 - 170, 438, '我方', { fontFamily: UI_FONT, fontSize: '22px', color: '#a7a9be' })
      .setOrigin(0.5);
    this.add
      .text(GAME_W / 2 + 170, 438, `${oppChar.name}`, { fontFamily: UI_FONT, fontSize: '22px', color: '#a7a9be' })
      .setOrigin(0.5);

    // 战绩
    const rows: [string, string, string][] = [
      ['总伤害', `${data.myStats.damageDealt}`, `${data.oppStats.damageDealt}`],
      ['最大连击', `×${data.myStats.maxCombo}`, `×${data.oppStats.maxCombo}`],
      ['大招', `${data.myStats.ultsCast}`, `${data.oppStats.ultsCast}`],
      ['净化脏数据', `${data.myStats.garbagePurged}`, `${data.oppStats.garbagePurged}`],
      ['剩余 HP', `${data.myHp}`, `${data.oppHp}`],
    ];
    rows.forEach(([k, mine, theirs], i) => {
      const y = 520 + i * 48;
      this.add.text(GAME_W / 2, y, k, { fontFamily: UI_FONT, fontSize: '26px', color: '#5e5c70' }).setOrigin(0.5);
      this.add
        .text(GAME_W / 2 - 150, y, mine, { fontFamily: UI_FONT, fontSize: '28px', fontStyle: 'bold', color: '#fffffe' })
        .setOrigin(0.5);
      this.add
        .text(GAME_W / 2 + 150, y, theirs, { fontFamily: UI_FONT, fontSize: '28px', color: '#a7a9be' })
        .setOrigin(0.5);
    });

    // 对手赛后锐评（异步：Claude 即兴 → 降级本地台词）
    const panel = this.add.rectangle(GAME_W / 2, 880, 640, 170, 0x7f5af0, 0.12).setStrokeStyle(2, 0x7f5af0, 0.7);
    const tag = this.add
      .text(GAME_W / 2, 815, `${oppChar.emoji} 对手赛后锐评`, { fontFamily: UI_FONT, fontSize: '24px', color: '#a786ff' })
      .setOrigin(0.5);
    const quoteText = this.add
      .text(GAME_W / 2, 890, '对手正在打字…', {
        fontFamily: UI_FONT,
        fontSize: '28px',
        color: '#fffffe',
        align: 'center',
        wordWrap: { width: 580 },
        lineSpacing: 8,
      })
      .setOrigin(0.5);
    void panel;

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
      quoteText.setText(`「${res.line}」`);
      if (res.source === 'ai') tag.setText(`${oppChar.emoji} 对手赛后锐评 ✨Claude 即兴`);
    });

    // 按钮
    const mkBtn = (x: number, y: number, w: number, label: string, color: number, onClick: () => void): void => {
      const bg = this.add.rectangle(x, y, w, 86, color, 1).setStrokeStyle(3, 0xfffffe, 0.7);
      this.add
        .text(x, y, label, { fontFamily: UI_FONT, fontSize: '30px', fontStyle: 'bold', color: '#fffffe' })
        .setOrigin(0.5);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        sfx.click();
        onClick();
      });
    };
    mkBtn(GAME_W / 2 - 180, 1060, 320, '⚔️ 再来一局', 0x7f5af0, () => this.scene.start('CharacterSelect'));
    mkBtn(GAME_W / 2 + 180, 1060, 320, '🏠 主菜单', 0x1f1d33, () => this.scene.start('Menu'));
    mkBtn(GAME_W / 2, 1170, 480, '📸 保存战报卡（可分享）', 0x2cb67d, () => {
      const canvas = buildShareCard({
        outcome: data.outcome,
        myChar,
        oppChar,
        difficultyLabel: data.difficultyLabel,
        myStats: data.myStats,
        elapsedSec: data.elapsedSec,
        quote: this.quote,
        quoteSource: this.quoteSource,
      });
      downloadCanvas(canvas, `AI大乱斗战报-${Date.now()}.png`);
      this.add
        .text(GAME_W / 2, 1240, '已生成 PNG（手机端如未下载请截屏分享）', {
          fontFamily: UI_FONT,
          fontSize: '20px',
          color: '#5e5c70',
        })
        .setOrigin(0.5);
    });
  }
}
