-- Church-record facts per member (P1B step 5): baptism, profession of faith and
-- communicant registration, each as recorded by the church, with its source.
--
-- The default is "unknown" (no row = all unknown). Nothing is inferred from
-- office, age, active status or past communion ticks. An unknown status never
-- bars anyone from the Lord's Supper and never removes anyone from care; this is
-- a factual record, not a pastoral judgement. Any status other than "unknown"
-- needs a source (e.g. "교적부 2026").
begin;

create or replace function public.raah_rpc_set_ecclesial_profile(
  p_workspace text,
  p_actor text,
  p_member_id uuid,
  p_expected_revision integer,
  p_baptism text,
  p_profession text,
  p_communicant text,
  p_source_label text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.raah_member_ecclesial_profiles%rowtype;
  v_source text := nullif(btrim(coalesce(p_source_label, '')), '');
  v_has_fact boolean;
  v_inserted integer;
begin
  perform public.raah_rpc_assert_access(p_workspace, p_actor);

  if not exists (select 1 from public.raah_members where id = p_member_id) then
    raise exception using errcode = 'P0404', message = 'member not found';
  end if;

  if p_baptism is null or p_baptism not in ('unknown', 'not_baptized', 'baptized')
     or p_profession is null or p_profession not in ('unknown', 'preparing', 'confirmed')
     or p_communicant is null or p_communicant not in ('unknown', 'not_registered', 'registered') then
    raise exception using errcode = 'P0422', message = 'invalid status';
  end if;
  if v_source is not null and char_length(v_source) > 120 then
    raise exception using errcode = 'P0422', message = 'source too long';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode = 'P0422', message = 'invalid revision';
  end if;

  v_has_fact := p_baptism <> 'unknown' or p_profession <> 'unknown' or p_communicant <> 'unknown';
  if v_has_fact and v_source is null then
    raise exception using errcode = 'P0422', message = 'source required when a status is recorded';
  end if;

  select * into v_row
  from public.raah_member_ecclesial_profiles
  where workspace_id = p_workspace and member_id = p_member_id
  for update;

  if not found then
    if p_expected_revision <> 0 then
      raise exception using errcode = 'P0409', message = 'profile changed since it was loaded';
    end if;
    insert into public.raah_member_ecclesial_profiles (
      workspace_id, member_id, baptism_status, profession_status, communicant_status,
      verified_at, verified_by, source_label, revision
    )
    values (
      p_workspace, p_member_id, p_baptism, p_profession, p_communicant,
      case when v_has_fact then now() end, case when v_has_fact then p_actor end, v_source, 1
    )
    on conflict (workspace_id, member_id) do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 0 then
      -- A concurrent first save won.
      raise exception using errcode = 'P0409', message = 'profile changed since it was loaded';
    end if;
    v_row.revision := 0;
  else
    if v_row.revision <> p_expected_revision then
      raise exception using errcode = 'P0409', message = 'profile changed since it was loaded';
    end if;
    update public.raah_member_ecclesial_profiles
    set baptism_status = p_baptism,
        profession_status = p_profession,
        communicant_status = p_communicant,
        source_label = v_source,
        verified_at = case when v_has_fact then now() end,
        verified_by = case when v_has_fact then p_actor end,
        revision = revision + 1,
        updated_at = now()
    where workspace_id = p_workspace and member_id = p_member_id;
  end if;

  -- Ids only: statuses and the source text are not written to the audit trail.
  insert into public.raah_audit_events (workspace_id, actor_uid, action, target_type, target_id)
  values (p_workspace, p_actor, 'ecclesial_profile.update', 'member', p_member_id::text);

  return jsonb_build_object('revision', v_row.revision + 1);
end;
$$;

revoke execute on function public.raah_rpc_set_ecclesial_profile(text, text, uuid, integer, text, text, text, text) from public, anon, authenticated;
grant execute on function public.raah_rpc_set_ecclesial_profile(text, text, uuid, integer, text, text, text, text) to service_role;

commit;
