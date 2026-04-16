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

  // API Route to subscribe to topic
  app.post('/api/notifications/subscribe', async (req, res) => {
    const { token, topic = 'all_members' } = req.body;
    if (!admin.apps.length || !token) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    if (topic !== 'all_members') {
      return res.status(400).json({ error: 'Unsupported topic' });
    }
    const decoded = await verifyRequestUser(req).catch(error => {
      console.error('Error verifying subscribe request:', error);
      return null;
    });
    if (!decoded) {
      return res.status(401).json({ error: 'Authentication required' });
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
    const { title, body, targetUrl, targetTokens, targetUserIds, imageUrl, useTopic } = req.body;

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

      if (useTopic) {
        // Zero-read broadcast using topics
        response = await admin.messaging().send({
          ...baseMessage,
          topic: useTopic === true ? 'all_members' : useTopic,
        });
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
            
            snapshot.forEach(doc => {
              tokensToUse.push(doc.data().token);
            });
          }
        }
        
        tokensToUse = Array.from(new Set(tokensToUse));

        if (tokensToUse.length > 0) {
          response = await admin.messaging().sendEachForMulticast({
            ...baseMessage,
            tokens: tokensToUse,
          });
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
