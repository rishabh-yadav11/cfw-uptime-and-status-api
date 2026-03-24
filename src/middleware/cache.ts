import { Context, Next } from 'hono';

export const cacheMiddleware = (ttlSeconds: number) => {
  return async (c: Context, next: Next) => {
    if (c.req.method !== 'GET') {
      return await next();
    }

    const cacheKey = new Request(c.req.url, c.req.raw);
    const cache = caches.default;

    const response = await cache.match(cacheKey);
    if (response) {
      const newResponse = new Response(response.body, response);
      // Ensure request_id is unique even on cache hit, or update it
      const oldBody = await newResponse.json() as any;
      oldBody.request_id = c.get('requestId');
      
      const resWithNewId = c.json(oldBody, newResponse.status as any);
      resWithNewId.headers.set('X-Cache', 'HIT');
      return resWithNewId;
    }

    await next();

    if (c.res.ok) {
      const resToCache = c.res.clone();
      resToCache.headers.set('Cache-Control', `public, max-age=${ttlSeconds}`);
      c.executionCtx.waitUntil(cache.put(cacheKey, resToCache));
    }
  };
};
