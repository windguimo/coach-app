-- Replaces the round-robin subject rotation with a per-subject weekly
-- frequency. Previously apply_onboarding/ensure_plan_days picked exactly one
-- subject per active day via `offset (d % subject_count)`, so with several
-- subjects each one only came back every Nth day. Now every subject has a
-- `sessions_per_week` (1-7, default 7 = every active day) and the scheduler
-- decides, per active day, which subject(s) are due — a day can end up with
-- zero, one, or several subjects depending on everyone's settings.
--
-- plan_days therefore stops being "one row per day" and becomes "one row per
-- scheduled session" (still one row per (day, subject) pair). Nothing reads
-- plan_days assuming a single row per day at the data layer — the frontend
-- pieces that did are updated in the same change as this migration.

alter table public.subjects
  add column sessions_per_week smallint not null default 7 check (sessions_per_week between 1 and 7);

alter table public.plan_days drop constraint if exists plan_days_user_id_day_date_key;
alter table public.plan_days add constraint plan_days_user_id_day_date_subject_id_key unique (user_id, day_date, subject_id);

-- ─────────────────────────── RPC: apply onboarding selection (updated) ───────────────────────────
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
  v_days int[] := coalesce(p_active_days, '{0,1,2,3,4,5,6}');
  v_freq_by_label jsonb;
  v_active_dows int[];
  v_n_active integer;
  v_rank integer;
  v_subject record;
  v_dow_idx integer;
  v_shifted integer;
  v_f_eff integer;
  v_due boolean;
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

  -- Preserve each existing subject's frequency across a re-submitted
  -- onboarding (e.g. via "Ajouter un sujet") — otherwise editing the subject
  -- list would silently reset everyone's tuning back to "every day".
  select jsonb_object_agg(label, sessions_per_week) into v_freq_by_label
    from public.subjects where user_id = v_user;

  delete from public.subjects where user_id = v_user;
  delete from public.plan_days where user_id = v_user and day_date >= current_date;

  update public.profiles set daily_minutes = p_daily_minutes, active_days = v_days where id = v_user;

  foreach v_label in array p_subjects loop
    insert into public.subjects (user_id, label, tone, mastery_pct, sessions_per_week)
      values (
        v_user, v_label, case when v_i = 0 then 'accent' else 'neutral' end, 0,
        coalesce((v_freq_by_label ->> v_label)::int, 7)
      );
    v_i := v_i + 1;
  end loop;

  select array_agg(dow order by dow) into v_active_dows from unnest(v_days) as dow;
  v_n_active := array_length(v_active_dows, 1);

  for d in 0..6 loop
    v_day := current_date + d;
    if not (extract(dow from v_day)::int = any(v_active_dows)) then
      insert into public.plan_days (user_id, day_date, subject_id, label, status, minutes)
        values (v_user, v_day, null, null, 'off', null);
    else
      select array_position(v_active_dows, extract(dow from v_day)::int) - 1 into v_dow_idx;

      v_rank := 0;
      for v_subject in select id, label, sessions_per_week from public.subjects where user_id = v_user order by created_at loop
        v_f_eff := least(v_subject.sessions_per_week, v_n_active);
        v_shifted := (v_dow_idx + v_rank) % v_n_active;
        v_due := (((v_shifted + 1) * v_f_eff) / v_n_active) - ((v_shifted * v_f_eff) / v_n_active) >= 1;
        if v_due then
          insert into public.plan_days (user_id, day_date, subject_id, label, status, minutes)
            values (
              v_user, v_day, v_subject.id, v_subject.label,
              case when d = 0 then 'today' else 'upcoming' end,
              case when extract(dow from v_day) in (0, 6) then greatest(5, p_daily_minutes / 2) else p_daily_minutes end
            );
        end if;
        v_rank := v_rank + 1;
      end loop;
    end if;
  end loop;
end;
$$;

