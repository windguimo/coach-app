-- Shared content library — makes AI-generated course/quiz content reusable
-- across users instead of regenerating it per user.
--
-- Previously `course_modules`/`quiz_questions` held the generated text
-- directly, keyed by (subject_id, module_index) — but subject_id belongs to
-- one user's `subjects` row, so N users picking the same topic paid for N
-- separate Claude generations of "module 1", "module 2", etc.
--
-- This migration introduces `content_library` (+ `content_library_questions`)
-- as the shared, canonical store, keyed by (topic_slug, module_index) where
-- topic_slug is a normalized form of the free-text subject label (see
-- `slugify_topic` below). `course_modules` becomes a thin per-user pointer
-- (which module a user is on, their notion link) into that shared content —
-- per-user mastery/progress stays exactly where it was.
--
-- Normalization approach (v1): lowercase + strip accents/punctuation +
-- collapse whitespace, no fuzzy/LLM-assisted synonym matching. "Négociation
-- commerciale", "négociation commerciale " and "Negociation Commerciale" all
-- normalize to the slug "negociation-commerciale" and share one cache entry.
-- Two different phrasings of the same underlying topic (e.g. "closing a
-- deal" vs. "négociation commerciale") will NOT be merged — they get
-- separate library entries. That's an intentional v1 trade-off: exact-match
-- normalization is cheap and correct-by-construction, whereas fuzzy/semantic
-- matching risks silently mixing unrelated topics. Revisit once there's
-- usage data showing how much duplication exact-match normalization misses
-- (e.g. promote a curated taxonomy of canonical topics that free-text input
-- gets matched against).
--
-- Staleness policy (v1): content never regenerates once cached. Cheapest
-- option, and fine short-term since course content for a given notion
-- doesn't go stale fast. `reuse_count` is tracked on each entry so a future
-- migration can add periodic regeneration (e.g. after N reuses or M days)
-- once there's real usage data to size that policy against.

-- ─────────────────────────── topic normalization ───────────────────────────
create extension if not exists unaccent;

create or replace function public.slugify_topic(p_label text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(lower(unaccent(coalesce(p_label, ''))), '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )
  );
$$;

-- ─────────────────────────── shared content library ───────────────────────────
create table public.content_library (
  id uuid primary key default gen_random_uuid(),
  topic_slug text not null,
  topic_label text not null, -- first free-text label that created this entry (display/debug only)
  module_index integer not null,
  notion_label text not null,
  eyebrow text not null,
  title text not null,
  paragraphs jsonb not null default '[]'::jsonb,
  takeaway text not null,
  read_minutes integer not null default 6,
  reuse_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (topic_slug, module_index)
);

alter table public.content_library enable row level security;

-- Readable by any authenticated user — it's shared, not owned by one user.
-- No insert/update/delete policy: writes only happen via the Edge Function's
-- service-role client, which bypasses RLS entirely.
create policy "content_library: select for authenticated" on public.content_library
  for select to authenticated using (true);

create table public.content_library_questions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_library(id) on delete cascade,
  question_index integer not null,
  prompt text not null,
  options jsonb not null,
  correct_index smallint not null,
  explanation text not null,
  created_at timestamptz not null default now(),
  unique (content_id, question_index)
);

alter table public.content_library_questions enable row level security;

create policy "content_library_questions: select for authenticated" on public.content_library_questions
  for select to authenticated using (true);

-- ─────────────────────────── course_modules becomes a per-user pointer ───────────────────────────
-- No inline content or existing rows worth migrating (this table only ever
-- held disposable, regenerable AI output), so drop and recreate rather than
-- carry an ALTER TABLE migration for columns that are being removed anyway.
drop table if exists public.quiz_questions cascade;
drop table if exists public.course_modules cascade;

create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  notion_id uuid references public.notions(id) on delete set null,
  content_id uuid not null references public.content_library(id) on delete restrict,
  module_index integer not null,
  created_at timestamptz not null default now(),
  unique (subject_id, module_index)
);

alter table public.course_modules enable row level security;

create policy "course_modules: all own" on public.course_modules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- quiz_attempts now points straight at the shared question, not a per-user copy.
alter table public.quiz_attempts
  add constraint quiz_attempts_quiz_question_id_fkey
  foreign key (quiz_question_id) references public.content_library_questions(id) on delete cascade;

-- ─────────────────────────── RPC: record a quiz attempt (updated) ───────────────────────────
create or replace function public.record_quiz_attempt(p_question_id uuid, p_picked int)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_question public.content_library_questions%rowtype;
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

  select * into v_question from public.content_library_questions where id = p_question_id;
  if not found then
    raise exception 'question not found';
  end if;

  -- the question is shared, but recording an attempt still requires the
  -- caller to actually have this module assigned to them (ownership check
  -- moves from quiz_questions.user_id to a course_modules lookup).
  select * into v_module from public.course_modules
    where content_id = v_question.content_id and user_id = v_user;
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
