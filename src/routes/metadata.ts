import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { Env, Variables } from '../types';
import { authMiddleware, rateLimitMiddleware, cacheMiddleware } from '../middleware';
import { successResponse, errorResponse, validateUrl, fetchWithTimeout, readBodySafely } from '../utils';

const metadataRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// Cache TTL 6h as per specs for derived results
const CACHE_TTL = 6 * 60 * 60;

const querySchema = z.object({
  url: z.string().url().max(2048)
});

const batchSchema = z.object({
  urls: z.array(z.string().url().max(2048)).max(50)
});

metadataRouter.use('/metadata', authMiddleware(['metadata:read']), rateLimitMiddleware);
metadataRouter.use('/favicon', authMiddleware(['metadata:read']), rateLimitMiddleware);
metadataRouter.use('/schema', authMiddleware(['metadata:read']), rateLimitMiddleware);
metadataRouter.use('/metadata/batch', authMiddleware(['metadata:read']), rateLimitMiddleware);

metadataRouter.get('/metadata', zValidator('query', querySchema), cacheMiddleware(CACHE_TTL), async (c) => {
  const { url } = c.req.valid('query');
  const requestId = c.get('requestId');

  if (!validateUrl(url)) {
    return c.json(errorResponse('BAD_REQUEST', 'Invalid or blocked URL', requestId), 400);
  }

  try {
    const res = await fetchWithTimeout(url, { redirect: 'manual' }, 8000);
    let html = '';
    try {
      html = await readBodySafely(res);
    } catch (e: any) {
      return c.json(errorResponse('PAYLOAD_TOO_LARGE', 'Response body too large', requestId), 413);
    }
    
    // Simplistic HTML parsing for metadata
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const canonicalMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
    const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["']/i);
    const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    
    const data = {
      title: titleMatch ? titleMatch[1] : null,
      description: metaDescMatch ? metaDescMatch[1] : null,
      canonical: canonicalMatch ? canonicalMatch[1] : null,
      lang: langMatch ? langMatch[1] : null,
      og: {
        title: ogTitleMatch ? ogTitleMatch[1] : null
      }
    };

    c.header('Cache-Control', 'public, max-age=21600'); // 6h
    return c.json(successResponse(data, { url }, requestId));
  } catch (error: any) {
    return c.json(errorResponse('FETCH_ERROR', error.message, requestId), 502);
  }
});

metadataRouter.get('/favicon', zValidator('query', querySchema), cacheMiddleware(CACHE_TTL), async (c) => {
  const { url } = c.req.valid('query');
  const requestId = c.get('requestId');

  if (!validateUrl(url)) {
    return c.json(errorResponse('BAD_REQUEST', 'Invalid or blocked URL', requestId), 400);
  }
  
  try {
    const res = await fetchWithTimeout(url, { redirect: 'manual' }, 8000);
    let html = '';
    try {
      html = await readBodySafely(res);
    } catch (e: any) {
      return c.json(errorResponse('PAYLOAD_TOO_LARGE', 'Response body too large', requestId), 413);
    }
    const faviconMatch = html.match(/<link\s+rel=["'](?:shortcut )?icon["']\s+href=["']([^"']+)["']/i);
    
    const data = {
      faviconUrl: faviconMatch ? new URL(faviconMatch[1], url).toString() : new URL('/favicon.ico', url).toString()
    };

    c.header('Cache-Control', 'public, max-age=21600');
    return c.json(successResponse(data, { url }, requestId));
  } catch (error: any) {
    return c.json(errorResponse('FETCH_ERROR', error.message, requestId), 502);
  }
});

metadataRouter.get('/schema', zValidator('query', querySchema), cacheMiddleware(CACHE_TTL), async (c) => {
  const { url } = c.req.valid('query');
  const requestId = c.get('requestId');

  if (!validateUrl(url)) {
    return c.json(errorResponse('BAD_REQUEST', 'Invalid or blocked URL', requestId), 400);
  }
  
  try {
    const res = await fetchWithTimeout(url, { redirect: 'manual' }, 8000);
    let html = '';
    try {
      html = await readBodySafely(res);
    } catch (e: any) {
      return c.json(errorResponse('PAYLOAD_TOO_LARGE', 'Response body too large', requestId), 413);
    }
    const schemaMatch = html.match(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    
    let schemaData = null;
    if (schemaMatch) {
      try {
        schemaData = JSON.parse(schemaMatch[1]);
      } catch (e) {
         // ignore parse error
      }
    }

    const data = {
      schema: schemaData
    };

    c.header('Cache-Control', 'public, max-age=21600');
    return c.json(successResponse(data, { url }, requestId));
  } catch (error: any) {
    return c.json(errorResponse('FETCH_ERROR', error.message, requestId), 502);
  }
});

metadataRouter.post('/metadata/batch', zValidator('json', batchSchema), async (c) => {
  const { urls } = c.req.valid('json');
  const requestId = c.get('requestId');

  const results = await Promise.all(urls.map(async (url) => {
    if (!validateUrl(url)) {
      return { url, error: 'Invalid or blocked URL' };
    }
    try {
      const res = await fetchWithTimeout(url, { redirect: 'manual' }, 8000);
      const html = await readBodySafely(res);
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      return { url, title: titleMatch ? titleMatch[1] : null };
    } catch (error: any) {
      return { url, error: error.message };
    }
  }));

  return c.json(successResponse({ results }, { count: urls.length }, requestId));
});

export default metadataRouter;
