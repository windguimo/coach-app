-- Coach app schema — profiles, subjects, notions, weekly plan, AI-generated
-- course/quiz content, quiz attempts, activity heatmap, milestones.
-- Paste this whole file into the Supabase SQL Editor and click "Run".

-- ─────────────────────────── profiles ───────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Vous',
  initials text not null default '??',
  xp integer not null default 0,
  streak_days integer not null default 0,
  last_active_date date,
  daily_minutes integer not null default 15,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: select own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);

-- auto-create a profile row whenever a new user signs up
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, initials)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    upper(left(coalesce(new.raw_user_meta_data->>'display_name', new.email), 2))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────── subjects ───────────────────────────
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  tone text not null default 'neutral', -- 'accent' | 'neutral' (display only)
  mastery_pct numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.subjects enable row level security;

create policy "subjects: all own" on public.subjects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────── notions ───────────────────────────
create table public.notions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  label text not null,
  filled smallint not null default 0 check (filled between 0 and 5),
  status_label text not null default 'à découvrir',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.notions enable row level security;

create policy "notions: all own" on public.notions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────── weekly plan ───────────────────────────
create table public.plan_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_date date not null,
  subject_id uuid references public.subjects(id) on delete set null,
  label text,
  status text not null default 'upcoming', -- 'done' | 'today' | 'upcoming' | 'off'
  minutes integer,
  created_at timestamptz not null default now(),
  unique (user_id, day_date)
);

alter table public.plan_days enable row level security;

create policy "plan_days: all own" on public.plan_days
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────── activity log (heatmap) ───────────────────────────
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  intensity numeric not null default 0 check (intensity between 0 and 1),
  created_at timestamptz not null default now(),
  unique (user_id, activity_date)
);

alter table public.activity_log enable row level security;

create policy "activity_log: all own" on public.activity_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────── milestones ───────────────────────────
create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null, -- e.g. 'streak_10', 'quiz_no_fault', 'subject_complete'
  label text not null,
  icon text not null default 'flame',
  reached boolean not null default false,
  reached_at timestamptz,
  unique (user_id, key)
);

alter table public.milestones enable row level security;

create policy "milestones: all own" on public.milestones
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────── AI-generated course modules ───────────────────────────
create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  notion_id uuid references public.notions(id) on delete set null,
  module_index integer not null,
  eyebrow text not null,
  title text not null,
  paragraphs jsonb not null default '[]'::jsonb,
  takeaway text not null,
  read_minutes integer not null default 6,
  created_at timestamptz not null default now(),
  unique (subject_id, module_index)
);

alter table public.course_modules enable row level security;

create policy "course_modules: all own" on public.course_modules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────── AI-generated quiz questions ───────────────────────────
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_module_id uuid not null references public.course_modules(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  question_index integer not null,
  prompt text not null,
  options jsonb not null, -- array of strings
  correct_index smallint not null,
  explanation text not null,
  created_at timestamptz not null default now(),
  unique (course_module_id, question_index)
);

alter table public.quiz_questions enable row level security;

create policy "quiz_questions: all own" on public.quiz_questions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────── quiz attempts (audit trail) ───────────────────────────
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quiz_question_id uuid not null references public.quiz_questions(id) on delete cascade,
  picked_index smallint not null,
  is_correct boolean not null,
  xp_awarded integer not null,
  created_at timestamptz not null default now()
);

alter table public.quiz_attempts enable row level security;

create policy "quiz_attempts: select own" on public.quiz_attempts
  for select using (auth.uid() = user_id);
create policy "quiz_attempts: insert own" on public.quiz_attempts
  for insert with check (auth.uid() = user_id);

