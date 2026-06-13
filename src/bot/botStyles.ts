import type { PersonaId } from '../shared/tauntProtocol';

/** bot 选步评分的分项权重（默认全 1） */
export interface CharWeights {
  damage: number;
  special: number;
  main: number;
  purify: number;
}

export const DEFAULT_WEIGHTS: CharWeights = { damage: 1, special: 1, main: 1, purify: 1 };

/** 六角色作为对手时的打法风格：让「换个对手」真的换种压迫 */
export const BOT_STYLES: Record<PersonaId, { weights: Partial<CharWeights>; styleDesc: string }> = {
  omni: {
    weights: { damage: 1.5 },
    styleDesc: '高压输出流 —— 每一步都冲着你的血条来',
  },
  cheap: {
    weights: { main: 2.6 },
    styleDesc: '充能狂魔 —— 疯狂攒大招，小心连吃两次蒸馏',
  },
  scholar: {
    weights: { purify: 2.4, damage: 0.8 },
    styleDesc: '苟住防守流 —— 解锁净化优先，护盾期硬打必被反弹',
  },
  hallucin: {
    weights: { damage: 1.15, special: 1.3 },
    styleDesc: '混沌污染流 —— 连击就给你的棋盘染色，防不胜防',
  },
  twin: {
    weights: { special: 2.4 },
    styleDesc: '特殊块流 —— 满屏激光卷积核，还有镜像分身加倍',
  },
  alpaca: {
    weights: { purify: 3, damage: 1.1 },
    styleDesc: '社区清洁工 —— 净化回能拉满，大招随时引爆底排',
  },
};
