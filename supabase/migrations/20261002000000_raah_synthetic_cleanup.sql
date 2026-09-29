-- Test ("시범") data cleanup.
--
-- Real pastoral history must stay protected, so deletion exists only for
-- members flagged synthetic at creation and for communion periods that hold no
-- real member. The flag is set once on insert (the API never updates it), and
-- both functions re-check the flag / roster inside the transaction.
-- Audit rows carry ids and counts only, never names or content.
begin;

alter table public.raah_members add column if not exists is_synthetic boolean not null default false;

-- Deletes a synthetic member and everything attached to them, in FK-safe order.
-- Tables holding a member reference: raah_visitation_logs, raah_attendance_records
-- (cascade), raah_follow_up_resolutions, raah_ministry_schedule_items,
-- raah_member_ecclesial_profiles, raah_communion_reviews (+ review_logs),
-- raah_care_tasks.
create or replace function public.raah_rpc_delete_synthetic_member(
  p_workspace text,
  p_actor text,
  p_member_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_member public.raah_members%rowtype;
  v_review_ids uuid[];
  v_log_ids uuid[];
  v_slot_ids uuid[];
  v_logs integer := 0;
  v_reviews integer := 0;
  v_tasks integer := 0;
  v_slots integer := 0;
  v_n integer;
begin
  perform public.raah_rpc_assert_access(p_workspace, p_actor);

  select * into v_member from public.raah_members where id = p_member_id for update;
  if not found then
    raise exception using errcode = 'P0404', message = 'member not found';
  end if;
  if not v_member.is_synthetic then
    raise exception using errcode = 'P0422', message = 'member is not synthetic';
  end if;

  select coalesce(array_agg(id), '{}') into v_review_ids
  from public.raah_communion_reviews where member_id = p_member_id;
  select coalesce(array_agg(id), '{}') into v_log_ids
  from public.raah_visitation_logs where member_id = p_member_id;

  -- Links first (both directions), then the reviews they pointed at.
  delete from public.raah_communion_review_logs
  where review_id = any (v_review_ids) or visitation_log_id = any (v_log_ids);
  delete from public.raah_communion_reviews where member_id = p_member_id;
  get diagnostics v_reviews = row_count;

  delete from public.raah_member_ecclesial_profiles where member_id = p_member_id;

  -- Care tasks and the calendar slots they pointed at.
  select coalesce(array_agg(schedule_item_id) filter (where schedule_item_id is not null), '{}') into v_slot_ids
  from public.raah_care_tasks where member_id = p_member_id;
  delete from public.raah_care_tasks where member_id = p_member_id;
  get diagnostics v_tasks = row_count;
  delete from public.raah_ministry_schedule_items
  where id = any (v_slot_ids) or member_id = p_member_id;
  get diagnostics v_slots = row_count;

  delete from public.raah_follow_up_resolutions
  where member_id = p_member_id or (source_type = 'visitation' and source_id = any (v_log_ids));
  delete from public.raah_visitation_logs where member_id = p_member_id;
  get diagnostics v_logs = row_count;

  -- Attendance records cascade with the member.
  delete from public.raah_members where id = p_member_id;

  insert into public.raah_audit_events (workspace_id, actor_uid, action, target_type, target_id)
  values (p_workspace, p_actor, 'member.synthetic_delete', 'member', p_member_id::text);

  return jsonb_build_object('visitationLogs', v_logs, 'reviews', v_reviews, 'careTasks', v_tasks, 'scheduleItems', v_slots);
end;
$$;

-- Deletes a communion period only when no real (non-synthetic) member has a
-- review in it, in any roster state. Conversation logs stay with their
-- synthetic member; only the links are removed.
create or replace function public.raah_rpc_delete_test_period(
  p_workspace text,
  p_actor text,
  p_period_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_period public.raah_communion_periods%rowtype;
  v_review_ids uuid[];
  v_slot_ids uuid[];
  v_reviews integer := 0;
  v_tasks integer := 0;
  v_slots integer := 0;
begin
  perform public.raah_rpc_assert_access(p_workspace, p_actor);

  select * into v_period
  from public.raah_communion_periods
  where workspace_id = p_workspace and id = p_period_id
  for update;
  if not found then
    raise exception using errcode = 'P0404', message = 'period not found';
  end if;

  if exists (
    select 1
    from public.raah_communion_reviews r
    join public.raah_members m on m.id = r.member_id
    where r.workspace_id = p_workspace and r.period_id = p_period_id and not m.is_synthetic
  ) then
    raise exception using errcode = 'P0409', message = 'period has real members';
  end if;

  select coalesce(array_agg(id), '{}') into v_review_ids
  from public.raah_communion_reviews where workspace_id = p_workspace and period_id = p_period_id;

  select coalesce(array_agg(schedule_item_id) filter (where schedule_item_id is not null), '{}') into v_slot_ids
  from public.raah_care_tasks
  where workspace_id = p_workspace and source_type = 'communion_review' and source_id = any (v_review_ids);
  delete from public.raah_care_tasks
  where workspace_id = p_workspace and source_type = 'communion_review' and source_id = any (v_review_ids);
  get diagnostics v_tasks = row_count;
  delete from public.raah_ministry_schedule_items where id = any (v_slot_ids);
  get diagnostics v_slots = row_count;

  delete from public.raah_communion_review_logs where workspace_id = p_workspace and review_id = any (v_review_ids);
  delete from public.raah_communion_reviews where workspace_id = p_workspace and period_id = p_period_id;
  get diagnostics v_reviews = row_count;
  delete from public.raah_communion_occasions where workspace_id = p_workspace and period_id = p_period_id;
  delete from public.raah_communion_periods where workspace_id = p_workspace and id = p_period_id;

  insert into public.raah_audit_events (workspace_id, actor_uid, action, target_type, target_id)
  values (p_workspace, p_actor, 'period.test_delete', 'communion_period', p_period_id::text);

  return jsonb_build_object('reviews', v_reviews, 'careTasks', v_tasks, 'scheduleItems', v_slots);
end;
$$;

revoke execute on function public.raah_rpc_delete_synthetic_member(text, text, uuid) from public, anon, authenticated;
revoke execute on function public.raah_rpc_delete_test_period(text, text, uuid) from public, anon, authenticated;
grant execute on function public.raah_rpc_delete_synthetic_member(text, text, uuid) to service_role;
grant execute on function public.raah_rpc_delete_test_period(text, text, uuid) to service_role;

commit;
