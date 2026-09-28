-- RAAH communion pastoral care: schema and atomic RPC functions (plan R04, 12.x).
--
-- Tables are service_role-only. Multi-row writes go through raah_rpc_* functions,
-- each of which runs in one transaction and re-checks raah_workspace_access, so a
-- revoked grant cannot slip in between the server check and the write.
-- Error SQLSTATEs the server maps to HTTP: P0403 → 403, P0404 → 404,
-- P0409 → 409 (stale revision), P0422 → 422 (invalid input or transition).
-- Messages never contain names or pastoral content.
begin;

-- ───── Ecclesial facts, separate from the directory's `active` flag ─────
create table if not exists public.raah_member_ecclesial_profiles (
  workspace_id text not null default 'default',
  member_id uuid not null references public.raah_members(id) on delete restrict,
  baptism_status text not null default 'unknown' check (baptism_status in ('unknown', 'not_baptized', 'baptized')),
  profession_status text not null default 'unknown' check (profession_status in ('unknown', 'preparing', 'confirmed')),
  communicant_status text not null default 'unknown' check (communicant_status in ('unknown', 'not_registered', 'registered')),
  verified_at timestamptz,
  verified_by text,
  -- Where the fact came from (e.g. "교적부 2026"). Not a place for pastoral notes.
  source_label text check (source_label is null or char_length(source_label) <= 120),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, member_id)
);

-- ───── Communion care periods and the services they prepare for ─────
create table if not exists public.raah_communion_periods (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'default',
  name text not null check (char_length(name) between 1 and 80),
  starts_on date not null,
  ends_on date not null,
  status text not null default 'active' check (status in ('planned', 'active', 'closed')),
  owner_uid text not null,
  guide_version text not null check (char_length(guide_version) between 1 and 40),
  timezone text not null default 'Asia/Seoul',
  closed_at timestamptz,
  closed_by text,
  revision integer not null default 1,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  check (ends_on >= starts_on),
  check ((status = 'closed') = (closed_at is not null))
);

create table if not exists public.raah_communion_occasions (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'default',
  period_id uuid not null,
  service_date date not null,
  attendance_event_id uuid references public.raah_attendance_events(id) on delete set null,
  status text not null default 'scheduled' check (status in ('scheduled', 'held', 'cancelled')),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, period_id) references public.raah_communion_periods (workspace_id, id) on delete restrict,
  unique (workspace_id, period_id, service_date)
);

-- ───── One pastoral review per member per period ─────
create table if not exists public.raah_communion_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'default',
  period_id uuid not null,
  member_id uuid not null references public.raah_members(id) on delete restrict,
  assignee_uid text not null,
  -- Pastoral progress only. Never a judgement on admission to the Supper.
  status text not null default 'not_started'
    check (status in ('not_started', 'scheduled', 'in_progress', 'reviewed', 'closed_without_contact')),
  -- Excluded rows stay so the roster at closing can be reproduced.
  roster_state text not null default 'included' check (roster_state in ('included', 'excluded')),
  roster_changed_at timestamptz not null default now(),
  roster_changed_by text not null,
  -- Short neutral reason for reopening or closing without contact. Details belong in the encrypted log.
  status_reason text check (status_reason is null or char_length(status_reason) <= 200),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, period_id) references public.raah_communion_periods (workspace_id, id) on delete restrict,
  unique (workspace_id, period_id, member_id),
  unique (workspace_id, id)
);

create index if not exists raah_communion_reviews_period_idx on public.raah_communion_reviews (workspace_id, period_id, status);

create table if not exists public.raah_communion_review_logs (
  workspace_id text not null default 'default',
  review_id uuid not null,
  visitation_log_id uuid not null references public.raah_visitation_logs(id) on delete restrict,
  linked_at timestamptz not null default now(),
  linked_by text not null,
  primary key (workspace_id, review_id, visitation_log_id),
  foreign key (workspace_id, review_id) references public.raah_communion_reviews (workspace_id, id) on delete restrict
);

-- ───── Audit and idempotency ─────
create table if not exists public.raah_audit_events (
  id bigint generated always as identity primary key,
  workspace_id text not null,
  actor_uid text not null,
  action text not null check (char_length(action) between 1 and 60),
  target_type text not null check (char_length(target_type) between 1 and 40),
  target_id text,
  outcome text not null default 'success' check (outcome in ('success', 'denied', 'failed')),
  request_id text check (request_id is null or char_length(request_id) <= 80),
  occurred_at timestamptz not null default now()
);

