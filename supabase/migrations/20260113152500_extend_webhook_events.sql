-- Extend webhook_events to store raw_body and headers for full auditability
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS headers JSONB,
  ADD COLUMN IF NOT EXISTS raw_body TEXT;

-- Index on processed to allow quick queries for unprocessed events
CREATE INDEX IF NOT EXISTS webhook_events_processed_idx ON public.webhook_events (processed);
