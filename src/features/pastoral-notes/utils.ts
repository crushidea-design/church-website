export function normalizeMemberName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ko-KR');
}

export function formatDisplayDate(value?: string) {
  if (!value) return '-';

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(parsed);
}
