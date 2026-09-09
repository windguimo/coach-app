-- Links each quiz question to its notion (previously only reachable via
-- course_modules), so the Révisions screen can query directly: "give me
-- questions for notions that aren't mastered yet". Paste into the SQL
-- Editor and Run.

alter table public.quiz_questions add column notion_id uuid references public.notions(id) on delete set null;

update public.quiz_questions qq
  set notion_id = cm.notion_id
  from public.course_modules cm
  where cm.id = qq.course_module_id and qq.notion_id is null;
