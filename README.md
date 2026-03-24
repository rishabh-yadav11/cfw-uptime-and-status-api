# Uptime and Status API

Cloudflare Worker providing an Uptime and Status API, including Website Metadata fetching.

## Features

* **Website Metadata API**: Extract metadata, schemas, and favicons with strict SSRF guarding.
* **Uptime & Status API**: Create health checks, track incidents, and expose public status pages.
* **Robust Security**:
  * API Key Authentication via `Authorization: Bearer <api_key>`
  * Strict Rate Limiting (Free, Pro, Agency tiers)
  * HMAC Signatures (`X-Timestamp`, `X-Nonce`, `X-Signature`) for Write Routes
  * Idempotency Keys to prevent duplicates
  * Cloudflare KV for efficient checks, state, and tokens.

## Environment Variables

The worker relies on standard Cloudflare bindings in `wrangler.jsonc`:
- `KV`: KVNamespace binding for state and cache
- `HMAC_SECRET`: Secret key used for signing write route requests

Ensure these are configured via `wrangler secret put HMAC_SECRET` or `.dev.vars` locally.

## Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Run tests
npm test

# Run linter
npm run lint

# Typecheck
npm run typecheck
```

## Deployment Readiness

To deploy to Cloudflare:
```bash
npm run deploy
```
Make sure to provision the KV Namespace first and update the ID in `wrangler.jsonc`.

## API Usage Examples

### 1. Fetch Website Metadata
```bash
curl -X GET "https://<your-worker-domain>/v1/metadata?url=https://example.com" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 2. Create a Check (HMAC Signed)
Requires signing the payload (`POST\n/v1/checks\n<timestamp>\n<nonce>\n<body_json>`) with your `HMAC_SECRET`.
```bash
curl -X POST "https://<your-worker-domain>/v1/checks" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-Timestamp: 1690000000000" \
  -H "X-Nonce: unique_random_string" \
  -H "X-Signature: hex_hmac_signature" \
  -H "Idempotency-Key: uuid-v4" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","interval":60,"name":"Test","project_slug":"demo"}'
```

### 3. Public Status Feed
```bash
curl -X GET "https://<your-worker-domain>/v1/status/demo"
```
