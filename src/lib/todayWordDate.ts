import { format } from 'date-fns';

// Calendar dates are not UTC instants: avoid new Date('YYYY-MM-DD').
export function parseTodayWordDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1000) return null;
  const date = new Date(year, month - 1, day);
  return format(date, 'yyyy-MM-dd') === value ? date : null;
}

export function resolveTodayWordDate(value: unknown, isAdmin: boolean, today: string): Date {
  const parsed = parseTodayWordDate(value);
  return parsed && (isAdmin || String(value) <= today) ? parsed : parseTodayWordDate(today)!;
}

export function todayWordDateKey(value: unknown): string | null {
  return parseTodayWordDate(value) ? String(value) : null;
}
