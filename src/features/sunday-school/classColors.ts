// Class chip / tab styles. Following the printed materials, classes share one
// quiet style (white paper with a thin border) and only the selected one is
// filled with the school green. Kept per class so each can get its own color later.
import type { SchoolClassId } from './types';

export interface ClassColor {
  /** Selected chip / tab. */
  active: string;
  /** Unselected chip / tab. */
  idle: string;
  /** Small icon circle or accent text. */
  accent: string;
}

const SHARED: ClassColor = {
  active: 'bg-emerald-700 text-white shadow-sm',
  idle: 'bg-white text-emerald-900 ring-1 ring-inset ring-[#D9D3C4] hover:bg-[#F5F1E8]',
  accent: 'bg-[#F5F1E8] text-emerald-700 ring-[#E1DACB]',
};

export const CLASS_COLORS: Record<SchoolClassId, ClassColor> = {
  seed: SHARED,
  jaram: SHARED,
  seum: SHARED,
  didim: SHARED,
};

export function classColor(id: string): ClassColor | undefined {
  return (CLASS_COLORS as Record<string, ClassColor>)[id];
}
