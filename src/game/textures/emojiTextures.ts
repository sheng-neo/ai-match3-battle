import Phaser from 'phaser';
import { COLOR_EMOJI, COLOR_HEX } from '../../config';
import { CHARACTERS } from '../../battle/characters';

export const TILE_SIZE = 96;

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

function hexToCss(hex: number, alpha = 1): string {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawEmojiOrLetter(
  ctx: CanvasRenderingContext2D,
  emoji: string,
  fallbackLetter: string,
  fallbackColor: string,
  cx: number,
  cy: number,
  px: number,
): void {
  ctx.font = `${px}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(emoji).width;
  if (w >= px * 0.4) {
    ctx.fillText(emoji, cx, cy);
  } else {
    // 平台不支持该 emoji：降级为字母 + 色块
    ctx.fillStyle = fallbackColor;
    ctx.font = `bold ${px}px sans-serif`;
    ctx.fillText(fallbackLetter, cx, cy);
  }
}

function makeCanvas(scene: Phaser.Scene, key: string, size: number): CanvasRenderingContext2D | null {
  if (scene.textures.exists(key)) return null;
  const tex = scene.textures.createCanvas(key, size, size);
  return tex ? tex.context : null;
}

function refresh(scene: Phaser.Scene, key: string): void {
  const tex = scene.textures.get(key) as Phaser.Textures.CanvasTexture;
  tex.refresh();
}

/** 一次性烘焙全部纹理：棋子、特殊块覆盖层、锁、火花、头像 */
export function bakeAllTextures(scene: Phaser.Scene): void {
  const S = TILE_SIZE;
  const C = S / 2;

  // 六色棋子
  for (let color = 0; color < 6; color++) {
    const key = `tile-${color}`;
    const ctx = makeCanvas(scene, key, S);
    if (!ctx) continue;
    const hex = COLOR_HEX[color];
    roundRect(ctx, 4, 4, S - 8, S - 8, 18);
    ctx.fillStyle = hexToCss(hex, 0.18);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = hexToCss(hex, 0.95);
    ctx.stroke();
    drawEmojiOrLetter(ctx, COLOR_EMOJI[color], 'DCPEVT'[color], hexToCss(hex), C, C + 3, 54);
    refresh(scene, key);
  }

  // 脏数据
  {
    const ctx = makeCanvas(scene, 'tile-garbage', S);
    if (ctx) {
      roundRect(ctx, 4, 4, S - 8, S - 8, 18);
      ctx.fillStyle = 'rgba(90,90,100,0.45)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(160,160,170,0.9)';
      ctx.setLineDash([8, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      drawEmojiOrLetter(ctx, '💩', 'G', '#999', C, C + 3, 50);
      refresh(scene, 'tile-garbage');
    }
  }

  // 奇点
  {
    const ctx = makeCanvas(scene, 'tile-sing', S);
    if (ctx) {
      roundRect(ctx, 4, 4, S - 8, S - 8, 18);
      ctx.fillStyle = 'rgba(20,18,40,0.95)';
      ctx.fill();
      const grad = ctx.createLinearGradient(0, 0, S, S);
      grad.addColorStop(0, '#7f5af0');
      grad.addColorStop(0.5, '#2cb67d');
      grad.addColorStop(1, '#ff8906');
      ctx.lineWidth = 4;
      ctx.strokeStyle = grad;
      ctx.stroke();
      drawEmojiOrLetter(ctx, '🌀', 'S', '#7f5af0', C, C + 3, 54);
      refresh(scene, 'tile-sing');
    }
  }

  // 特殊块覆盖层：横/竖激光箭头、卷积核框
  {
    const ctx = makeCanvas(scene, 'ov-row', S);
    if (ctx) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.moveTo(6, C);
      ctx.lineTo(24, C - 11);
      ctx.lineTo(24, C + 11);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(S - 6, C);
      ctx.lineTo(S - 24, C - 11);
      ctx.lineTo(S - 24, C + 11);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(24, C - 3, S - 48, 6);
      refresh(scene, 'ov-row');
    }
  }
  {
    const ctx = makeCanvas(scene, 'ov-col', S);
    if (ctx) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.moveTo(C, 6);
      ctx.lineTo(C - 11, 24);
      ctx.lineTo(C + 11, 24);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(C, S - 6);
      ctx.lineTo(C - 11, S - 24);
      ctx.lineTo(C + 11, S - 24);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(C - 3, 24, 6, S - 48);
      refresh(scene, 'ov-col');
    }
  }
  {
    const ctx = makeCanvas(scene, 'ov-kernel', S);
    if (ctx) {
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      roundRect(ctx, 14, 14, S - 28, S - 28, 10);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (const [dx, dy] of [
        [14, 14],
        [S - 14, 14],
        [14, S - 14],
        [S - 14, S - 14],
      ]) {
        ctx.beginPath();
        ctx.arc(dx, dy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      refresh(scene, 'ov-kernel');
    }
  }

  // 验证码锁（剩余 1/2/3 击三种态）
  for (let hits = 1; hits <= 3; hits++) {
    const key = `ov-lock${hits}`;
    const ctx = makeCanvas(scene, key, S);
    if (!ctx) continue;
    roundRect(ctx, 4, 4, S - 8, S - 8, 18);
    ctx.fillStyle = 'rgba(8,8,14,0.62)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,216,3,0.9)';
    ctx.stroke();
    drawEmojiOrLetter(ctx, '🔒', 'L', '#ffd803', C, C - 6, 38);
    // 剩余点击数 pips
    ctx.fillStyle = '#ffd803';
    const total = hits;
    const startX = C - (total - 1) * 10;
    for (let i = 0; i < total; i++) {
      ctx.beginPath();
      ctx.arc(startX + i * 20, S - 20, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    refresh(scene, key);
  }

  // 粒子火花
  {
    const ctx = makeCanvas(scene, 'spark', 16);
    if (ctx) {
      const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.6)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 16, 16);
      refresh(scene, 'spark');
    }
  }

  // 角色头像
  for (const c of CHARACTERS) {
    const key = `avatar-${c.id}`;
    const size = 128;
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, size, size);
    if (!tex) continue;
    const ctx = tex.context;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(127,90,240,0.25)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#7f5af0';
    ctx.stroke();
    drawEmojiOrLetter(ctx, c.emoji, c.name[0], '#fffffe', size / 2, size / 2 + 4, 64);
    tex.refresh();
  }
}
