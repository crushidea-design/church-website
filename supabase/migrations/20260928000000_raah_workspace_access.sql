-- RAAH-only access grants (plan R01). A homepage admin role alone must not
-- open pastoral records once enforcement is on; each pastoral worker needs
-- an explicit, revocable grant here. Only the server (service_role) reads it.
begin;

create table if not exists public.raah_workspace_access (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'default',
  firebase_uid text not null check (char_length(firebase_uid) between 1 and 128),
  -- Software access role, not an ecclesiastical office or decision authority.
  access_role text not null check (access_role in ('pastor', 'elder', 'clerk')),
  active boolean not null default true,
  granted_by text,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, firebase_uid),
  check (revoked_at is null or active = false)
);

alter table public.raah_workspace_access enable row level security;

-- No policies: browser roles get nothing. Grants are explicit so a future
-- default-privilege change cannot silently expose the table.
revoke all on table public.raah_workspace_access from public, anon, authenticated;
grant select, insert, update, delete on table public.raah_workspace_access to service_role;

commit;
