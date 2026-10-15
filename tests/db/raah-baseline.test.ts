import { describe, expect, it } from 'vitest';

// Runs only through `npm run test:db`, which points these variables at the
// local Supabase stack. Never set them to a production project.
const url = process.env.RAAH_TEST_SUPABASE_URL;
const serviceKey = process.env.RAAH_TEST_SERVICE_ROLE_KEY;
const anonKey = process.env.RAAH_TEST_ANON_KEY;
const enabled = Boolean(url && serviceKey && anonKey);

const RAAH_TABLES = [
  'raah_members',
  'raah_visitation_logs',
  'raah_attendance_events',
  'raah_attendance_records',
  'raah_follow_up_resolutions',
  'raah_ministry_schedule_items',
  'raah_calendar_connections',
  'raah_calendar_oauth_settings',
];

function rest(path: string, key: string, init: RequestInit = {}) {
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...init.headers,
    },
  });
}

describe.skipIf(!enabled)('RAAH baseline schema (local Supabase only)', () => {
  it.each(RAAH_TABLES)('%s exists for the server role', async (table) => {
    const response = await rest(`${table}?select=*&limit=0`, serviceKey!);
    expect(response.status).toBe(200);
  });

  it('keeps the attendance service_type default readable after the encoding fix', async () => {
    const response = await rest('raah_attendance_events', serviceKey!, {
      method: 'POST',
      body: JSON.stringify({ date: '2026-01-04' }),
    });
    expect(response.status).toBe(201);
    const [event] = await response.json();
    expect(event.service_type).toBe('주일예배');
  });

  it('adds end_date to ministry schedule items', async () => {
    const response = await rest('raah_ministry_schedule_items?select=end_date&limit=0', serviceKey!);
    expect(response.status).toBe(200);
  });

  it.each(['raah_members', 'raah_visitation_logs'])('hides %s rows from the anon key', async (table) => {
    const seed: Record<string, object> = {
      raah_members: { name: '가상 성도', search_name: '가상성도' },
      raah_visitation_logs: { member_name: '가상 성도', member_search_name: '가상성도', date: '2026-01-04', log_type: '심방', encrypted_payload: {} },
    };
    const insert = await rest(table, serviceKey!, { method: 'POST', body: JSON.stringify(seed[table]) });
    expect(insert.status, await insert.clone().text()).toBe(201);

    const read = await rest(`${table}?select=id`, anonKey!);
    const rows = read.ok ? await read.json() : [];
    expect(rows).toEqual([]);
  });

  it.each(['raah_members', 'raah_visitation_logs'])('rejects anon inserts into %s', async (table) => {
    const response = await rest(table, anonKey!, {
      method: 'POST',
      body: JSON.stringify({ name: '가상', search_name: '가상', member_name: '가상', member_search_name: '가상' }),
    });
    expect(response.ok).toBe(false);
  });
});
