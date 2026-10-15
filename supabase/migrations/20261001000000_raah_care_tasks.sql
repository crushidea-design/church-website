-- Follow-up care tasks (plan 8.2, 11.x, R08 / PR-9).
--
-- A task outlives the communion period it came from, carries a neutral list
-- title and an optional encrypted detail, and may point at a schedule item.
-- The schedule item is only a calendar slot: completing it never completes the
-- care, and completing the care never touches the schedule.
begin;

create table if not exists public.raah_care_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'default',
  member_id uuid not null references public.raah_members(id) on delete restrict,
  source_type text not null check (source_type in ('communion_review', 'visitation_log', 'manual')),
  source_id uuid,
  assignee_uid text not null,
  -- Shown in lists and reminders, so it stays neutral (e.g. "후속 면담").
  title text not null check (char_length(title) between 1 and 60),
  due_on date,
  status text not null default 'open' check (status in ('open', 'deferred', 'done', 'cancelled')),
  -- AES-GCM ciphertext produced by the server; never plaintext.
  encrypted_detail jsonb check (encrypted_detail is null or (encrypted_detail ? 'iv' and encrypted_detail ? 'tag' and encrypted_detail ? 'ciphertext')),
  encryption_version integer,
  schedule_item_id uuid references public.raah_ministry_schedule_items(id) on delete set null,
  status_changed_at timestamptz not null default now(),
  status_changed_by text not null,
  revision integer not null default 1,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  check ((source_type = 'manual') = (source_id is null)),
  check ((encrypted_detail is null) = (encryption_version is null))
);

create index if not exists raah_care_tasks_member_idx on public.raah_care_tasks (workspace_id, member_id, status);
create index if not exists raah_care_tasks_assignee_idx on public.raah_care_tasks (workspace_id, assignee_uid, status, due_on);

alter table public.raah_care_tasks enable row level security;
revoke all on table public.raah_care_tasks from public, anon, authenticated;
grant select, insert, update, delete on table public.raah_care_tasks to service_role;

