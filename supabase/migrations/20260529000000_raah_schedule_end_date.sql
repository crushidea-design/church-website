alter table public.raah_ministry_schedule_items
  add column if not exists end_date date;

update public.raah_ministry_schedule_items
set end_date = date
where end_date is null;

create index if not exists raah_ministry_schedule_items_end_date_idx
  on public.raah_ministry_schedule_items (end_date);
