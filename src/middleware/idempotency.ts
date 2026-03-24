import { Context, Next } from 'hono';
import { Env, Variables } from '../types';

export const idempotencyMiddleware = async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
  const idempotencyKey = c.req.header('Idempotency-Key');
  const requestId = c.get('requestId');

  if (!idempotencyKey) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing Idempotency-Key header' }, request_id: requestId }, 400);
  }

  // Check if result exists
  const keyStr = `idempotency:${idempotencyKey}`;
  const existingResult = await c.env.KV.get(keyStr);
  if (existingResult) {
    try {
      const parsed = JSON.parse(existingResult);
      return c.json(parsed.body, parsed.status);
    } catch (e) {
      // Ignored
    }
  }

  await next();

  // If request was successful or handled, save result
  if (c.res.ok || c.res.status >= 400) {
    const clonedRes = c.res.clone();
    const text = await clonedRes.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    await c.env.KV.put(keyStr, JSON.stringify({ status: c.res.status, body }), { expirationTtl: 24 * 60 * 60 });
  }
};
