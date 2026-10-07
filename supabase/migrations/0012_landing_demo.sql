-- Public landing-page demo: a logged-out visitor types any subject and
-- watches a mini-lesson + one quiz question being written live by Claude
-- (Edge Function `demo-lesson`, deployed with verify_jwt = false).
--
-- `demo_lessons` caches the generated text per normalized topic (same
-- `slugify_topic` normalization as content_library, migration 0007), so a
-- topic is only ever paid for once; every later visitor typing it — or
-- clicking the same suggestion chip — gets the cached text replayed for
-- free. Kept separate from content_library on purpose: demo content is a
-- shorter, differently-shaped format (plain text streamed as it's
-- generated, not a structured tool call) and must not leak into real
-- users' course sequences.
--
-- `demo_requests` is the rate-limit log: one row per *generation* (cache
-- hits are free and not logged), keyed by a salted hash of the visitor's IP
-- — never the raw IP. The function refuses beyond 3 generations per IP per
-- day and beyond a global daily cap, which bounds the worst-case Anthropic
-- spend of an open, unauthenticated endpoint.
--
-- Both tables: RLS enabled with no policies → unreachable from the anon /
-- authenticated keys, only the function's service-role client touches them.

create table public.demo_lessons (
  topic_slug text primary key,
  topic_label text not null,
  content text not null,
  hit_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.demo_lessons enable row level security;

create table public.demo_requests (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  topic_slug text not null,
  created_at timestamptz not null default now()
);

create index demo_requests_created_at_idx on public.demo_requests (created_at);
create index demo_requests_ip_created_idx on public.demo_requests (ip_hash, created_at);

alter table public.demo_requests enable row level security;
