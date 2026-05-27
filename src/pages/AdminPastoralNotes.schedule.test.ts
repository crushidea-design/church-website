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

  it('updates existing dashboard schedule items through the RAAH schedule API', () => {
    const source = readFileSync(new URL('./AdminPastoralNotes.tsx', import.meta.url), 'utf8');
    const managementApi = readFileSync(new URL('../features/pastoral-notes/managementApi.ts', import.meta.url), 'utf8');
    const server = readFileSync(new URL('../../netlify/functions/raah-management.mts', import.meta.url), 'utf8');
    const submitHandler = source.slice(
      source.indexOf('const handleCreateScheduleItem = async'),
      source.indexOf('const handleCompleteScheduleItem = async')
    );

    expect(source).toContain('editingScheduleItemId');
    expect(source).toContain('onEdit={openScheduleFormForEdit}');
    expect(submitHandler).toContain('editingScheduleItemId ? await updateRaahMinistryScheduleItem(editingScheduleItemId, input, user)');
    expect(managementApi).toContain('export async function updateRaahMinistryScheduleItem');
    expect(managementApi).toContain("method: 'PATCH'");
    expect(server).toContain('const handleUpdateScheduleItem = async');
    expect(server).toContain("if (route === 'schedule' && req.method === 'PATCH' && id) return handleUpdateScheduleItem(req, id);");
  });
});

describe('RAAH record editing wiring', () => {
  it('updates existing visitation logs and legacy notes instead of only creating new records', () => {
    const source = readFileSync(new URL('./AdminPastoralNotes.tsx', import.meta.url), 'utf8');
    const noteApi = readFileSync(new URL('../features/pastoral-notes/api.ts', import.meta.url), 'utf8');
    const managementApi = readFileSync(new URL('../features/pastoral-notes/managementApi.ts', import.meta.url), 'utf8');
    const notesServer = readFileSync(new URL('../../netlify/functions/raah-notes.mts', import.meta.url), 'utf8');
    const managementServer = readFileSync(new URL('../../netlify/functions/raah-management.mts', import.meta.url), 'utf8');

    expect(source).toContain('editingLogId');
    expect(source).toContain('openLogFormForEdit');
    expect(source).toContain('editingLegacyNoteId');
    expect(source).toContain('openLegacyFormForEdit');
    expect(source).toContain('editingLogId ? await updateRaahVisitationLog(editingLogId, logForm, user)');
    expect(source).toContain('editingLegacyNoteId ? await updateRaahNote(editingLegacyNoteId, legacyForm, user)');
    expect(managementApi).toContain('export async function updateRaahVisitationLog');
    expect(noteApi).toContain('export async function updateRaahNote');
    expect(notesServer).toContain('const handleUpdate = async');
    expect(notesServer).toContain("if (req.method === 'PATCH' && noteId) return handleUpdate(req, noteId);");
    expect(managementServer).toContain('const handleUpdateLog = async');
    expect(managementServer).toContain("if (route === 'visitation-logs' && req.method === 'PATCH' && id) return handleUpdateLog(req, id);");
  });
});
