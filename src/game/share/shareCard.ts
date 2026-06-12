import type { CharacterDef } from '../../battle/characters';
import type { SideStats } from '../../battle/battleController';

export interface ShareCardData {
  outcome: 'win' | 'lose' | 'draw';
  myChar: CharacterDef;
  oppChar: CharacterDef;
  difficultyLabel: string;
  myStats: SideStats;
  elapsedSec: number;
  quote: string;
  quoteSource: 'ai' | 'fallback';
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const ch of text) {
    if (ctx.measureText(cur + ch).width > maxWidth) {
      lines.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** 离屏 canvas 绘制可分享战报卡（750×1000 PNG） */
export function buildShareCard(data: ShareCardData): HTMLCanvasElement {
  const W = 750;
  const H = 1000;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0f0e17');
  bg.addColorStop(1, '#1b1930');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#7f5af0';
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, W - 28, H - 28);

  ctx.textAlign = 'center';
  const FONT = "'PingFang SC','Microsoft YaHei',sans-serif";
  const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

  // 标题
  ctx.fillStyle = '#a7a9be';
  ctx.font = `28px ${FONT}`;
  ctx.fillText('⚔️ AI 大乱斗 · 消消乐 ⚔️', W / 2, 78);

  // 结果
  const outcomeText = data.outcome === 'win' ? '胜 利' : data.outcome === 'lose' ? '惜 败' : '平 局';
  ctx.fillStyle = data.outcome === 'win' ? '#2cb67d' : data.outcome === 'lose' ? '#e53170' : '#ffd803';
  ctx.font = `bold 96px ${FONT}`;
  ctx.fillText(outcomeText, W / 2, 200);

  // 对阵
  ctx.font = `72px ${EMOJI}`;
  ctx.fillText(data.myChar.emoji, W / 2 - 180, 330);
  ctx.fillText(data.oppChar.emoji, W / 2 + 180, 330);
  ctx.fillStyle = '#fffffe';
  ctx.font = `bold 44px ${FONT}`;
  ctx.fillText('VS', W / 2, 322);
  ctx.font = `24px ${FONT}`;
  ctx.fillStyle = '#a7a9be';
  ctx.fillText(data.myChar.name, W / 2 - 180, 380);
  ctx.fillText(`${data.oppChar.name}（${data.difficultyLabel}）`, W / 2 + 180, 380);

  // 战绩
  const stats: [string, string][] = [
    ['总伤害', `${data.myStats.damageDealt}`],
    ['最大连击', `x${data.myStats.maxCombo}`],
    ['释放大招', `${data.myStats.ultsCast} 次`],
    ['净化脏数据', `${data.myStats.garbagePurged} 块`],
    ['用时', `${data.elapsedSec}s`],
  ];
  ctx.font = `30px ${FONT}`;
  stats.forEach(([k, v], i) => {
    const y = 470 + i * 56;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#a7a9be';
    ctx.fillText(k, 140, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fffffe';
    ctx.fillText(v, W - 140, y);
  });

  // AI 锐评
  ctx.textAlign = 'center';
  const quoteTop = 790;
  ctx.fillStyle = 'rgba(127,90,240,0.14)';
  ctx.fillRect(70, quoteTop - 46, W - 140, 170);
  ctx.strokeStyle = 'rgba(127,90,240,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(70, quoteTop - 46, W - 140, 170);
  ctx.fillStyle = '#a786ff';
  ctx.font = `24px ${FONT}`;
  const tag = data.quoteSource === 'ai' ? '✨ 对手赛后锐评（Claude 即兴）' : '💬 对手赛后锐评';
  ctx.fillText(tag, W / 2, quoteTop - 10);
  ctx.fillStyle = '#fffffe';
  ctx.font = `30px ${FONT}`;
  const lines = wrapText(ctx, `「${data.quote}」`, W - 200);
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, W / 2, quoteTop + 38 + i * 42));

  // 页脚
  ctx.fillStyle = '#5e5c70';
  ctx.font = `22px ${FONT}`;
  ctx.fillText('你能打过万亿参数 MoE 吗？', W / 2, H - 50);

  return canvas;
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/png');
}
