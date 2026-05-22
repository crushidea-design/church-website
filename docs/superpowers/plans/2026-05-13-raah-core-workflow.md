# RAAH Core Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persisted follow-up completion, multi-event attendance, and manual ministry schedules to the RAAH admin app.

**Architecture:** Add pure client helpers for candidate filtering, attendance event selection, and schedule grouping. Extend the existing Netlify RAAH management function with narrow Supabase tables and endpoints. Update `AdminPastoralNotes.tsx` to consume the new bootstrap data while keeping all writes behind the existing admin-authenticated API.

**Tech Stack:** React 19, TypeScript, Vitest, Netlify Functions, Supabase REST tables.

---

### Task 1: Pure Workflow Helpers

**Files:**
- Create: `src/features/pastoral-notes/raahWorkflow.ts`
- Test: `src/features/pastoral-notes/raahWorkflow.test.ts`

- [ ] Write tests for follow-up filtering, attendance event selection, and schedule grouping.
- [ ] Run `npm.cmd run test -- src/features/pastoral-notes/raahWorkflow.test.ts` and confirm the tests fail because the module does not exist.
- [ ] Implement `buildFollowUpCandidateKey`, `filterResolvedFollowUps`, `selectAttendanceEvent`, `buildAttendanceRecordsForEvent`, and `groupMinistryScheduleItems`.
- [ ] Re-run the targeted test and confirm it passes.

### Task 2: Client API Types

**Files:**
- Modify: `src/features/pastoral-notes/managementApi.ts`

- [ ] Add types for attendance event types, follow-up resolutions, and ministry schedule items.
- [ ] Extend bootstrap parsing to return `attendanceEvents`, `followUpResolutions`, and `ministryScheduleItems`.
- [ ] Add API helpers `resolveRaahFollowUp`, `createRaahMinistryScheduleItem`, and `completeRaahMinistryScheduleItem`.
- [ ] Run `npm.cmd run lint` and confirm TypeScript catches no client type errors.

### Task 3: Supabase Schema

**Files:**
- Modify: `supabase/raah_management.sql`
- Modify: `supabase/raah_attendance.sql`

- [ ] Add `event_type` to `raah_attendance_events`, plus a unique date/type index.
- [ ] Add `raah_follow_up_resolutions`.
- [ ] Add `raah_ministry_schedule_items`.
- [ ] Add admin-only RLS policies for the new tables.
- [ ] Run `git diff --check`.

### Task 4: Netlify RAAH API

**Files:**
- Modify: `netlify/functions/raah-management.mts`

- [ ] Extend attendance parsing and row mapping with `eventType`.
- [ ] Change attendance loading to return all events for the selected date.
- [ ] Add follow-up resolution list/create handling.
- [ ] Add ministry schedule list/create/complete handling.
- [ ] Extend bootstrap response with the new collections.
- [ ] Run `npm.cmd run lint`.

### Task 5: RAAH UI Integration

**Files:**
- Modify: `src/pages/AdminPastoralNotes.tsx`

- [ ] Use workflow helpers to compute pending follow-ups, selected attendance event, and schedule groups.
- [ ] Add `확인 완료` action to follow-up candidates.
- [ ] Add attendance event chips for `주일 오전`, `주일 오후`, `청년부`, `수요`, and `기타`.
- [ ] Add `오늘/이번 주 사역 일정` panel with create and complete actions.
- [ ] Run `npm.cmd run lint` and `npm.cmd run build`.

### Task 6: Verification

**Files:**
- No new files.

- [ ] Run `npm.cmd run test -- src/features/pastoral-notes/raahWorkflow.test.ts`.
- [ ] Run `npm.cmd run lint`.
- [ ] Run `npm.cmd run build`.
- [ ] Start or reuse the local dev server and inspect `/raah` enough to confirm the app renders. If admin auth blocks data screens, record that limitation.
