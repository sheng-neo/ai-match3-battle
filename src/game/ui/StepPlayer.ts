import Phaser from 'phaser';
import { ANIM, COLOR_HEX, INSTANT_THRESHOLD } from '../../config';
// COLOR_HEX 用于消除冲击环着色
import { PieceKind, Special, StepEvent } from '../../engine/types';
import type { BoardView } from './BoardView';

export interface StepPlayerOpts {
  /** 时长除数：迷你盘 2.5 */
  speed?: number;
  /** 特效（粒子/震屏/音效）开关，迷你盘关闭 */
  effects?: boolean;
  onSfx?: (name: string, combo?: number) => void;
  onShake?: (strength: number) => void;
}

/**
 * 引擎事件 → 补间动画的串行回放队列。
 * 逻辑层瞬时算完，这里按事件顺序逐波播放；busy 期间场景应忽略输入。
 * 队列积压超过阈值时直接快进（bot 高频操作保护）。
 */
export class StepPlayer {
  private queue: StepEvent[][] = [];
  private running = false;
  private idleCbs: (() => void)[] = [];
  private readonly speed: number;
  private readonly effects: boolean;

  constructor(
    private scene: Phaser.Scene,
    private view: BoardView,
    private opts: StepPlayerOpts = {},
  ) {
    this.speed = opts.speed ?? 1;
    this.effects = opts.effects ?? true;
  }

  get busy(): boolean {
    return this.running || this.queue.length > 0;
  }

  enqueue(steps: StepEvent[]): void {
    if (!steps.length) return;
    this.queue.push(steps);
    void this.pump();
  }

  onIdle(cb: () => void): void {
    if (!this.busy) cb();
    else this.idleCbs.push(cb);
  }

  /** 等待队列清空 */
  waitIdle(): Promise<void> {
    return new Promise((res) => this.onIdle(res));
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;
    while (this.queue.length) {
      const instant = this.queue.length >= INSTANT_THRESHOLD;
      const steps = this.queue.shift()!;
      for (const s of steps) {
        await this.play(s, instant);
      }
    }
    this.running = false;
    const cbs = this.idleCbs;
    this.idleCbs = [];
    for (const cb of cbs) cb();
  }

  private d(ms: number, instant: boolean): number {
    return instant ? 0 : ms / this.speed;
  }

  private tween(targets: object | object[], props: Record<string, unknown>, duration: number, ease = 'Quad.easeOut'): Promise<void> {
    if (duration <= 0) {
      const list = Array.isArray(targets) ? targets : [targets];
      for (const t of list) Object.assign(t, props);
      return Promise.resolve();
    }
    return new Promise((res) => {
      this.scene.tweens.add({ targets, ...props, duration, ease, onComplete: () => res() });
    });
  }

  private wait(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((res) => this.scene.time.delayedCall(ms, res));
  }

  private sfx(name: string, combo?: number): void {
    if (this.effects) this.opts.onSfx?.(name, combo);
  }

