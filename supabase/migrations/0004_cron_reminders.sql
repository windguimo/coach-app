-- Schedules the daily reminder push at 17:00 UTC (~18-19h heure de Paris
-- selon l'heure d'été/hiver — approximatif pour cette V1, à raffiner plus
-- tard avec un fuseau horaire par utilisateur). Paste into the SQL Editor
-- and Run — AFTER you've set the CRON_SECRET and WEB_PUSH_VAPID_* secrets
-- in Edge Functions → Secrets (see the setup checklist).

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'send-daily-reminders',
  '0 17 * * *',
  $$
  select net.http_post(
    url := 'https://xrmjhsgeipshejfwdklh.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_AOekb0yXdT6cYkP_9QqkBQ_EC57KADS',
      'x-cron-secret', 'EhL7S0RlmHDx7jR7ab4i7rDjp5CIfjla'
    ),
    body := '{}'::jsonb
  );
  $$
);
