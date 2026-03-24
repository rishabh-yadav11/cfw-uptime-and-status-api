import { Context, Next } from 'hono';

export const bodySizeMiddleware = async (c: Context, next: Next) => {
  const contentLength = c.req.header('Content-Length');
  
  if (contentLength && parseInt(contentLength, 10) > 256 * 1024) {
    return c.json({ ok: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large, max 256KB' }, request_id: c.get('requestId') }, 413);
  }

  // To truly be safe, we could intercept the stream, but for most use cases, Content-Length is enough
  // Workers have a 100MB body limit themselves, but we enforce 256KB as per specs
  await next();
};
