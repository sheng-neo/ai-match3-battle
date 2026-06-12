export const SIZE = 8;
export const COLOR_COUNT = 6;

export interface Pos {
  x: number; // 列 0..7
  y: number; // 行 0..7，0 在顶部
}

export enum Color {
  Data = 0, // 📊 数据
  Compute = 1, // ⚡ 算力
  Param = 2, // 🧠 参数
  Energy = 3, // 🔋 能量
  VRAM = 4, // 💾 显存
  Token = 5, // 🔮 Token
}

export enum Special {
  None = 0,
  RowLaser = 1, // 张量射线·横（清整行）
  ColLaser = 2, // 张量射线·竖（清整列）
  Kernel = 3, // 卷积核（3x3 爆破）
  Singularity = 4, // 奇点（同色全消，color 为 null）
}

export enum PieceKind {
  Normal = 0,
  Garbage = 1, // 脏数据：不可交换不可匹配，相邻消除或被爆破净化
}

export interface Piece {
  /** 全局自增、稳定 —— 渲染层用它映射 sprite */
  id: number;
  kind: PieceKind;
  color: Color | null; // Garbage 与 Singularity 为 null
  special: Special;
  /** 验证码锁剩余点击数，0 = 未锁。锁随棋子下落。 */
  lockHits: number;
}

export type MatchShape = 'line3' | 'line4' | 'line5' | 'LT';

export interface MatchGroup {
  color: Color;
  cells: Pos[];
  shape: MatchShape;
  /** 仅横/竖直线段有意义 */
  vertical: boolean;
  /** line4/line5/LT 的特殊块生成位置 */
  spawnAt?: Pos;
}

export interface ClearedPiece {
  pieceId: number;
  at: Pos;
  color: Color | null;
  special: Special;
  kind: PieceKind;
  /** 因相邻消除而被净化的脏数据 */
  byPurge?: boolean;
}

export type StepEvent =
  | { t: 'swap'; a: Pos; b: Pos; revert: boolean }
  | { t: 'match'; combo: number; cleared: ClearedPiece[] }
  | { t: 'specialTrigger'; source: Pos; special: Special; affected: Pos[] }
  | { t: 'spawnSpecial'; at: Pos; pieceId: number; special: Special; color: Color | null }
  | { t: 'gravity'; moves: { pieceId: number; from: Pos; to: Pos }[] }
  | { t: 'refill'; spawns: { pieceId: number; at: Pos; color: Color }[] }
  | { t: 'garbageAdd'; cells: { at: Pos; pieceId: number; replacedId: number }[] }
  | { t: 'lockAdd'; cells: { at: Pos; pieceId: number; hits: number }[] }
  | { t: 'lockHit'; at: Pos; pieceId: number; remaining: number }
  | { t: 'shuffle'; moves: { pieceId: number; from: Pos; to: Pos }[] };

export interface ResolveSummary {
  valid: boolean;
  totalCleared: number;
  /** 级联深度（最大 combo 波次） */
  maxCombo: number;
  clearedByColor: Partial<Record<Color, number>>;
  specialsCreated: Special[];
  specialsTriggered: Special[];
  fusion: boolean;
  garbagePurged: number;
}

export interface SwapResult {
  summary: ResolveSummary;
  steps: StepEvent[];
}

export function newSummary(): ResolveSummary {
  return {
    valid: true,
    totalCleared: 0,
    maxCombo: 0,
    clearedByColor: {},
    specialsCreated: [],
    specialsTriggered: [],
    fusion: false,
    garbagePurged: 0,
  };
}

export function posKey(p: Pos): number {
  return p.y * SIZE + p.x;
}

export function samePos(a: Pos, b: Pos): boolean {
  return a.x === b.x && a.y === b.y;
}

export function adjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}
