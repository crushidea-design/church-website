begin;

create table if not exists public.raah_attendance_events (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  service_type text not null default '주일예배',
  includes_communion boolean not null default true,
  memo text,
  created_by jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (date, service_type)
);

create index if not exists raah_attendance_events_date_idx
  on public.raah_attendance_events (date desc);

create table if not exists public.raah_attendance_records (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.raah_attendance_events(id) on delete cascade,
  member_id uuid not null references public.raah_members(id) on delete cascade,
  member_name text not null,
  member_search_name text not null,
  attended boolean not null default false,
  communion_participated boolean not null default false,
  note text,
  created_by jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, member_id)
);

create index if not exists raah_attendance_records_event_id_idx
  on public.raah_attendance_records (event_id);

create index if not exists raah_attendance_records_member_id_idx
  on public.raah_attendance_records (member_id);

create index if not exists raah_attendance_records_member_search_name_idx
  on public.raah_attendance_records (member_search_name);

drop trigger if exists set_raah_attendance_events_updated_at on public.raah_attendance_events;
create trigger set_raah_attendance_events_updated_at
before update on public.raah_attendance_events
for each row execute function public.set_raah_updated_at();

drop trigger if exists set_raah_attendance_records_updated_at on public.raah_attendance_records;
create trigger set_raah_attendance_records_updated_at
before update on public.raah_attendance_records
for each row execute function public.set_raah_updated_at();

alter table public.raah_attendance_events enable row level security;
alter table public.raah_attendance_records enable row level security;

drop policy if exists "raah_attendance_events_admin_select" on public.raah_attendance_events;
create policy "raah_attendance_events_admin_select"
  on public.raah_attendance_events
  for select
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    or auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_attendance_events_admin_insert" on public.raah_attendance_events;
create policy "raah_attendance_events_admin_insert"
  on public.raah_attendance_events
  for insert
  with check (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    or auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_attendance_events_admin_update" on public.raah_attendance_events;
create policy "raah_attendance_events_admin_update"
  on public.raah_attendance_events
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

drop policy if exists "raah_attendance_events_admin_delete" on public.raah_attendance_events;
create policy "raah_attendance_events_admin_delete"
  on public.raah_attendance_events
  for delete
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    or auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_attendance_records_admin_select" on public.raah_attendance_records;
create policy "raah_attendance_records_admin_select"
  on public.raah_attendance_records
  for select
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    or auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_attendance_records_admin_insert" on public.raah_attendance_records;
create policy "raah_attendance_records_admin_insert"
  on public.raah_attendance_records
  for insert
  with check (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    or auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_attendance_records_admin_update" on public.raah_attendance_records;
create policy "raah_attendance_records_admin_update"
  on public.raah_attendance_records
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

drop policy if exists "raah_attendance_records_admin_delete" on public.raah_attendance_records;
create policy "raah_attendance_records_admin_delete"
  on public.raah_attendance_records
  for delete
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    or auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
  );

commit;
