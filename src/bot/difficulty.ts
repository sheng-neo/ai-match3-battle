import type { RNG } from '../engine/rng';
import type { DifficultyDef } from '../config';
import type { ScoredMove } from './evaluator';

export type DifficultyId = DifficultyDef['id'];

/** 按难度从已排序候选中选一步 */
export function pickMove(id: DifficultyId, moves: ScoredMove[], rng: RNG): ScoredMove {
  if (moves.length === 1) return moves[0];
  switch (id) {
    case 'easy': {
      if (rng.next() < 0.3) return moves[rng.nextInt(moves.length)];
      const top = moves.slice(0, Math.min(3, moves.length));
      return top[rng.nextInt(top.length)];
    }
    case 'normal': {
      const top = moves.slice(0, Math.min(5, moves.length));
      const T = 3;
      const weights = top.map((m) => Math.exp(m.score / T));
      const sum = weights.reduce((s, w) => s + w, 0);
      let r = rng.next() * sum;
      for (let i = 0; i < top.length; i++) {
        r -= weights[i];
        if (r <= 0) return top[i];
      }
      return top[top.length - 1];
    }
    case 'hard':
      return rng.next() < 0.9 ? moves[0] : (moves[1] ?? moves[0]);
  }
}

export function rollInterval(def: DifficultyDef, rng: RNG): number {
  const [lo, hi] = def.intervalMs;
  return lo + rng.next() * (hi - lo);
}

export function rollCastDelay(def: DifficultyDef, rng: RNG): number {
  const [lo, hi] = def.castDelayMs;
  return lo + rng.next() * (hi - lo);
}
