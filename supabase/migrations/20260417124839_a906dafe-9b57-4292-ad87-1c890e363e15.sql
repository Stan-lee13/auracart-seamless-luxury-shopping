-- Enable pg_cron + pg_net for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Remove any existing schedule with same name
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'aliexpress-token-refresh-hourly') THEN
    PERFORM cron.unschedule('aliexpress-token-refresh-hourly');
  END IF;
END $$;

-- Schedule the AliExpress token refresh edge function every hour
SELECT cron.schedule(
  'aliexpress-token-refresh-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mnuppunshelyjezumqtr.supabase.co/functions/v1/refresh-aliexpress-token',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1udXBwdW5zaGVseWplenVtcXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDIzMTMsImV4cCI6MjA4MzU3ODMxM30.qOC2GflroSBuBG7_nHjfsdnivkKdxEmJ2v56rTFUy2k"}'::jsonb,
    body := concat('{"scheduled_at": "', now(), '"}')::jsonb
  );
  $$
);