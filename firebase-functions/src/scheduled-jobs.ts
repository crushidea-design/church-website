import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret, defineString } from 'firebase-functions/params';
import { DEFAULT_GEMINI_MODEL } from '../../netlify/functions/_shared/gemini-model.mjs';
import { JOBS, runScheduledJob } from '../../netlify/functions/_shared/scheduled-job.mjs';
import { runJob as notifications } from '../../netlify/functions/scheduled-notifications.mjs';
import { runJob as aggregate } from '../../netlify/functions/word-fruit-aggregate-tick.mjs';
import { runJob as warning } from '../../netlify/functions/word-fruit-friday-warning.mjs';
import { runJob as autoDraft } from '../../netlify/functions/word-fruit-auto-draft.mjs';

const common = {
  region: 'asia-northeast1', timeZone: 'Asia/Seoul',
  // A timed-out send/AI call can have succeeded. The ledger requires review.
  retryCount: 0, maxRetrySeconds: 0, maxInstances: 1, concurrency: 1,
};
const geminiModel = defineString('GEMINI_MODEL', { default: DEFAULT_GEMINI_MODEL });

export const scheduledNotifications = onSchedule(
  { ...common, schedule: JOBS.scheduledNotifications.kstCron, timeoutSeconds: 300 },
  async (event) => { await runScheduledJob('scheduledNotifications', 'firebase', notifications, event.scheduleTime); },
);
export const wordFruitAggregate = onSchedule(
  { ...common, schedule: JOBS.wordFruitAggregate.kstCron, timeoutSeconds: 300 },
  async (event) => { await runScheduledJob('wordFruitAggregate', 'firebase', aggregate, event.scheduleTime); },
);
export const wordFruitFridayWarning = onSchedule(
  { ...common, schedule: JOBS.wordFruitFridayWarning.kstCron, timeoutSeconds: 300 },
  async (event) => { await runScheduledJob('wordFruitFridayWarning', 'firebase', warning, event.scheduleTime); },
);
export const wordFruitAutoDraft = onSchedule(
  { ...common, schedule: JOBS.wordFruitAutoDraft.kstCron, timeoutSeconds: 540, secrets: [defineSecret('GEMINI_API_KEY')] },
  async (event) => {
    process.env.GEMINI_MODEL = geminiModel.value();
    await runScheduledJob('wordFruitAutoDraft', 'firebase', autoDraft, event.scheduleTime);
  },
);
