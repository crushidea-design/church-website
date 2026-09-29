-- Legacy note (raah_notes) -> visitation log migration.
--
-- The originals are never deleted or rewritten: each note only gets a pointer
-- to the log it became. The RPC moves one note per call inside one transaction
-- (log insert + pointer + audit row) and is idempotent, so a retried or
-- concurrent request cannot create a second log. The server decrypts the legacy
-- payload, maps it to the four-field log body and re-encrypts it; this function
-- only ever sees ciphertext. Audit rows carry ids only, never names or content.
begin;

alter table public.raah_notes
  add column if not exists migrated_to_log_id uuid references public.raah_visitation_logs(id) on delete set null;
alter table public.raah_notes
  add column if not exists migrated_at timestamptz;

create index if not exists raah_notes_unmigrated_idx
  on public.raah_notes (created_at, id)
  where migrated_to_log_id is null;

create or replace function public.raah_rpc_migrate_legacy_note(
  p_workspace text,
  p_actor text,
  p_note_id uuid,
  p_member_id uuid,
  p_member_name text,
  p_member_search_name text,
  p_date date,
  p_log_type text,
  p_encrypted_payload jsonb,
  p_encryption_version integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_note public.raah_notes%rowtype;
  v_log_id uuid;
begin
  perform public.raah_rpc_assert_access(p_workspace, p_actor);

  select * into v_note from public.raah_notes where id = p_note_id for update;
  if not found then
    raise exception using errcode = 'P0404', message = 'note not found';
  end if;

  -- Already moved (this request lost a race, or the client retried): report the existing log.
  if v_note.migrated_to_log_id is not null then
    return jsonb_build_object('logId', v_note.migrated_to_log_id, 'alreadyMigrated', true);
  end if;

  insert into public.raah_visitation_logs (
    member_id, member_name, member_search_name, date, log_type, public_summary,
    encrypted_payload, encryption_version, is_encrypted, created_by, created_at
  )
  values (
    p_member_id, p_member_name, p_member_search_name, p_date, p_log_type, null,
    p_encrypted_payload, p_encryption_version, true, v_note.created_by, v_note.created_at
  )
  returning id into v_log_id;

  update public.raah_notes
  set migrated_to_log_id = v_log_id, migrated_at = now()
  where id = p_note_id;

  insert into public.raah_audit_events (workspace_id, actor_uid, action, target_type, target_id)
  values (p_workspace, p_actor, 'legacy_note.migrate', 'raah_note', p_note_id::text);

  return jsonb_build_object('logId', v_log_id, 'alreadyMigrated', false);
end;
$$;

revoke execute on function public.raah_rpc_migrate_legacy_note(text, text, uuid, uuid, text, text, date, text, jsonb, integer) from public, anon, authenticated;
grant execute on function public.raah_rpc_migrate_legacy_note(text, text, uuid, uuid, text, text, date, text, jsonb, integer) to service_role;

commit;
