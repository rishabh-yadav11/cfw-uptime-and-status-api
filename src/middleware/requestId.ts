import { Context, Next } from 'hono';
import { Env, Variables } from '../types';

export const requestIdMiddleware = async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-Id', requestId);
  await next();
};
