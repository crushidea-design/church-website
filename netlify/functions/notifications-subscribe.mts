import type { Config } from '@netlify/functions';
import { admin, initializeFirebaseAdmin, jsonResponse, verifyRequestUser } from './_shared/firebase-admin.mjs';

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (!initializeFirebaseAdmin()) {
    return jsonResponse({ error: 'Firebase Admin not initialized' }, 500);
  }

  const { token, topic = 'all_members' } = await req.json().catch(() => ({}));
  if (!token) {
    return jsonResponse({ error: 'Invalid request' }, 400);
  }
  if (topic !== 'all_members') {
    return jsonResponse({ error: 'Unsupported topic' }, 400);
  }

  const decoded = await verifyRequestUser(req).catch((error) => {
    console.error('Error verifying subscribe request:', error);
    return null;
  });
  if (!decoded) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  try {
    await admin.messaging().subscribeToTopic(token, topic);
    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Error subscribing to topic:', error);
    return jsonResponse({ error: 'Failed to subscribe' }, 500);
  }
};

export const config: Config = {
  path: '/api/notifications/subscribe',
};
