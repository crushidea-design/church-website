// Stateless presentation primitives used across the RAAH admin pages.
// Each takes its data via props and renders shared style tokens from
// adminShell.ts; do not add state, effects, or domain logic here.
import React from 'react';
import { Lock } from 'lucide-react';
import { shell } from './adminShell';

export function FocusCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: number;
  helper?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={shell.panel + ' p-4'}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#607080]">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eef7f3] text-[#2e6b5f]">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-[#17202b] sm:text-3xl">{value}</p>
      {helper && <p className="mt-1 text-xs text-[#607080]">{helper}</p>}
    </div>
  );
}

export function MiniCount({ label, value }: { label: string; value: number }) {
  return (
    <div className={shell.mutedPanel + ' p-3'}>
      <p className="text-xs font-semibold text-[#607080]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[#17202b]">{value}</p>
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-[#ccd7df] bg-[#f8fafb] p-8 text-center text-sm text-[#607080]">
      {children}
    </p>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[#607080]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={shell.input}
      />
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 4,
  locked,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  locked?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#607080]">
        {locked && <Lock size={13} />}
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className={`${shell.input} leading-6`}
      />
    </label>
  );
}

export function DetailBlock({ label, value, locked }: { label: string; value?: string; locked?: boolean }) {
  return (
    <div className={shell.mutedPanel + ' p-4'}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#607080]">
        {locked && <Lock size={13} />}
        {label}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#28415b]">{value?.trim() ? value : '-'}</p>
    </div>
  );
}

export function BigToggle({
  active,
  label,
  onClick,
  text,
  accent,
  disabled,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  text: string;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-9 rounded-lg border px-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? accent
            ? 'border-[#2e6b5f] bg-[#eef7f3] text-[#245b51]'
            : 'border-[#12345a] bg-[#12345a] text-white'
          : 'border-[#d5dee5] bg-white text-[#2e6b5f] hover:bg-[#f7faf9]'
      }`}
      aria-label={label}
    >
      {text}
    </button>
  );
}
