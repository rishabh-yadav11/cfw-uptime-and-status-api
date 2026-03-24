import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { Env, Variables } from '../types';
import { authMiddleware, rateLimitMiddleware, hmacMiddleware, idempotencyMiddleware } from '../middleware';
import { successResponse, errorResponse, validateUrl, fetchWithTimeout } from '../utils';

const uptimeRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

const checkSchema = z.object({
  url: z.string().url().max(2048),
  interval: z.number().min(60).max(86400).default(60),
  name: z.string().max(100),
  project_slug: z.string().max(50)
});

const incidentSchema = z.object({
  check_id: z.string(),
  status: z.enum(['investigating', 'identified', 'monitoring', 'resolved']),
  message: z.string().max(500)
});

// GET endpoints
uptimeRouter.get('/checks/:id', authMiddleware(['uptime:read']), rateLimitMiddleware, async (c) => {
  const id = c.req.param('id');
  const requestId = c.get('requestId');
  
  const checkStr = await c.env.KV.get(`check:${id}`);
  if (!checkStr) {
    return c.json(errorResponse('NOT_FOUND', 'Check not found', requestId), 404);
  }
  return c.json(successResponse(JSON.parse(checkStr), {}, requestId));
});

uptimeRouter.get('/checks/:id/history', authMiddleware(['uptime:read']), rateLimitMiddleware, async (c) => {
  const id = c.req.param('id');
  const requestId = c.get('requestId');
  
  // In a real app we'd query history, here we just return a stub for the spec
  const data = [
      { timestamp: Date.now(), latency: 120, status: 'up' }
  ];
  return c.json(successResponse(data, { check_id: id }, requestId));
});

uptimeRouter.get('/status/:project_slug', async (c) => { // Public endpoint
  const projectSlug = c.req.param('project_slug');
  const requestId = c.get('requestId') || 'req-123';
  
  const data = {
    project: projectSlug,
    status: 'operational',
    incidents: []
  };
  return c.json(successResponse(data, {}, requestId));
});

// POST endpoints
uptimeRouter.post('/checks', authMiddleware(['uptime:write']), rateLimitMiddleware, hmacMiddleware, idempotencyMiddleware, zValidator('json', checkSchema), async (c) => {
  const body = c.req.valid('json');
  const requestId = c.get('requestId');

  if (!validateUrl(body.url) || !body.url.startsWith('https://')) {
      return c.json(errorResponse('BAD_REQUEST', 'Invalid or blocked URL. Only HTTPS targets are allowed.', requestId), 400);
  }

  const id = crypto.randomUUID();
  const checkData = { ...body, id, created_at: Date.now() };

  await c.env.KV.put(`check:${id}`, JSON.stringify(checkData));
  await c.env.KV.put(`project:${body.project_slug}:check:${id}`, id); // maintain index

  return c.json(successResponse({ ...checkData }, {}, requestId), 201);
});

uptimeRouter.post('/incidents', authMiddleware(['uptime:write']), rateLimitMiddleware, hmacMiddleware, idempotencyMiddleware, zValidator('json', incidentSchema), async (c) => {
  const body = c.req.valid('json');
  const requestId = c.get('requestId');

  const id = crypto.randomUUID();
  const incidentData = { ...body, id, created_at: Date.now() };

  await c.env.KV.put(`incident:${id}`, JSON.stringify(incidentData));

  return c.json(successResponse({ ...incidentData }, {}, requestId), 201);
});

export default uptimeRouter;
