import { describe, expect, it } from 'vitest';
import { DEFAULT_GEMINI_MODEL, resolveGeminiModel } from './gemini-model.mjs';

describe('resolveGeminiModel', () => {
  it('uses the configured model name', () => {
    expect(resolveGeminiModel(' gemini-2.5-flash ')).toBe('gemini-2.5-flash');
  });

  it('falls back when unset or malformed', () => {
    expect(resolveGeminiModel(undefined)).toBe(DEFAULT_GEMINI_MODEL);
    expect(resolveGeminiModel('')).toBe(DEFAULT_GEMINI_MODEL);
    expect(resolveGeminiModel('gpt-4o')).toBe(DEFAULT_GEMINI_MODEL);
    expect(resolveGeminiModel('gemini-3.8-flash; drop')).toBe(DEFAULT_GEMINI_MODEL);
  });
});
