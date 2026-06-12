import { TAUNT } from '../config';
import type { PersonaId, TauntEventType, TauntState } from '../shared/tauntProtocol';
import { fetchTaunt } from './tauntClient';

const PRIORITY: Record<TauntEventType, number> = {
  result: 100,
  botUltimate: 80,
  playerUltimate: 78,
  botLocked: 60,
  botHurt: 58,
  playerBigCombo: 50,
  botBigCombo: 45,
  playerLowHp: 40,
  botLowHp: 40,
  opening: 30,
};

export interface TauntDirectorOpts {
  persona: PersonaId;
  getState: () => TauntState;
  display: (line: string, source: 'ai' | 'fallback') => void;
  now: () => number;
}

/**
 * 嘴炮调度：节流（全局最短间隔 + 同类冷却）、高优先级可顶掉待发低优先级、
 * 完全异步 —— 任何一环失败都不影响游戏循环。
 */
export class TauntDirector {
  private lastFiredAt = -Infinity;
  private lastByType = new Map<TauntEventType, number>();
  private pending: TauntEventType | null = null;
  private inflight = false;
  private disposed = false;

  constructor(private opts: TauntDirectorOpts) {}

  notify(type: TauntEventType): void {
    if (this.disposed) return;
    const now = this.opts.now();
    if (now - (this.lastByType.get(type) ?? -Infinity) < TAUNT.perEventCooldownMs) return;
    if (this.inflight || now - this.lastFiredAt < TAUNT.minGapMs) {
      if (!this.pending || PRIORITY[type] > PRIORITY[this.pending]) this.pending = type;
      return;
    }
    void this.fire(type);
  }

  /** 场景每帧调用：补发被节流挡下的最高优先级事件 */
  update(): void {
    if (this.disposed || !this.pending || this.inflight) return;
    const now = this.opts.now();
    if (now - this.lastFiredAt >= TAUNT.minGapMs) {
      const type = this.pending;
      this.pending = null;
      void this.fire(type);
    }
  }

  dispose(): void {
    this.disposed = true;
  }

  private async fire(type: TauntEventType): Promise<void> {
    const now = this.opts.now();
    this.lastFiredAt = now;
    this.lastByType.set(type, now);
    this.inflight = true;
    const res = await fetchTaunt({
      personaId: this.opts.persona,
      event: type,
      state: this.opts.getState(),
    });
    this.inflight = false;
    if (!this.disposed) this.opts.display(res.line, res.source);
  }
}
