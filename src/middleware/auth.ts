import { Context, Next } from 'hono';
import { Env, Variables, ApiKeyData } from '../types';

export const authMiddleware = (requiredScopes: string[] = []) => {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const requestId = c.get('requestId');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' }, request_id: requestId }, 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token format' }, request_id: requestId }, 401);
    }

    // Hash the token to look up in KV
    const tokenBuffer = new TextEncoder().encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', tokenBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const keyDataStr = await c.env.KV.get(`apikey:${tokenHash}`);
    if (!keyDataStr) {
      return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid API key' }, request_id: requestId }, 401);
    }

    let keyData: ApiKeyData;
    try {
      keyData = JSON.parse(keyDataStr);
    } catch (e) {
      return c.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to parse API key data' }, request_id: requestId }, 500);
    }

    if (keyData.status !== 'active') {
      return c.json({ ok: false, error: { code: 'FORBIDDEN', message: `API key is ${keyData.status}` }, request_id: requestId }, 403);
    }

    // Check scopes
    if (requiredScopes.length > 0) {
      const hasScope = requiredScopes.every(scope => keyData.scopes.includes(scope) || keyData.scopes.includes('admin'));
      if (!hasScope) {
        return c.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Insufficient scopes' }, request_id: requestId }, 403);
      }
    }

    // Update last_used_at async
    c.executionCtx.waitUntil(
      c.env.KV.put(`apikey:${tokenHash}`, JSON.stringify({ ...keyData, last_used_at: Date.now() }))
    );

    c.set('apiKey', keyData);

    await next();
  };
};
