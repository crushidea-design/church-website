import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineString } from 'firebase-functions/params';
import { executeSync } from '../../netlify/functions/_shared/mccheyne-sync-runtime.mjs';

const mode = defineString('MCCHEYNE_SYNC_MODE', { default: 'off' });
const readerAccount = defineString('MCCHEYNE_DRIVE_SERVICE_ACCOUNT', { default: '' });
const approverPerson = defineString('MCCHEYNE_APPROVER_PERSON', { default: '' });
// Deliberately no default: deployment requires an explicitly approved runtime identity.
const runtimeAccount = defineString('MCCHEYNE_SYNC_RUNTIME_ACCOUNT');
export function applySyncConfiguration() {
  process.env.MCCHEYNE_SYNC_MODE = mode.value();
  process.env.MCCHEYNE_DRIVE_SERVICE_ACCOUNT = readerAccount.value();
  process.env.MCCHEYNE_APPROVER_PERSON = approverPerson.value();
}

// Scheduler-authenticated invocation. No public HTTP function or user-supplied job identity.
export const mccheyneApprovedSync = onSchedule({
  schedule: '0 5 * * *', timeZone: 'Asia/Seoul', region: 'asia-northeast1',
  serviceAccount: runtimeAccount, timeoutSeconds: 540, maxInstances: 1, concurrency: 1,
  retryCount: 0, maxRetrySeconds: 0,
}, async () => {
  applySyncConfiguration();
  await executeSync(480_000);
});