-- ─────────────────────────── RPC: roll the plan forward (updated) ───────────────────────────
create or replace function public.ensure_plan_days(p_days_ahead int default 14)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_n integer;
  v_day date;
  v_daily_minutes integer;
  v_active_dows int[];
  v_n_active integer;
  v_rank integer;
  v_subject record;
  v_dow_idx integer;
  v_shifted integer;
  v_f_eff integer;
  v_due boolean;
  v_any_for_day boolean;
  rec record;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select count(*) into v_n from public.subjects where user_id = v_user;
  if v_n = 0 then
    return; -- no subjects yet — nothing to plan until onboarding runs
  end if;

  select daily_minutes into v_daily_minutes from public.profiles where id = v_user;
  select array_agg(dow order by dow) into v_active_dows
    from unnest(coalesce((select active_days from public.profiles where id = v_user), '{0,1,2,3,4,5,6}')) as dow;
  v_n_active := array_length(v_active_dows, 1);

  for d in 0..p_days_ahead loop
    v_day := current_date + d;
    if not exists (select 1 from public.plan_days where user_id = v_user and day_date = v_day) then
      if not (extract(dow from v_day)::int = any(v_active_dows)) then
        insert into public.plan_days (user_id, day_date, subject_id, label, status, minutes)
          values (v_user, v_day, null, null, 'off', null);
      else
        select array_position(v_active_dows, extract(dow from v_day)::int) - 1 into v_dow_idx;

        v_any_for_day := false;
        v_rank := 0;
        for v_subject in select id, label, sessions_per_week from public.subjects where user_id = v_user order by created_at loop
          v_f_eff := least(v_subject.sessions_per_week, v_n_active);
          v_shifted := (v_dow_idx + v_rank) % v_n_active;
          v_due := (((v_shifted + 1) * v_f_eff) / v_n_active) - ((v_shifted * v_f_eff) / v_n_active) >= 1;
          if v_due then
            insert into public.plan_days (user_id, day_date, subject_id, label, status, minutes)
              values (
                v_user, v_day, v_subject.id, v_subject.label,
                case when d = 0 then 'today' else 'upcoming' end,
                case when extract(dow from v_day) in (0, 6) then greatest(5, v_daily_minutes / 2) else v_daily_minutes end
              );
            v_any_for_day := true;
          end if;
          v_rank := v_rank + 1;
        end loop;
      end if;
    end if;
  end loop;

  -- Reconcile past days per (day, subject): "done" if this specific subject
  -- was actually practiced that day (a course_modules row exists for it),
  -- "missed" otherwise — more precise than the old day-level activity_log
  -- check, now that a day can carry more than one subject.
  for rec in
    select id, day_date, subject_id from public.plan_days
    where user_id = v_user and day_date < current_date and status in ('today', 'upcoming') and subject_id is not null
  loop
    update public.plan_days set status = case
      when exists (
        select 1 from public.course_modules
        where user_id = v_user and subject_id = rec.subject_id and created_at::date = rec.day_date
      ) then 'done' else 'missed' end
      where id = rec.id;
  end loop;

  update public.plan_days set status = 'today' where user_id = v_user and day_date = current_date and status = 'upcoming';
end;
$$;

-- ─────────────────────────── RPC: change one subject's frequency ───────────────────────────
create function public.update_subject_frequency(p_subject_id uuid, p_sessions_per_week int)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if p_sessions_per_week < 1 or p_sessions_per_week > 7 then
    raise exception 'sessions_per_week must be between 1 and 7';
  end if;

  update public.subjects set sessions_per_week = p_sessions_per_week
    where id = p_subject_id and user_id = v_user;
  if not found then
    raise exception 'subject not found (or not yours)';
  end if;

  -- Drop future scheduling so the next ensure_plan_days() call rebuilds it
  -- under the new frequency — same "purge the future, let the scheduler
  -- rebuild" pattern apply_onboarding already uses.
  delete from public.plan_days where user_id = v_user and day_date >= current_date;
end;
$$;