  private async play(s: StepEvent, instant: boolean): Promise<void> {
    const v = this.view;
    switch (s.t) {
      case 'swap': {
        const idA = v.pieceIdAt(s.a);
        const idB = v.pieceIdAt(s.b);
        v.setIndex(s.a, idB);
        v.setIndex(s.b, idA);
        const pa = idA !== null ? v.spriteOf(idA) : undefined;
        const pb = idB !== null ? v.spriteOf(idB) : undefined;
        const xyA = v.cellXY(s.a);
        const xyB = v.cellXY(s.b);
        this.sfx(s.revert ? 'invalid' : 'swap');
        const dur = this.d(ANIM.swap, instant);
        await Promise.all([
          pa ? this.tween(pa.root, { x: xyB.x, y: xyB.y }, dur) : Promise.resolve(),
          pb ? this.tween(pb.root, { x: xyA.x, y: xyA.y }, dur) : Promise.resolve(),
        ]);
        break;
      }

      case 'match': {
        this.sfx('pop', s.combo);
        if (this.effects && !instant && s.combo >= 3) {
          this.opts.onShake?.(Math.min(0.006, 0.001 + s.combo * 0.0007));
        }
        const dur = this.d(ANIM.pop, instant);
        const jobs: Promise<void>[] = [];
        const burstN = Math.min(16, 5 + s.combo * 2);
        let ringBudget = 6; // 单波冲击环上限，防大清屏卡顿
        for (const c of s.cleared) {
          if (v.pieceIdAt(c.at) === c.pieceId) v.setIndex(c.at, null);
          const pv = v.spriteOf(c.pieceId);
          if (!pv) continue;
          if (this.effects && !instant) {
            pv.stopFx();
            v.burstColor(c.at, c.color, c.byPurge ? 4 : burstN);
            if (ringBudget-- > 0 && (s.combo >= 2 || c.special !== Special.None)) {
              v.ring(c.at, c.color !== null ? (COLOR_HEX[c.color] ?? 0xffffff) : 0xffffff, 2.2, 300);
            }
          }
          jobs.push(
            this.tween(
              pv.root,
              { scale: 0, alpha: 0, angle: (c.pieceId % 2 ? 1 : -1) * 70 },
              dur,
              'Back.easeIn',
            ).then(() => v.removePiece(c.pieceId)),
          );
        }
        await Promise.all(jobs);
        break;
      }

      case 'specialTrigger': {
        if (!this.effects || instant) break;
        await this.flashSpecial(s);
        break;
      }

      case 'spawnSpecial': {
        // 生成格此刻应为空（本波已清除）
        const pv = v.addPiece(
          { id: s.pieceId, kind: PieceKind.Normal, color: s.color, special: s.special, lockHits: 0 },
          s.at,
        );
        pv.root.setScale(0);
        this.sfx('charge');
        await this.tween(pv.root, { scale: 1 }, this.d(ANIM.spawnSpecial, instant), 'Back.easeOut');
        break;
      }

      case 'gravity': {
        for (const m of s.moves) if (v.pieceIdAt(m.from) === m.pieceId) v.setIndex(m.from, null);
        const jobs: Promise<void>[] = [];
        for (const m of s.moves) {
          v.setIndex(m.to, m.pieceId);
          const pv = v.spriteOf(m.pieceId);
          if (!pv) continue;
          const xy = v.cellXY(m.to);
          const dist = Math.abs(m.to.y - m.from.y);
          jobs.push(this.tween(pv.root, { x: xy.x, y: xy.y }, this.d(ANIM.gravityBase + ANIM.gravityPerCell * dist, instant), 'Quad.easeIn'));
        }
        await Promise.all(jobs);
        break;
      }

      case 'refill': {
        const jobs: Promise<void>[] = [];
        const dur = this.d(ANIM.refill, instant);
        for (const sp of s.spawns) {
          const pv = v.addPiece(
            { id: sp.pieceId, kind: PieceKind.Normal, color: sp.color, special: Special.None, lockHits: 0 },
            sp.at,
          );
          const target = v.cellXY(sp.at);
          if (dur > 0) {
            pv.root.setPosition(target.x, target.y - v.cell * (sp.at.y + 1.6));
            jobs.push(this.tween(pv.root, { x: target.x, y: target.y }, dur + sp.at.y * (18 / this.speed), 'Quad.easeIn'));
          }
        }
        await Promise.all(jobs);
        break;
      }

      case 'garbageAdd': {
        this.sfx('garbage');
        const jobs: Promise<void>[] = [];
        for (const c of s.cells) {
          v.removePiece(c.replacedId);
          const pv = v.addPiece(
            { id: c.pieceId, kind: PieceKind.Garbage, color: null, special: Special.None, lockHits: 0 },
            c.at,
          );
          pv.root.setScale(0);
          jobs.push(this.tween(pv.root, { scale: 1 }, this.d(ANIM.garbageIn, instant), 'Back.easeOut'));
        }
        if (this.effects && !instant) this.opts.onShake?.(0.0025);
        await Promise.all(jobs);
        break;
      }

      case 'lockAdd': {
        this.sfx('lock');
        for (const c of s.cells) {
          const pv = v.spriteOf(c.pieceId);
          pv?.setLock(c.hits);
          if (pv && !instant) {
            pv.lock.setAlpha(0);
            void this.tween(pv.lock, { alpha: 1 }, this.d(160, instant));
          }
        }
        await this.wait(this.d(120, instant));
        break;
      }

      case 'lockHit': {
        const pv = v.spriteOf(s.pieceId);
        if (pv) {
          pv.setLock(s.remaining);
          this.sfx(s.remaining === 0 ? 'unlock' : 'lockHit');
          if (!instant) {
            const ox = pv.root.x;
            await this.tween(pv.root, { x: ox + 4 }, this.d(ANIM.lockHit / 2, instant), 'Sine.easeInOut');
            await this.tween(pv.root, { x: ox }, this.d(ANIM.lockHit / 2, instant), 'Sine.easeInOut');
          }
        }
        break;
      }

      case 'recolor': {
        this.sfx('glitch');
        const jobs: Promise<void>[] = [];
        for (const c of s.cells) {
          const pv = v.spriteOf(c.pieceId);
          if (!pv) continue;
          if (this.effects && !instant) {
            v.burst(c.at, 0xe53170, 5);
            v.ring(c.at, 0xe53170, 1.8, 260);
          }
          pv.recolorTo(c.color);
          if (!instant) {
            pv.root.setScale(0.6);
            jobs.push(this.tween(pv.root, { scale: 1 }, this.d(170, instant), 'Back.easeOut'));
          }
        }
        await Promise.all(jobs);
        break;
      }

      case 'promote': {
        this.sfx('charge');
        const jobs: Promise<void>[] = [];
        for (const c of s.cells) {
          const pv = v.spriteOf(c.pieceId);
          if (!pv) continue;
          pv.setSpecial(c.special);
          if (this.effects && !instant) {
            v.ring(c.at, 0xfffffe, 2.4, 320);
            v.burst(c.at, 0xfffffe, 8);
          }
          if (!instant) {
            pv.root.setScale(1.3);
            jobs.push(this.tween(pv.root, { scale: 1 }, this.d(ANIM.spawnSpecial, instant), 'Back.easeOut'));
          }
        }
        await Promise.all(jobs);
        break;
      }

      case 'shuffle': {
        this.sfx('shuffle');
        for (const m of s.moves) if (v.pieceIdAt(m.from) === m.pieceId) v.setIndex(m.from, null);
        const jobs: Promise<void>[] = [];
        for (const m of s.moves) {
          v.setIndex(m.to, m.pieceId);
          const pv = v.spriteOf(m.pieceId);
          if (!pv) continue;
          const xy = v.cellXY(m.to);
          jobs.push(this.tween(pv.root, { x: xy.x, y: xy.y }, this.d(ANIM.shuffle, instant), 'Sine.easeInOut'));
        }
        await Promise.all(jobs);
        break;
      }
    }
  }

