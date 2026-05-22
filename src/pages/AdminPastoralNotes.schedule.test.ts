import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('RAAH dashboard schedule form wiring', () => {
  it('saves dashboard schedule items through the RAAH schedule API, not Google Calendar events', () => {
    const source = readFileSync(new URL('./AdminPastoralNotes.tsx', import.meta.url), 'utf8');
    const submitHandler = source.slice(
      source.indexOf('const handleCreateScheduleItem = async'),
      source.indexOf('const handleCompleteScheduleItem = async')
    );

    expect(submitHandler).toContain('createRaahMinistryScheduleItem(input, user)');
    expect(submitHandler).not.toContain('createRaahGoogleCalendarEvent(');
  });
});
