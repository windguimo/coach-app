-- Lets a user remove a subject from Profile. subjects RLS already allows a
-- direct delete ("all own"), but that alone would leave stale future
-- plan_days rows referencing it (subject_id set null on delete, per its
-- "on delete set null" FK) until they naturally scroll past, and wouldn't
-- rebalance the other subjects' scheduling (per-subject frequency phase-
-- shifts depend on the full subject list, see 0008_subject_frequency.sql).
-- So this goes through an RPC, same "purge the future, let
-- ensure_plan_days rebuild" pattern as apply_onboarding/
-- update_subject_frequency.
create function public.delete_subject(p_subject_id uuid)
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

  delete from public.subjects where id = p_subject_id and user_id = v_user;
  if not found then
    raise exception 'subject not found (or not yours)';
  end if;

  delete from public.plan_days where user_id = v_user and day_date >= current_date;
end;
$$;
