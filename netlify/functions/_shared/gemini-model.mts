// Which Gemini model the word-fruit functions call. Set GEMINI_MODEL in Netlify
// to switch models without a code change; delete it to fall back.
// gemini-2.5-flash is not deprecated but Google limits it to past active users
// and recommends gemini-3.8-flash for new work (checked 2026-09-29).
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

const MODEL_NAME = /^gemini-[a-z0-9.-]{1,60}$/;

export function resolveGeminiModel(configured: string | undefined) {
  const value = configured?.trim();
  return value && MODEL_NAME.test(value) ? value : DEFAULT_GEMINI_MODEL;
}
