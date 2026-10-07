-- Lightweight event log for PWA install funnel measurement (install prompt
-- shown/accepted/dismissed, app_installed, app_opened_standalone,
-- push_permission_granted/denied — the client decides which event name to
-- send, this table just stores them). user_id defaults to auth.uid() so
-- the client insert only needs to send {event, platform} (see
-- src/lib/analytics.js) — same ownership pattern as quiz_attempts
-- (migration 0001), select/insert own only, no update/delete (it's a log).
create table public.app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event text not null,
  platform text,
  created_at timestamptz not null default now()
);

alter table public.app_events enable row level security;

create policy "app_events: select own" on public.app_events
  for select using (auth.uid() = user_id);
create policy "app_events: insert own" on public.app_events
  for insert with check (auth.uid() = user_id);
