-- LLM cost tracking. Every Anthropic call made by an Edge Function
-- (generate-session, demo-lesson) writes one row to `llm_usage` with the
-- token counts the API reports in `usage`, the duration, and whether it
-- succeeded. `cost_usd` is computed at insert time by a trigger from
-- `llm_prices` (USD per million tokens), so:
--   - a price change is a one-row UPDATE of llm_prices, no redeploy;
--   - past rows keep the cost they were billed at.
-- Calls made before this migration were not measured (no token counts were
-- kept); the dashboard only covers calls from here on.
--
-- `llm_costs(days)` aggregates it for the dashboard; `admin_dashboard`
-- (migration 0013) is replaced to merge it in under the `llm` key.
-- Both tables: RLS with no policies — written by the functions'
-- service-role client, read only through the security definer functions.

create table public.llm_prices (
  model text primary key,
  input_per_mtok numeric not null,
  output_per_mtok numeric not null,
  cache_write_per_mtok numeric not null,
  cache_read_per_mtok numeric not null,
  updated_at timestamptz not null default now()
);

alter table public.llm_prices enable row level security;

-- claude-sonnet-5: $2 / $10 per MTok; cache writes 1.25× input (5-min
-- TTL), cache reads 0.1× input.
insert into public.llm_prices (model, input_per_mtok, output_per_mtok, cache_write_per_mtok, cache_read_per_mtok)
values ('claude-sonnet-5', 2, 10, 2.5, 0.2);

create table public.llm_usage (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  function_name text not null,          -- 'generate-session' | 'demo-lesson'
  model text not null,
  user_id uuid references auth.users(id) on delete set null,
  topic_slug text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_creation_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  duration_ms integer,
  ok boolean not null default true,
  error text
);

create index llm_usage_created_idx on public.llm_usage (created_at);

alter table public.llm_usage enable row level security;

create or replace function public.llm_usage_set_cost()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  p public.llm_prices;
begin
  select * into p from public.llm_prices where model = new.model;
  if found then
    new.cost_usd := (new.input_tokens * p.input_per_mtok
                   + new.output_tokens * p.output_per_mtok
                   + new.cache_creation_tokens * p.cache_write_per_mtok
                   + new.cache_read_tokens * p.cache_read_per_mtok) / 1000000.0;
  end if;
  return new;
end;
$$;

create trigger llm_usage_cost before insert on public.llm_usage
  for each row execute function public.llm_usage_set_cost();

create or replace function public.llm_costs(p_days integer default 7)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with
  win as (
    select now() - make_interval(days => greatest(coalesce(p_days, 7), 1)) as since
  ),
  u as (
    select l.* from public.llm_usage l, win where l.created_at >= win.since
  ),
  days as (
    select d::date as day
    from win, generate_series((win.since at time zone 'Europe/Paris')::date,
                              (now() at time zone 'Europe/Paris')::date,
                              interval '1 day') d
  )
  select jsonb_build_object(
    'total_usd', (select round(coalesce(sum(cost_usd), 0), 4) from u),
    'calls', (select count(*) from u),
    'failed_calls', (select count(*) from u where not ok),
    'input_tokens', (select coalesce(sum(input_tokens + cache_creation_tokens + cache_read_tokens), 0) from u),
    'output_tokens', (select coalesce(sum(output_tokens), 0) from u),
    'all_time_usd', (select round(coalesce(sum(cost_usd), 0), 4) from public.llm_usage),
    'tracking_since', (select min(created_at) from public.llm_usage),
    'by_function', (select coalesce(jsonb_agg(jsonb_build_object(
        'function', function_name,
        'calls', calls,
        'failed', failed,
        'cost_usd', round(cost, 4),
        'avg_cost_usd', round(cost / nullif(calls, 0), 5),
        'avg_input_tokens', round(avg_in),
        'avg_output_tokens', round(avg_out),
        'avg_ms', round(avg_ms)
      ) order by cost desc), '[]'::jsonb)
      from (select function_name, count(*) as calls, count(*) filter (where not ok) as failed,
                   sum(cost_usd) as cost,
                   avg(input_tokens + cache_creation_tokens + cache_read_tokens) as avg_in,
                   avg(output_tokens) as avg_out, avg(duration_ms) as avg_ms
            from u group by function_name) f),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day,
        'cost_usd', (select round(coalesce(sum(cost_usd), 0), 4) from u
                      where (created_at at time zone 'Europe/Paris')::date = d.day),
        'calls', (select count(*) from u where (created_at at time zone 'Europe/Paris')::date = d.day)
      ) order by d.day), '[]'::jsonb) from days d),
    'top_topics', (select coalesce(jsonb_agg(jsonb_build_object('topic', topic_slug, 'calls', calls, 'cost_usd', round(cost, 4))
                     order by cost desc), '[]'::jsonb)
                   from (select coalesce(topic_slug, '—') as topic_slug, count(*) as calls, sum(cost_usd) as cost
                         from u group by 1 order by cost desc limit 10) t),
    -- How much the shared caches save: modules served to users vs modules
    -- actually generated, demo lessons shown vs generated.
    'cache', jsonb_build_object(
      'modules_served', (select count(*) from public.course_modules c, win where c.created_at >= win.since),
      'modules_generated', (select count(*) from u where function_name = 'generate-session' and ok),
      'demos_shown', (select count(*) from public.app_events e, win
                       where e.event = 'demo_completed' and e.created_at >= win.since),
      'demos_generated', (select count(*) from u where function_name = 'demo-lesson' and ok)
    ),
    'prices', (select coalesce(jsonb_agg(to_jsonb(p) - 'updated_at'), '[]'::jsonb) from public.llm_prices p)
  );
$$;

revoke all on function public.llm_costs(integer) from public, anon, authenticated;

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
  return public.analytics_dashboard(p_days, p_include_admin)
         || jsonb_build_object('llm', public.llm_costs(p_days));
end;
$$;
