-- Drops the retired 이전 (legacy) RAAH notes table and its migration RPC.
--
-- Apply this ONLY AFTER the code that stops reading public.raah_notes has been
-- deployed; applying it earlier breaks the running app.
-- The originals were moved into raah_visitation_logs by
-- 20261003000000_raah_legacy_note_migration.sql, and the 2026-09-29 data backup
-- still holds the original raah_notes rows.
begin;

drop function if exists public.raah_rpc_migrate_legacy_note(text, text, uuid, uuid, text, text, date, text, jsonb, integer);
drop table if exists public.raah_notes;

commit;
