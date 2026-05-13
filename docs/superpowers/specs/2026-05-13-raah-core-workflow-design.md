# RAAH Core Workflow Design

## Scope

This design covers the first implementation slice selected by the user:

1. Save completed follow-up state so follow-up candidates disappear after they are handled.
2. Expand attendance from one Sunday service record into multiple worship or ministry meeting events.
3. Add a RAAH home section for today's and this week's ministry schedule.

Google Calendar OAuth, creating Google Calendar events from visitation logs, and Google Tasks integration are intentionally outside this slice. The first slice should still shape the local data model so Google Calendar can attach cleanly in the next slice.

## Existing Context

RAAH currently lives mostly in `src/pages/AdminPastoralNotes.tsx`, with server access through `netlify/functions/raah-management.mts` and client helpers in `src/features/pastoral-notes/managementApi.ts`.

Follow-up candidates are currently derived from visitation logs where `hasFollowUp` is true or decrypted `nextSteps` has content. Since there is no persisted completion state, handled follow-ups continue to appear.

Attendance already has Supabase tables named `raah_attendance_events` and `raah_attendance_records`, but the server currently loads only the newest event for a date. The UI therefore behaves like a date has exactly one attendance event.

## Approach

Use the existing Supabase-backed RAAH management function and add narrow, feature-local tables and endpoints:

- `raah_follow_up_resolutions` stores one completion record per follow-up source.
- `raah_ministry_schedule_items` stores manual ministry schedule items and tasks for the RAAH dashboard.
- `raah_attendance_events` is extended with a stable `event_type` field and a unique date/type constraint, allowing one date to have multiple events.

The UI should keep the RAAH app dense and operational. Avoid a new large calendar surface in this slice. The home dashboard should show a compact "오늘/이번 주 사역 일정" panel, and attendance should show event chips for the current date.

## Follow-Up Completion

Each follow-up candidate gets a `candidateKey` derived from the source type and source id. For the first version, candidates are visitation-log based, so the key is `visitation:<logId>`.

When the admin clicks `확인 완료`, the client calls a new endpoint:

`POST /api/raah/follow-ups/resolve`

Payload:

```json
{
  "sourceType": "visitation",
  "sourceId": "log-id",
  "memberId": "member-id",
  "memberName": "성도 이름",
  "memo": "카톡으로 확인함"
}
```

The server inserts or updates a row in `raah_follow_up_resolutions`. Bootstrap returns a `followUpResolutions` list or already-filtered `pendingFollowUps`. The client filters completed candidates out of the dashboard and can show a short toast after completion.

This keeps encrypted visitation contents immutable. It also avoids rewriting sensitive encrypted payloads just to mark a workflow state.

## Multi-Event Attendance

Attendance event types:

- `sunday_morning`: 주일 오전
- `sunday_afternoon`: 주일 오후
- `young_adults`: 청년부 모임
- `wednesday_prayer`: 수요기도회
- `other`: 기타

Each event has:

- `date`
- `eventType`
- `serviceType`
- `includesCommunion`
- `memo`
- `records`

The server should support:

- `GET /api/raah/attendance?date=YYYY-MM-DD` returning all events for the date.
- `POST /api/raah/attendance` saving one event identified by date and event type.

For backward compatibility, the client can treat the first returned event as the selected event while it migrates to an event-chip UI. The dashboard summary should count distinct members who attended at least one event in the selected week, and keep communion count tied only to events where communion is enabled.

The attendance screen should show event chips at the top:

`주일 오전`, `주일 오후`, `청년부`, `수요`, `기타`

Selecting a chip loads and edits that event's records. This avoids building a full matrix in the first pass while still allowing multiple worship or ministry meetings to be checked.

## Ministry Schedule

Add manual schedule items before Google Calendar integration:

```ts
type RaahMinistryScheduleItem = {
  id: string;
  title: string;
  date: string;
  startsAt?: string;
  endsAt?: string;
  itemType: 'visitation' | 'counseling' | 'task' | 'meeting' | 'other';
  memberId?: string;
  memberName?: string;
  status: 'open' | 'done';
  source: 'manual' | 'google_calendar';
  externalId?: string;
  memo?: string;
};
```

The first implementation only writes `source: 'manual'`. The next Google Calendar slice can upsert items using `source: 'google_calendar'` and `externalId`.

RAAH home adds a compact panel titled `오늘/이번 주 사역 일정`:

- Today section: items dated today.
- Week section: next upcoming items in the current week.
- Each item can be marked done.
- Empty state says there are no registered ministry schedules.

The visitation form will not create calendar items in this slice. Schedule items are created and completed from the dashboard schedule panel.

## Data Flow

Bootstrap should return:

```ts
{
  summary,
  members,
  logs,
  attendanceEvents,
  attendanceHistory,
  followUpResolutions,
  ministryScheduleItems
}
```

The client computes:

- `pendingFollowUps`: logs with follow-up content minus completed resolution keys.
- `selectedAttendanceEvent`: event matching the active event type and date.
- `todayScheduleItems` and `weekScheduleItems`: from the returned schedule items.

Writes go through the existing `raah-management.mts` admin auth check. No RAAH client should talk directly to Supabase.

## Error Handling

If follow-up completion fails, leave the candidate visible and show a toast.

If a selected attendance event does not exist yet, the UI builds empty records from active members and creates the event on save.

If schedule loading fails during bootstrap, the whole bootstrap can fail because this is an admin-only operational screen. The error should be surfaced through the existing RAAH loading failure toast.

## Testing

Use TDD for new pure transformation helpers:

- Build follow-up candidate keys and filter resolved candidates.
- Select or initialize an attendance event from date/type and active members.
- Group ministry schedule items into today and week buckets.

Then verify integration with:

- `npm.cmd run test -- <new test files>`
- `npm.cmd run lint`
- `npm.cmd run build`

Manual visual verification should cover desktop and mobile RAAH dashboard plus the attendance tab. If admin auth prevents full local data verification, note that limitation explicitly.

## Out Of Scope For This Slice

- Google OAuth consent flow.
- Storing Google refresh tokens.
- Creating Google Calendar events.
- Google Tasks API.
- Public-facing RAAH access.
- Deployment.
