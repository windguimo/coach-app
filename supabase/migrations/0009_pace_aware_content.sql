-- Content length now depends on the user's chosen daily pace (10/15/25/40
-- min from ONBOARDING_PACES) — previously every module had a hardcoded 2
-- paragraphs + 2 quiz questions regardless of pace, so a "10 min" session
-- was actually done in about a minute. generate-session now sizes the
-- generated lesson from profile.daily_minutes (see its updated code), and
-- the shared cache key grows from (topic_slug, module_index) to
-- (topic_slug, module_index, target_minutes) so two users on different
-- paces don't reuse each other's differently-sized content.

alter table public.content_library add column target_minutes integer not null default 15;

alter table public.content_library drop constraint if exists content_library_topic_slug_module_index_key;
alter table public.content_library
  add constraint content_library_topic_slug_module_index_target_minutes_key
  unique (topic_slug, module_index, target_minutes);
