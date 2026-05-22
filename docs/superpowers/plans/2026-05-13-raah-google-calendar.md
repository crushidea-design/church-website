# RAAH Google Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect one RAAH-dedicated Google Calendar, sync its events into the RAAH schedule panel, and create calendar events from visitation records.

**Architecture:** Add pure calendar helpers for testable OAuth state and event mapping. Add Supabase schema for one encrypted Google Calendar connection. Add a dedicated Netlify function for Google Calendar OAuth/status/sync/event creation, then wire compact controls into the RAAH dashboard and visitation detail.

**Tech Stack:** React 19, TypeScript, Vitest, Netlify Functions, Supabase REST, Google OAuth 2.0 web server flow, Google Calendar API.

---

### Task 1: Calendar Helper Tests

**Files:**
- Create: `src/features/pastoral-notes/raahCalendar.ts`
- Test: `src/features/pastoral-notes/raahCalendar.test.ts`

- [ ] Write tests for state verification, event payload building, and Google event mapping.
- [ ] Run `npm.cmd run test -- src/features/pastoral-notes/raahCalendar.test.ts` and confirm it fails because `raahCalendar` does not exist.
- [ ] Implement the pure helpers.
- [ ] Re-run the targeted test and confirm it passes.

### Task 2: Client Calendar API Types

**Files:**
- Modify: `src/features/pastoral-notes/managementApi.ts`

- [ ] Add types for calendar status and calendar event creation input.
- [ ] Add `getRaahCalendarStatus`, `getRaahCalendarAuthUrl`, `syncRaahGoogleCalendar`, and `createRaahGoogleCalendarEvent`.
- [ ] Run `npm.cmd run lint`.

### Task 3: Supabase Calendar Schema

**Files:**
- Modify: `supabase/raah_management.sql`

- [ ] Add `raah_calendar_connections`.
- [ ] Add updated-at trigger.
- [ ] Add admin-only select/insert/update policies.
- [ ] Run `git diff --check`.

### Task 4: Netlify Calendar Function

**Files:**
- Create: `netlify/functions/raah-calendar.mts`
- Create: `netlify/functions/raah-calendar-callback.mts`

- [ ] Implement shared admin auth, Supabase REST helper, and encryption helper inside `raah-calendar.mts`.
- [ ] Implement `GET /api/raah/calendar/status`.
- [ ] Implement `GET /api/raah/calendar/auth-url`.
- [ ] Implement `POST /api/raah/calendar/sync`.
- [ ] Implement `POST /api/raah/calendar/events`.
- [ ] Implement OAuth callback code exchange and encrypted connection upsert in `raah-calendar-callback.mts`.
- [ ] Run `npm.cmd run lint`.

### Task 5: RAAH UI Wiring

**Files:**
- Modify: `src/pages/AdminPastoralNotes.tsx`

- [ ] Load calendar status after RAAH data loads.
- [ ] Add connection and sync controls to the schedule panel.
- [ ] Add calendar event creation form to visitation detail.
- [ ] Keep manual schedule item creation unchanged.
- [ ] Run `npm.cmd run lint`.

### Task 6: Verification

**Files:**
- No new files.

- [ ] Run `npm.cmd run test -- src/features/pastoral-notes/raahCalendar.test.ts`.
- [ ] Run `npm.cmd run test -- src/features/pastoral-notes/raahWorkflow.test.ts`.
- [ ] Run `npm.cmd run lint`.
- [ ] Run `npm.cmd run build`.
- [ ] Open `/raah` locally and confirm the route renders. Note that real OAuth requires Google client credentials and redirect URI setup.
