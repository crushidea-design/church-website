import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Socket } from 'node:net';
import { createDriveReader } from '../netlify/functions/_shared/mccheyne-drive.mts';
import { evaluateApprovalMoves } from '../netlify/functions/_shared/mccheyne-move-evidence.mts';
import { APPROVED_FOLDER, APPROVED_FOLDER_YEARS, DOC_MIME } from '../netlify/functions/_shared/mccheyne-sync-core.mts';

const meta = { id: 'synthetic_document_12345', name: 'synthetic', parents: [APPROVED_FOLDER], mimeType: DOC_MIME, version: '1', modifiedTime: '2026-10-27T00:00:00Z' };
const approver = 'people/synthetic_approver';
const actor = { user: { knownUser: { personName: approver, isCurrentUser: false } } };
const target = { driveItem: { name: `items/${meta.id}` } };
const detail = { move: { addedParents: [{ driveItem: { name: `items/${APPROVED_FOLDER}` } }] } };
const timestamp = '2026-10-27T00:00:01Z';
const later = '2026-10-27T00:00:02Z';
const action = (overrides = {}) => ({ actor, target, detail, timestamp, ...overrides });
const compact = () => ({ actors: [actor], targets: [target], timestamp, actions: [{ detail }] });
const evaluate = (activities: unknown[], options = {}) => evaluateApprovalMoves([{ activities }], { documentId: meta.id, folderId: APPROVED_FOLDER, approver, modifiedTime: meta.modifiedTime, complete: true, ...options });

