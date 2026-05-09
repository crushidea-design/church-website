import express from 'express';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cron from 'node-cron';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;
  const ADMIN_EMAIL = 'crushidea@gmail.com';
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  let firebaseConfig: any = {};

  try {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.warn('firebase-applet-config.json not found or invalid. Falling back to the default Firestore database.');
  }

  const getAppDb = () => firebaseConfig.firestoreDatabaseId
    ? getFirestore(firebaseConfig.firestoreDatabaseId)
    : admin.firestore();

  const verifyRequestUser = async (req: any) => {
    const authHeader = req.headers.authorization || '';
    const idToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : null;

    if (!idToken || !admin.apps.length) {
      return null;
    }

    return admin.auth().verifyIdToken(idToken);
  };

  const requireAdmin = async (req: any, res: any) => {
    try {
      const decoded = await verifyRequestUser(req);
      if (!decoded) {
        res.status(401).json({ error: 'Authentication required' });
        return null;
      }

      if (decoded.email === ADMIN_EMAIL) {
        return decoded;
      }

      const userDoc = await getAppDb().collection('users').doc(decoded.uid).get();
      if (userDoc.exists && userDoc.data()?.role === 'admin') {
        return decoded;
      }

      res.status(403).json({ error: 'Admin permission required' });
      return null;
    } catch (error) {
      console.error('Error verifying admin request:', error);
      res.status(401).json({ error: 'Invalid authentication token' });
      return null;
    }
  };

  // Initialize Firebase Admin
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    try {
      let serviceAccount: any = null;
      const rawKey = serviceAccountKey.trim();

      // Robust JSON parsing helper
      const robustParse = (input: string): any => {
        try {
          // 1. Direct parse
          const parsed = JSON.parse(input);
          if (typeof parsed === 'object' && parsed !== null) return parsed;
          if (typeof parsed === 'string') return robustParse(parsed); // Handle double encoding
        } catch (e: any) {
          // 2. Try cleaning up escaped quotes and newlines if it looks like a string-wrapped JSON
          if (input.includes('\\"')) {
            try {
              const unescaped = input.replace(/\\"/g, '"').replace(/\\n/g, '\n');
              return robustParse(unescaped);
            } catch (e2) {}
          }

          // 3. Try extracting the first valid JSON object if there's trailing garbage
          const firstBrace = input.indexOf('{');
          const lastBrace = input.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            try {
              return JSON.parse(input.substring(firstBrace, lastBrace + 1));
            } catch (e3) {}
          }
        }
        return null;
      };

      serviceAccount = robustParse(rawKey);
      
      console.log(`Attempted to parse service account key. Length: ${rawKey.length}. First char: ${rawKey[0]}. Last char: ${rawKey[rawKey.length - 1]}`);

      // 4. Try base64 as a last resort
      if (!serviceAccount) {
        try {
          const decoded = Buffer.from(rawKey, 'base64').toString('utf8');
          serviceAccount = robustParse(decoded);
        } catch (e) {}
      }

      if (serviceAccount && serviceAccount.project_id) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log(`Firebase Admin initialized for project: ${serviceAccount.project_id}`);
        
        // Start cron job for scheduled notifications
        startScheduledTasksCron();
      } else {
        throw new Error('Could not parse valid service account key from FIREBASE_SERVICE_ACCOUNT_KEY');
      }
    } catch (error) {
      console.error('Error initializing Firebase Admin:', error);
      const snippet = typeof serviceAccountKey === 'string' 
        ? serviceAccountKey.substring(0, 50) + '...' 
        : 'Not a string';
      console.error('Service account key snippet:', snippet);
    }
  } else {
    console.warn('FIREBASE_SERVICE_ACCOUNT_KEY not found. Push notifications will not work.');
  }

  function startScheduledTasksCron() {
    console.log('Starting scheduled tasks cron job...');
    // Run every hour
    cron.schedule('0 * * * *', async () => {
      try {
        const db = getAppDb();
        const now = new Date();
        
        // Handle Scheduled Notifications
        const notificationsSnapshot = await db.collection('scheduled_notifications')
          .where('status', '==', 'pending')
          .where('scheduledAt', '<=', now)
          .get();

        if (!notificationsSnapshot.empty) {
          console.log(`Found ${notificationsSnapshot.size} scheduled notifications to send.`);
          
          for (const doc of notificationsSnapshot.docs) {
            const notif = doc.data();
            const baseMessage: any = {
              notification: { title: notif.title, body: notif.body },
              data: {
                url: notif.targetUrl || '/',
                ...(notif.imageUrl && { image: notif.imageUrl }),
              },
              webpush: {
                notification: {
                  icon: '/pwa-icon-192-v7.png',
                  badge: '/favicon-48x48-v7.png',
                  vibrate: [100, 50, 100],
                  ...(notif.imageUrl && { image: notif.imageUrl }),
                },
                fcm_options: { link: notif.targetUrl || '/' }
              }
            };

            try {
              if (notif.targetAudience === 'all') {
                // Zero-read broadcast
                await admin.messaging().send({ ...baseMessage, topic: 'all_members' });
              } else {
                let targetTokens: string[] = notif.targetTokens || [];
                if (targetTokens.length === 0 && notif.targetUserIds?.length > 0) {
                  const thirtyDaysAgo = new Date();
                  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                  const tokenSet = new Set<string>();
                  for (let i = 0; i < notif.targetUserIds.length; i += 30) {
                    const chunk = notif.targetUserIds.slice(i, i + 30);
                    const tokensSnapshot = await db.collection('fcm_tokens')
                      .where('userId', 'in', chunk)
                      .where('updatedAt', '>=', thirtyDaysAgo)
                      .get();
                    tokensSnapshot.docs.forEach(t => tokenSet.add(t.data().token));
                  }
                  targetTokens = Array.from(tokenSet);
                }

                if (targetTokens.length > 0) {
                  await admin.messaging().sendEachForMulticast({ ...baseMessage, tokens: targetTokens });
                }
              }
              await doc.ref.update({ status: 'sent', sentAt: FieldValue.serverTimestamp() });
            } catch (err) {
              console.error(`Failed to send scheduled notification ${doc.id}:`, err);
              await doc.ref.update({ status: 'failed', error: String(err) });
            }
          }
        }
      } catch (error: any) {
        if (error.code === 8 || (error.message && error.message.includes('RESOURCE_EXHAUSTED'))) {
          console.warn('Firestore quota exceeded. Scheduled tasks will pause until quota resets.');
        } else {
          console.error('Error in scheduled tasks cron job:', error);
        }
      }
    });
  }

  app.use(express.json());

  // API Route: notification system health check (admin only)
  app.get('/api/notifications/health', async (req, res) => {
    const adminInitialized = admin.apps.length > 0;

    const decoded = await verifyRequestUser(req).catch(() => null);
    if (!decoded || decoded.email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!adminInitialized) {
      return res.json({
        ok: false,
        adminInitialized: false,
        messagingAvailable: false,
        firestoreReachable: false,
        activeTokenCount: 0,
        error: 'FIREBASE_SERVICE_ACCOUNT_KEY가 설정되지 않았습니다.',
      });
    }

    let firestoreReachable = false;
    let activeTokenCount = 0;
    let messagingAvailable = false;

    try {
      const db = getAppDb();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const snap = await db.collection('fcm_tokens').where('updatedAt', '>=', cutoff).count().get();
      activeTokenCount = snap.data().count;
      firestoreReachable = true;
    } catch (error) {
      console.error('Firestore health check failed:', error);
    }

    try {
      admin.messaging();
      messagingAvailable = true;
    } catch {
      // messaging 초기화 실패
    }

    res.json({
      ok: firestoreReachable && messagingAvailable,
      adminInitialized,
      messagingAvailable,
      firestoreReachable,
      activeTokenCount,
    });
  });

  // API Route to subscribe to topic
  const SUPPORTED_TOPICS = new Set(['all_members', 'next_members']);

  app.post('/api/notifications/subscribe', async (req, res) => {
    const { token, topic = 'all_members', action = 'subscribe' } = req.body;
    if (!admin.apps.length || !token) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    if (!SUPPORTED_TOPICS.has(String(topic))) {
      return res.status(400).json({ error: 'Unsupported topic' });
    }
    if (action !== 'subscribe' && action !== 'unsubscribe') {
      return res.status(400).json({ error: 'Unsupported action' });
    }
    const decoded = await verifyRequestUser(req).catch(error => {
      console.error('Error verifying subscribe request:', error);
      return null;
    });
    if (!decoded) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      if (action === 'unsubscribe') {
        await admin.messaging().unsubscribeFromTopic(token, topic);
      } else {
        await admin.messaging().subscribeToTopic(token, topic);
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error subscribing to topic:', error);
      res.status(500).json({ error: 'Failed to subscribe' });
    }
  });

  // API Route to send notifications
  app.post('/api/notifications/send', async (req, res) => {
    const { title, body, targetUrl, targetTokens, targetUserIds, imageUrl, useTopic, inAppTargetUids, inAppMessage } = req.body;

    if (!admin.apps.length) {
      return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }

    if (!title || !body) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const adminUser = await requireAdmin(req, res);
      if (!adminUser) return;

      let response;
      const baseMessage: any = {
        notification: { title, body },
        data: {
          url: targetUrl || '/',
          ...(imageUrl && { image: imageUrl }),
        },
        webpush: {
          notification: {
            icon: '/pwa-icon-192-v7.png',
            badge: '/favicon-48x48-v7.png',
            vibrate: [100, 50, 100],
            ...(imageUrl && { image: imageUrl }),
          },
          fcm_options: {
            link: targetUrl || '/',
          },
        },
      };

      const createInAppNotifications = async (uids: string[], message: string) => {
        const uniqueUids = Array.from(new Set(uids.filter(Boolean)));
        if (uniqueUids.length === 0) return;
        const db = getAppDb();
        const BATCH_LIMIT = 500;
        for (let i = 0; i < uniqueUids.length; i += BATCH_LIMIT) {
          const batch = db.batch();
          for (const uid of uniqueUids.slice(i, i + BATCH_LIMIT)) {
            const docRef = db.collection('next_generation_notifications').doc();
            batch.set(docRef, {
              uid,
              type: 'announcement',
              message,
              createdAt: FieldValue.serverTimestamp(),
              isRead: false,
            });
          }
          await batch.commit();
        }
      };

      if (useTopic) {
        const topic = useTopic === true ? 'all_members' : String(useTopic);
        if (!SUPPORTED_TOPICS.has(topic)) {
          return res.status(400).json({ error: 'Unsupported topic' });
        }
        response = await admin.messaging().send({ ...baseMessage, topic });
        if (Array.isArray(inAppTargetUids) && inAppTargetUids.length > 0) {
          await createInAppNotifications(inAppTargetUids, inAppMessage || body).catch(console.error);
        }
        res.json({ success: true, messageId: response });
      } else {
        let tokensToUse = targetTokens || [];

        if (targetUserIds && targetUserIds.length > 0) {
          const db = getAppDb();
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          for (let i = 0; i < targetUserIds.length; i += 30) {
            const chunk = targetUserIds.slice(i, i + 30);
            const snapshot = await db.collection('fcm_tokens')
              .where('userId', 'in', chunk)
              .where('updatedAt', '>=', thirtyDaysAgo)
              .get();
            snapshot.forEach(doc => tokensToUse.push(doc.data().token));
          }
        }

        tokensToUse = Array.from(new Set(tokensToUse));

        if (tokensToUse.length > 0) {
          response = await admin.messaging().sendEachForMulticast({
            ...baseMessage,
            tokens: tokensToUse,
          });
          if (Array.isArray(inAppTargetUids) && inAppTargetUids.length > 0) {
            await createInAppNotifications(inAppTargetUids, inAppMessage || body).catch(console.error);
          }
          res.json({
            success: true,
            successCount: response.successCount,
            failureCount: response.failureCount,
          });
        } else {
          res.status(400).json({ error: 'No target specified or no tokens found' });
        }
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      res.status(500).json({ error: 'Failed to send notification' });
    }
  });

  // ─── 다음세대 말씀 열매 체크 (Asia/Seoul 기준 서버 검증) ─────────────
  app.post('/api/word-fruit/check', async (req, res) => {
    if (!admin.apps.length) {
      return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }
    const decoded = await verifyRequestUser(req).catch(() => null);
    if (!decoded) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const weekId = typeof req.body?.weekId === 'string' ? req.body.weekId.trim() : '';
    if (!weekId) {
      return res.status(400).json({ error: 'weekId required' });
    }

    const dayName = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      weekday: 'short',
    }).format(new Date());
    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(dayName);
    if (dow === 0) {
      return res
        .status(400)
        .json({ error: 'CHECK_NOT_ALLOWED_SUNDAY', message: '주일은 새 말씀 열매를 받는 날이에요.' });
    }
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const fruitStageOf = (count: number) => (count <= 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3);
    const docId = `${weekId}__${decoded.uid}`;
    const db = getAppDb();
    const ref = db.collection('next_generation_word_fruit_progress').doc(docId);

    try {
      const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new Error('PROGRESS_NOT_FOUND');
        const data = snap.data() as any;
        if (data.userId !== decoded.uid) throw new Error('FORBIDDEN');
        const dates: string[] = Array.isArray(data.checkedDates) ? data.checkedDates : [];
        if (dates.includes(today)) throw new Error('ALREADY_CHECKED_TODAY');
        const nextCount = (data.checkCount ?? 0) + 1;
        const nextDates = [...dates, today];
        tx.update(ref, {
          checkCount: nextCount,
          checkedDates: nextDates,
          fruitStage: fruitStageOf(nextCount),
          completed: nextCount >= 3,
          lastCheckedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { count: nextCount, dates: nextDates, childName: data.childName ?? '' };
      });

      // Fire-and-forget parent notification
      (async () => {
        try {
          const parentSnap = await db
            .collection('next_generation_members')
            .where('department', '==', '학부모')
            .where('role', '==', 'member')
            .where('childIds', 'array-contains', decoded.uid)
            .get();
          const parentUids: string[] = [];
          parentSnap.forEach((d) => {
            const data = d.data() as any;
            if (typeof data?.uid === 'string') parentUids.push(data.uid);
          });
          if (parentUids.length === 0) return;
          const completed = result.count >= 3;
          const name = result.childName || '자녀';
          const body = completed
            ? `${name} — 이번 주 말씀 열매가 모두 익었어요! 🎉`
            : `${name} — 오늘도 작은 순종을 실천했어요. (${Math.min(result.count, 3)}/3)`;

          // In-app
          for (let i = 0; i < parentUids.length; i += 500) {
            const batch = db.batch();
            parentUids.slice(i, i + 500).forEach((uid) => {
              batch.set(db.collection('next_generation_notifications').doc(), {
                uid,
                type: 'announcement',
                message: body,
                createdAt: FieldValue.serverTimestamp(),
                isRead: false,
              });
            });
            await batch.commit();
          }

          // FCM
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 30);
          const tokenSet = new Set<string>();
          for (let i = 0; i < parentUids.length; i += 30) {
            const chunk = parentUids.slice(i, i + 30);
            const snap = await db
              .collection('fcm_tokens')
              .where('userId', 'in', chunk)
              .where('updatedAt', '>=', cutoff)
              .get();
            snap.forEach((d) => {
              const t = d.data().token;
              if (typeof t === 'string') tokenSet.add(t);
            });
          }
          const tokens = Array.from(tokenSet);
          if (tokens.length > 0) {
            const baseMessage: any = {
              notification: { title: '자녀 말씀 열매', body },
              data: { url: '/next/elementary?highlight=word-fruit', appScope: 'next' },
              webpush: {
                notification: {
                  icon: '/pwa-icon-192-v7.png',
                  badge: '/favicon-48x48-v7.png',
                  vibrate: [100, 50, 100],
                },
                fcm_options: { link: '/next/elementary?highlight=word-fruit' },
              },
            };
            await admin.messaging().sendEachForMulticast({ ...baseMessage, tokens });
          }
        } catch (err) {
          console.error('notifyLinkedParents failed:', err);
        }
      })();

      res.json({ success: true, count: result.count, dates: result.dates });
    } catch (e: any) {
      const code = String(e?.message ?? e);
      if (code === 'PROGRESS_NOT_FOUND') {
        return res
          .status(404)
          .json({ error: code, message: '이번 주 작은 순종이 등록되지 않았어요.' });
      }
      if (code === 'FORBIDDEN') return res.status(403).json({ error: code });
      if (code === 'ALREADY_CHECKED_TODAY') {
        return res.status(409).json({ error: code, message: '오늘은 이미 열매를 돌보았어요.' });
      }
      console.error('word-fruit-check failed:', e);
      res.status(500).json({ error: 'INTERNAL', message: '체크 중 오류가 발생했습니다.' });
    }
  });

  // ─── 다음세대 말씀 열매: AI 카드 생성 (서버 측, 키 보호) ────────────
  app.post('/api/word-fruit/generate-cards', async (req, res) => {
    if (!admin.apps.length) {
      return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }
    const decoded = await verifyRequestUser(req).catch(() => null);
    if (!decoded) return res.status(401).json({ error: 'Authentication required' });

    const isPastor = await (async () => {
      if (decoded.email === ADMIN_EMAIL) return true;
      const snap = await getAppDb().collection('next_generation_members').doc(decoded.uid).get();
      if (!snap.exists) return false;
      const data = snap.data() as any;
      return data?.role === 'member' && data?.isNextGenerationAdmin === true;
    })();
    if (!isPastor) return res.status(403).json({ error: 'Pastor permission required' });

    const manuscript = typeof req.body?.manuscript === 'string' ? req.body.manuscript.trim() : '';
    if (manuscript.length < 30) {
      return res
        .status(400)
        .json({ error: 'MANUSCRIPT_TOO_SHORT', message: '강의원고가 너무 짧습니다.' });
    }
    if (manuscript.length > 60_000) {
      return res
        .status(400)
        .json({ error: 'MANUSCRIPT_TOO_LONG', message: '강의원고가 너무 깁니다.' });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: 'AI_KEY_MISSING', message: 'AI 키가 서버에 설정되지 않았습니다.' });
    }

    const PROMPT = `다음은 유초등부 주일 강의원고입니다. 이 원고를 바탕으로 “이번 주 말씀 열매” 기능에 사용할 3개의 실천 카드를 만들어 주세요.\n\n대상: 초등학교 유초등부 아이들\n신학 방향: 실천을 아이의 공로나 점수로 표현하지 말고, 하나님께서 말씀으로 우리 삶에 열매를 맺게 하신다는 관점으로 작성\n문체: 짧고 따뜻하게, 아이들이 이해할 수 있는 말로 작성\n분량: 각 카드의 요약은 1-2문장, 질문 1개, 기도문 1문장\n반드시 다음 3단계로 작성:\n1회차: 말씀을 기억해요\n2회차: 마음을 돌아보아요\n3회차: 하나님께 감사해요\n\n오로지 다음 JSON 스키마만 출력하세요. JSON 외의 다른 텍스트는 절대 출력하지 마세요.\n{\n  "recommendedPractices": ["string"],\n  "fruitName": "string",\n  "memoryVerse": "string",\n  "cards": [\n    { "order": 1, "title": "말씀을 기억해요", "summary": "string", "question": "string", "prayer": "string" },\n    { "order": 2, "title": "마음을 돌아보아요", "summary": "string", "question": "string", "prayer": "string" },\n    { "order": 3, "title": "하나님께 감사해요", "summary": "string", "question": "string", "prayer": "string" }\n  ]\n}\n\n강의원고:\n`;

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: PROMPT + manuscript,
        config: { responseMimeType: 'application/json' },
      });
      const text = (response as any).text ?? '';
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        const m = text.match(/\{[\s\S]*\}/);
        if (!m) throw new Error('JSON parse failed');
        parsed = JSON.parse(m[0]);
      }
      res.json({ success: true, data: parsed });
    } catch (err: any) {
      console.error('generate-cards error:', err);
      res.status(500).json({ error: 'AI_FAILED', message: err?.message || String(err) });
    }
  });

  // ─── 다음세대 말씀 열매 게시 알림 (인앱 + FCM) ────────────────────
  const ensureNextGenerationPastor = async (uid: string, email: string | undefined) => {
    if (email === ADMIN_EMAIL) return true;
    const snap = await getAppDb().collection('next_generation_members').doc(uid).get();
    if (!snap.exists) return false;
    const data = snap.data() as any;
    return data?.role === 'member' && data?.isNextGenerationAdmin === true;
  };

  app.post('/api/word-fruit/notify-publish', async (req, res) => {
    if (!admin.apps.length) {
      return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }
    const decoded = await verifyRequestUser(req).catch(() => null);
    if (!decoded) return res.status(401).json({ error: 'Authentication required' });
    if (!(await ensureNextGenerationPastor(decoded.uid, decoded.email))) {
      return res.status(403).json({ error: 'Pastor permission required' });
    }
    const weekId = typeof req.body?.weekId === 'string' ? req.body.weekId.trim() : '';
    if (!weekId) return res.status(400).json({ error: 'weekId required' });

    const db = getAppDb();
    const fruitSnap = await db.collection('next_generation_word_fruits').doc(weekId).get();
    if (!fruitSnap.exists) return res.status(404).json({ error: 'FRUIT_NOT_FOUND' });
    const fruit: any = fruitSnap.data();
    if (fruit.status !== 'published') {
      return res
        .status(400)
        .json({ error: 'NOT_PUBLISHED', message: '게시 후 알림을 보낼 수 있습니다.' });
    }

    const memberIds = new Set<string>();
    for (const department of ['학생', '학부모', '교사']) {
      const snap = await db
        .collection('next_generation_members')
        .where('department', '==', department)
        .where('role', '==', 'member')
        .get();
      snap.forEach((d) => {
        const data = d.data() as any;
        if (data?.uid) memberIds.add(data.uid);
      });
    }
    const targets = Array.from(memberIds);
    const messageBody = `${fruit.title || ''} — 한 주 동안 작은 순종을 함께 실천해 보아요.`;

    // In-app
    if (targets.length > 0) {
      for (let i = 0; i < targets.length; i += 500) {
        const batch = db.batch();
        targets.slice(i, i + 500).forEach((uid) => {
          batch.set(db.collection('next_generation_notifications').doc(), {
            uid,
            type: 'announcement',
            message: messageBody,
            createdAt: FieldValue.serverTimestamp(),
            isRead: false,
          });
        });
        await batch.commit();
      }
    }

    // FCM
    const tokenSet = new Set<string>();
    if (targets.length > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      for (let i = 0; i < targets.length; i += 30) {
        const chunk = targets.slice(i, i + 30);
        const snap = await db
          .collection('fcm_tokens')
          .where('userId', 'in', chunk)
          .where('updatedAt', '>=', cutoff)
          .get();
        snap.forEach((d) => {
          const t = d.data().token;
          if (typeof t === 'string') tokenSet.add(t);
        });
      }
    }
    const tokens = Array.from(tokenSet);
    let result: any = { successCount: 0, failureCount: 0 };
    if (tokens.length > 0) {
      const baseMessage: any = {
        notification: { title: '이번 주 말씀 열매', body: messageBody },
        data: { url: '/next/elementary?highlight=word-fruit', appScope: 'next' },
        webpush: {
          notification: {
            icon: '/pwa-icon-192-v7.png',
            badge: '/favicon-48x48-v7.png',
            vibrate: [100, 50, 100],
          },
          fcm_options: { link: '/next/elementary?highlight=word-fruit' },
        },
      };
      result = await admin
        .messaging()
        .sendEachForMulticast({ ...baseMessage, tokens });
    }

    res.json({ success: true, inAppCount: targets.length, fcmTokenCount: tokens.length, ...result });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
