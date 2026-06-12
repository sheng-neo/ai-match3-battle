/** 内存令牌桶（serverless 实例级即可）：防滥用，超限走前端降级台词 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();
const CAPACITY = 20; // 每分钟 20 次
const REFILL_PER_MS = CAPACITY / 60_000;

export function rateLimitOk(key: string): boolean {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: CAPACITY, lastRefill: now };
    buckets.set(key, b);
  }
  b.tokens = Math.min(CAPACITY, b.tokens + (now - b.lastRefill) * REFILL_PER_MS);
  b.lastRefill = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  // 防止 Map 无限增长
  if (buckets.size > 5000) buckets.clear();
  return true;
}
