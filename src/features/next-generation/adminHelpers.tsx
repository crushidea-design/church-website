// Shared types, constants, and tiny presentational helpers used by
// the NextGenerationAdmin modal and its eventual sub-panels.
import React from 'react';
import { Timestamp } from 'firebase/firestore';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Department, NEXT_GENERATION_DEPARTMENTS } from '../../lib/nextGenerationAuth';

export type QADepartment = 'elementary' | 'young-adults';

export interface QAItem {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  department?: QADepartment;
  isPrivate?: boolean;
  createdAt: Timestamp;
  isAnswered: boolean;
  answer?: string;
  answeredAt?: Timestamp;
  answeredBy?: string;
}

export const QA_DEPARTMENT_LABEL: Record<QADepartment, string> = {
  elementary: '유초등부',
  'young-adults': '청년부',
};

export const QA_DEPARTMENT_BADGE: Record<QADepartment, string> = {
  elementary: 'bg-amber-100 text-amber-800 border-amber-200',
  'young-adults': 'bg-sky-100 text-sky-800 border-sky-200',
};

export interface ContactItem {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: Timestamp;
  isRead: boolean;
}

export type AdminTab =
  | 'members'
  | 'classes'
  | 'bibleReading'
  | 'qa'
  | 'contacts'
  | 'notifications'
  | 'migration'
  | 'wordFruit';

export interface MigrationRow {
  postId: string;
  title: string;
  status: 'pending' | 'done' | 'skipped' | 'error';
  error?: string;
}

export interface ClassReadingDoc {
  uid: string;
  completedBooks?: string[];
  updatedAt?: Timestamp;
}

export const NEXT_NOTIFICATION_TARGETS = [
  { value: '/next', label: '다음세대 홈' },
  { value: '/next/elementary', label: '초등부 자료' },
  { value: '/next/young-adults', label: '청년부 자료' },
  { value: '/next/contact', label: '문의하기' },
];

export const NOTIFICATION_DEPARTMENT_OPTIONS: Department[] = [...NEXT_GENERATION_DEPARTMENTS];

export const DEPT_COLORS: Record<Department, string> = {
  '청년': 'bg-blue-100 text-blue-700',
  '교사': 'bg-green-100 text-green-700',
  '학부모': 'bg-purple-100 text-purple-700',
  '학생': 'bg-amber-100 text-amber-800',
};

export function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1 ${ok ? 'text-green-600' : 'text-red-600'}`}>
      {ok ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />} {label}
    </span>
  );
}

export function formatAdminDate(ts: Timestamp | undefined): string {
  if (!ts) return '-';
  const d = ts.toDate();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export function formatActivityDate(millis: number): string {
  if (!millis) return '-';
  const d = new Date(millis);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