describe('Drive Activity approval evidence (no network)', () => {
  beforeEach(() => {
    vi.stubEnv('MCCHEYNE_APPROVER_PERSON', approver);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('NETWORK_FORBIDDEN'));
    vi.spyOn(Socket.prototype, 'connect').mockImplementation(() => { throw new Error('NETWORK_FORBIDDEN'); });
  });
  afterEach(() => {
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(Socket.prototype.connect).not.toHaveBeenCalled();
    vi.restoreAllMocks(); vi.unstubAllEnvs();
  });
  it('accepts explicit, compact, and individually inherited fields', () => {
    const full = action();
    expect(evaluate([{ actions: [full] }]).approved).toBe(true);
    expect(evaluate([compact()])).toMatchObject({ approved: true, knownActorCount: 1, approverMatchCount: 1, inheritedActorCount: 1, inheritedTargetCount: 1, inheritedTimeCount: 1 });
    for (const field of ['actor', 'target', 'timestamp']) {
      const partial: any = { ...full }; delete partial[field];
      expect(evaluate([{ ...compact(), actions: [partial] }]).approved).toBe(true);
    }
  });
  it('uses explicit actor/target/time over summary fields', () => {
    const otherActor = { user: { knownUser: { personName: 'people/other' } } };
    expect(evaluate([{ ...compact(), actions: [action({ actor: otherActor })] }]).reason).toBe('LATEST_ACTOR_UNVERIFIED');
    expect(evaluate([{ ...compact(), actions: [action({ target: { driveItem: { name: 'items/other_document' } } })] }]).reason).toBe('LATEST_TARGET_UNVERIFIED');
    expect(evaluate([{ ...compact(), timestamp: meta.modifiedTime, actions: [action()] }]).approved).toBe(true);
    expect(evaluate([{ ...compact(), actions: [action({ timestamp: meta.modifiedTime })] }]).reason).toBe('MODIFIED_NOT_BEFORE_MOVE');
  });
  it.each(['explicit', 'inherited'] as const)('newest non-approver blocks older approval (%s)', form => {
    const badActor = { user: { knownUser: { personName: 'people/other' } } };
    const newest = form === 'explicit' ? { actions: [action({ actor: badActor, timestamp: later })] }
      : { actors: [badActor], targets: [target], timestamp: later, actions: [{ detail }] };
    for (const entries of [[{ actions: [action()] }, newest], [newest, { actions: [action()] }]]) {
      expect(evaluate(entries).reason).toBe('LATEST_ACTOR_UNVERIFIED');
    }
  });
  it('older non-approver does not veto a newer verified move', () => {
    expect(evaluate([{ actions: [action({ actor: { anonymous: {} } })] }, { ...compact(), timestamp: later }]).approved).toBe(true);
  });
  it.each(['actors', 'targets'])('does not cross-join multiple %s or choose the first candidate', field => {
    const newest: any = { ...compact(), timestamp: later };
    newest[field] = [newest[field][0], newest[field][0]];
    expect(evaluate([{ actions: [action()] }, newest]).approved).toBe(false);
  });
  it.each([undefined, null, [], {}, 'invalid'])('malformed/absent summary actor or target is not approval (%j)', value => {
    for (const field of ['actors', 'targets']) expect(evaluate([{ ...compact(), [field]: value }]).approved).toBe(false);
  });
  it.each(['actor', 'target', 'timestamp'])('explicit malformed %s never falls back to a valid summary', field => {
    for (const value of [undefined, null, '', {}]) expect(evaluate([{ ...compact(), actions: [action({ [field]: value })] }]).approved).toBe(false);
  });
  it.each([
    { user: { unknownUser: {} } }, { user: { deletedUser: {} } }, { anonymous: {} },
    { system: {} }, { impersonation: { impersonatedUser: actor.user } },
    { user: { knownUser: { isCurrentUser: true } } },
    { user: { knownUser: { personName: 'people/synthetic_reader', isCurrentUser: true } } },
    { user: { knownUser: actor.user.knownUser, unknownUser: {} } },
  ])('does not treat unverified/Reader actor as human approval (%j)', value => {
    expect(evaluate([{ actions: [action({ actor: value })] }]).reason).toBe('LATEST_ACTOR_UNVERIFIED');
  });
  it('an unlocatable latest target and a latest outside destination block older approval', () => {
    for (const newest of [
      { actors: [actor], timestamp: later, actions: [{ detail }] },
      { actions: [action({ timestamp: later, target: { driveItem: { name: 'items/other_document' } } })] },
      { actions: [action({ timestamp: later, detail: { move: { addedParents: [{ driveItem: { name: 'items/outside' } }] } } })] },
    ]) expect(evaluate([{ actions: [action()] }, newest]).approved).toBe(false);
  });
  it('accepts only the exact current root or year destination', () => {
    for (const folderId of Object.keys(APPROVED_FOLDER_YEARS)) {
      const moved = action({ detail: { move: { addedParents: [{ driveItem: { name: `items/${folderId}` } }] } } });
      expect(evaluate([{ actions: [moved] }], { folderId }).approved).toBe(true);
      expect(evaluate([{ actions: [moved] }], { folderId: 'outside' }).approved).toBe(false);
      if (folderId !== APPROVED_FOLDER) expect(evaluate([{ actions: [action()] }], { folderId }).approved).toBe(false);
    }
  });
  it.each([undefined, null, [], [{ driveItem: { name: `items/${APPROVED_FOLDER}` } }, {}], { 0: target, length: 1 }])('rejects missing/ambiguous destinations (%j)', addedParents => {
    expect(evaluate([{ actions: [action({ detail: { move: { addedParents } } })] }]).approved).toBe(false);
  });
  it('range-only or missing move times cannot be skipped in favor of another precise move', () => {
    for (const entry of [
      { ...compact(), timestamp: undefined },
      { actors: [actor], targets: [target], timeRange: { startTime: timestamp, endTime: later }, actions: [{ detail }] },
      { ...compact(), actions: [{ actor, target, detail, timeRange: { startTime: timestamp, endTime: later } }] },
      { ...compact(), actions: [action({ timeRange: { startTime: timestamp, endTime: later } })] },
    ]) expect(evaluate([{ actions: [action()] }, entry]).reason).toBe('IMPRECISE_MOVE_TIME');
  });
  it('holds ties and equal/later modification times; fractional timestamp ties are conservative', () => {
    expect(evaluate([{ actions: [action(), action()] }]).reason).toBe('LATEST_MOVE_TIED');
    for (const modifiedTime of [timestamp, later, 'invalid']) expect(evaluate([compact()], { modifiedTime }).reason).toBe('MODIFIED_NOT_BEFORE_MOVE');
    expect(evaluate([{ actions: [action({ timestamp: '2026-10-27T00:00:01.000001Z' }), action({ timestamp: '2026-10-27T00:00:01.000002Z' })] }]).reason).toBe('LATEST_MOVE_TIED');
  });
  it('rejects normalized-invalid dates, date-only values, and objects instead of precise timestamps', () => {
    for (const value of ['2026-02-30T00:00:01Z', '2026-10-27T24:00:00Z', '2026-10-27', { seconds: '1' }]) {
      expect(evaluate([{ actions: [action({ timestamp: value })] }]).reason).toBe('IMPRECISE_MOVE_TIME');
    }
    expect(evaluate([{ actions: [action({ timestamp: '2026-10-27T09:00:01+09:00' })] }]).approved).toBe(true);
  });
  it('does not invent actions from primaryActionDetail or accept malformed pages', () => {
    for (const page of [null, [], { activities: {} }, { activities: [{ primaryActionDetail: detail, actors: [actor], targets: [target], timestamp }] }, { activities: [{ actions: [{ detail: null }] }] }, { nextPageToken: 1 }]) {
      expect(evaluateApprovalMoves([{ activities: [compact()] }, page], { documentId: meta.id, folderId: APPROVED_FOLDER, approver, modifiedTime: meta.modifiedTime, complete: true }).reason).toBe('MALFORMED_ACTIVITY');
    }
    expect(evaluate([{ ...compact(), actions: [{ detail: { permissionChange: {} } }, { detail }] }]).approved).toBe(true);
    expect(evaluate([]).reason).toBe('NO_MOVE');
  });
  it('follows pages, considers a newer event on the second page, and retains the exact query', async () => {
    const request = vi.fn().mockResolvedValueOnce({ activities: [compact()], nextPageToken: 'synthetic_next' })
      .mockResolvedValueOnce({ activities: [{ actors: [{ user: { unknownUser: {} } }], targets: [target], timestamp: later, actions: [{ detail }] }] });
    const diagnostic = vi.fn();
    expect(await createDriveReader(request, diagnostic).approvedMove(meta)).toBe(false);
    expect(request.mock.calls[1]).toEqual(['https://driveactivity.googleapis.com/v2/activity:query', { itemName: `items/${meta.id}`, pageSize: 100, consolidationStrategy: { none: {} }, filter: 'detail.action_detail_case:MOVE', pageToken: 'synthetic_next' }]);
    expect(diagnostic).toHaveBeenCalledWith(expect.objectContaining({ reason: 'LATEST_ACTOR_UNVERIFIED', pageCount: 2, complete: true }));
  });
  it('five pages with remaining token never approve', async () => {
    const request = vi.fn().mockResolvedValue({ activities: [compact()], nextPageToken: 'synthetic_next' });
    const diagnostic = vi.fn();
    expect(await createDriveReader(request, diagnostic).approvedMove(meta)).toBe(false);
    expect(request).toHaveBeenCalledTimes(5);
    expect(diagnostic).toHaveBeenCalledWith(expect.objectContaining({ reason: 'INCOMPLETE_ACTIVITY', pageCount: 5 }));
  });
  it('diagnostics contain no identity/raw data and sink mutation/errors do not affect authorization', async () => {
    const report = evaluate([compact()]);
    expect(Object.values(report).every(value => ['number', 'boolean'].includes(typeof value) || value === 'APPROVED')).toBe(true);
    const serialized = JSON.stringify(report);
    for (const sensitive of [meta.id, approver, APPROVED_FOLDER, timestamp]) expect(serialized).not.toContain(sensitive);
    const sink = vi.fn(value => { value.approved = false; throw new Error('synthetic diagnostic error'); });
    expect(await createDriveReader(async () => ({ activities: [compact()] }), sink).approvedMove(meta)).toBe(true);
  });
});
