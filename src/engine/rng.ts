/** 引擎唯一随机源。同一 state 重建后产生完全相同的后续序列（clone/联机回放的基础）。 */
export interface RNG {
  next(): number;
  nextInt(maxExclusive: number): number;
  state(): number;
}

export function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return {
    next(): number {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    nextInt(maxExclusive: number): number {
      if (maxExclusive <= 0) return 0;
      return Math.floor(this.next() * maxExclusive);
    },
    state(): number {
      return a >>> 0;
    },
  };
}

/** Fisher–Yates，使用注入的 rng，原地打乱 */
export function shuffleInPlace<T>(arr: T[], rng: RNG): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}
