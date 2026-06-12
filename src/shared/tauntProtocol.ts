/** 前后端共享的 /api/taunt 协议类型（仅类型，零运行时依赖） */

export type PersonaId = 'omni' | 'cheap' | 'scholar';

export type TauntEventType =
  | 'opening' // 开局
  | 'playerBigCombo' // 玩家打出大连击 / fusion
  | 'botBigCombo' // bot 自己打出大连击
  | 'botLocked' // bot 被验证码锁
  | 'botUltimate' // bot 放大招
  | 'playerUltimate' // 玩家放大招
  | 'botHurt' // bot 单次被打 ≥18
  | 'playerLowHp' // 玩家残血
  | 'botLowHp' // bot 残血
  | 'result'; // 结算（win/lose 由 state.result 区分，bot 视角）

export interface TauntState {
  /** bot 自己的 HP */
  myHp: number;
  /** 玩家 HP */
  oppHp: number;
  /** 刚发生事件相关的 combo 数 */
  combo: number;
  timeLeftSec: number;
  difficulty: string;
  /** 仅 result 事件：bot 视角的胜负 */
  result?: 'win' | 'lose' | 'draw';
}

export interface TauntRequest {
  personaId: PersonaId;
  event: TauntEventType;
  state: TauntState;
}

export interface TauntResponse {
  line: string;
  source: 'ai' | 'fallback';
}

export const TAUNT_EVENT_TYPES: TauntEventType[] = [
  'opening',
  'playerBigCombo',
  'botBigCombo',
  'botLocked',
  'botUltimate',
  'playerUltimate',
  'botHurt',
  'playerLowHp',
  'botLowHp',
  'result',
];

export const PERSONA_IDS: PersonaId[] = ['omni', 'cheap', 'scholar'];
