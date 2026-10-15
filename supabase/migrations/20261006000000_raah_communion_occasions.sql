-- Communion services (occasions) of a care period (P1B step 4).
--
-- A period can hold several services: one can be added, moved, marked held,
-- cancelled or restored. This only changes the schedule of the period. Reviews,
-- conversations and care tasks are never touched, and attendance is never
-- written: participation is read from attendance at display time.
-- A closed period's services are frozen.
begin;

create or replace function public.raah_rpc_add_occasion(
  p_workspace text,
  p_actor text,
  p_period_id uuid,
  p_service_date date
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_period public.raah_communion_periods%rowtype;
  v_id uuid;
begin
  perform public.raah_rpc_assert_access(p_workspace, p_actor);

  select * into v_period
  from public.raah_communion_periods
  where workspace_id = p_workspace and id = p_period_id
  for update;
  if not found then
    raise exception using errcode = 'P0404', message = 'period not found';
  end if;
  if v_period.status = 'closed' then
    raise exception using errcode = 'P0422', message = 'period is closed';
  end if;
  if p_service_date is null then
    raise exception using errcode = 'P0422', message = 'service date required';
  end if;
  if exists (
    select 1 from public.raah_communion_occasions
    where workspace_id = p_workspace and period_id = p_period_id and service_date = p_service_date
  ) then
    raise exception using errcode = 'P0409', message = 'service date already exists in this period';
  end if;

  insert into public.raah_communion_occasions (workspace_id, period_id, service_date)
  values (p_workspace, p_period_id, p_service_date)
  returning id into v_id;

  insert into public.raah_audit_events (workspace_id, actor_uid, action, target_type, target_id)
  values (p_workspace, p_actor, 'occasion.add', 'communion_occasion', v_id::text);

  return jsonb_build_object('id', v_id, 'revision', 1);
end;
$$;

-- One change per call: a new date (only while scheduled) or a status change
-- (scheduled -> held / cancelled, and held / cancelled -> scheduled to undo).
create or replace function public.raah_rpc_update_occasion(
  p_workspace text,
  p_actor text,
  p_occasion_id uuid,
  p_expected_revision integer,
  p_status text,
  p_service_date date
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_occ public.raah_communion_occasions%rowtype;
  v_period public.raah_communion_periods%rowtype;
  v_status text;
  v_date date;
  v_date_changed boolean;
  v_status_changed boolean;
begin
  perform public.raah_rpc_assert_access(p_workspace, p_actor);

  select * into v_occ
  from public.raah_communion_occasions
  where workspace_id = p_workspace and id = p_occasion_id;
  if not found then
    raise exception using errcode = 'P0404', message = 'occasion not found';
  end if;

  -- Lock the period first, then re-read the occasion under the lock.
  select * into v_period
  from public.raah_communion_periods
  where workspace_id = p_workspace and id = v_occ.period_id
  for update;

  select * into v_occ
  from public.raah_communion_occasions
  where workspace_id = p_workspace and id = p_occasion_id
  for update;
  if not found then
    raise exception using errcode = 'P0404', message = 'occasion not found';
  end if;

  if v_occ.revision <> p_expected_revision then
    raise exception using errcode = 'P0409', message = 'occasion changed since it was loaded';
  end if;
  if v_period.status = 'closed' then
    raise exception using errcode = 'P0422', message = 'period is closed';
  end if;

  v_status := coalesce(p_status, v_occ.status);
  v_date := coalesce(p_service_date, v_occ.service_date);
  v_date_changed := v_date <> v_occ.service_date;
  v_status_changed := v_status <> v_occ.status;

  if v_status not in ('scheduled', 'held', 'cancelled') then
    raise exception using errcode = 'P0422', message = 'invalid status';
  end if;
  if not v_date_changed and not v_status_changed then
    raise exception using errcode = 'P0422', message = 'nothing to change';
  end if;
  if v_date_changed and (v_status_changed or v_occ.status <> 'scheduled') then
    raise exception using errcode = 'P0422', message = 'only a scheduled service can change its date, on its own';
  end if;
  if v_status_changed and not (
    (v_occ.status = 'scheduled' and v_status in ('held', 'cancelled'))
    or (v_occ.status in ('held', 'cancelled') and v_status = 'scheduled')
  ) then
    raise exception using errcode = 'P0422', message = 'status change not allowed';
  end if;
  if v_date_changed and exists (
    select 1 from public.raah_communion_occasions
    where workspace_id = p_workspace and period_id = v_occ.period_id and service_date = v_date and id <> v_occ.id
  ) then
    raise exception using errcode = 'P0409', message = 'service date already exists in this period';
  end if;

  update public.raah_communion_occasions
  set status = v_status,
      service_date = v_date,
      -- A linked attendance event belongs to the old date; it is re-derived by date.
      attendance_event_id = case when v_date_changed then null else attendance_event_id end,
      revision = revision + 1,
      updated_at = now()
  where id = v_occ.id;

  insert into public.raah_audit_events (workspace_id, actor_uid, action, target_type, target_id)
  values (p_workspace, p_actor, 'occasion.update', 'communion_occasion', v_occ.id::text);

  return jsonb_build_object('revision', v_occ.revision + 1);
end;
$$;

revoke execute on function public.raah_rpc_add_occasion(text, text, uuid, date) from public, anon, authenticated;
revoke execute on function public.raah_rpc_update_occasion(text, text, uuid, integer, text, date) from public, anon, authenticated;
grant execute on function public.raah_rpc_add_occasion(text, text, uuid, date) to service_role;
grant execute on function public.raah_rpc_update_occasion(text, text, uuid, integer, text, date) to service_role;

commit;
