import Anthropic from '@anthropic-ai/sdk';
import {
  PERSONA_IDS,
  TAUNT_EVENT_TYPES,
  type TauntRequest,
  type TauntResponse,
} from '../../src/shared/tauntProtocol';
import { PERSONAS } from './personas';

let client: Anthropic | null = null;

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
      myHp: clampNum(st.myHp, 0, 100),
      oppHp: clampNum(st.oppHp, 0, 100),
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
    `你的HP=${state.myHp}/100`,
    `玩家HP=${state.oppHp}/100`,
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

/** 核心处理：dev middleware 与 Vercel function 共用。失败抛错，由外壳兜底降级。 */
export async function handleTauntRequest(raw: unknown): Promise<TauntResponse> {
  const req = sanitize(raw);
  if (!req) throw new Error('bad_request');
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('no_api_key');
  client ??= new Anthropic();

  const msg = await client.messages.create(
    {
      model: process.env.TAUNT_MODEL ?? 'claude-haiku-4-5',
      max_tokens: 200,
      system: PERSONAS[req.personaId],
      messages: [{ role: 'user', content: renderSummary(req) }],
    },
    { timeout: 8000, maxRetries: 1 },
  );
  const text = msg.content.find((b) => b.type === 'text')?.text ?? '';
  const line = clampLine(text, req.event === 'result' ? 60 : 40);
  if (!line) throw new Error('empty');
  return { line, source: 'ai' };
}
