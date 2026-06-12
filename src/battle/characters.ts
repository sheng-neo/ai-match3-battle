import { Color } from '../engine/types';
import type { PersonaId } from '../shared/tauntProtocol';

export type UltimateId = 'overfit_storm' | 'distill' | 'align_shield';

export interface CharacterPassive {
  /** 造成伤害倍率 */
  damageMul?: number;
  /** 充能倍率 */
  energyMul?: number;
  /** 干扰被无效化的概率 */
  dodge?: number;
}

export interface CharacterDef {
  id: PersonaId;
  name: string;
  emoji: string;
  title: string;
  flavor: string;
  /** 本命色：消除该色充能翻倍 */
  mainColor: Color;
  passive: CharacterPassive;
  passiveDesc: string;
  ult: UltimateId;
  ultName: string;
  ultDesc: string;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'omni',
    name: 'GPT-omni 全知者',
    emoji: '🤖',
    title: '傲慢全能型',
    flavor: '万事皆知，爹味点评，自带居高临下光环。',
    mainColor: Color.Param,
    passive: { damageMul: 1.1 },
    passiveDesc: '被动「降维视角」：造成伤害 +10%',
    ult: 'overfit_storm',
    ultName: '过拟合风暴',
    ultDesc: '双方棋盘各随机消除 20 格（己方消除照常计伤与充能）',
  },
  {
    id: 'cheap',
    name: 'DeepCheap-R1 卷王',
    emoji: '💸',
    title: '性价比战神',
    flavor: '句句不离成本，能白嫖绝不付费。',
    mainColor: Color.Compute,
    passive: { energyMul: 1.25 },
    passiveDesc: '被动「极致性价比」：充能 +25%',
    ult: 'distill',
    ultName: '知识蒸馏',
    ultDesc: '偷取对方当前能量的 50%',
  },
  {
    id: 'scholar',
    name: 'Claudius 谨慎学者',
    emoji: '🦉',
    title: '礼貌但锋利',
    flavor: '先道歉，再赢你。安全对齐，拒绝越界。',
    mainColor: Color.Data,
    passive: { dodge: 0.2 },
    passiveDesc: '被动「宪法审查」：20% 概率无效化对方干扰',
    ult: 'align_shield',
    ultName: '对齐护盾',
    ultDesc: '10 秒内对方的干扰攻击全部反弹回去',
  },
];

export function charById(id: PersonaId): CharacterDef {
  const c = CHARACTERS.find((x) => x.id === id);
  if (!c) throw new Error(`unknown character: ${id}`);
  return c;
}

export function otherCharacters(id: PersonaId): CharacterDef[] {
  return CHARACTERS.filter((x) => x.id !== id);
}
