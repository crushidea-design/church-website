import express from 'express';
import { randomUUID } from 'node:crypto';

/** Test double for the PostgREST contract, not a replacement for PostgreSQL/RLS tests. */
export function createFixtureRest() {
  const tables = new Map<string, Record<string, unknown>[]>();
  const app = express();
  app.use(express.json());
  app.all('/rest/v1/:table', (req, res) => {
    if (!req.params.table.startsWith('raah_')) { res.sendStatus(404); return; }
    const rows = tables.get(req.params.table) || [];
    tables.set(req.params.table, rows);
    const url = new URL(req.originalUrl, 'http://127.0.0.1');
    const filters = [...url.searchParams].filter(([key]) => !['select', 'order', 'offset', 'limit', 'on_conflict'].includes(key));
    const matches = (row: Record<string, unknown>) => filters.every(([field, value]) => {
      const [operator, ...rest] = value.split('.');
      const expected = rest.join('.');
      if (operator === 'eq') return String(row[field]) === expected;
      if (operator === 'gte') return String(row[field]) >= expected;
      if (operator === 'lte') return String(row[field]) <= expected;
      if (operator === 'is' && expected === 'null') return row[field] == null;
      throw new Error(`Unsupported fixture filter: ${field}`);
    });
    let selected = rows.filter(matches);
    if (req.method === 'POST') {
      const input = Array.isArray(req.body) ? req.body : [req.body];
      const conflicts = (url.searchParams.get('on_conflict') || '').split(',').filter(Boolean);
      selected = input.map((value) => {
        const existing = conflicts.length ? rows.find((row) => conflicts.every((key) => row[key] === value[key])) : undefined;
        if (existing) { Object.assign(existing, value, { updated_at: new Date().toISOString() }); return existing; }
        const row = { ...value, id: randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        rows.push(row);
        return row;
      });
      res.status(201).json(selected); return;
    }
    if (req.method === 'PATCH') { selected.forEach((row) => Object.assign(row, req.body)); res.json(selected); return; }
    if (req.method === 'DELETE') { tables.set(req.params.table, rows.filter((row) => !matches(row))); res.status(204).end(); return; }
    if (req.method !== 'GET') { res.sendStatus(405); return; }
    for (const order of (url.searchParams.get('order') || '').split(',').reverse()) {
      const [field, direction] = order.split('.');
      selected.sort((a, b) => String(a[field] || '').localeCompare(String(b[field] || '')) * (direction === 'desc' ? -1 : 1));
    }
    const offset = Number(url.searchParams.get('offset') || 0);
    const limit = Math.min(Number(url.searchParams.get('limit') || 1000), 1000);
    const result = selected.slice(offset, offset + limit).map((row) => req.params.table === 'raah_attendance_records'
      ? { ...row, raah_attendance_events: tables.get('raah_attendance_events')?.find((event) => event.id === row.event_id) }
      : row);
    res.setHeader('Content-Range', `${offset}-${offset + result.length - 1}/${selected.length}`);
    res.json(result);
  });
  return { app, tables };
}
