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
  event_type text not null default 'sunday_morning' check (event_type in ('sunday_morning', 'sunday_afternoon', 'young_adults', 'wednesday_prayer', 'other')),
  service_type text not null default '주일?�배',
  includes_communion boolean not null default true,
  memo text,
  created_by jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.raah_attendance_events
  add column if not exists event_type text not null default 'sunday_morning';

alter table public.raah_attendance_events
  drop constraint if exists raah_attendance_events_date_service_type_key;

create index if not exists raah_attendance_events_date_idx on public.raah_attendance_events (date desc);
create unique index if not exists raah_attendance_events_date_event_type_idx on public.raah_attendance_events (date, event_type);

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

create table if not exists public.raah_follow_up_resolutions (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('visitation')),
  source_id uuid not null,
  candidate_key text not null unique,
  member_id uuid references public.raah_members(id) on delete set null,
  member_name text,
  memo text,
  completed_by jsonb,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists raah_follow_up_resolutions_source_idx on public.raah_follow_up_resolutions (source_type, source_id);
create index if not exists raah_follow_up_resolutions_member_id_idx on public.raah_follow_up_resolutions (member_id);

create table if not exists public.raah_ministry_schedule_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  starts_at text,
  ends_at text,
  item_type text not null default 'task' check (item_type in ('visitation', 'counseling', 'task', 'meeting', 'other')),
  member_id uuid references public.raah_members(id) on delete set null,
  member_name text,
  status text not null default 'open' check (status in ('open', 'done')),
  source text not null default 'manual' check (source in ('manual', 'google_calendar')),
  external_id text,
  memo text,
  created_by jsonb,
  completed_by jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists raah_ministry_schedule_items_date_idx on public.raah_ministry_schedule_items (date);
create index if not exists raah_ministry_schedule_items_status_idx on public.raah_ministry_schedule_items (status);
create unique index if not exists raah_ministry_schedule_items_source_external_idx
  on public.raah_ministry_schedule_items (source, external_id)
  where external_id is not null;

create table if not exists public.raah_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'google_calendar' check (provider in ('google_calendar')),
  calendar_id text not null,
  calendar_summary text,
  google_account_email text,
  encrypted_token jsonb not null,
  scope text,
  token_expiry timestamptz,
  connected_by jsonb,
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists raah_calendar_connections_provider_idx on public.raah_calendar_connections (provider, connected_at desc);
create unique index if not exists raah_calendar_connections_provider_unique_idx on public.raah_calendar_connections (provider);

