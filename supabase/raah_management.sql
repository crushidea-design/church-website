begin;

create extension if not exists pgcrypto;

create table if not exists public.raah_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  search_name text not null,
  birth_date date,
  phone text,
  address text,
  position text,
  district text,
  registered_at date,
  status text not null default 'active' check (status in ('active', 'inactive')),
  public_note text,
  created_by jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists raah_members_search_name_idx on public.raah_members (search_name);
create index if not exists raah_members_status_idx on public.raah_members (status);
create index if not exists raah_members_district_idx on public.raah_members (district);

create table if not exists public.raah_visitation_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.raah_members(id) on delete set null,
  member_name text not null,
  member_search_name text not null,
  date date not null,
  log_type text not null,
  public_summary text,
  encrypted_payload jsonb not null,
  encryption_version integer not null default 1,
  is_encrypted boolean not null default true,
  created_by jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists raah_visitation_logs_member_id_idx on public.raah_visitation_logs (member_id);
create index if not exists raah_visitation_logs_member_search_name_idx on public.raah_visitation_logs (member_search_name);
create index if not exists raah_visitation_logs_date_idx on public.raah_visitation_logs (date desc);

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

create index if not exists raah_attendance_events_date_idx on public.raah_attendance_events (date desc);

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

create index if not exists raah_attendance_records_event_id_idx on public.raah_attendance_records (event_id);
create index if not exists raah_attendance_records_member_id_idx on public.raah_attendance_records (member_id);
create index if not exists raah_attendance_records_member_search_name_idx on public.raah_attendance_records (member_search_name);

create or replace function public.set_raah_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_raah_members_updated_at on public.raah_members;
create trigger set_raah_members_updated_at
before update on public.raah_members
for each row execute function public.set_raah_updated_at();

drop trigger if exists set_raah_visitation_logs_updated_at on public.raah_visitation_logs;
create trigger set_raah_visitation_logs_updated_at
before update on public.raah_visitation_logs
for each row execute function public.set_raah_updated_at();

drop trigger if exists set_raah_attendance_events_updated_at on public.raah_attendance_events;
create trigger set_raah_attendance_events_updated_at
before update on public.raah_attendance_events
for each row execute function public.set_raah_updated_at();

drop trigger if exists set_raah_attendance_records_updated_at on public.raah_attendance_records;
create trigger set_raah_attendance_records_updated_at
before update on public.raah_attendance_records
for each row execute function public.set_raah_updated_at();

alter table public.raah_members enable row level security;
alter table public.raah_visitation_logs enable row level security;
alter table public.raah_attendance_events enable row level security;
alter table public.raah_attendance_records enable row level security;

drop policy if exists "raah_members_admin_select" on public.raah_members;
create policy "raah_members_admin_select"
  on public.raah_members
  for select
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    or auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_members_admin_insert" on public.raah_members;
create policy "raah_members_admin_insert"
  on public.raah_members
  for insert
  with check (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    or auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_members_admin_update" on public.raah_members;
create policy "raah_members_admin_update"
  on public.raah_members
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

drop policy if exists "raah_members_admin_delete" on public.raah_members;
create policy "raah_members_admin_delete"
  on public.raah_members
  for delete
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    or auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_visitation_logs_admin_select" on public.raah_visitation_logs;
create policy "raah_visitation_logs_admin_select"
  on public.raah_visitation_logs
  for select
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    or auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_visitation_logs_admin_insert" on public.raah_visitation_logs;
create policy "raah_visitation_logs_admin_insert"
  on public.raah_visitation_logs
  for insert
  with check (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    or auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_visitation_logs_admin_update" on public.raah_visitation_logs;
create policy "raah_visitation_logs_admin_update"
  on public.raah_visitation_logs
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

drop policy if exists "raah_visitation_logs_admin_delete" on public.raah_visitation_logs;
create policy "raah_visitation_logs_admin_delete"
  on public.raah_visitation_logs
  for delete
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    or auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
  );

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
