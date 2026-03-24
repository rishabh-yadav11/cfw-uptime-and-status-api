export const corsMiddleware = (c: any, next: any) => {
  const origin = c.req.header('Origin');
  
  if (origin) {
    const allowedOrigins = ['http://localhost:3000', 'https://dashboard.example.com'];
    if (!allowedOrigins.includes(origin)) {
      return new Response('CORS Not Allowed', { status: 403 });
    }
    c.header('Access-Control-Allow-Origin', origin);
  } else {
    // Server-to-server doesn't have an Origin header, so we let it through and allow everything
    c.header('Access-Control-Allow-Origin', '*');
  }

  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Timestamp, X-Nonce, X-Signature, Idempotency-Key');

  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  return next();
};
