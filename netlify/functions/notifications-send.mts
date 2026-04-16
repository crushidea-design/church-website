import type { Config } from '@netlify/functions';
import {
  admin,
  buildNotificationMessage,
  getActiveTokensForUserIds,
  initializeFirebaseAdmin,
  jsonResponse,
  requireAdmin,
  sendMulticastInChunks,
} from './_shared/firebase-admin.mjs';

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

  const { title, body, targetUrl, targetTokens, targetUserIds, imageUrl, useTopic } = await req
    .json()
    .catch(() => ({}));

  if (!title || !body) {
    return jsonResponse({ error: 'Missing required fields' }, 400);
  }

  const baseMessage = buildNotificationMessage({
    title: String(title),
    body: String(body),
    targetUrl: targetUrl ? String(targetUrl) : '/',
    imageUrl: imageUrl ? String(imageUrl) : undefined,
  });

  try {
    if (useTopic) {
      const topic = useTopic === true ? 'all_members' : String(useTopic);
      if (topic !== 'all_members') {
        return jsonResponse({ error: 'Unsupported topic' }, 400);
      }

      const messageId = await admin.messaging().send({
        ...baseMessage,
        topic,
      });
      return jsonResponse({ success: true, messageId });
    }

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
    return jsonResponse({ success: true, ...result });
  } catch (error) {
    console.error('Error sending notification:', error);
    return jsonResponse({ error: 'Failed to send notification' }, 500);
  }
};

export const config: Config = {
  path: '/api/notifications/send',
};
