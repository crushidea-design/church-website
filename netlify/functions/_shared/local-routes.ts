import type { Express } from 'express';
import type { Context } from '@netlify/functions';
import * as notes from '../raah-notes.mts';
import * as management from '../raah-management.mts';
import * as calendar from '../raah-calendar.mts';
import * as calendarCallback from '../raah-calendar-callback.mts';
import * as ai from '../raah-ai-assist.mts';
import * as comments from '../post-comments.mts';
import * as attachments from '../delete-attachment.mts';

/** Use the production handlers locally, including their path params and authorization. */
export function registerLocalRoutes(app: Express) {
  const modules = [notes, management, calendar, calendarCallback, ai, comments, attachments];
  for (const module of modules) {
    const paths = module.config.path;
    for (const path of (Array.isArray(paths) ? paths : [paths])) {
      if (!path) continue;
      app.all(path, async (req, res) => {
        try {
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string' && !['content-length', 'host'].includes(key)) headers.set(key, value);
          }
          const request = new Request(`${req.protocol}://${req.get('host')}${req.originalUrl}`, {
            method: req.method, headers,
            ...(!['GET', 'HEAD'].includes(req.method) ? { body: JSON.stringify(req.body ?? {}) } : {}),
          });
          const response = await module.default(request, { params: req.params } as Context);
          if (!response) { res.status(500).json({ error: 'Handler returned no response' }); return; }
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.status(response.status).send(Buffer.from(await response.arrayBuffer()));
        } catch {
          // Do not log request bodies or upstream pastoral data.
          res.status(500).json({ error: 'Request failed' });
        }
      });
    }
  }
}
