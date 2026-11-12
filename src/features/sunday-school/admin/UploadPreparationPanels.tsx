// Admin-only pieces of the upload form (2027 preparation). Rendered only when
// role === 'admin' so the catalog subscription never runs for other users.
import React, { useEffect, useMemo, useRef } from 'react';
import { useSundaySchoolCatalog } from '../api';
import { getSchoolWeekStatus } from '../schedule';
import { computeSundayKey, isValidDateKey } from './scheduleAdmin';
import { describeSchoolWeek, getSuggestedTopicId } from './uploadHelpers';

export type PublishMode = 'public' | 'private';

export function PublishModeOptions({
  value,
  onChange,
  forcedPrivateReason,
}: {
  value: PublishMode;
  onChange: (value: PublishMode) => void;
  forcedPrivateReason?: string | null;
}) {
  const effective = forcedPrivateReason ? 'private' : value;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-black text-emerald-950">2027 준비 (관리자 전용)</p>
      <div className="mt-3 flex flex-wrap gap-4">
        {([
          ['public', '바로 공개'],
          ['private', '비공개로 준비 (개강 때 공개)'],
        ] as const).map(([mode, label]) => (
          <label key={mode} className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <input
              type="radio"
              name="next-generation-publish-mode"
              checked={effective === mode}
              disabled={!!forcedPrivateReason}
              onChange={() => onChange(mode)}
            />
            {label}
          </label>
        ))}
      </div>
      {forcedPrivateReason && <p className="mt-2 text-xs font-bold text-amber-800">{forcedPrivateReason}</p>}
      {effective === 'private' && !forcedPrivateReason && (
        <p className="mt-2 text-xs font-bold text-amber-800">비공개 자료는 성도 화면에 보이지 않고 알림도 가지 않습니다.</p>
      )}
    </div>
  );
}

export function SchoolWeekHint({
  weekKey,
  topicIds,
  autoSelectEnabled,
  onSuggestTopic,
}: {
  weekKey: string;
  topicIds: string[];
  /** False once the user picked a topic themselves (or the topic was requested). */
  autoSelectEnabled: boolean;
  onSuggestTopic: (topicId: string) => void;
}) {
  const { terms, curriculum } = useSundaySchoolCatalog();
  const status = useMemo(
    () =>
      isValidDateKey(weekKey)
        ? getSchoolWeekStatus({ terms, curriculum, sundayKey: computeSundayKey(weekKey) })
        : null,
    [terms, curriculum, weekKey],
  );
  const suggested = status ? getSuggestedTopicId(status, topicIds) : null;

  const appliedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!autoSelectEnabled || !suggested) return;
    const marker = `${weekKey}:${suggested}`;
    if (appliedRef.current === marker) return;
    appliedRef.current = marker;
    onSuggestTopic(suggested);
  }, [autoSelectEnabled, suggested, weekKey, onSuggestTopic]);

  if (!status) return null;
  return (
    <p className="mt-2 text-xs font-bold text-emerald-800">학사 일정: {describeSchoolWeek(status)}</p>
  );
}