create table if not exists public.raah_calendar_oauth_settings (
  id text primary key default 'google_calendar',
  client_id text not null,
  client_secret text not null,
  calendar_id text not null default 'primary',
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

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

drop trigger if exists set_raah_follow_up_resolutions_updated_at on public.raah_follow_up_resolutions;
create trigger set_raah_follow_up_resolutions_updated_at
before update on public.raah_follow_up_resolutions
for each row execute function public.set_raah_updated_at();

drop trigger if exists set_raah_ministry_schedule_items_updated_at on public.raah_ministry_schedule_items;
create trigger set_raah_ministry_schedule_items_updated_at
before update on public.raah_ministry_schedule_items
for each row execute function public.set_raah_updated_at();

drop trigger if exists set_raah_calendar_connections_updated_at on public.raah_calendar_connections;
create trigger set_raah_calendar_connections_updated_at
before update on public.raah_calendar_connections
for each row execute function public.set_raah_updated_at();

drop trigger if exists set_raah_calendar_oauth_settings_updated_at on public.raah_calendar_oauth_settings;
create trigger set_raah_calendar_oauth_settings_updated_at
before update on public.raah_calendar_oauth_settings
for each row execute function public.set_raah_updated_at();

alter table public.raah_members enable row level security;
alter table public.raah_visitation_logs enable row level security;
alter table public.raah_attendance_events enable row level security;
alter table public.raah_attendance_records enable row level security;
alter table public.raah_follow_up_resolutions enable row level security;
alter table public.raah_ministry_schedule_items enable row level security;
alter table public.raah_calendar_connections enable row level security;
alter table public.raah_calendar_oauth_settings enable row level security;

drop policy if exists "raah_members_admin_select" on public.raah_members;
create policy "raah_members_admin_select"
  on public.raah_members
  for select
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_members_admin_insert" on public.raah_members;
create policy "raah_members_admin_insert"
  on public.raah_members
  for insert
  with check (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_members_admin_update" on public.raah_members;
create policy "raah_members_admin_update"
  on public.raah_members
  for update
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_members_admin_delete" on public.raah_members;
create policy "raah_members_admin_delete"
  on public.raah_members
  for delete
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_visitation_logs_admin_select" on public.raah_visitation_logs;
create policy "raah_visitation_logs_admin_select"
  on public.raah_visitation_logs
  for select
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_visitation_logs_admin_insert" on public.raah_visitation_logs;
create policy "raah_visitation_logs_admin_insert"
  on public.raah_visitation_logs
  for insert
  with check (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_visitation_logs_admin_update" on public.raah_visitation_logs;
create policy "raah_visitation_logs_admin_update"
  on public.raah_visitation_logs
  for update
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_visitation_logs_admin_delete" on public.raah_visitation_logs;
create policy "raah_visitation_logs_admin_delete"
  on public.raah_visitation_logs
  for delete
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_attendance_events_admin_select" on public.raah_attendance_events;
create policy "raah_attendance_events_admin_select"
  on public.raah_attendance_events
  for select
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_attendance_events_admin_insert" on public.raah_attendance_events;
create policy "raah_attendance_events_admin_insert"
  on public.raah_attendance_events
  for insert
  with check (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_attendance_events_admin_update" on public.raah_attendance_events;
create policy "raah_attendance_events_admin_update"
  on public.raah_attendance_events
  for update
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_attendance_events_admin_delete" on public.raah_attendance_events;
create policy "raah_attendance_events_admin_delete"
  on public.raah_attendance_events
  for delete
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_attendance_records_admin_select" on public.raah_attendance_records;
create policy "raah_attendance_records_admin_select"
  on public.raah_attendance_records
  for select
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_attendance_records_admin_insert" on public.raah_attendance_records;
create policy "raah_attendance_records_admin_insert"
  on public.raah_attendance_records
  for insert
  with check (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_attendance_records_admin_update" on public.raah_attendance_records;
create policy "raah_attendance_records_admin_update"
  on public.raah_attendance_records
  for update
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_attendance_records_admin_delete" on public.raah_attendance_records;
create policy "raah_attendance_records_admin_delete"
  on public.raah_attendance_records
  for delete
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_follow_up_resolutions_admin_select" on public.raah_follow_up_resolutions;
create policy "raah_follow_up_resolutions_admin_select"
  on public.raah_follow_up_resolutions
  for select
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_follow_up_resolutions_admin_insert" on public.raah_follow_up_resolutions;
create policy "raah_follow_up_resolutions_admin_insert"
  on public.raah_follow_up_resolutions
  for insert
  with check (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_follow_up_resolutions_admin_update" on public.raah_follow_up_resolutions;
create policy "raah_follow_up_resolutions_admin_update"
  on public.raah_follow_up_resolutions
  for update
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_ministry_schedule_items_admin_select" on public.raah_ministry_schedule_items;
create policy "raah_ministry_schedule_items_admin_select"
  on public.raah_ministry_schedule_items
  for select
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_ministry_schedule_items_admin_insert" on public.raah_ministry_schedule_items;
create policy "raah_ministry_schedule_items_admin_insert"
  on public.raah_ministry_schedule_items
  for insert
  with check (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_ministry_schedule_items_admin_update" on public.raah_ministry_schedule_items;
create policy "raah_ministry_schedule_items_admin_update"
  on public.raah_ministry_schedule_items
  for update
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_calendar_connections_admin_select" on public.raah_calendar_connections;
create policy "raah_calendar_connections_admin_select"
  on public.raah_calendar_connections
  for select
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_calendar_connections_admin_insert" on public.raah_calendar_connections;
create policy "raah_calendar_connections_admin_insert"
  on public.raah_calendar_connections
  for insert
  with check (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_calendar_connections_admin_update" on public.raah_calendar_connections;
create policy "raah_calendar_connections_admin_update"
  on public.raah_calendar_connections
  for update
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_calendar_oauth_settings_admin_select" on public.raah_calendar_oauth_settings;
create policy "raah_calendar_oauth_settings_admin_select"
  on public.raah_calendar_oauth_settings
  for select
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_calendar_oauth_settings_admin_insert" on public.raah_calendar_oauth_settings;
create policy "raah_calendar_oauth_settings_admin_insert"
  on public.raah_calendar_oauth_settings
  for insert
  with check (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

drop policy if exists "raah_calendar_oauth_settings_admin_update" on public.raah_calendar_oauth_settings;
create policy "raah_calendar_oauth_settings_admin_update"
  on public.raah_calendar_oauth_settings
  for update
  using (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    auth.jwt() ->> 'email' = 'crushidea@gmail.com'
    or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

commit;
