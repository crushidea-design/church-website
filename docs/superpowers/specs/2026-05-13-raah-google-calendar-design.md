# RAAH Google Calendar Design

## Scope

This design covers RAAH workflow steps 4-6:

1. Connect one RAAH-dedicated Google Calendar through OAuth.
2. Read that calendar into the RAAH ministry schedule panel.
3. Create Google Calendar events from RAAH visitation records.

Google Tasks remains outside this slice. Ministry tasks continue to be represented as events on the dedicated RAAH calendar until a later Tasks-specific design is approved.

## Direction

RAAH will connect a single ministry calendar owned by a Google account chosen by the church administrator. This avoids reading the administrator's entire personal calendar and keeps pastoral scheduling data scoped to a dedicated calendar.

OAuth uses Google's web server flow. The app redirects an admin to Google's consent page, receives an authorization code on a Netlify Function callback, exchanges the code server-side, and stores the refresh token only in Supabase. The browser never receives Google access or refresh tokens.

## Environment

The server expects:

- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `GOOGLE_CALENDAR_REDIRECT_URI`
- `RAAH_ENCRYPTION_SECRET`

The redirect URI should point to:

`https://<site-domain>/.netlify/functions/raah-calendar-callback`

Local development can use the same function path on localhost if a matching OAuth redirect URI is registered.

## Data Model

Add `raah_calendar_connections`:

```sql
id uuid primary key
provider text default 'google_calendar'
calendar_id text not null
calendar_summary text
google_account_email text
encrypted_token jsonb not null
scope text
token_expiry timestamptz
connected_by jsonb
connected_at timestamptz
updated_at timestamptz
```

Only one active Google Calendar connection is needed in this slice. The server reads the newest row.

Existing `raah_ministry_schedule_items` already supports `source: 'google_calendar'` and `external_id`. Google events are upserted into that table using `source = 'google_calendar'` and `external_id = event.id`.

## Server API

Add a focused Netlify Function for Google calendar work:

- `GET /api/raah/calendar/status`
- `GET /api/raah/calendar/auth-url`
- `GET /.netlify/functions/raah-calendar-callback`
- `POST /api/raah/calendar/sync`
- `POST /api/raah/calendar/events`

All `/api/raah/calendar/*` endpoints require existing RAAH admin auth except the OAuth callback. The callback validates a signed `state` parameter before exchanging the code.

`auth-url` returns the Google consent URL. The requested scope is the narrow Calendar events scope:

`https://www.googleapis.com/auth/calendar.events`

`sync` refreshes the access token, lists events from the connected calendar for the current week window, and upserts them into `raah_ministry_schedule_items`.

`events` creates one Google Calendar event from a RAAH visitation context:

```json
{
  "title": "심방 - 김민교",
  "date": "2026-05-13",
  "startsAt": "14:00",
  "endsAt": "15:00",
  "memberId": "member-id",
  "memberName": "김민교",
  "memo": "카페에서 만남",
  "sourceLogId": "log-id"
}
```

After Google returns an event id, the server inserts or updates the RAAH schedule item with `source: 'google_calendar'`.

## UI

RAAH dashboard schedule panel adds:

- Calendar connection status.
- `Google Calendar 연결` button when not connected.
- `Google 일정 동기화` button when connected.

Visitation detail adds a compact `캘린더 일정 만들기` form. It uses the selected log's member name by default and asks only for date, start time, end time, and memo.

The UI should remain usable without Google Calendar configured. Manual schedule items continue to work.

## Error Handling

If Google OAuth environment variables are missing, the status endpoint reports `configured: false` and the UI shows a setup-needed message.

If refresh token exchange fails, the UI shows a reconnect-needed toast and does not delete local manual schedule items.

If event creation fails, no local `google_calendar` schedule item is created. The user can retry.

## Testing

Use pure helper tests for:

- Google OAuth state creation and validation.
- Google event payload construction.
- Google event to RAAH schedule item mapping.

Then verify:

- `npm.cmd run test -- src/features/pastoral-notes/raahCalendar.test.ts`
- `npm.cmd run lint`
- `npm.cmd run build`

Manual browser verification can confirm the RAAH route renders. Full OAuth cannot be completed unless Google OAuth client credentials and a redirect URI are configured.
