import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleTauntRequest } from './_lib/tauntHandler';
import { rateLimitOk } from './_lib/rateLimit';

/** Vercel serverless 外壳：限流 + 调核心 + 任何失败都返回降级信号（HTTP 200） */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  const fwd = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimitOk(ip)) {
    res.status(200).json({ line: '', source: 'fallback' });
    return;
  }
  try {
    const out = await handleTauntRequest(req.body);
    res.status(200).json(out);
  } catch {
    res.status(200).json({ line: '', source: 'fallback' });
  }
}