create or replace function public.raah_rpc_create_care_task(
  p_workspace text,
  p_actor text,
  p_actor_name text,
  p_idempotency_key text,
  p_request_hash text,
  p_member_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_title text,
  p_due_on date,
  p_encrypted_detail jsonb,
  p_encryption_version integer,
  p_schedule_date date default null,
  p_schedule_starts_at text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.raah_idempotency_keys%rowtype;
  v_source_member uuid;
  v_member public.raah_members%rowtype;
  v_schedule_id uuid;
  v_task_id uuid;
begin
  perform public.raah_rpc_assert_access(p_workspace, p_actor);
  -- Serialise retries of the same key: without this, two overlapping requests
  -- both miss the key below and one of them fails on its unique insert.
  perform pg_advisory_xact_lock(hashtextextended(p_workspace || ':' || p_actor || ':' || p_idempotency_key, 0));

  select * into v_existing
  from public.raah_idempotency_keys
  where workspace_id = p_workspace and actor_uid = p_actor and key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash then
      raise exception using errcode = 'P0422', message = 'idempotency key reused for a different request';
    end if;
    return (select jsonb_build_object('taskId', id, 'scheduleItemId', schedule_item_id, 'revision', revision)
            from public.raah_care_tasks where id = v_existing.result_ref::uuid);
  end if;

  select * into v_member from public.raah_members where id = p_member_id;
  if not found then
    raise exception using errcode = 'P0404', message = 'member not found';
  end if;

  -- The source must belong to the same person (and workspace for reviews).
  if p_source_type = 'communion_review' then
    select member_id into v_source_member from public.raah_communion_reviews where workspace_id = p_workspace and id = p_source_id;
  elsif p_source_type = 'visitation_log' then
    select member_id into v_source_member from public.raah_visitation_logs where id = p_source_id;
  elsif p_source_type = 'manual' then
    v_source_member := p_member_id;
  else
    raise exception using errcode = 'P0422', message = 'unknown source type';
  end if;
  if v_source_member is null then
    raise exception using errcode = 'P0404', message = 'source not found';
  end if;
  if v_source_member <> p_member_id then
    raise exception using errcode = 'P0422', message = 'source belongs to another member';
  end if;

  if p_schedule_date is not null then
    if p_schedule_starts_at is not null and p_schedule_starts_at !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception using errcode = 'P0422', message = 'invalid start time';
    end if;
    -- Neutral calendar entry: no pastoral content in title or memo (plan 7.2).
    insert into public.raah_ministry_schedule_items (title, date, end_date, starts_at, item_type, member_id, member_name, created_by)
    values ('목양 일정', p_schedule_date, p_schedule_date, p_schedule_starts_at, 'visitation', v_member.id, v_member.name,
            jsonb_build_object('uid', p_actor, 'name', coalesce(p_actor_name, '')))
    returning id into v_schedule_id;
  end if;

  insert into public.raah_care_tasks (
    workspace_id, member_id, source_type, source_id, assignee_uid, title, due_on,
    encrypted_detail, encryption_version, schedule_item_id, status_changed_by, created_by
  )
  values (
    p_workspace, p_member_id, p_source_type, case when p_source_type = 'manual' then null else p_source_id end, p_actor,
    btrim(p_title), p_due_on, p_encrypted_detail, p_encryption_version, v_schedule_id, p_actor, p_actor
  )
  returning id into v_task_id;

  insert into public.raah_idempotency_keys (workspace_id, actor_uid, key, request_hash, result_ref)
  values (p_workspace, p_actor, p_idempotency_key, p_request_hash, v_task_id::text);

  insert into public.raah_audit_events (workspace_id, actor_uid, action, target_type, target_id)
  values (p_workspace, p_actor, 'care_task.create', 'care_task', v_task_id::text);

  return jsonb_build_object('taskId', v_task_id, 'scheduleItemId', v_schedule_id, 'revision', 1);
end;
$$;

-- open ⇄ deferred, open/deferred → done/cancelled, done/cancelled → open (reopen).
-- History lives in the audit trail; a reopened task keeps its id and links.
create or replace function public.raah_rpc_set_care_task_status(
  p_workspace text,
  p_actor text,
  p_task_id uuid,
  p_expected_revision integer,
  p_to_status text,
  p_due_on date default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task public.raah_care_tasks%rowtype;
  v_allowed boolean;
begin
  perform public.raah_rpc_assert_access(p_workspace, p_actor);

  select * into v_task from public.raah_care_tasks where workspace_id = p_workspace and id = p_task_id for update;
  if not found then
    raise exception using errcode = 'P0404', message = 'task not found';
  end if;
  if v_task.revision <> p_expected_revision then
    raise exception using errcode = 'P0409', message = 'task changed since it was loaded';
  end if;

  v_allowed := case v_task.status
    when 'open' then p_to_status in ('deferred', 'done', 'cancelled')
    when 'deferred' then p_to_status in ('open', 'done', 'cancelled')
    when 'done' then p_to_status = 'open'
    when 'cancelled' then p_to_status = 'open'
    else false
  end;
  if not v_allowed then
    raise exception using errcode = 'P0422', message = 'transition not allowed';
  end if;
  if p_to_status = 'deferred' and p_due_on is null then
    raise exception using errcode = 'P0422', message = 'deferring needs a new date';
  end if;

  update public.raah_care_tasks
  set status = p_to_status,
      due_on = coalesce(p_due_on, due_on),
      status_changed_at = now(),
      status_changed_by = p_actor,
      revision = revision + 1,
      updated_at = now()
  where id = v_task.id;

  insert into public.raah_audit_events (workspace_id, actor_uid, action, target_type, target_id)
  values (p_workspace, p_actor, 'care_task.status:' || p_to_status, 'care_task', v_task.id::text);

  return v_task.revision + 1;
end;
$$;

revoke execute on function public.raah_rpc_create_care_task(text, text, text, text, text, uuid, text, uuid, text, date, jsonb, integer, date, text) from public, anon, authenticated;
revoke execute on function public.raah_rpc_set_care_task_status(text, text, uuid, integer, text, date) from public, anon, authenticated;
grant execute on function public.raah_rpc_create_care_task(text, text, text, text, text, uuid, text, uuid, text, date, jsonb, integer, date, text) to service_role;
grant execute on function public.raah_rpc_set_care_task_status(text, text, uuid, integer, text, date) to service_role;

commit;
