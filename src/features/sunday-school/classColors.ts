// Class chip / tab styles. Following the printed materials, classes share one
// quiet style: plain text, the selected one underlined in the school green.
// Kept per class so each can get its own color later.
import type { SchoolClassId } from './types';

export interface ClassColor {
  /** Selected chip / tab. */
  active: string;
  /** Unselected chip / tab. */
  idle: string;
  /** Small icon circle or accent text. */
  accent: string;
}

export const DEFAULT_CLASS_STYLE: ClassColor = {
  active: 'border-b-2 border-emerald-700 text-emerald-800',
  idle: 'border-b-2 border-transparent text-slate-600 hover:text-emerald-800',
  accent: 'bg-white text-emerald-700 ring-[#DADFDD]',
};
const SHARED = DEFAULT_CLASS_STYLE;

export const CLASS_COLORS: Record<SchoolClassId, ClassColor> = {
  seed: SHARED,
  jaram: SHARED,
  seum: SHARED,
  didim: SHARED,
};

export function classColor(id: string): ClassColor | undefined {
  return (CLASS_COLORS as Record<string, ClassColor>)[id];
}
