// Which Gemini model the word-fruit functions call. Set GEMINI_MODEL in Netlify
// to switch models without a code change; delete it to fall back.
// Moved from gemini-2.5-flash, which Google limits to past active users, to
// its recommended gemini-3.8-flash (2026-09-29). To roll back without a code
// change, set GEMINI_MODEL=gemini-2.5-flash.
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

const MODEL_NAME = /^gemini-[a-z0-9.-]{1,60}$/;

export function resolveGeminiModel(configured: string | undefined) {
  const value = configured?.trim();
  return value && MODEL_NAME.test(value) ? value : DEFAULT_GEMINI_MODEL;
}
