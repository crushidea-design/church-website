import { buildRouteTable, handleRequest, normalizePath, type HandlerModule, type IncomingLike, type OutgoingLike } from './adapter.js';
import * as comments from '../../netlify/functions/post-comments.mjs';
import * as attachments from '../../netlify/functions/delete-attachment.mjs';
import * as subscribe from '../../netlify/functions/notifications-subscribe.mjs';
import * as send from '../../netlify/functions/notifications-send.mjs';
import * as health from '../../netlify/functions/notifications-health.mjs';
import * as check from '../../netlify/functions/word-fruit-check.mjs';
import * as generateCards from '../../netlify/functions/word-fruit-generate-cards.mjs';
import * as notifyPublish from '../../netlify/functions/word-fruit-notify-publish.mjs';
import * as mccheyneSync from '../../netlify/functions/mccheyne-sync.mjs';
import * as mccheynePublish from '../../netlify/functions/mccheyne-publish.mjs';

// Explicit allowlist: no RAAH handlers, scheduled jobs, or legacy function URLs.
export const siteModules = [comments, attachments, subscribe, send, health, check, generateCards, notifyPublish, mccheynePublish, mccheyneSync] as unknown as HandlerModule[];
export const siteRoutes = buildRouteTable(siteModules);

export const normalizeSitePath = (pathname: string) => normalizePath(pathname, '/siteApi', ['/api/'], []);

export const handleSiteRequest = async (incoming: IncomingLike, res: OutgoingLike) => {
  // User APIs authenticate users; the publish API authenticates external automation
  // with a bearer key. All responses are private and must bypass caches.
  res.setHeader('Cache-Control', 'no-store');
  await handleRequest(siteRoutes, incoming, res, 'https://builttogether.church', normalizeSitePath);
};
