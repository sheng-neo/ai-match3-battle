import Phaser from 'phaser';
import { COLOR_HEX } from '../../config';
import { CHARACTERS } from '../../battle/characters';

export const TILE_SIZE = 128;

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

/** t>0 向白色提亮，t<0 向黑色压暗 */
function shade(hex: number, t: number, alpha = 1): string {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const f = (c: number) => Math.round(t >= 0 ? c + (255 - c) * t : c * (1 + t));
  return `rgba(${f(r)},${f(g)},${f(b)},${alpha})`;
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
  withShadow = true,
): void {
  ctx.save();
  ctx.font = `${px}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (withShadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
  }
  const w = ctx.measureText(emoji).width;
  if (w >= px * 0.4) {
    ctx.fillText(emoji, cx, cy);
  } else {
    ctx.fillStyle = fallbackColor;
    ctx.font = `bold ${px}px sans-serif`;
    ctx.fillText(fallbackLetter, cx, cy);
  }
  ctx.restore();
}

/** 立体糖果质感底块：投影 + 纵向渐变 + 玻璃高光 + 提亮包边 */
function drawGlossyBase(ctx: CanvasRenderingContext2D, S: number, hex: number, opts: { dashed?: boolean } = {}): void {
  const m = Math.round(S * 0.06); // 8
  const r = Math.round(S * 0.2); // 26
  const bodyH = S - m * 2 - Math.round(S * 0.05);

  // 底部投影
  roundRect(ctx, m, m + Math.round(S * 0.07), S - m * 2, bodyH, r);
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.fill();

  // 主体纵向渐变（顶亮底暗 = 立体）
  const body = ctx.createLinearGradient(0, m, 0, m + bodyH);
  body.addColorStop(0, shade(hex, 0.52));
  body.addColorStop(0.45, shade(hex, 0.02));
  body.addColorStop(1, shade(hex, -0.36));
  roundRect(ctx, m, m, S - m * 2, bodyH, r);
  ctx.fillStyle = body;
  ctx.fill();

  // 包边
  ctx.lineWidth = Math.max(2, S * 0.024);
  ctx.strokeStyle = shade(hex, 0.32, 0.95);
  if (opts.dashed) ctx.setLineDash([Math.round(S * 0.09), Math.round(S * 0.06)]);
  roundRect(ctx, m + 1, m + 1, S - m * 2 - 2, bodyH - 2, r - 1);
  ctx.stroke();
  ctx.setLineDash([]);

  // 顶部玻璃高光
  const gloss = ctx.createLinearGradient(0, m + 2, 0, m + bodyH * 0.42);
  gloss.addColorStop(0, 'rgba(255,255,255,0.55)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  roundRect(ctx, m + Math.round(S * 0.07), m + Math.round(S * 0.045), S - m * 2 - Math.round(S * 0.14), bodyH * 0.4, r * 0.6);
  ctx.fillStyle = gloss;
  ctx.fill();
}

/**
 * 手绘高辨识 AI 图标（设计基于 128px，按 u 缩放）：
 * 0 数据=数据库圆柱 1 算力=芯片闪电 2 参数=神经网络 3 能量=电池 4 显存=内存条 5 Token=代币
 */
function drawAiIcon(ctx: CanvasRenderingContext2D, color: number, S: number): void {
  const u = S / 128;
  const cx = 64 * u;
  const white = 'rgba(255,255,255,0.96)';
  const dark = shade(COLOR_HEX[color], -0.55);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 6 * u;
  ctx.shadowOffsetY = 3 * u;

  switch (color) {
    case 0: {
      // 数据库圆柱
      const rx = 26 * u;
      const ry = 10 * u;
      const top = 44 * u;
      const bot = 88 * u;
      ctx.fillStyle = white;
      ctx.beginPath();
      ctx.ellipse(cx, top, rx, ry, 0, Math.PI, Math.PI * 2);
      ctx.lineTo(cx + rx, bot);
      ctx.ellipse(cx, bot, rx, ry, 0, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, top, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = dark;
      ctx.lineWidth = 3.5 * u;
      ctx.beginPath();
      ctx.ellipse(cx, top, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (const yy of [59, 74]) {
        ctx.beginPath();
        ctx.ellipse(cx, yy * u, rx, ry, 0, 0.18, Math.PI - 0.18);
        ctx.stroke();
      }
      break;
    }
    case 1: {
      // 芯片 + 闪电
      const x = 42 * u;
      const y = 42 * u;
      const w = 44 * u;
      ctx.fillStyle = white;
      // 引脚（四边各 3 根）
      for (let i = 0; i < 3; i++) {
        const off = x + w * (0.22 + i * 0.28) - 3 * u;
        ctx.fillRect(off, y - 8 * u, 6 * u, 8 * u);
        ctx.fillRect(off, y + w, 6 * u, 8 * u);
        ctx.fillRect(x - 8 * u, off, 8 * u, 6 * u);
        ctx.fillRect(x + w, off, 8 * u, 6 * u);
      }
      roundRect(ctx, x, y, w, w, 8 * u);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = dark;
      roundRect(ctx, x + 8 * u, y + 8 * u, w - 16 * u, w - 16 * u, 5 * u);
      ctx.fill();
      ctx.fillStyle = white;
      ctx.beginPath();
      ctx.moveTo(69 * u, 48 * u);
      ctx.lineTo(56 * u, 67 * u);
      ctx.lineTo(63 * u, 67 * u);
      ctx.lineTo(59 * u, 80 * u);
      ctx.lineTo(73 * u, 61 * u);
      ctx.lineTo(65 * u, 61 * u);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 2: {
      // 神经网络（2-3-2 节点连线）
      const L: [number, number][] = [
        [42, 52],
        [42, 80],
      ];
      const M: [number, number][] = [
        [64, 42],
        [64, 66],
        [64, 90],
      ];
      const R: [number, number][] = [
        [86, 52],
        [86, 80],
      ];
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 3 * u;
      ctx.shadowColor = 'transparent';
      ctx.beginPath();
      for (const [lx, ly] of L)
        for (const [mx, my] of M) {
          ctx.moveTo(lx * u, ly * u);
          ctx.lineTo(mx * u, my * u);
        }
      for (const [mx, my] of M)
        for (const [rx2, ry2] of R) {
          ctx.moveTo(mx * u, my * u);
          ctx.lineTo(rx2 * u, ry2 * u);
        }
      ctx.stroke();
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.fillStyle = white;
      for (const [px, py] of [...L, ...M, ...R]) {
        ctx.beginPath();
        ctx.arc(px * u, py * u, (px === 64 ? 7.5 : 6.5) * u, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 3: {
      // 电池（满电三格）
      ctx.strokeStyle = white;
      ctx.lineWidth = 5 * u;
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      roundRect(ctx, 36 * u, 50 * u, 46 * u, 32 * u, 6 * u);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = white;
      roundRect(ctx, 84 * u, 58 * u, 9 * u, 16 * u, 3 * u);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      for (let i = 0; i < 3; i++) {
        roundRect(ctx, (43 + i * 12.5) * u, 56 * u, 9 * u, 20 * u, 2.5 * u);
        ctx.fill();
      }
      break;
    }
    case 4: {
      // 内存条（芯片 + 金手指）
      ctx.fillStyle = white;
      roundRect(ctx, 46 * u, 38 * u, 36 * u, 46 * u, 4 * u);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = dark;
      for (const [dx, dy] of [
        [52, 45],
        [67, 45],
        [52, 62],
        [67, 62],
      ]) {
        roundRect(ctx, dx * u, dy * u, 10 * u, 12 * u, 2 * u);
        ctx.fill();
      }
      ctx.fillStyle = '#ffd803';
      for (let i = 0; i < 6; i++) {
        ctx.fillRect((48 + i * 5.5) * u, 85 * u, 4 * u, 8 * u);
      }
      break;
    }
    case 5: {
      // Token 代币
      ctx.fillStyle = white;
      ctx.beginPath();
      ctx.arc(cx, 66 * u, 27 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2.5 * u;
      ctx.beginPath();
      ctx.arc(cx, 66 * u, 21 * u, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = dark;
      ctx.font = `bold ${34 * u}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('T', cx, 67 * u);
      break;
    }
  }
  ctx.restore();
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
  const emojiY = C + Math.round(S * 0.04);

  // 六色棋子（立体糖果 + 手绘高辨识 AI 图标，不再依赖 emoji）
  for (let color = 0; color < 6; color++) {
    const key = `tile-${color}`;
    const ctx = makeCanvas(scene, key, S);
    if (!ctx) continue;
    drawGlossyBase(ctx, S, COLOR_HEX[color]);
    drawAiIcon(ctx, color, S);
    refresh(scene, key);
  }

  // 脏数据（灰暗 + 虚线边）
  {
    const ctx = makeCanvas(scene, 'tile-garbage', S);
    if (ctx) {
      drawGlossyBase(ctx, S, 0x55555f, { dashed: true });
      drawEmojiOrLetter(ctx, '💩', 'G', '#999', C, emojiY, Math.round(S * 0.46));
      refresh(scene, 'tile-garbage');
    }
  }

  // 奇点（暗体 + 彩虹包边）
  {
    const ctx = makeCanvas(scene, 'tile-sing', S);
    if (ctx) {
      drawGlossyBase(ctx, S, 0x232040);
      const grad = ctx.createLinearGradient(0, 0, S, S);
      grad.addColorStop(0, '#7f5af0');
      grad.addColorStop(0.35, '#3da9fc');
      grad.addColorStop(0.7, '#2cb67d');
      grad.addColorStop(1, '#ff8906');
      ctx.lineWidth = Math.max(3, S * 0.032);
      ctx.strokeStyle = grad;
      const m = Math.round(S * 0.06);
      roundRect(ctx, m + 1, m + 1, S - m * 2 - 2, S - m * 2 - Math.round(S * 0.05) - 2, Math.round(S * 0.2) - 1);
      ctx.stroke();
      drawEmojiOrLetter(ctx, '🌀', 'S', '#7f5af0', C, emojiY, Math.round(S * 0.52));
      refresh(scene, 'tile-sing');
    }
  }

  // 特殊块覆盖层（白色 + 黑描影，确保亮底可读）
  const overlayShadow = (ctx: CanvasRenderingContext2D): void => {
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 7;
  };
  {
    const ctx = makeCanvas(scene, 'ov-row', S);
    if (ctx) {
      ctx.save();
      overlayShadow(ctx);
      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      const a = Math.round(S * 0.07);
      const t = Math.round(S * 0.115);
      ctx.beginPath();
      ctx.moveTo(a, C);
      ctx.lineTo(a + t * 1.7, C - t);
      ctx.lineTo(a + t * 1.7, C + t);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(S - a, C);
      ctx.lineTo(S - a - t * 1.7, C - t);
      ctx.lineTo(S - a - t * 1.7, C + t);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(a + t * 1.7, C - Math.round(S * 0.028), S - (a + t * 1.7) * 2, Math.round(S * 0.056));
      ctx.restore();
      refresh(scene, 'ov-row');
    }
  }
  {
    const ctx = makeCanvas(scene, 'ov-col', S);
    if (ctx) {
      ctx.save();
      overlayShadow(ctx);
      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      const a = Math.round(S * 0.07);
      const t = Math.round(S * 0.115);
      ctx.beginPath();
      ctx.moveTo(C, a);
      ctx.lineTo(C - t, a + t * 1.7);
      ctx.lineTo(C + t, a + t * 1.7);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(C, S - a);
      ctx.lineTo(C - t, S - a - t * 1.7);
      ctx.lineTo(C + t, S - a - t * 1.7);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(C - Math.round(S * 0.028), a + t * 1.7, Math.round(S * 0.056), S - (a + t * 1.7) * 2);
      ctx.restore();
      refresh(scene, 'ov-col');
    }
  }
  {
    const ctx = makeCanvas(scene, 'ov-kernel', S);
    if (ctx) {
      ctx.save();
      overlayShadow(ctx);
      ctx.lineWidth = Math.max(4, S * 0.045);
      ctx.strokeStyle = 'rgba(255,255,255,0.96)';
      const inset = Math.round(S * 0.16);
      roundRect(ctx, inset, inset, S - inset * 2, S - inset * 2, Math.round(S * 0.09));
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      for (const [dx, dy] of [
        [inset, inset],
        [S - inset, inset],
        [inset, S - inset],
        [S - inset, S - inset],
      ]) {
        ctx.beginPath();
        ctx.arc(dx, dy, Math.max(4, S * 0.045), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      refresh(scene, 'ov-kernel');
    }
  }

  // 验证码锁（剩余 1/2/3 击）
  for (let hits = 1; hits <= 3; hits++) {
    const key = `ov-lock${hits}`;
    const ctx = makeCanvas(scene, key, S);
    if (!ctx) continue;
    const m = Math.round(S * 0.06);
    roundRect(ctx, m, m, S - m * 2, S - m * 2 - Math.round(S * 0.05), Math.round(S * 0.2));
    ctx.fillStyle = 'rgba(6,6,12,0.66)';
    ctx.fill();
    ctx.lineWidth = Math.max(2, S * 0.024);
    ctx.strokeStyle = 'rgba(255,216,3,0.95)';
    ctx.stroke();
    drawEmojiOrLetter(ctx, '🔒', 'L', '#ffd803', C, C - Math.round(S * 0.07), Math.round(S * 0.34), false);
    ctx.fillStyle = '#ffd803';
    const startX = C - (hits - 1) * Math.round(S * 0.105);
    for (let i = 0; i < hits; i++) {
      ctx.beginPath();
      ctx.arc(startX + i * Math.round(S * 0.21), S - Math.round(S * 0.2), Math.max(4, S * 0.05), 0, Math.PI * 2);
      ctx.fill();
    }
    refresh(scene, key);
  }

  // 受击红晕（边缘渐变，中心透明不挡棋盘）
  {
    const size = 256;
    if (!scene.textures.exists('vignette')) {
      const tex = scene.textures.createCanvas('vignette', size, size);
      if (tex) {
        const ctx = tex.context;
        const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.32, size / 2, size / 2, size * 0.72);
        g.addColorStop(0, 'rgba(229,49,112,0)');
        g.addColorStop(0.75, 'rgba(229,49,112,0.45)');
        g.addColorStop(1, 'rgba(229,49,112,0.85)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        tex.refresh();
      }
    }
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

  // 角色头像（用角色主题色描边）
  for (const c of CHARACTERS) {
    const key = `avatar-${c.id}`;
    const size = 128;
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, size, size);
    if (!tex) continue;
    const ctx = tex.context;
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, shade(c.accent, 0.15, 0.4));
    grad.addColorStop(1, shade(c.accent, -0.45, 0.4));
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 5, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = shade(c.accent, 0.1);
    ctx.stroke();
    drawEmojiOrLetter(ctx, c.emoji, c.name[0], '#fffffe', size / 2, size / 2 + 4, 62, false);
    tex.refresh();
  }
}
