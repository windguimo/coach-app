-- Product analytics: first-party event tracking (no third-party tracker)
-- + a private admin dashboard.
--
-- 1. `app_events` (migration 0011) now also accepts events from signed-out
--    visitors (landing page, demo, signup screen): `user_id` becomes
--    nullable, and each event carries
--      - anon_id    : random per-device id (localStorage) — links a
--                     visitor's pre-signup journey to their account, since
--                     events after login carry both anon_id and user_id;
--      - session_id : per-visit id (rotates after 30 min of inactivity) —
--                     visit duration = last event − first event, kept
--                     accurate by a 30 s heartbeat while the tab is visible;
--      - path, props: route and small event-specific payload.
--    No IP, no user agent beyond the coarse `platform`. Anonymous inserts
--    are allowed only with user_id null; reads stay "own rows only".
--
-- 2. `admins`: who may open the dashboard. RLS with no policies (only
--    security definer functions read it); rows are added by hand from the
--    SQL editor / MCP, never by a migration, so no email lives in the repo.
--
-- 3. `analytics_dashboard(days, include_admin)` computes every dashboard
--    figure in one jsonb (KPIs, daily series, funnels, session
--    abandonment, demo topics, platforms, per-user table, recent events).
--    Not executable by anon/authenticated — it's what Claude queries
--    directly via SQL for analysis. `admin_dashboard(...)` is the
--    client-facing wrapper that checks `is_admin()` first.
--    Admin traffic (admins' accounts and every device they used) is
--    excluded by default so testing the app yourself doesn't skew stats.

-- ─────────────────────────── events ───────────────────────────
alter table public.app_events alter column user_id drop not null;

alter table public.app_events
  add column anon_id text,
  add column session_id text,
  add column path text,
  add column props jsonb not null default '{}'::jsonb;

alter table public.app_events
  add constraint app_events_event_len check (char_length(event) between 1 and 64),
  add constraint app_events_anon_len check (anon_id is null or char_length(anon_id) <= 64),
  add constraint app_events_session_len check (session_id is null or char_length(session_id) <= 64),
  add constraint app_events_path_len check (path is null or char_length(path) <= 200),
  add constraint app_events_props_size check (pg_column_size(props) <= 4000);

create index app_events_created_idx on public.app_events (created_at);
create index app_events_anon_idx on public.app_events (anon_id, created_at);
create index app_events_user_idx on public.app_events (user_id, created_at);
create index app_events_event_idx on public.app_events (event, created_at);

create policy "app_events: insert anonymous" on public.app_events
  for insert to anon with check (user_id is null);

-- ─────────────────────────── admins ───────────────────────────
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ─────────────────────────── dashboard ───────────────────────────
create or replace function public.analytics_dashboard(p_days integer default 7, p_include_admin boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since timestamptz := now() - make_interval(days => greatest(coalesce(p_days, 7), 1));
  v_result jsonb;
begin
  with
  excluded_users as (
    select a.user_id from public.admins a where not p_include_admin
  ),
  excluded_anon as (
    select distinct e.anon_id from public.app_events e
    where not p_include_admin and e.anon_id is not null
      and e.user_id in (select user_id from excluded_users)
  ),
  all_ev as (
    select e.* from public.app_events e
    where (e.user_id is null or e.user_id not in (select user_id from excluded_users))
      and (e.anon_id is null or e.anon_id not in (select anon_id from excluded_anon))
  ),
  ev as (
    select * from all_ev where created_at >= v_since
  ),
  usr as (
    select u.id, u.email, u.created_at, p.display_name, p.xp, p.streak_days
    from auth.users u
    left join public.profiles p on p.id = u.id
    where u.id not in (select user_id from excluded_users)
  ),
  qa as (
    select q.* from public.quiz_attempts q
    where q.created_at >= v_since and q.user_id in (select id from usr)
  ),
  sess as (
    select e.session_id,
           extract(epoch from max(e.created_at) - min(e.created_at)) as secs
    from ev e
    where e.session_id is not null
    group by e.session_id
  ),
  days as (
    select d::date as day
    from generate_series((v_since at time zone 'Europe/Paris')::date,
                         (now() at time zone 'Europe/Paris')::date,
                         interval '1 day') d
  ),
  seance as (
    select e.props->>'module_id' as mid,
           bool_or(e.event = 'session_completed') as completed,
           max(case when e.event = 'session_answer' then (e.props->>'qi')::int + 1 end) as answered_n
    from ev e
    where e.event in ('session_started', 'session_answer', 'session_completed')
      and e.props ? 'module_id'
    group by 1
    having bool_or(e.event = 'session_started')
  ),
  cohort as (
    select u.id, u.created_at,
           exists (select 1 from public.subjects s where s.user_id = u.id) as onboarded,
           exists (select 1 from public.course_modules c where c.user_id = u.id) as started,
           exists (select 1 from public.quiz_attempts q where q.user_id = u.id) as answered,
           (select count(distinct (q.created_at at time zone 'Europe/Paris')::date)
              from public.quiz_attempts q where q.user_id = u.id) as active_days,
           exists (select 1 from public.quiz_attempts q where q.user_id = u.id
                    and (q.created_at at time zone 'Europe/Paris')::date
                        = (u.created_at at time zone 'Europe/Paris')::date + 1) as back_d1
    from usr u
    where u.created_at >= v_since
  )
  select jsonb_build_object(
    'generated_at', now(),
    'days', greatest(coalesce(p_days, 7), 1),

    'kpis', jsonb_build_object(
      'visitors', (select count(distinct anon_id) from ev),
      'new_visitors', (select count(*) from (
          select anon_id from all_ev where anon_id is not null
          group by anon_id having min(created_at) >= v_since) t),
      'visits', (select count(*) from sess),
      'signups', (select count(*) from usr where created_at >= v_since),
      'total_users', (select count(*) from usr),
      'active_users', (select count(distinct uid) from (
          select user_id as uid from ev where user_id is not null
          union select user_id from qa) t),
      'sessions_completed', (select count(*) from ev where event = 'session_completed'),
      'questions_answered', (select count(*) from qa),
      'accuracy_pct', (select round(100.0 * avg(case when is_correct then 1 else 0 end)) from qa),
      'avg_visit_secs', (select round(avg(secs)) from sess),
      'median_visit_secs', (select round(percentile_cont(0.5) within group (order by secs)::numeric) from sess),
      'total_minutes', (select round(coalesce(sum(secs), 0) / 60.0) from sess),
      'bounce_pct', (select round(100.0 * avg(case when secs < 10 then 1 else 0 end)) from sess),
      'back_d1_pct', (select round(100.0 * avg(case when back_d1 then 1 else 0 end)) from cohort
                       where created_at < now() - interval '1 day'),
      'returning_pct', (select round(100.0 * avg(case when active_days >= 2 then 1 else 0 end)) from cohort
                         where answered),
      'installed', (select count(distinct anon_id) from ev
                     where event = 'app_opened_standalone' or props->>'standalone' = 'true'),
      'push_users', (select count(distinct ps.user_id) from public.push_subscriptions ps
                      where ps.user_id in (select id from usr)),
      'claude_demo_generations', (select count(*) from public.demo_requests where created_at >= v_since),
      'claude_session_generations', (select count(*) from public.content_library where created_at >= v_since),
      'session_errors', (select count(*) from ev where event = 'session_error'),
      'avg_generation_ms', (select round(avg((props->>'ms')::numeric)) from ev
                             where event = 'session_ready' and props ? 'ms')
    ),

    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day,
        'visitors', (select count(distinct anon_id) from ev
                      where (created_at at time zone 'Europe/Paris')::date = d.day),
        'signups', (select count(*) from usr
                     where (created_at at time zone 'Europe/Paris')::date = d.day),
        'active_users', (select count(distinct user_id) from qa
                          where (created_at at time zone 'Europe/Paris')::date = d.day),
        'sessions_completed', (select count(*) from ev where event = 'session_completed'
                                and (created_at at time zone 'Europe/Paris')::date = d.day)
      ) order by d.day), '[]'::jsonb) from days d),

    'visitor_funnel', (select jsonb_agg(jsonb_build_object('key', s.key, 'label', s.label, 'count', (
        select count(distinct e.anon_id) from ev e
        where case when s.key = 'landing_view' then e.event = 'page_view' and e.path = '/'
                   else e.event = s.key end
      )) order by s.ord)
      from (values
        (1, 'landing_view', 'Visite de la page d''accueil'),
        (2, 'demo_started', 'Démo lancée'),
        (3, 'demo_completed', 'Cours de démo affiché'),
        (4, 'demo_answered', 'Question de démo jouée'),
        (5, 'signup_cta_clicked', 'Clic « Créer mon compte »'),
        (6, 'signup_completed', 'Compte créé'),
        (7, 'onboarding_completed', 'Onboarding terminé'),
        (8, 'session_started', 'Séance ouverte'),
        (9, 'session_completed', 'Séance terminée')
      ) s(ord, key, label)),

    'account_funnel', jsonb_build_array(
      jsonb_build_object('label', 'Inscrits', 'count', (select count(*) from cohort)),
      jsonb_build_object('label', 'Sujets choisis', 'count', (select count(*) from cohort where onboarded)),
      jsonb_build_object('label', 'Première séance générée', 'count', (select count(*) from cohort where started)),
      jsonb_build_object('label', 'Au moins une réponse', 'count', (select count(*) from cohort where answered)),
      jsonb_build_object('label', 'Actifs 2 jours ou plus', 'count', (select count(*) from cohort where active_days >= 2)),
      jsonb_build_object('label', 'Actifs 3 jours ou plus', 'count', (select count(*) from cohort where active_days >= 3))
    ),

    'abandonment', jsonb_build_object(
      'started', (select count(*) from seance),
      'completed', (select count(*) from seance where completed),
      'quit_after', (select coalesce(jsonb_agg(jsonb_build_object('answered', n, 'count', c) order by n), '[]'::jsonb)
                     from (select coalesce(answered_n, 0) as n, count(*) as c
                           from seance where not completed group by 1) t)
    ),

    'demo_topics', (select coalesce(jsonb_agg(jsonb_build_object('topic', topic, 'count', c) order by c desc, topic), '[]'::jsonb)
                    from (select min(props->>'topic') as topic, count(*) as c from ev
                          where event = 'demo_started' and props ? 'topic'
                          group by lower(props->>'topic') order by c desc limit 15) t),
    'demo_errors', (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'count', c) order by c desc), '[]'::jsonb)
                    from (select coalesce(props->>'code', 'error') as code, count(*) as c from ev
                          where event = 'demo_error' group by 1) t),

    'platforms', (select coalesce(jsonb_agg(jsonb_build_object('platform', p, 'count', c) order by c desc), '[]'::jsonb)
                  from (select coalesce(platform, 'inconnu') as p, count(distinct anon_id) as c from ev
                        where anon_id is not null group by 1) t),
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('source', s, 'count', c) order by c desc), '[]'::jsonb)
                from (select coalesce(nullif(props->>'ref', ''), 'direct') as s, count(distinct anon_id) as c from ev
                      where event = 'page_view' and props ? 'ref' group by 1) t),

    'users', (select coalesce(jsonb_agg(x order by x.last_seen desc nulls last), '[]'::jsonb) from (
      select u.id,
             coalesce(u.display_name, split_part(u.email, '@', 1)) as name,
             u.email,
             u.created_at,
             greatest((select max(created_at) from public.app_events e where e.user_id = u.id),
                      (select max(created_at) from public.quiz_attempts q where q.user_id = u.id)) as last_seen,
             (select count(*) from public.course_modules c where c.user_id = u.id) as modules,
             (select count(*) from public.quiz_attempts q where q.user_id = u.id) as answers,
             (select round(100.0 * avg(case when is_correct then 1 else 0 end))
                from public.quiz_attempts q where q.user_id = u.id) as accuracy,
             (select count(distinct (q.created_at at time zone 'Europe/Paris')::date)
                from public.quiz_attempts q where q.user_id = u.id) as active_days,
             coalesce(u.streak_days, 0) as streak,
             coalesce(u.xp, 0) as xp,
             (select string_agg(s.label, ', ' order by s.created_at) from public.subjects s where s.user_id = u.id) as subjects,
             (select round(coalesce(sum(t.secs), 0) / 60.0) from (
                select extract(epoch from max(e.created_at) - min(e.created_at)) as secs
                from public.app_events e where e.user_id = u.id and e.session_id is not null
                group by e.session_id) t) as minutes,
             (select e.platform from public.app_events e where e.user_id = u.id and e.platform is not null
                order by e.created_at desc limit 1) as platform,
             exists (select 1 from public.push_subscriptions ps where ps.user_id = u.id) as push
      from usr u) x),

    'recent', (select coalesce(jsonb_agg(r order by r.at desc), '[]'::jsonb) from (
      select e.created_at as at, e.event, e.path, e.props, e.platform,
             coalesce(u.display_name, case when e.anon_id is not null then 'Visiteur ' || left(e.anon_id, 4) end, '—') as who
      from ev e
      left join usr u on u.id = e.user_id
      where e.event <> 'heartbeat'
      order by e.created_at desc
      limit 80) r)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.analytics_dashboard(integer, boolean) from public, anon, authenticated;

create or replace function public.admin_dashboard(p_days integer default 7, p_include_admin boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return public.analytics_dashboard(p_days, p_include_admin);
end;
$$;

revoke all on function public.admin_dashboard(integer, boolean) from public, anon;
grant execute on function public.admin_dashboard(integer, boolean) to authenticated;
