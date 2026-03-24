# Uptime and Status API

## Product Summary
Run scheduled health checks, track latency, save incidents, and expose a public status JSON feed.

## Route List
- POST /v1/checks
- GET /v1/checks/:id
- GET /v1/checks/:id/history
- GET /v1/status/:project_slug
- POST /v1/incidents
- scopes: uptime:read, uptime:write
- write_routes: HMAC signing plus Idempotency-Key
- target_rules: public https targets only
- check_limits: interval floor 60s, timeout 5s
- create_check: POST /v1/checks creates monitor and returns id
- signed_write: bad signature returns 401
- status_feed: GET /v1/status/demo returns current state and incident summary

## Auth Model
- **Type**: API Key (Bearer Token)
- **Header**: `Authorization: Bearer <api_key>`
- **Storage**: Hashed storage in Cloudflare KV
- **Advanced**: HMAC Signature required for write routes (X-Timestamp, X-Nonce, X-Signature)

## Rate Limit Model
- **Model**: Token Bucket (per API Key and per IP)
- **Free Plan**: 60 req/min, 5000/day
- **Pro Plan**: 300 req/min, 100,000/day
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Required Cloudflare Bindings
- **KV**: Used for API key metadata, rate limiting, and asset storage.

## Local Setup
```bash
npm install
cp .env.example .env
npm run dev
```

## Test Commands
```bash
npm test        # Run Vitest
npm run lint    # Run ESLint
npm run typecheck # Run TSC
```

## Deploy Steps
```bash
# 1. Create KV/R2 namespaces in Cloudflare
# 2. Update wrangler.jsonc with namespace IDs
# 3. Add secrets
wrangler secret put API_KEY_SECRET
# 4. Deploy
npm run deploy
```

## Security Notes
- **SSRF Guard**: Strict blocking of private/local IP ranges on all URL-fetching routes.
- **Request IDs**: `X-Request-Id` included in every response for tracing.
- **Strict Validation**: Zod-based input validation for all queries and bodies.
- **Redaction**: Automatic redaction of PII and secrets in logs.

## Example Request
```bash
curl -X GET "http://localhost:8787/v1/checks/:id" \
     -H "Authorization: Bearer YOUR_API_KEY"
```

## Response Shape
- **Success**: `{ ok: true, data: {...}, meta: {...}, request_id: "..." }`
- **Error**: `{ ok: false, error: { code: "...", message: "..." }, request_id: "..." }`
