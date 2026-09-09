-- Rolls the user's plan forward (called whenever Today/Planning loads) and
-- reconciles past days against real activity instead of a static schedule —
-- a day only becomes "done" if the user actually did something that day,
-- otherwise it's marked "missed". Paste into the SQL Editor and Run.

create function public.ensure_plan_days(p_days_ahead int default 14)
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
  v_had_activity boolean;
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

  for d in 0..p_days_ahead loop
    v_day := current_date + d;
    if not exists (select 1 from public.plan_days where user_id = v_user and day_date = v_day) then
      -- deterministic rotation over subjects, stable across repeated calls
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
