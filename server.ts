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
      let serviceAccount;
      // Check if it's already an object (though process.env usually returns strings)
      if (typeof serviceAccountKey === 'object') {
        serviceAccount = serviceAccountKey;
      } else {
        // Clean up the string in case it has extra quotes or is malformed
        const cleanedKey = serviceAccountKey.trim();
        
        // Try parsing as JSON
        try {
          serviceAccount = JSON.parse(cleanedKey);
        } catch (jsonError) {
          // If it fails, maybe it's a base64 encoded string?
          try {
            const decoded = Buffer.from(cleanedKey, 'base64').toString('utf8');
            serviceAccount = JSON.parse(decoded);
          } catch (base64Error) {
            // If both fail, throw the original JSON error
            throw jsonError;
          }
        }
      }

      if (serviceAccount && serviceAccount.project_id) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log(`Firebase Admin initialized for project: ${serviceAccount.project_id}`);
      } else {
        throw new Error('Invalid service account key structure');
      }
    } catch (error) {
      console.error('Error initializing Firebase Admin:', error);
      // Log the first few characters to help debug without exposing the whole key
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
