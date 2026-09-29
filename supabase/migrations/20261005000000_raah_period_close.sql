-- Closing and reopening a communion care period (P1B step 2).
--
-- Closing freezes the roster, review transitions and new conversation logs
-- (the existing RPCs already refuse a closed period with P0422). Care tasks are
-- not tied to periods, so closing never touches them: they stay open and can
-- still be completed. The summary stored at closing holds counts only, never
-- ids or names. Reopening keeps that summary (it describes the last close) and
-- records who reopened it and why.
begin;

alter table public.raah_communion_periods add column if not exists closing_summary jsonb;
alter table public.raah_communion_periods add column if not exists reopened_at timestamptz;
alter table public.raah_communion_periods add column if not exists reopened_by text;
alter table public.raah_communion_periods add column if not exists reopen_reason text
  check (reopen_reason is null or char_length(reopen_reason) between 1 and 200);

create or replace function public.raah_rpc_close_period(
  p_workspace text,
  p_actor text,
  p_period_id uuid,
  p_expected_revision integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_period public.raah_communion_periods%rowtype;
  v_by_status jsonb;
  v_included integer;
  v_excluded integer;
  v_open_tasks integer;
  v_summary jsonb;
begin
  perform public.raah_rpc_assert_access(p_workspace, p_actor);

  select * into v_period
  from public.raah_communion_periods
  where workspace_id = p_workspace and id = p_period_id
  for update;
  if not found then
    raise exception using errcode = 'P0404', message = 'period not found';
  end if;
  if v_period.revision <> p_expected_revision then
    raise exception using errcode = 'P0409', message = 'period changed since it was loaded';
  end if;
  if v_period.status = 'closed' then
    raise exception using errcode = 'P0422', message = 'period is already closed';
  end if;

  select
    count(*) filter (where roster_state = 'included'),
    count(*) filter (where roster_state = 'excluded')
  into v_included, v_excluded
  from public.raah_communion_reviews
  where workspace_id = p_workspace and period_id = p_period_id;

  select jsonb_build_object(
    'not_started', count(*) filter (where status = 'not_started'),
    'scheduled', count(*) filter (where status = 'scheduled'),
    'in_progress', count(*) filter (where status = 'in_progress'),
    'reviewed', count(*) filter (where status = 'reviewed'),
    'closed_without_contact', count(*) filter (where status = 'closed_without_contact')
  ) into v_by_status
  from public.raah_communion_reviews
  where workspace_id = p_workspace and period_id = p_period_id and roster_state = 'included';

  select count(*) into v_open_tasks
  from public.raah_care_tasks t
  where t.workspace_id = p_workspace
    and t.status in ('open', 'deferred')
    and t.member_id in (
      select r.member_id
      from public.raah_communion_reviews r
      where r.workspace_id = p_workspace and r.period_id = p_period_id and r.roster_state = 'included'
    );

  v_summary := jsonb_build_object(
    'included', v_included,
    'excluded', v_excluded,
    'byStatus', v_by_status,
    'openCareTasks', v_open_tasks
  );

  update public.raah_communion_periods
  set status = 'closed',
      closed_at = now(),
      closed_by = p_actor,
      closing_summary = v_summary,
      revision = revision + 1,
      updated_at = now()
  where id = v_period.id;

  insert into public.raah_audit_events (workspace_id, actor_uid, action, target_type, target_id)
  values (p_workspace, p_actor, 'period.close', 'communion_period', p_period_id::text);

  return jsonb_build_object('revision', v_period.revision + 1, 'closingSummary', v_summary);
end;
$$;

create or replace function public.raah_rpc_reopen_period(
  p_workspace text,
  p_actor text,
  p_period_id uuid,
  p_expected_revision integer,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_period public.raah_communion_periods%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  perform public.raah_rpc_assert_access(p_workspace, p_actor);

  select * into v_period
  from public.raah_communion_periods
  where workspace_id = p_workspace and id = p_period_id
  for update;
  if not found then
    raise exception using errcode = 'P0404', message = 'period not found';
  end if;
  if v_period.revision <> p_expected_revision then
    raise exception using errcode = 'P0409', message = 'period changed since it was loaded';
  end if;
  if v_period.status <> 'closed' then
    raise exception using errcode = 'P0422', message = 'period is not closed';
  end if;
  if char_length(v_reason) not between 1 and 200 then
    raise exception using errcode = 'P0422', message = 'reason required';
  end if;

  update public.raah_communion_periods
  set status = 'active',
      closed_at = null,
      closed_by = null,
      reopened_at = now(),
      reopened_by = p_actor,
      reopen_reason = v_reason,
      revision = revision + 1,
      updated_at = now()
  where id = v_period.id;

  insert into public.raah_audit_events (workspace_id, actor_uid, action, target_type, target_id)
  values (p_workspace, p_actor, 'period.reopen', 'communion_period', p_period_id::text);

  return jsonb_build_object('revision', v_period.revision + 1);
end;
$$;

revoke execute on function public.raah_rpc_close_period(text, text, uuid, integer) from public, anon, authenticated;
revoke execute on function public.raah_rpc_reopen_period(text, text, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.raah_rpc_close_period(text, text, uuid, integer) to service_role;
grant execute on function public.raah_rpc_reopen_period(text, text, uuid, integer, text) to service_role;

commit;
