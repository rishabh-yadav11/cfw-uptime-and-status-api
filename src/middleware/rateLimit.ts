import { Context, Next } from 'hono';
import { Env, Variables } from '../types';

export const rateLimitMiddleware = async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
  const apiKey = c.get('apiKey');
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const requestId = c.get('requestId');

  if (!apiKey) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Missing API key' }, request_id: requestId }, 401);
  }

  const { plan, key_id } = apiKey;

  // Rate limits
  let rateLimit, burstLimit, dayLimit;
  if (plan === 'free') {
    rateLimit = 60; burstLimit = 10; dayLimit = 5000;
  } else if (plan === 'pro') {
    rateLimit = 300; burstLimit = 30; dayLimit = 100000;
  } else if (plan === 'agency') {
    rateLimit = 1000; burstLimit = 100; dayLimit = 1000000; // arbitrary high number for agency
  } else {
    rateLimit = 60; burstLimit = 10; dayLimit = 5000; // default
  }

  const now = Date.now();
  const dayKey = `ratelimit:day:${key_id}:${Math.floor(now / 86400000)}`;
  const bucketKey = `ratelimit:bucket:${key_id}:${ip}`;
  
  // Daily check
  const dayCountStr = await c.env.KV.get(dayKey);
  const dayCount = parseInt(dayCountStr || '0', 10);
  if (dayCount >= dayLimit) {
    return c.json({ ok: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Daily limit exceeded' }, request_id: requestId }, 429);
  }

  // Token bucket check
  let tokens = burstLimit;
  let lastRefill = now;
  
  const bucketStr = await c.env.KV.get(bucketKey);
  if (bucketStr) {
    const bucket = JSON.parse(bucketStr);
    tokens = bucket.tokens;
    lastRefill = bucket.lastRefill;
  }

  // Refill tokens
  const refillRateMs = 60000 / rateLimit; // e.g., 60/m = 1 per 1000ms
  const elapsedMs = now - lastRefill;
  const newTokens = Math.floor(elapsedMs / refillRateMs);

  if (newTokens > 0) {
    tokens = Math.min(burstLimit, tokens + newTokens);
    lastRefill = now;
  }

  if (tokens <= 0) {
    const resetTimeMs = lastRefill + refillRateMs;
    const retryAfter = Math.ceil((resetTimeMs - now) / 1000);
    c.header('Retry-After', retryAfter.toString());
    c.header('X-RateLimit-Limit', burstLimit.toString());
    c.header('X-RateLimit-Remaining', '0');
    c.header('X-RateLimit-Reset', resetTimeMs.toString());
    return c.json({ ok: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded' }, request_id: requestId }, 429);
  }

  tokens -= 1;

  // Save state (using waitUntil to not block the request)
  c.executionCtx.waitUntil(
    c.env.KV.put(dayKey, (dayCount + 1).toString(), { expirationTtl: 86400 })
  );
  c.executionCtx.waitUntil(
    c.env.KV.put(bucketKey, JSON.stringify({ tokens, lastRefill }), { expirationTtl: 60 })
  );

  c.header('X-RateLimit-Limit', burstLimit.toString());
  c.header('X-RateLimit-Remaining', tokens.toString());

  await next();
};
