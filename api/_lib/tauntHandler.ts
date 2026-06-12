import {
  PERSONA_IDS,
  TAUNT_EVENT_TYPES,
  type TauntRequest,
  type TauntResponse,
} from '../../src/shared/tauntProtocol';
import { PERSONAS } from './personas';

/**
 * 嘴炮生成核心（dev middleware / Vercel / Fly 服务器三处共用）。
 * 双通道（按环境变量自动选择，零运行时依赖，全走内置 fetch）：
 *   1. OPENROUTER_API_KEY —— OpenAI 兼容中转（OpenRouter/easyrouter 等，统一管理 key）
 *      可选 TAUNT_BASE_URL 覆盖中转地址，TAUNT_MODEL 覆盖模型（默认 anthropic/claude-haiku-4.5）
 *   2. ANTHROPIC_API_KEY —— Anthropic 官方直连（默认 claude-haiku-4-5）
 * 两者都没有则抛错，由外壳返回降级信号，前端走本地台词库。
 */

const EVENT_DESC: Record<string, string> = {
  opening: '对局刚开始',
  playerBigCombo: '玩家刚打出了一记大连击/特殊块组合',
  botBigCombo: '你自己刚打出了一记大连击',
  botLocked: '你的棋盘刚被玩家的验证码锁住了格子，你必须连点三次才能解锁',
  botUltimate: '你刚释放了自己的大招',
  playerUltimate: '玩家刚对你释放了大招',
  botHurt: '你刚被玩家狠狠打了一下，掉了不少血',
  playerLowHp: '玩家已经残血，胜利在望',
  botLowHp: '你自己已经残血，形势危急',
  result: '对局结束了',
};

function clampNum(v: unknown, lo: number, hi: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/** 严格校验/消毒输入（防注入：所有自由文本字段都不进 prompt） */
function sanitize(raw: unknown): TauntRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const personaId = PERSONA_IDS.find((p) => p === r.personaId);
  const event = TAUNT_EVENT_TYPES.find((e) => e === r.event);
  if (!personaId || !event) return null;
  const st = (r.state ?? {}) as Record<string, unknown>;
  const result = st.result === 'win' || st.result === 'lose' || st.result === 'draw' ? st.result : undefined;
  const diff = st.difficulty === 'easy' || st.difficulty === 'hard' ? st.difficulty : 'normal';
  return {
    personaId,
    event,
    state: {
      myHp: clampNum(st.myHp, 0, 200),
      oppHp: clampNum(st.oppHp, 0, 200),
      combo: clampNum(st.combo, 0, 30),
      timeLeftSec: clampNum(st.timeLeftSec, 0, 999),
      difficulty: diff,
      result,
    },
  };
}

function renderSummary(req: TauntRequest): string {
  const { state } = req;
  const parts = [
    `事件=${EVENT_DESC[req.event] ?? req.event}`,
    `你的HP=${state.myHp}`,
    `玩家HP=${state.oppHp}`,
    `剩余${state.timeLeftSec}秒`,
  ];
  if (state.combo > 0) parts.push(`相关连击=${state.combo}`);
  if (req.event === 'result') {
    const map = { win: '你赢了', lose: '你输给了玩家', draw: '平局' } as const;
    parts.push(map[state.result ?? 'draw']);
    parts.push('请输出一句结算锐评（赢了得意/输了破防但嘴硬，限 60 字内）');
  }
  return parts.join(' | ');
}

function clampLine(text: string, maxLen: number): string {
  const cleaned = text.replace(/[\r\n]+/g, ' ').replace(/^["'「『]+|["'」』]+$/g, '').trim();
  return [...cleaned].slice(0, maxLen).join('');
}

const FETCH_TIMEOUT_MS = 6000;

/** 通道 1：OpenAI 兼容中转（OpenRouter 等） */
async function viaOpenRouter(system: string, user: string): Promise<string> {
  const base = (process.env.TAUNT_BASE_URL ?? 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const resp = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'content-type': 'application/json',
      'x-title': 'AI Match3 Battle',
    },
    body: JSON.stringify({
      model: process.env.TAUNT_MODEL ?? 'anthropic/claude-haiku-4.5',
      max_tokens: 200,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`openrouter_${resp.status}`);
  const j = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
  return j.choices?.[0]?.message?.content ?? '';
}

/** 通道 2：Anthropic 官方直连 */
async function viaAnthropic(system: string, user: string): Promise<string> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.TAUNT_MODEL ?? 'claude-haiku-4-5',
      max_tokens: 200,
      system,
      messages: [{ role: 'user', content: user }],
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`anthropic_${resp.status}`);
  const j = (await resp.json()) as { content?: { type: string; text?: string }[] };
  return j.content?.find((b) => b.type === 'text')?.text ?? '';
}

export async function handleTauntRequest(raw: unknown): Promise<TauntResponse> {
  const req = sanitize(raw);
  if (!req) throw new Error('bad_request');

  const system = PERSONAS[req.personaId];
  const user = renderSummary(req);
  let text: string;
  if (process.env.OPENROUTER_API_KEY) {
    text = await viaOpenRouter(system, user);
  } else if (process.env.ANTHROPIC_API_KEY) {
    text = await viaAnthropic(system, user);
  } else {
    throw new Error('no_api_key');
  }

  const line = clampLine(text, req.event === 'result' ? 60 : 40);
  if (!line) throw new Error('empty');
  return { line, source: 'ai' };
}
