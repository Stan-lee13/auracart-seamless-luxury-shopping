Paystack Webhook Listener

This small Node ESM express listener verifies Paystack webhooks and inserts a minimal immutable order record into Supabase.

Environment variables (required):
- SUPABASE_URL - your Supabase URL
- SUPABASE_SERVICE_KEY - Supabase service role key (keep secret)
- PAYSTACK_SECRET - Paystack webhook secret (from Paystack dashboard)

Run locally:

```bash
npm run start:webhook
```

Deploy:
- Deploy as a small serverless function (Vercel/Netlify/Azure Functions) or a tiny node service behind HTTPS.
- Ensure the `PAYSTACK_SECRET` and `SUPABASE_SERVICE_KEY` are provided as environment variables.

Note: For local convenience the webhook server also mounts a small API proxy at `/api/create-charge` which uses `PAYSTACK_SECRET_KEY` (server secret) to initialize transactions. Set `PAYSTACK_SECRET_KEY` when running in production; keep it secret.

Notes:
- This is a scaffold. For production you must harden logging, retries, idempotency (avoid duplicate inserts by checking `order_number`), and persist full webhook payloads for audit.

Test the listener locally

1. Ensure env vars are set: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PAYSTACK_SECRET`.
2. Start the webhook listener:

```bash
npm run start:webhook
```

3. Send a signed test webhook from the repository (uses `PAYSTACK_SECRET`):

```bash
# optionally set WEBHOOK_URL if your listener is exposed differently
export WEBHOOK_URL="http://localhost:8787/webhook/paystack"
export PAYSTACK_SECRET="<your-paystack-secret>"
npm run test:webhook
```

Apply the unique constraint migration

```bash
# Using psql
psql "$DATABASE_URL" -f supabase/migrations/20260113153000_add_unique_order_number.sql

# Or use the supabase CLI
supabase db push

Deployment

Docker:

```bash
# Build container image
docker build -t auracart-webhook -f server/Dockerfile .

# Run (set env vars)
docker run -e SUPABASE_URL="${SUPABASE_URL}" -e SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_KEY}" -e PAYSTACK_SECRET="${PAYSTACK_SECRET}" -p 8787:8787 auracart-webhook
```

PaaS (Heroku/Render):

1. Ensure `Procfile` is present (already added).
2. Set `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `PAYSTACK_SECRET` in platform env settings.

Admin endpoints

- Admin endpoints under `/api/admin/*` are protected by a Supabase auth token. Include an Authorization header with the user's access token:

```bash
curl -H "Authorization: Bearer <ACCESS_TOKEN>" https://your-webhook-host/api/admin/refunds
```

The server will verify the token with Supabase and check `user_roles` for the `admin` role before allowing access.

Rate limiting & logging

- Admin endpoints are rate-limited: default `60` requests per minute per admin token or client IP. Responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.
- Requests to admin endpoints are logged to stdout as structured JSON with `admin_req_start` and `admin_req_end` events (timestamp, path, method, status, duration). In production, forward stdout to your log collector.

Redis-backed rate limiter (recommended)

- For horizontal scaling use Redis for rate limiting. Set `REDIS_URL` (e.g. `redis://:password@host:6379/0`). When `REDIS_URL` is set the server will use `rate-limiter-flexible` with Redis; otherwise it falls back to a single-process in-memory limiter (not suitable for multi-instance deployments).

Redis startup health-check

- If you want the process to fail-fast when Redis is required, set `REDIS_REQUIRED=true` alongside `REDIS_URL` in your environment. On startup the server will attempt a `PING` to Redis and exit with a non-zero code if the check fails — useful for orchestration and early detection of misconfiguration.


Dead-letter / retries

- Failed processing is inserted into `webhook_failures` (see migration). Implement a scheduled worker that replays or notifies on rows in `webhook_failures`.
- Consider setting a cap on attempts and moving permanently failed rows to an archival table after investigation.

Observability

- Add structured logs (JSON) and ship to a log aggregator (Datadog/Logflare) for production.
- Add basic metrics (counts of processed, failed, duplicates) and alerts when failure rate rises.
```
