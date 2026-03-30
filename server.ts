import express from 'express';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

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

  app.use(express.json());

  // API Route to send notifications
  app.post('/api/notifications/send', async (req, res) => {
    const { title, body, targetTokens } = req.body;

    if (!admin.apps.length) {
      return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }

    if (!title || !body || !targetTokens || !targetTokens.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const message = {
        notification: { title, body },
        tokens: targetTokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      res.json({
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
      });
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
