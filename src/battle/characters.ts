import { Color } from '../engine/types';
import type { PersonaId } from '../shared/tauntProtocol';

export type UltimateId =
  | 'overfit_storm' // 双方棋盘各随机消 20 格
  | 'distill' // 偷取对方 50% 能量
  | 'align_shield' // 10s 干扰反弹
  | 'hallucinate' // 改写对手 8 格颜色 + 锁 1 格
  | 'twin_resonance' // 己方升格 2 激光 + 1 卷积核
  | 'open_source'; // 引爆己方底部两行

export interface CharacterPassive {
  /** 造成伤害倍率 */
  damageMul?: number;
  /** 充能倍率 */
  energyMul?: number;
  /** 干扰被无效化的概率 */
  dodge?: number;
  /** 连击≥3 时随机污染对手 n 格颜色 */
  comboScramble?: number;
  /** 生成特殊块时追加一道随机激光的概率 */
  twinChance?: number;
  /** 每净化 1 块脏数据的额外能量 */
  purifyEnergy?: number;
}

export interface CharacterDef {
  id: PersonaId;
  name: string;
  emoji: string;
  title: string;
  flavor: string;
  /** 主题色（UI 强调用） */
  accent: number;
  /** 本命色：消除该色充能翻倍 */
  mainColor: Color;
  passive: CharacterPassive;
  passiveName: string;
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
    accent: 0x3da9fc,
    mainColor: Color.Param,
    passive: { damageMul: 1.12 },
    passiveName: '降维视角',
    passiveDesc: '造成伤害 +12%',
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
    accent: 0xffd803,
    mainColor: Color.Compute,
    passive: { energyMul: 1.3 },
    passiveName: '极致性价比',
    passiveDesc: '充能 +30%，大招转得飞快',
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
    accent: 0x2cb67d,
    mainColor: Color.Data,
    passive: { dodge: 0.22 },
    passiveName: '宪法审查',
    passiveDesc: '22% 概率无效化对方干扰',
    ult: 'align_shield',
    ultName: '对齐护盾',
    ultDesc: '10 秒内对方的干扰攻击全部反弹回去',
  },
  {
    id: 'hallucin',
    name: 'Hallucin-8 幻觉君',
    emoji: '🍄',
    title: '一本正经胡说型',
    flavor: '现实由它解释，参考文献：它编的。',
    accent: 0xe53170,
    mainColor: Color.Token,
    passive: { comboScramble: 1 },
    passiveName: '认知污染',
    passiveDesc: '连击≥3 时随机污染对手 1 格颜色',
    ult: 'hallucinate',
    ultName: '集体幻觉',
    ultDesc: '随机改写对手 8 格颜色并锁住 1 格——它酝酿的连击瞬间面目全非',
  },
  {
    id: 'twin',
    name: 'Twin-Ω 双子星',
    emoji: '👯',
    title: '镜像复制型',
    flavor: '一个打不过？那就两个我。',
    accent: 0x7f5af0,
    mainColor: Color.VRAM,
    passive: { twinChance: 0.25 },
    passiveName: '镜像分身',
    passiveDesc: '生成特殊块时 25% 概率追加一道随机激光',
    ult: 'twin_resonance',
    ultName: '双子共振',
    ultDesc: '己方棋盘随机升格 2 格为张量射线、1 格为卷积核',
  },
  {
    id: 'alpaca',
    name: 'Alpaca-3 开源侠',
    emoji: '🦙',
    title: '社区众包型',
    flavor: '本对局开源，欢迎 fork，记得点 star。',
    accent: 0xff8906,
    mainColor: Color.Energy,
    passive: { purifyEnergy: 8 },
    passiveName: '众包净化',
    passiveDesc: '每净化 1 块脏数据额外 +8 能量',
    ult: 'open_source',
    ultName: '社区之力',
    ultDesc: '引爆己方棋盘最底两行（16 格大清算，照常计伤与充能）',
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
