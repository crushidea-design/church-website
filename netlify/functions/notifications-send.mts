import type { Config } from '@netlify/functions';
import {
  admin,
  buildNotificationMessage,
  createInAppNotifications,
  getActiveTokensForUserIds,
  initializeFirebaseAdmin,
  jsonResponse,
  requireAdmin,
  sendMulticastInChunks,
} from './_shared/firebase-admin.mjs';

const SUPPORTED_TOPICS = new Set(['all_members', 'next_members']);

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (!initializeFirebaseAdmin()) {
    return jsonResponse({ error: 'Firebase Admin not initialized' }, 500);
  }

  const adminCheck = await requireAdmin(req).catch((error) => {
    console.error('Error verifying admin request:', error);
    return { response: jsonResponse({ error: 'Invalid authentication token' }, 401) };
  });
  if (adminCheck.response) return adminCheck.response;

  const { title, body, targetUrl, targetTokens, targetUserIds, imageUrl, useTopic, appScope, badgeCount, inAppTargetUids, inAppMessage } = await req
    .json()
    .catch(() => ({}));

  if (!title || !body) {
    return jsonResponse({ error: 'Missing required fields' }, 400);
  }

  const parsedBadgeCount = Number.parseInt(String(badgeCount), 10);

  const baseMessage = buildNotificationMessage({
    title: String(title),
    body: String(body),
    targetUrl: targetUrl ? String(targetUrl) : '/',
    imageUrl: imageUrl ? String(imageUrl) : undefined,
    appScope: typeof appScope === 'string' ? appScope : undefined,
    badgeCount: Number.isFinite(parsedBadgeCount) ? parsedBadgeCount : undefined,
  });

  const targetUidsForInApp = Array.isArray(inAppTargetUids)
    ? inAppTargetUids.filter((u): u is string => typeof u === 'string')
    : [];
  const inAppMsg = typeof inAppMessage === 'string' ? inAppMessage : String(body);

  try {
    let fcmResult: { success: boolean; messageId?: string; successCount?: number; failureCount?: number };

    if (useTopic) {
      const topic = useTopic === true ? 'all_members' : String(useTopic);
      if (!SUPPORTED_TOPICS.has(topic)) {
        return jsonResponse({ error: 'Unsupported topic' }, 400);
      }

      const messageId = await admin.messaging().send({
        ...baseMessage,
        topic,
      });
      fcmResult = { success: true, messageId };
    } else {
      let tokensToUse = Array.isArray(targetTokens)
        ? targetTokens.filter((token): token is string => typeof token === 'string')
        : [];

      if (Array.isArray(targetUserIds) && targetUserIds.length > 0) {
        const userIds = targetUserIds.filter((userId): userId is string => typeof userId === 'string');
        tokensToUse = [...tokensToUse, ...(await getActiveTokensForUserIds(userIds))];
      }

      tokensToUse = Array.from(new Set(tokensToUse));
      if (tokensToUse.length === 0) {
        return jsonResponse({ error: 'No target specified or no tokens found' }, 400);
      }

      const result = await sendMulticastInChunks(baseMessage, tokensToUse);
      fcmResult = { success: true, ...result };
    }

    // FCM 발송 성공 후 in-app notification 일괄 생성 (Admin SDK → rules 우회)
    if (targetUidsForInApp.length > 0) {
      await createInAppNotifications(targetUidsForInApp, inAppMsg).catch((err) => {
        console.error('Failed to create in-app notifications:', err);
      });
    }

    return jsonResponse(fcmResult);
  } catch (error) {
    console.error('Error sending notification:', error);
    return jsonResponse({ error: 'Failed to send notification' }, 500);
  }
};

export const config: Config = {
  path: '/api/notifications/send',
};
