import { Hono } from 'hono';
import { Env, Variables } from './types';
import { requestIdMiddleware } from './middleware';
import { corsMiddleware } from './middleware/cors';
import { bodySizeMiddleware } from './middleware/bodySize';
import metadataRouter from './routes/metadata';
import uptimeRouter from './routes/uptime';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use('*', requestIdMiddleware);
app.use('*', corsMiddleware);
app.use('*', bodySizeMiddleware);

// API Routes
app.route('/v1', metadataRouter);
app.route('/v1', uptimeRouter); // includes /checks, /status, /incidents

// OpenAPI definition
app.get('/openapi.json', (c) => {
  return c.json({
    openapi: '3.0.0',
    info: { title: 'Uptime and Status API', version: '1.0.0' },
    paths: {
      '/v1/metadata': { get: { responses: { '200': { description: 'Success' } } } },
      '/v1/checks': { post: { responses: { '201': { description: 'Created' } } } },
      '/v1/status/{project_slug}': { get: { responses: { '200': { description: 'Status feed' } } } }
    }
  });
});

app.onError((err, c) => {
  const requestId = c.get('requestId');
  console.error(`[${requestId}] ${err.message}`);
  return c.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }, request_id: requestId }, 500);
});

export default app;
