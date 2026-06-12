import { TAUNT } from '../config';
import type { TauntRequest, TauntResponse } from '../shared/tauntProtocol';
import { fallbackLine } from './fallbackLines';

/**
 * 请求 /api/taunt（Claude 即兴锐评）。任何失败（超时/断网/无 key/限流）
 * 都无缝回退本地台词库 —— 调用方永远拿得到一句话，且绝不抛错。
 */
export async function fetchTaunt(req: TauntRequest): Promise<TauntResponse> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TAUNT.requestTimeoutMs);
    const resp = await fetch('/api/taunt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (resp.ok) {
      const j = (await resp.json()) as Partial<TauntResponse>;
      if (j && j.source === 'ai' && typeof j.line === 'string' && j.line.trim()) {
        return { line: j.line.trim(), source: 'ai' };
      }
    }
  } catch {
    // 走降级
  }
  return { line: fallbackLine(req.personaId, req.event, req.state), source: 'fallback' };
}