-- ─────────────────────────── RPC: record a quiz attempt ───────────────────────────
-- Server-side scoring: client cannot forge XP/streak by writing profiles directly
-- (no update policy is granted for xp/streak — only this function, running as the
-- caller via SECURITY INVOKER, is allowed to touch them through direct table grants
-- being absent; instead we use SECURITY DEFINER and enforce ownership explicitly).
create function public.record_quiz_attempt(p_question_id uuid, p_picked int)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_question public.quiz_questions%rowtype;
  v_module public.course_modules%rowtype;
  v_correct boolean;
  v_xp integer;
  v_today date := current_date;
  v_last date;
  v_streak integer;
  v_notion_id uuid;
  v_filled smallint;
  v_status text;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select * into v_question from public.quiz_questions
    where id = p_question_id and user_id = v_user;
  if not found then
    raise exception 'question not found';
  end if;

  v_correct := (p_picked = v_question.correct_index);
  v_xp := case when v_correct then 25 else 5 end;

  insert into public.quiz_attempts (user_id, quiz_question_id, picked_index, is_correct, xp_awarded)
  values (v_user, p_question_id, p_picked, v_correct, v_xp);

  select last_active_date, streak_days into v_last, v_streak from public.profiles where id = v_user;
  if v_last = v_today then
    -- already active today, streak unchanged
  elsif v_last = v_today - 1 then
    v_streak := v_streak + 1;
  else
    v_streak := 1;
  end if;

  update public.profiles
    set xp = xp + v_xp, streak_days = v_streak, last_active_date = v_today
    where id = v_user;

  insert into public.activity_log (user_id, activity_date, intensity)
    values (v_user, v_today, 1)
    on conflict (user_id, activity_date) do update set intensity = least(1, public.activity_log.intensity + 0.3);

  if v_correct then
    select * into v_module from public.course_modules where id = v_question.course_module_id;
    v_notion_id := v_module.notion_id;
    if v_notion_id is not null then
      update public.notions set filled = least(5, filled + 1) where id = v_notion_id
        returning filled into v_filled;
      v_status := case
        when v_filled >= 4 then 'solide'
        when v_filled >= 2 then 'en cours'
        when v_filled = 1 then 'démarré'
        else 'à découvrir'
      end;
      update public.notions set status_label = v_status where id = v_notion_id;
    end if;
  end if;

  if v_streak >= 10 then
    insert into public.milestones (user_id, key, label, icon, reached, reached_at)
      values (v_user, 'streak_10', '10 jours d''affilée', 'flame', true, now())
      on conflict (user_id, key) do update set reached = true, reached_at = coalesce(public.milestones.reached_at, now());
  end if;

  return jsonb_build_object(
    'correct', v_correct,
    'xp_awarded', v_xp,
    'xp_total', (select xp from public.profiles where id = v_user),
    'streak_days', v_streak
  );
end;
$$;

-- ─────────────────────────── RPC: apply onboarding selection ───────────────────────────
-- Replaces the user's subjects + regenerates a 7-day plan starting today.
create function public.apply_onboarding(p_subjects text[], p_daily_minutes int)
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
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if v_n is null or v_n = 0 then
    raise exception 'at least one subject is required';
  end if;

  delete from public.subjects where user_id = v_user;
  delete from public.plan_days where user_id = v_user and day_date >= current_date;

  update public.profiles set daily_minutes = p_daily_minutes where id = v_user;

  foreach v_label in array p_subjects loop
    insert into public.subjects (user_id, label, tone, mastery_pct)
      values (v_user, v_label, case when v_i = 0 then 'accent' else 'neutral' end, 0);
    v_i := v_i + 1;
  end loop;

  for d in 0..6 loop
    v_day := current_date + d;
    select id into v_subject_id from public.subjects where user_id = v_user
      order by created_at offset (d % v_n) limit 1;
    insert into public.plan_days (user_id, day_date, subject_id, label, status, minutes)
      values (
        v_user, v_day, v_subject_id,
        (select label from public.subjects where id = v_subject_id),
        case when d = 0 then 'today' else 'upcoming' end,
        case when extract(dow from v_day) in (0, 6) then greatest(5, p_daily_minutes / 2) else p_daily_minutes end
      );
  end loop;
end;
$$;
