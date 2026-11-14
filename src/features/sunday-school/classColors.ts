// One color per class, from warm to deep: 씨앗 gold, 자람 sage, 세움 slate blue, 디딤 wine.
// Literal hex classes so Tailwind picks them up; they read well on the navy/gold school theme.
import type { SchoolClassId } from './types';

export interface ClassColor {
  /** Selected chip / tab. */
  active: string;
  /** Unselected chip / tab. */
  idle: string;
  /** Small icon circle or accent text. */
  accent: string;
}

export const CLASS_COLORS: Record<SchoolClassId, ClassColor> = {
  seed: {
    active: 'bg-[#A47E2C] text-white shadow-sm',
    idle: 'bg-[#F4ECD6] text-[#5F481B] hover:bg-[#EAD9AD]',
    accent: 'bg-[#F4ECD6] text-[#806122] ring-[#EAD9AD]',
  },
  jaram: {
    active: 'bg-[#56704F] text-white shadow-sm',
    idle: 'bg-[#E4EBDD] text-[#33452F] hover:bg-[#D2DEC6]',
    accent: 'bg-[#E4EBDD] text-[#56704F] ring-[#D2DEC6]',
  },
  seum: {
    active: 'bg-[#4A6094] text-white shadow-sm',
    idle: 'bg-[#E2E8F3] text-[#263A66] hover:bg-[#C5D0E5]',
    accent: 'bg-[#E2E8F3] text-[#4A6094] ring-[#C5D0E5]',
  },
  didim: {
    active: 'bg-[#7A2E3A] text-white shadow-sm',
    idle: 'bg-[#F3E1E3] text-[#5A1F29] hover:bg-[#E8C9CD]',
    accent: 'bg-[#F3E1E3] text-[#7A2E3A] ring-[#E8C9CD]',
  },
};

export function classColor(id: string): ClassColor | undefined {
  return (CLASS_COLORS as Record<string, ClassColor>)[id];
}
