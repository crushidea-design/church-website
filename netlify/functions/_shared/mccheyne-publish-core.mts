import { createHash, timingSafeEqual } from 'node:crypto';

export const PUBLIC_ORIGIN = 'https://builttogether.church';
export const postUrl = (id: string) => `${PUBLIC_ORIGIN}/post/${id}`;

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest();

/** Constant-time bearer-key check. An unset or empty expected key never authorizes. */
export const isAuthorized = (header: string | null, expectedKey: string | undefined): boolean => {
  if (typeof expectedKey !== 'string' || expectedKey.length === 0) return false;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const token = header.slice('Bearer '.length);
  if (token.length === 0) return false;
  return timingSafeEqual(sha256(token), sha256(expectedKey));
};

export type PublishStatus = 'published' | 'draft';
export type PublishInput = {
  date: string;
  passage: string;
  title: string;
  content: string;
  sourceId: string;
  status: PublishStatus;
};
export type ValidationResult =
  | { ok: true; value: PublishInput }
  | { ok: false; errors: Record<string, string> };

const isRealDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
};

export const validatePublishRequest = (body: unknown): ValidationResult => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, errors: { body: 'JSON object required' } };
  }
  const input = body as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const date = input.date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.date = 'date must be YYYY-MM-DD';
  else if (!isRealDate(date)) errors.date = 'date is not a real calendar date';

  const passage = typeof input.passage === 'string' ? input.passage.trim() : '';
  if (typeof input.passage !== 'string' || !passage) errors.passage = 'passage is required';
  else if (passage.length > 100) errors.passage = 'passage must be at most 100 characters';

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (typeof input.title !== 'string' || !title) errors.title = 'title is required';
  else if (title.length > 150) errors.title = 'title must be at most 150 characters';

  let content = '';
  if (typeof input.content !== 'string' || !input.content.trim()) errors.content = 'content is required';
  else if (input.content.length > 50000) errors.content = 'content must be at most 50000 characters';
  else {
    content = markdownToGuideText(input.content);
    if (!content) errors.content = 'content is empty after conversion';
  }

  const sourceId = input.source_id;
  if (typeof sourceId !== 'string' || !/^[A-Za-z0-9_-]{10,200}$/.test(sourceId)) {
    errors.source_id = 'source_id must be 10-200 characters of A-Z a-z 0-9 _ -';
  }

  let status: PublishStatus = 'published';
  if (input.status !== undefined) {
    if (input.status === 'published' || input.status === 'draft') status = input.status;
    else errors.status = "status must be 'published' or 'draft'";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { date: date as string, passage, title, content, sourceId: sourceId as string, status },
  };
};

// ---------------------------------------------------------------- Markdown

const ESCAPABLE = '\\`*_{}[]()#+-.!>~|';
const ESC_BASE = 0xe000; // private-use placeholders for backslash-escaped characters
const stashEscapes = (s: string) =>
  s.replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, (_m, ch: string) => String.fromCharCode(ESC_BASE + ESCAPABLE.indexOf(ch)));
const restoreEscapes = (s: string) =>
  s.replace(/[-]/g, (c) => ESCAPABLE[c.charCodeAt(0) - ESC_BASE] ?? '');

const stripInline = (text: string): string => {
  let s = text;
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  s = s.replace(/!\[[^\]]*\]\[[^\]]*\]/g, '');
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  s = s.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');
  s = s.replace(/`+([^`]*)`+/g, '$1');
  s = s.replace(/\*\*(.+?)\*\*/g, '$1');
  s = s.replace(/(?<![\p{L}\p{N}_])__(.+?)__(?![\p{L}\p{N}_])/gu, '$1');
  s = s.replace(/~~(.+?)~~/g, '$1');
  s = s.replace(/\*(?!\s)(.+?)(?<!\s)\*/g, '$1');
  s = s.replace(/(?<![\p{L}\p{N}_])_(?!\s)(.+?)(?<!\s)_(?![\p{L}\p{N}_])/gu, '$1');
  return s;
};

const removeFootnotes = (md: string): string => {
  const lines = md.split('\n');
  const out: string[] = [];
  const isContinuation = (l: string) => /^( {4}|\t)/.test(l);
  for (let i = 0; i < lines.length; i++) {
    if (/^[ \t]*\[\^[^\]]+\]:/.test(lines[i])) {
      let j = i + 1;
      for (;;) {
        if (j < lines.length && isContinuation(lines[j]) && lines[j].trim() !== '') { j++; continue; }
        // blank lines belong to the definition only if an indented line follows
        let k = j;
        while (k < lines.length && lines[k].trim() === '') k++;
        if (k > j && k < lines.length && isContinuation(lines[k])) { j = k; continue; }
        break;
      }
      i = j - 1;
      continue;
    }
    out.push(lines[i]);
  }
  return out.join('\n').replace(/[ \t]*\[\^[^\]]+\]/g, '');
};

const LIST_ITEM = /^\s*(?:([-*+])|(\d{1,3})[.)])\s+(.*)$/;
const HR = /^\s*([-*_])(?:\s*\1){2,}\s*$/;

export const markdownToGuideText = (md: string): string => {
  let s = md.replace(/\r\n?/g, '\n');
  s = removeFootnotes(s);
  s = s.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, '');
  s = stashEscapes(s);

  const paragraphs: string[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => {
    if (para.length) paragraphs.push(para.join(' '));
    para = [];
  };
  const flushList = () => {
    if (list.length) paragraphs.push(list.join('\n'));
    list = [];
  };
  const flush = () => { flushPara(); flushList(); };

  for (const rawLine of s.split('\n')) {
    if (rawLine.trim() === '') { flush(); continue; }
    let line = rawLine.replace(/^\s*(?:>\s?)+/, '');
    if (line.trim() === '') { flush(); continue; }
    if (HR.test(line)) { flush(); continue; }
    if (/^\s*\[[^\]]+\]:\s*\S+/.test(line)) continue; // link reference definition
    const heading = /^\s*#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      flush();
      const text = stripInline(heading[1]).trim();
      if (text) paragraphs.push(text);
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      flushPara();
      const marker = item[1] ? '•' : `${item[2]}.`;
      list.push(`${marker} ${stripInline(item[3]).trim()}`);
      continue;
    }
    line = stripInline(line).trim();
    if (!line) continue;
    if (list.length) list[list.length - 1] += ` ${line}`; // wrapped list item
    else para.push(line);
  }
  flush();

  const out = paragraphs
    .map((p) => restoreEscapes(p).split('\n').map((l) => l.trim()).filter(Boolean).map((l) => `  ${l}`).join('\n'))
    .filter((p) => p.trim() !== '')
    .join('\n\n');
  // Defensive: nothing that looks like a tag may survive.
  return out.replace(/<(?=[A-Za-z/!?])/g, '');
};

// ------------------------------------------------------------- Title / date

export const buildGuideTitle = (date: string, passage: string, title: string): string => {
  const [, m, d] = date.split('-').map(Number);
  const prefix = `${m}월 ${d}일`;
  const t = title.trim();
  if (t.startsWith(prefix)) return t;
  if (t.startsWith(passage.trim())) return `${prefix} ${t}`;
  return `${prefix} ${passage.trim()} ${t}`;
};

/** 00:00 on `date` in Asia/Seoul (UTC+9, no DST). */
export const kstMidnight = (date: string): Date => new Date(`${date}T00:00:00+09:00`);