create index if not exists raah_audit_events_target_idx on public.raah_audit_events (workspace_id, target_type, target_id);

create table if not exists public.raah_idempotency_keys (
  workspace_id text not null,
  actor_uid text not null,
  key text not null check (char_length(key) between 8 and 128),
  request_hash text not null check (char_length(request_hash) between 8 and 128),
  result_ref text not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, actor_uid, key)
);

-- ───── Privileges: browser roles get nothing ─────
do $$
declare
  t text;
begin
  foreach t in array array[
    'raah_member_ecclesial_profiles', 'raah_communion_periods', 'raah_communion_occasions',
    'raah_communion_reviews', 'raah_communion_review_logs', 'raah_audit_events', 'raah_idempotency_keys'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end $$;

-- The audit trail is append-only for the application role. (A database owner can
-- still alter it, so it must not be described as tamper-proof.)
revoke update, delete on table public.raah_audit_events from service_role;

-- ───── RPC functions ─────

create or replace function public.raah_rpc_assert_access(p_workspace text, p_actor text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role text;
begin
  select access_role into v_role
  from public.raah_workspace_access
  where workspace_id = p_workspace
    and firebase_uid = p_actor
    and active
    and revoked_at is null
    and (expires_at is null or expires_at > now());
  if v_role is null then
    raise exception using errcode = 'P0403', message = 'raah access not granted';
  end if;
  return v_role;
end;
$$;

create or replace function public.raah_rpc_create_communion_period(
  p_workspace text,
  p_actor text,
  p_idempotency_key text,
  p_request_hash text,
  p_name text,
  p_starts_on date,
  p_ends_on date,
  p_guide_version text,
  p_service_date date default null,
  p_attendance_event_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.raah_idempotency_keys%rowtype;
  v_period_id uuid;
begin
  perform public.raah_rpc_assert_access(p_workspace, p_actor);

  select * into v_existing
  from public.raah_idempotency_keys
  where workspace_id = p_workspace and actor_uid = p_actor and key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash then
      raise exception using errcode = 'P0422', message = 'idempotency key reused for a different request';
    end if;
    return v_existing.result_ref::uuid;
  end if;

  if p_service_date is not null and (p_service_date < p_starts_on or p_service_date > p_ends_on) then
    raise exception using errcode = 'P0422', message = 'service date outside period';
  end if;

  insert into public.raah_communion_periods (workspace_id, name, starts_on, ends_on, owner_uid, guide_version, created_by)
  values (p_workspace, p_name, p_starts_on, p_ends_on, p_actor, p_guide_version, p_actor)
  returning id into v_period_id;

  if p_service_date is not null then
    insert into public.raah_communion_occasions (workspace_id, period_id, service_date, attendance_event_id)
    values (p_workspace, v_period_id, p_service_date, p_attendance_event_id);
  end if;

  insert into public.raah_idempotency_keys (workspace_id, actor_uid, key, request_hash, result_ref)
  values (p_workspace, p_actor, p_idempotency_key, p_request_hash, v_period_id::text);

  insert into public.raah_audit_events (workspace_id, actor_uid, action, target_type, target_id)
  values (p_workspace, p_actor, 'communion_period.create', 'communion_period', v_period_id::text);

  return v_period_id;
end;
$$;

-- Adds or excludes one member. Re-running with the same state is a no-op, so
-- reloading the roster never creates duplicates. Exclusion keeps the row.
create or replace function public.raah_rpc_set_roster_entry(
  p_workspace text,
  p_actor text,
  p_period_id uuid,
  p_member_id uuid,
  p_included boolean
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_period public.raah_communion_periods%rowtype;
  v_state text := case when p_included then 'included' else 'excluded' end;
  v_review public.raah_communion_reviews%rowtype;
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

  select * into v_review
  from public.raah_communion_reviews
  where workspace_id = p_workspace and period_id = p_period_id and member_id = p_member_id
  for update;

  if not found then
    if not p_included then
      raise exception using errcode = 'P0404', message = 'member is not on the roster';
    end if;
    insert into public.raah_communion_reviews (workspace_id, period_id, member_id, assignee_uid, roster_changed_by)
    values (p_workspace, p_period_id, p_member_id, v_period.owner_uid, p_actor)
    returning * into v_review;
  elsif v_review.roster_state = v_state then
    return v_review.id;
  else
    update public.raah_communion_reviews
    set roster_state = v_state,
        roster_changed_at = now(),
        roster_changed_by = p_actor,
        revision = revision + 1,
        updated_at = now()
    where id = v_review.id;
  end if;

  insert into public.raah_audit_events (workspace_id, actor_uid, action, target_type, target_id)
  values (p_workspace, p_actor, 'communion_review.roster_' || v_state, 'communion_review', v_review.id::text);

  return v_review.id;
end;
$$;

-- Moves a review along the pastoral workflow (plan 8.1) with optimistic locking.
create or replace function public.raah_rpc_transition_review(
  p_workspace text,
  p_actor text,
  p_review_id uuid,
  p_expected_revision integer,
  p_to_status text,
  p_reason text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_review public.raah_communion_reviews%rowtype;
  v_period_status text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_allowed boolean;
begin
  perform public.raah_rpc_assert_access(p_workspace, p_actor);

  select * into v_review
  from public.raah_communion_reviews
  where workspace_id = p_workspace and id = p_review_id
  for update;
  if not found then
    raise exception using errcode = 'P0404', message = 'review not found';
  end if;
  if v_review.revision <> p_expected_revision then
    raise exception using errcode = 'P0409', message = 'review changed since it was loaded';
  end if;
  if v_review.roster_state <> 'included' then
    raise exception using errcode = 'P0422', message = 'review is not on the roster';
  end if;

  select status into v_period_status
  from public.raah_communion_periods
  where workspace_id = p_workspace and id = v_review.period_id;
  if v_period_status = 'closed' then
    raise exception using errcode = 'P0422', message = 'period is closed';
  end if;

  v_allowed := case v_review.status
    when 'not_started' then p_to_status in ('scheduled', 'in_progress', 'reviewed', 'closed_without_contact')
    when 'scheduled' then p_to_status in ('not_started', 'in_progress', 'reviewed', 'closed_without_contact')
    when 'in_progress' then p_to_status in ('scheduled', 'reviewed', 'closed_without_contact')
    when 'reviewed' then p_to_status = 'in_progress'
    when 'closed_without_contact' then p_to_status in ('not_started', 'in_progress')
    else false
  end;
  if not v_allowed then
    raise exception using errcode = 'P0422', message = 'transition not allowed';
  end if;

  -- Reopening a finished review or closing without contact must say why.
  if (v_review.status in ('reviewed', 'closed_without_contact') or p_to_status = 'closed_without_contact') and v_reason is null then
    raise exception using errcode = 'P0422', message = 'reason required';
  end if;

  update public.raah_communion_reviews
  set status = p_to_status,
      status_reason = v_reason,
      revision = revision + 1,
      updated_at = now()
  where id = v_review.id;

  insert into public.raah_audit_events (workspace_id, actor_uid, action, target_type, target_id)
  values (p_workspace, p_actor, 'communion_review.status:' || p_to_status, 'communion_review', v_review.id::text);

  return v_review.revision + 1;
end;
$$;

-- Functions are callable by the server only. Supabase grants EXECUTE on new
-- functions to anon/authenticated by default, so revoke explicitly.
revoke execute on function public.raah_rpc_assert_access(text, text) from public, anon, authenticated;
revoke execute on function public.raah_rpc_create_communion_period(text, text, text, text, text, date, date, text, date, uuid) from public, anon, authenticated;
revoke execute on function public.raah_rpc_set_roster_entry(text, text, uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.raah_rpc_transition_review(text, text, uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.raah_rpc_assert_access(text, text) to service_role;
grant execute on function public.raah_rpc_create_communion_period(text, text, text, text, text, date, date, text, date, uuid) to service_role;
grant execute on function public.raah_rpc_set_roster_entry(text, text, uuid, uuid, boolean) to service_role;
grant execute on function public.raah_rpc_transition_review(text, text, uuid, integer, text, text) to service_role;

commit;
