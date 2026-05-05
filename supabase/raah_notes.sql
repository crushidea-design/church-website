create table if not exists public.raah_notes (
  id uuid primary key default gen_random_uuid(),
  member_name text not null check (char_length(member_name) between 1 and 100),
  member_search_name text not null check (char_length(member_search_name) between 1 and 120),
  date date not null,
  meeting_type text not null check (char_length(meeting_type) between 1 and 50),
  encrypted_payload jsonb not null,
  encryption_version integer not null default 1,
  is_encrypted boolean not null default true,
  created_by jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists raah_notes_date_created_at_idx on public.raah_notes (date desc, created_at desc);
create index if not exists raah_notes_member_search_name_idx on public.raah_notes (member_search_name);

alter table public.raah_notes enable row level security;

drop policy if exists "raah_notes_admin_read" on public.raah_notes;
create policy "raah_notes_admin_read"
  on public.raah_notes
  for select
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    or auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_notes_admin_insert" on public.raah_notes;
create policy "raah_notes_admin_insert"
  on public.raah_notes
  for insert
  with check (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    or auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_notes_admin_update" on public.raah_notes;
create policy "raah_notes_admin_update"
  on public.raah_notes
  for update
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    or auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
  )
  with check (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    or auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_notes_admin_delete" on public.raah_notes;
create policy "raah_notes_admin_delete"
  on public.raah_notes
  for delete
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    or auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
  );
