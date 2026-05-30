// Shared style class strings for the RAAH admin surfaces.
// Lives in a tiny file so any panel/primitive can import without
// dragging in the 3,000-line page component.
export const shell = {
  page: 'min-h-screen bg-[#f3f6f8] text-[#17202b]',
  panel: 'rounded-xl border border-[#dbe3e8] bg-white shadow-[0_12px_28px_rgba(21,38,57,0.06)]',
  mutedPanel: 'rounded-xl border border-[#dbe3e8] bg-[#f7faf9]',
  input:
    'w-full rounded-lg border border-[#d5dee5] bg-white px-3 py-2.5 text-sm text-[#17202b] outline-none transition placeholder:text-[#8a97a3] focus:border-[#2e6b5f] focus:ring-2 focus:ring-[#2e6b5f]/15',
  button:
    'inline-flex items-center justify-center gap-2 rounded-lg bg-[#12345a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0c2745] disabled:cursor-not-allowed disabled:opacity-60',
  ghostButton:
    'inline-flex items-center justify-center gap-2 rounded-lg border border-[#d5dee5] bg-white px-4 py-2.5 text-sm font-semibold text-[#28415b] transition hover:border-[#b7c6d2] hover:bg-[#f7faf9]',
  badge: 'inline-flex items-center gap-1.5 rounded-full border border-[#cfddd8] bg-[#eef7f3] px-2.5 py-1 text-xs font-semibold text-[#2e6b5f]',
};
