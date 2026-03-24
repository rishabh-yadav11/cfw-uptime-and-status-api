import { Context, Next } from 'hono';
import { Env, Variables } from '../types';

export const hmacMiddleware = async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
  const timestampStr = c.req.header('X-Timestamp');
  const nonce = c.req.header('X-Nonce');
  const signature = c.req.header('X-Signature');
  const requestId = c.get('requestId');

  if (!timestampStr || !nonce || !signature) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Missing signing headers' }, request_id: requestId }, 401);
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Timestamp invalid or expired' }, request_id: requestId }, 401);
  }

  // Check nonce reuse
  const nonceKey = `nonce:${nonce}`;
  const usedNonce = await c.env.KV.get(nonceKey);
  if (usedNonce) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Nonce reused' }, request_id: requestId }, 401);
  }
  await c.env.KV.put(nonceKey, '1', { expirationTtl: 300 });

  // Validate signature
  let body = '';
  if (c.req.method !== 'GET') {
    const clonedReq = c.req.raw.clone();
    body = await clonedReq.text();
  }
  const path = new URL(c.req.url).pathname;
  const message = `${c.req.method}\n${path}\n${timestamp}\n${nonce}\n${body}`;

  const secretBuffer = new TextEncoder().encode(c.env.HMAC_SECRET);
  const key = await crypto.subtle.importKey('raw', secretBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const messageBuffer = new TextEncoder().encode(message);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageBuffer);
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const expectedSignature = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');

  if (signature !== expectedSignature) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid signature' }, request_id: requestId }, 401);
  }

  await next();
};
