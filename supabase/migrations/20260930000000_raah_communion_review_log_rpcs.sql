-- Communion conversation records (plan R07, PR-8).
--
-- A conversation is stored as an ordinary raah_visitation_logs row (log_type
-- '성찬 목양') so the existing encrypted-body path, detail view and editor keep
-- working. The server encrypts the body before calling; these functions only
-- ever see ciphertext. Creating the log, linking it to the review, moving the
-- review into "대화 진행 중", the idempotency record and the audit event happen
-- in one transaction.
begin;

create or replace function public.raah_rpc_create_review_log(
  p_workspace text,
  p_actor text,
  p_actor_name text,
  p_review_id uuid,
  p_expected_revision integer,
  p_idempotency_key text,
  p_request_hash text,
  p_date date,
  p_public_summary text,
  p_encrypted_payload jsonb,
  p_encryption_version integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.raah_idempotency_keys%rowtype;
  v_review public.raah_communion_reviews%rowtype;
  v_period_status text;
  v_member public.raah_members%rowtype;
  v_log_id uuid;
  v_revision integer;
begin
  perform public.raah_rpc_assert_access(p_workspace, p_actor);

  select * into v_existing
  from public.raah_idempotency_keys
  where workspace_id = p_workspace and actor_uid = p_actor and key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash then
      raise exception using errcode = 'P0422', message = 'idempotency key reused for a different request';
    end if;
    select revision into v_revision from public.raah_communion_reviews where id = p_review_id;
    return jsonb_build_object('logId', v_existing.result_ref, 'revision', v_revision);
  end if;

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
  select status into v_period_status from public.raah_communion_periods where workspace_id = p_workspace and id = v_review.period_id;
  if v_period_status = 'closed' then
    raise exception using errcode = 'P0422', message = 'period is closed';
  end if;

  -- Ciphertext only: the three AES-GCM fields the server produces.
  if jsonb_typeof(p_encrypted_payload) <> 'object'
     or not (p_encrypted_payload ? 'iv' and p_encrypted_payload ? 'tag' and p_encrypted_payload ? 'ciphertext') then
    raise exception using errcode = 'P0422', message = 'encrypted payload required';
  end if;
  if p_public_summary is not null and char_length(p_public_summary) > 200 then
    raise exception using errcode = 'P0422', message = 'summary too long';
  end if;

  select * into v_member from public.raah_members where id = v_review.member_id;

  insert into public.raah_visitation_logs (
    member_id, member_name, member_search_name, date, log_type, public_summary,
    encrypted_payload, encryption_version, is_encrypted, created_by
  )
  values (
    v_member.id, v_member.name, v_member.search_name, p_date, '성찬 목양', nullif(btrim(coalesce(p_public_summary, '')), ''),
    p_encrypted_payload, p_encryption_version, true, jsonb_build_object('uid', p_actor, 'name', coalesce(p_actor_name, ''))
  )
  returning id into v_log_id;

  insert into public.raah_communion_review_logs (workspace_id, review_id, visitation_log_id, linked_by)
  values (p_workspace, v_review.id, v_log_id, p_actor);

  -- A recorded conversation means the care is under way; it never marks the
  -- review as confirmed — that stays an explicit step.
  update public.raah_communion_reviews
  set status = case when status in ('not_started', 'scheduled') then 'in_progress' else status end,
      status_reason = case when status in ('not_started', 'scheduled') then null else status_reason end,
      revision = revision + 1,
      updated_at = now()
  where id = v_review.id
  returning revision into v_revision;

  insert into public.raah_idempotency_keys (workspace_id, actor_uid, key, request_hash, result_ref)
  values (p_workspace, p_actor, p_idempotency_key, p_request_hash, v_log_id::text);

  insert into public.raah_audit_events (workspace_id, actor_uid, action, target_type, target_id)
  values (p_workspace, p_actor, 'communion_review.log_create', 'communion_review', v_review.id::text);

  return jsonb_build_object('logId', v_log_id, 'revision', v_revision);
end;
$$;

-- Links an existing visitation record of the same member (plan 7.1). Linking
-- twice is a no-op. Existing records are referenced, never copied.
create or replace function public.raah_rpc_link_review_log(
  p_workspace text,
  p_actor text,
  p_review_id uuid,
  p_visitation_log_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_review public.raah_communion_reviews%rowtype;
  v_log_member uuid;
  v_inserted integer;
begin
  perform public.raah_rpc_assert_access(p_workspace, p_actor);

  select * into v_review
  from public.raah_communion_reviews
  where workspace_id = p_workspace and id = p_review_id
  for update;
  if not found then
    raise exception using errcode = 'P0404', message = 'review not found';
  end if;

  select member_id into v_log_member from public.raah_visitation_logs where id = p_visitation_log_id;
  if not found then
    raise exception using errcode = 'P0404', message = 'log not found';
  end if;
  if v_log_member is distinct from v_review.member_id then
    raise exception using errcode = 'P0422', message = 'log belongs to another member';
  end if;

  insert into public.raah_communion_review_logs (workspace_id, review_id, visitation_log_id, linked_by)
  values (p_workspace, v_review.id, p_visitation_log_id, p_actor)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    insert into public.raah_audit_events (workspace_id, actor_uid, action, target_type, target_id)
    values (p_workspace, p_actor, 'communion_review.log_link', 'communion_review', v_review.id::text);
  end if;
  return v_inserted > 0;
end;
$$;

revoke execute on function public.raah_rpc_create_review_log(text, text, text, uuid, integer, text, text, date, text, jsonb, integer) from public, anon, authenticated;
revoke execute on function public.raah_rpc_link_review_log(text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.raah_rpc_create_review_log(text, text, text, uuid, integer, text, text, date, text, jsonb, integer) to service_role;
grant execute on function public.raah_rpc_link_review_log(text, text, uuid, uuid) to service_role;

commit;
