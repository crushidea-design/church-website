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
        
        // Start cron job for scheduled posts and notifications
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
        const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
        const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const db = getFirestore(firebaseConfig.firestoreDatabaseId);
        const now = new Date();
        
        // 1. Handle Scheduled Posts
        const postsSnapshot = await db.collection('posts')
          .where('isPublished', '==', false)
          .where('scheduledAt', '<=', now)
          .get();

        if (!postsSnapshot.empty) {
          console.log(`Found ${postsSnapshot.size} scheduled posts to publish.`);
          const batch = db.batch();
          const postsToNotify: any[] = [];

          postsSnapshot.docs.forEach(doc => {
            const postData = doc.data();
            batch.update(doc.ref, {
              isPublished: true,
              updatedAt: FieldValue.serverTimestamp()
            });
            
            if (postData.category === 'today_word') {
              postsToNotify.push({ id: doc.id, ...postData });
            }
          });

          await batch.commit();
          console.log(`Successfully published ${postsSnapshot.size} posts.`);

          // Send notifications for published 'today_word' posts
          if (postsToNotify.length > 0) {
            for (const post of postsToNotify) {
              const baseMessage: any = {
                notification: { 
                  title: '오늘의 말씀 가이드라인이 올라왔습니다!', 
                  body: post.title 
                },
                data: { url: '/archive/today' },
                webpush: {
                  notification: {
                    icon: '/icons/church-logo-96x96.png',
                    badge: '/icons/badge-monochrome.png',
                    vibrate: [100, 50, 100]
                  },
                  fcm_options: { link: '/archive/today' }
                }
              };

              try {
                if (post.targetUserIds && post.targetUserIds.length > 0) {
                  // Only fetch tokens if we have specific target users
                  const thirtyDaysAgo = new Date();
                  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                  const tokensSnapshot = await db.collection('fcm_tokens')
                    .where('userId', 'in', post.targetUserIds)
                    .where('updatedAt', '>=', thirtyDaysAgo)
                    .get();
                  const targetTokens = Array.from(new Set(tokensSnapshot.docs.map(t => t.data().token)));
                  
                  if (targetTokens.length > 0) {
                    await admin.messaging().sendEachForMulticast({ ...baseMessage, tokens: targetTokens });
                  }
                } else {
                  // Zero-read broadcast using topic
                  await admin.messaging().send({ ...baseMessage, topic: 'all_members' });
                }
              } catch (err) {
                console.error(`Failed to send scheduled notification for post ${post.id}:`, err);
              }
            }
          }
        }

        // 2. Handle Scheduled Notifications
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
                  icon: '/icons/church-logo-96x96.png',
                  badge: '/icons/badge-monochrome.png',
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
                  const tokensSnapshot = await db.collection('fcm_tokens')
                    .where('userId', 'in', notif.targetUserIds)
                    .where('updatedAt', '>=', thirtyDaysAgo)
                    .get();
                  targetTokens = Array.from(new Set(tokensSnapshot.docs.map(t => t.data().token)));
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
      } catch (error) {
        console.error('Error in scheduled tasks cron job:', error);
      }
    });
  }

  app.use(express.json());

  // API Route to subscribe to topic
  app.post('/api/notifications/subscribe', async (req, res) => {
    const { token, topic = 'all_members' } = req.body;
    if (!admin.apps.length || !token) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    try {
      await admin.messaging().subscribeToTopic(token, topic);
      res.json({ success: true });
    } catch (error) {
      console.error('Error subscribing to topic:', error);
      res.status(500).json({ error: 'Failed to subscribe' });
    }
  });

  // API Route to send notifications
  app.post('/api/notifications/send', async (req, res) => {
    const { title, body, targetUrl, targetTokens, imageUrl, useTopic } = req.body;

    if (!admin.apps.length) {
      return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }

    if (!title || !body) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      let response;
      const baseMessage: any = {
        notification: { title, body },
        data: {
          url: targetUrl || '/',
          ...(imageUrl && { image: imageUrl }),
        },
        webpush: {
          notification: {
            icon: '/icons/church-logo-96x96.png',
            badge: '/icons/badge-monochrome.png',
            vibrate: [100, 50, 100],
            ...(imageUrl && { image: imageUrl }),
          },
          fcm_options: {
            link: targetUrl || '/',
          },
        },
      };

      if (useTopic) {
        // Zero-read broadcast using topics
        response = await admin.messaging().send({
          ...baseMessage,
          topic: useTopic === true ? 'all_members' : useTopic,
        });
        res.json({ success: true, messageId: response });
      } else if (targetTokens && targetTokens.length > 0) {
        response = await admin.messaging().sendEachForMulticast({
          ...baseMessage,
          tokens: targetTokens,
        });
        res.json({
          success: true,
          successCount: response.successCount,
          failureCount: response.failureCount,
        });
      } else {
        res.status(400).json({ error: 'No target specified' });
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      res.status(500).json({ error: 'Failed to send notification' });
    }
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
