import { SyncError, type RecordState, type SyncStore } from './mccheyne-sync-core.mjs';

/** Dry runs may read production state, but every state/lease/receipt write stays in memory. */
export function createReadOnlySyncStore(base: Pick<SyncStore, 'load' | 'conflict' | 'control' | 'siteState'>) {
  const states = new Map<string, RecordState>();
  let cursor: string | undefined;
  const store: SyncStore = {
    siteState: id => base.siteState(id),
    stop: async () => { throw new SyncError('READ_ONLY_MODE'); },
    control: async () => { const control = await base.control(); return { ...control, cursor: cursor ?? control.cursor }; },
    beginItem: async (id, _lease, advanceCursor = true) => { if ((await base.control()).stopped) throw new SyncError('STOPPED', false, true); if (advanceCursor) cursor = id; },
    acquire: async () => 'read-only-local',
    release: async () => {},
    load: async id => {
      const state = states.get(id) ?? await base.load(id);
      return state ? structuredClone(state) : undefined;
    },
    save: async state => { states.set(state.id, structuredClone(state)); },
    conflict: guide => base.conflict(guide),
    publish: async () => { throw new SyncError('READ_ONLY_MODE', false, true); },
    summary: async () => {},
  };
  return { store, records: () => [...states.values()].map(s => ({ id: s.id, name: s.name, status: s.status, code: s.code, date: s.approvedDate ?? null })) };
}
