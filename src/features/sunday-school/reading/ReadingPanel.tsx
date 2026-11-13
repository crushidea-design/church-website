// "올해 성경 읽기" on /next/school: shown to signed-in students and parents who
// have 세움·디딤 children; nothing for guests or anyone else.
import React, { useMemo } from 'react';
import { useNextGenerationAuth } from '../../../lib/nextGenerationAuth';
import { toLocalDateKey } from '../../../lib/nextGenerationResources';
import { useJourneyChildren } from '../journey/useJourneyChildren';
import ReadingChildCard from './ReadingChildCard';
import { isReadingClass } from './reading';

export default function ReadingPanel() {
  const { user, loading, isMember } = useNextGenerationAuth();
  const { children } = useJourneyChildren();
  const todayKey = useMemo(() => toLocalDateKey(new Date()), []);

  if (loading || !user || !isMember) return null;
  const readers = children.filter((child) => isReadingClass(child.classId));
  const otherParentView = children.some((child) => child.viewer === 'parent' && !isReadingClass(child.classId));
  if (readers.length === 0) {
    if (!otherParentView) return null;
    return (
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8" aria-label="올해 성경 읽기">
        <p className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-900">
          올해 성경 읽기는 세움반과 디딤반부터 시작해요. 다른 반은 준비되면 알려 드릴게요.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8" aria-labelledby="school-reading-title">
      <h2 id="school-reading-title" className="text-xl font-black text-emerald-950">
        올해 성경 읽기
      </h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        창세기부터 요한계시록까지, 한 해 동안 순서대로 이어 읽어요. 하루 서너 장이 목표선이고, 마지막으로 읽은 곳 다음부터 이어 읽으면 돼요.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {readers.map((child) => (
          <ReadingChildCard key={child.uid} child={child} todayKey={todayKey} uid={user.uid} />
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">우리 가정의 기록만 보입니다. 함께 걸어 주셔서 감사합니다.</p>
    </section>
  );
}
