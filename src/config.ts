/** 全局可调参数表：数值平衡、布局、动画时长都集中在这里 */

// ---------- 画面 ----------
export const GAME_W = 750;
export const GAME_H = 1334;
export const CELL = 84; // 主棋盘格尺寸（8 格 = 672）
export const BOARD_X = (GAME_W - CELL * 8) / 2; // 39
export const BOARD_Y = 330;
export const MINI_CELL = 21; // 对手迷你盘（8 格 = 168）

export const COLOR_HEX: Record<number, number> = {
  0: 0x3da9fc, // 数据 📊 蓝
  1: 0xffd803, // 算力 ⚡ 黄
  2: 0xe53170, // 参数 🧠 品红
  3: 0x2cb67d, // 能量 🔋 绿
  4: 0x7f5af0, // 显存 💾 紫
  5: 0xff8906, // Token 🔮 橙
};
/** 文本场景用的资源 emoji（与砖块手绘图标语义对齐：数据库/芯片/网络/电池/内存/代币） */
export const COLOR_EMOJI: Record<number, string> = {
  0: '🛢️',
  1: '⚡',
  2: '🧠',
  3: '🔋',
  4: '💾',
  5: '🪙',
};
/** 资源中文名（图鉴/提示用） */
export const COLOR_NAME: Record<number, string> = {
  0: '数据',
  1: '算力',
  2: '参数',
  3: '能量',
  4: '显存',
  5: 'Token',
};
export const BG_COLOR = 0x0f0e17;
export const UI_FONT = "'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif";

// ---------- 动画时长（ms，主盘基准；迷你盘按 speed 加速） ----------
export const ANIM = {
  swap: 140,
  pop: 170,
  gravityPerCell: 55,
  gravityBase: 40,
  refill: 200,
  spawnSpecial: 200,
  beam: 160,
  shuffle: 280,
  lockHit: 110,
  garbageIn: 160,
};
export const MINI_SPEED = 2.5;
/** 渲染队列积压超过该波数时直接快进（防 bot 高频操作堆积） */
export const INSTANT_THRESHOLD = 10;

// ---------- 对战数值 ----------
export const BATTLE = {
  durationMs: 150_000,
  maxHp: 100,
  /** 总伤害缩放（sim 调平用） */
  damageScale: 0.25,
  comboMulStep: 0.25, // comboMul = 1 + step*(combo-1)
  specialMul: { laser: 1.3, kernel: 1.5, singularity: 2.0, fusionExtra: 1.5 },
  // 干扰攻击触发
  garbageComboAt: 3, // combo≥3：脏数据 (combo-2) 个，上限 4
  garbageMax: 4,
  lockComboAt: 4, // combo≥4：验证码锁 1 个（3 击）
  lockHits: 3,
  rateLimitComboAt: 5, // combo≥5 或 fusion：限流
  rateLimitMs: 4000,
  rateLimitSwapCdMs: 1200,
  // 能量
  energyMax: 100,
  energyPerCell: 1,
  energyMainColorBonus: 1, // 本命色每格额外 +1
  energyOnHit: 5, // 被攻击补偿
  // 技能
  overfitStormCells: 20,
  distillRatio: 0.5,
  shieldMs: 10_000,
  hallucinateCells: 8,
  // 嘴炮触发阈值
  bigHitAt: 18,
  lowHpAt: 30,
  // 道具（每局各 1 次）
  itemHealAmount: 30,
  itemUnplugMs: 6000,
  // 闲置提示
  hintIdleMs: 5000,
};

// ---------- Bot 难度 ----------
export interface DifficultyDef {
  id: 'easy' | 'normal' | 'hard';
  label: string;
  desc: string;
  intervalMs: [number, number];
  castDelayMs: [number, number];
  unlockBias: number;
  /** 选步策略在 bot/difficulty.ts 中按 id 分派 */
}
export const DIFFICULTIES: DifficultyDef[] = [
  {
    id: 'easy',
    label: '7B 小模型',
    desc: '反应慢半拍，偶尔幻觉出昏招',
    intervalMs: [2800, 3600],
    castDelayMs: [3000, 6000],
    unlockBias: 0.3,
  },
  {
    id: 'normal',
    label: '72B 指令微调',
    desc: '章法清晰，偶有失误',
    intervalMs: [1800, 2400],
    castDelayMs: [1000, 2000],
    unlockBias: 0.6,
  },
  {
    id: 'hard',
    label: '万亿参数 MoE',
    desc: '手快眼毒，几乎不犯错',
    intervalMs: [1100, 1500],
    castDelayMs: [400, 800],
    unlockBias: 0.9,
  },
];

// ---------- 嘴炮 ----------
export const TAUNT = {
  minGapMs: 8000, // 全局最短间隔
  perEventCooldownMs: 20_000, // 同类事件冷却
  requestTimeoutMs: 3500,
  bubbleMs: 4200, // 气泡展示时长
  typewriterCps: 22, // 打字机速度（字/秒）
};
