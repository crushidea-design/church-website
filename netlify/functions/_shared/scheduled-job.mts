import { FieldValue } from 'firebase-admin/firestore';
import { getAppDb, initializeFirebaseAdmin, jsonResponse } from './firebase-admin.mjs';

export const JOBS = {
  scheduledNotifications: { utcCron: '0 * * * *', kstCron: '0 * * * *' },
  wordFruitAggregate: { utcCron: '0 14 * * *', kstCron: '0 23 * * *' },
  wordFruitFridayWarning: { utcCron: '0 3 * * 5', kstCron: '0 12 * * 5' },
  wordFruitAutoDraft: { utcCron: '0 14 * * 6', kstCron: '0 23 * * 6' },
} as const;
export type JobName = keyof typeof JOBS;
export type JobProvider = 'netlify' | 'firebase';
const TERMINAL_SKIPS = new Set(['ALREADY_PUBLISHED', 'HUMAN_EDITED', 'NO_MANUSCRIPT']);

/** Latest scheduled UTC slot; both providers share the same ledger key. */
export function scheduledSlot(job: JobName, date: Date): string {
  if (!Number.isFinite(date.getTime())) throw new Error('INVALID_SCHEDULE_TIME');
  const slot = new Date(date);
  slot.setUTCMinutes(0, 0, 0);
  if (job !== 'scheduledNotifications') {
    const hour = job === 'wordFruitFridayWarning' ? 3 : 14;
    slot.setUTCHours(hour);
    if (slot > date) slot.setUTCDate(slot.getUTCDate() - 1);
    if (job === 'wordFruitFridayWarning' || job === 'wordFruitAutoDraft') {
      const weekday = job === 'wordFruitFridayWarning' ? 5 : 6;
      slot.setUTCDate(slot.getUTCDate() - (slot.getUTCDay() - weekday + 7) % 7);
    }
  }
  return slot.toISOString();
}

/**
 * At-most-once per slot across providers. Never expire a claim automatically:
 * a crash after a send must be reviewed, not blindly resent. Control/ledger
 * documents are server-only (no matching client Firestore allow rule).
 */
export async function runScheduledJob(
  job: JobName, provider: JobProvider, work: () => Promise<Response>, scheduleTime?: string,
): Promise<Response> {
  if (!initializeFirebaseAdmin()) throw new Error('SCHEDULER_ADMIN_UNAVAILABLE');
  const now = new Date();
  const scheduled = scheduleTime ? new Date(scheduleTime) : now;
  if (!Number.isFinite(scheduled.getTime())) throw new Error('INVALID_SCHEDULE_TIME');
  // Prevent delayed weekly jobs from processing a different week with old keys.
  if (scheduleTime && (now.getTime() - scheduled.getTime() > 30 * 60_000 || scheduled.getTime() > now.getTime() + 60_000)) {
    throw new Error('STALE_SCHEDULE_TIME');
  }
  const slot = scheduledSlot(job, scheduled);
  const db = getAppDb();
  const control = db.collection('_scheduler_control').doc('jobs');
  const run = db.collection('_scheduled_job_runs').doc(`${job}__${slot}`);
  const claim = await db.runTransaction(async (tx) => {
    const config = await tx.get(control);
    const owners = config.data()?.owners;
    // Missing per-job setting preserves the existing Netlify schedule. Invalid
    // values and explicit "paused" disable work instead of enabling a provider.
    const owner = owners && Object.hasOwn(owners, job) ? owners[job] : 'netlify';
    if (owner !== provider) return 'INACTIVE_PROVIDER';
    if ((await tx.get(run)).exists) return 'ALREADY_CLAIMED';
    tx.create(run, { job, slot, provider, status: 'processing', startedAt: FieldValue.serverTimestamp() });
    return 'CLAIMED';
  });
  if (claim !== 'CLAIMED') return jsonResponse({ ok: true, status: claim });
  try {
    const response = await work();
    const result = await response.clone().json() as { ok?: boolean; reason?: string };
    const skipped = result.ok === false && TERMINAL_SKIPS.has(result.reason || '');
    const failed = !response.ok || (result.ok === false && !skipped);
    await run.update({ status: failed ? 'needs_review' : skipped ? 'skipped' : 'completed', finishedAt: FieldValue.serverTimestamp() });
    if (failed) throw new Error('SCHEDULED_JOB_FAILED');
    return response;
  } catch {
    await run.update({ status: 'needs_review', finishedAt: FieldValue.serverTimestamp() });
    // Never persist/log errors or handler payloads containing tokens or content.
    throw new Error('SCHEDULED_JOB_NEEDS_REVIEW');
  }
}

export function netlifyScheduledHandler(job: JobName, work: () => Promise<Response>) {
  return async () => {
    try { return await runScheduledJob(job, 'netlify', work); }
    catch { return jsonResponse({ ok: false, error: 'SCHEDULED_JOB_NEEDS_REVIEW' }, 500); }
  };
}
