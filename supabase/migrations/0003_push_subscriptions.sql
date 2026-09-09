-- Stores Web Push subscriptions (one browser/device per row) so the
-- send-reminders Edge Function can notify users who haven't done today's
-- session yet. Paste into the SQL Editor and Run.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

-- Users manage their own subscriptions (subscribe/unsubscribe from the app).
create policy "push_subscriptions: select own" on public.push_subscriptions
  for select using (auth.uid() = user_id);
create policy "push_subscriptions: insert own" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "push_subscriptions: delete own" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- No cross-user select policy: the send-reminders Edge Function reads every
-- user's subscriptions using the service-role key (auto-provided to Edge
-- Functions), which bypasses RLS by design — it never touches the client.
