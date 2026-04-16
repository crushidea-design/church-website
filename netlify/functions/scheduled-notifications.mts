import type { Config } from '@netlify/functions';
import { FieldValue } from 'firebase-admin/firestore';
import {
  admin,
  buildNotificationMessage,
  getActiveTokensForUserIds,
  getAppDb,
  initializeFirebaseAdmin,
  jsonResponse,
  sendMulticastInChunks,
} from './_shared/firebase-admin.mjs';

export default async () => {
  if (!initializeFirebaseAdmin()) {
    return jsonResponse({ error: 'Firebase Admin not initialized' }, 500);
  }

  const db = getAppDb();
  const now = new Date();

  try {
    const notificationsSnapshot = await db
      .collection('scheduled_notifications')
      .where('status', '==', 'pending')
      .where('scheduledAt', '<=', now)
      .get();

    for (const doc of notificationsSnapshot.docs) {
      const notif = doc.data();
      const baseMessage = buildNotificationMessage({
        title: String(notif.title),
        body: String(notif.body),
        targetUrl: notif.targetUrl || '/',
        imageUrl: notif.imageUrl,
      });

      try {
        if (notif.targetAudience === 'all') {
          await admin.messaging().send({ ...baseMessage, topic: 'all_members' });
        } else {
          let targetTokens: string[] = Array.isArray(notif.targetTokens)
            ? notif.targetTokens.filter((token: unknown): token is string => typeof token === 'string')
            : [];

          if (targetTokens.length === 0 && Array.isArray(notif.targetUserIds)) {
            targetTokens = await getActiveTokensForUserIds(
              notif.targetUserIds.filter((userId: unknown): userId is string => typeof userId === 'string')
            );
          }

          if (targetTokens.length > 0) {
            await sendMulticastInChunks(baseMessage, targetTokens);
          }
        }

        await doc.ref.update({ status: 'sent', sentAt: FieldValue.serverTimestamp() });
      } catch (error) {
        console.error(`Failed to send scheduled notification ${doc.id}:`, error);
        await doc.ref.update({ status: 'failed', error: String(error) });
      }
    }

    return jsonResponse({ success: true, processed: notificationsSnapshot.size });
  } catch (error) {
    console.error('Error in scheduled notifications function:', error);
    return jsonResponse({ error: 'Failed to process scheduled notifications' }, 500);
  }
};

export const config: Config = {
  schedule: '@hourly',
};
