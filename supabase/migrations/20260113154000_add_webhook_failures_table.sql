-- Create a dead-letter table for webhook processing failures
CREATE TABLE IF NOT EXISTS public.webhook_failures (
    id bigserial PRIMARY KEY,
    provider text,
    reference text,
    event_type text,
    payload jsonb,
    headers jsonb,
    error_text text,
    attempts integer DEFAULT 0,
    last_error_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_failures_reference ON public.webhook_failures (reference);