  /** 特殊块触发的光效：双层激光束 / 爆破圈 / 奇点坍缩闪光 */
  private async flashSpecial(s: Extract<StepEvent, { t: 'specialTrigger' }>): Promise<void> {
    const v = this.view;
    const cellPx = v.cell;
    const boardPx = cellPx * 8;
    const dur = ANIM.beam / this.speed;
    const mk = (x: number, y: number, w: number, h: number, color: number, alpha = 0.55): Promise<void> => {
      const r = this.scene.add.rectangle(x, y, w, h, color, alpha).setBlendMode(Phaser.BlendModes.ADD);
      v.container.add(r);
      return this.tween(r, { alpha: 0 }, dur).then(() => r.destroy());
    };
    /** 双层光束：彩色辉光 + 白色核心，并沿线撒火花 */
    const beam = (horizontal: boolean, at: number, color: number): Promise<void[]> => {
      const jobs: Promise<void>[] = [];
      if (horizontal) {
        jobs.push(mk(boardPx / 2, at, boardPx, cellPx * 1.05, color, 0.4));
        jobs.push(mk(boardPx / 2, at, boardPx, cellPx * 0.4, 0xffffff, 0.9));
      } else {
        jobs.push(mk(at, boardPx / 2, cellPx * 1.05, boardPx, color, 0.4));
        jobs.push(mk(at, boardPx / 2, cellPx * 0.4, boardPx, 0xffffff, 0.9));
      }
      for (let i = 0; i < 8; i += 2) {
        const p = horizontal ? { x: i, y: Math.round(at / cellPx - 0.5) } : { x: Math.round(at / cellPx - 0.5), y: i };
        v.burst(p, 0xffffff, 4);
      }
      return Promise.all(jobs);
    };
    const src = v.cellXY(s.source);
    switch (s.special) {
      case Special.RowLaser:
        this.sfx('laser');
        this.opts.onShake?.(0.0025);
        await beam(true, src.y, 0x3da9fc);
        break;
      case Special.ColLaser:
        this.sfx('laser');
        this.opts.onShake?.(0.0025);
        await beam(false, src.x, 0x3da9fc);
        break;
      case Special.Kernel:
        this.sfx('boom');
        this.opts.onShake?.(0.006);
        v.ring(s.source, 0xff8906, 3.6, 380);
        v.burst(s.source, 0xff8906, 18);
        await mk(src.x, src.y, cellPx * 3.1, cellPx * 3.1, 0xff8906, 0.5);
        break;
      case Special.Singularity: {
        this.sfx('sing');
        this.opts.onShake?.(0.008);
        v.ring(s.source, 0x7f5af0, 4.5, 460);
        v.ring(s.source, 0xfffffe, 3, 380);
        v.burst(s.source, 0x7f5af0, 22);
        const jobs = [mk(boardPx / 2, boardPx / 2, boardPx, boardPx, 0x7f5af0, 0.4)];
        for (const p of s.affected.slice(0, 10)) {
          v.burst(p, 0x7f5af0, 5);
          const xy = v.cellXY(p);
          jobs.push(mk(xy.x, xy.y, cellPx * 0.9, cellPx * 0.9, 0xffffff, 0.6));
        }
        await Promise.all(jobs);
        break;
      }
      default:
        break;
    }
  }
}
