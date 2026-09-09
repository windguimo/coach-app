-- Lets users choose which days of the week get a session. Adds
-- profiles.active_days (Postgres dow convention: 0=Sun..6=Sat) and updates
-- apply_onboarding / ensure_plan_days to respect it, producing real 'off'
-- days instead of always scheduling all 7. Paste into the SQL Editor and Run.

alter table public.profiles add column active_days int[] not null default '{0,1,2,3,4,5,6}';

create or replace function public.apply_onboarding(p_subjects text[], p_daily_minutes int, p_active_days int[] default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_label text;
  v_i integer := 0;
  v_n integer := array_length(p_subjects, 1);
  v_day date;
  v_subject_id uuid;
  v_days int[] := coalesce(p_active_days, '{0,1,2,3,4,5,6}');
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if v_n is null or v_n = 0 then
    raise exception 'at least one subject is required';
  end if;
  if array_length(v_days, 1) is null or array_length(v_days, 1) = 0 then
    v_days := '{0,1,2,3,4,5,6}';
  end if;

  delete from public.subjects where user_id = v_user;
  delete from public.plan_days where user_id = v_user and day_date >= current_date;

  update public.profiles set daily_minutes = p_daily_minutes, active_days = v_days where id = v_user;

  foreach v_label in array p_subjects loop
    insert into public.subjects (user_id, label, tone, mastery_pct)
      values (v_user, v_label, case when v_i = 0 then 'accent' else 'neutral' end, 0);
    v_i := v_i + 1;
  end loop;

  for d in 0..6 loop
    v_day := current_date + d;
    if not (extract(dow from v_day)::int = any(v_days)) then
      insert into public.plan_days (user_id, day_date, subject_id, label, status, minutes)
        values (v_user, v_day, null, null, 'off', null);
    else
      select id into v_subject_id from public.subjects where user_id = v_user
        order by created_at offset (d % v_n) limit 1;
      insert into public.plan_days (user_id, day_date, subject_id, label, status, minutes)
        values (
          v_user, v_day, v_subject_id,
          (select label from public.subjects where id = v_subject_id),
          case when d = 0 then 'today' else 'upcoming' end,
          case when extract(dow from v_day) in (0, 6) then greatest(5, p_daily_minutes / 2) else p_daily_minutes end
        );
    end if;
  end loop;
end;
$$;

create or replace function public.ensure_plan_days(p_days_ahead int default 14)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_n integer;
  v_day date;
  v_subject_id uuid;
  v_offset integer;
  v_daily_minutes integer;
  v_active_days int[];
  v_had_activity boolean;
  rec record;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select count(*) into v_n from public.subjects where user_id = v_user;
  if v_n = 0 then
    return;
  end if;

  select daily_minutes, coalesce(active_days, '{0,1,2,3,4,5,6}') into v_daily_minutes, v_active_days
    from public.profiles where id = v_user;

  for d in 0..p_days_ahead loop
    v_day := current_date + d;
    if not exists (select 1 from public.plan_days where user_id = v_user and day_date = v_day) then
      if not (extract(dow from v_day)::int = any(v_active_days)) then
        insert into public.plan_days (user_id, day_date, subject_id, label, status, minutes)
          values (v_user, v_day, null, null, 'off', null);
      else
        v_offset := ((v_day - date '1970-01-01') % v_n + v_n) % v_n;
        select id into v_subject_id from public.subjects where user_id = v_user
          order by created_at offset v_offset limit 1;
        insert into public.plan_days (user_id, day_date, subject_id, label, status, minutes)
          values (
            v_user, v_day, v_subject_id,
            (select label from public.subjects where id = v_subject_id),
            case when d = 0 then 'today' else 'upcoming' end,
            case when extract(dow from v_day) in (0, 6) then greatest(5, v_daily_minutes / 2) else v_daily_minutes end
          );
      end if;
    end if;
  end loop;

  for rec in
    select id, day_date from public.plan_days
    where user_id = v_user and day_date < current_date and status in ('today', 'upcoming')
  loop
    select exists(
      select 1 from public.activity_log where user_id = v_user and activity_date = rec.day_date and intensity > 0
    ) into v_had_activity;
    update public.plan_days set status = case when v_had_activity then 'done' else 'missed' end where id = rec.id;
  end loop;

  update public.plan_days set status = 'today' where user_id = v_user and day_date = current_date and status = 'upcoming';
end;
$$;
