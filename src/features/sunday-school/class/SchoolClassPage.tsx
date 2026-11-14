// Teacher's Sunday class screen (/next/school/class): attendance, last week's
// memory check and this week's promise, one row per child of the class.
import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useNextGenerationAuth } from '../../../lib/nextGenerationAuth';
import { hasDepartment } from '../../../lib/nextGenerationRoles';
import { NEXT_GENERATION_PATH, getActiveSundayKey } from '../../../lib/nextGenerationResources';
import { subscribeAttendanceForGroup } from '../../word-fruit/attendanceApi';
import type { AttendanceDoc } from '../../word-fruit/attendanceApi';
import { useTeacherRoster } from '../../word-fruit/WordFruitTeacherView';
import { useSundaySchoolCatalog } from '../api';
import { saveClassRows, subscribeSchoolWeekly } from '../classApi';
import {
  PROMISE_MAX_LENGTH,
  SCHOOL_CLASS_NAMES,
  buildRowDrafts,
  buildWeeklyWrites,
  canUseClassScreen,
  classBoardKey,
  getClassBoardStatus,
  getMemoryCheckTarget,
  getWeekCurriculumInfo,
  hasPromiseAndMemory,
  manageableClassIds,
  previousPromiseByUid,
  previousSundayKey,
  sundayKeyFromDateParam,
} from '../classScreen';
import type { ClassRowDraft } from '../classScreen';
import type { SchoolClassId, SchoolWeeklyDoc } from '../types';
import { countsByStudent, formatCountsLine } from '../journey/journey';
import { subscribeJourneyForClass } from '../journey/journeyApi';
import type { SchoolJourneyDoc } from '../journey/journeyApi';
import { isReadingClass, formatReadThrough, percentRead, readingYearFor } from '../reading/reading';
import { subscribeReadingForClass } from '../reading/readingApi';
import { CLASS_COLORS } from '../classColors';
import type { ReadingYearDoc } from '../reading/readingApi';

const SCHOOL_PATH = `${NEXT_GENERATION_PATH}/school`;

const PROMPTS: Array<{ label: string; hint: string }> = [
  { label: '언제?', hint: '아침에, 잠들기 전에' },
  { label: '누구에게?', hint: '동생에게, 부모님께' },
  { label: '무엇을?', hint: '문답과 이어진 행동 하나' },
  { label: '몇 번?', hint: '이번 주 3번' },
];

// Mobile: each child is a card. md and up: one table-like row.
const ROW_GRID_FULL = 'md:grid md:grid-cols-[minmax(6rem,1fr)_repeat(3,5.5rem)_6.5rem_minmax(10rem,1.6fr)_minmax(7rem,1fr)] md:items-center md:gap-3';
const ROW_GRID_SEED = 'md:grid md:grid-cols-[minmax(6rem,1fr)_repeat(3,5.5rem)] md:items-center md:gap-3';

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-bold transition disabled:opacity-50 ${
        checked
          ? 'border-emerald-600 bg-emerald-600 text-white'
          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      <span aria-hidden="true">{checked ? '✓' : '○'}</span>
      <span className="md:hidden">{label}</span>
    </button>
  );
}

function ClassBoard({
  classId,
  sundayKey,
  uid,
  curriculumLine,
  promiseExamples,
  memoryTarget,
}: {
  classId: SchoolClassId;
  sundayKey: string;
  uid: string;
  curriculumLine?: string;
  promiseExamples: string[];
  memoryTarget: ReturnType<typeof getMemoryCheckTarget>;
}) {
  const withPromise = hasPromiseAndMemory(classId);
  const showMemory = withPromise && !!memoryTarget;
  const groupIds = useMemo(() => [classId], [classId]);
  const roster = useTeacherRoster(groupIds);
  const students = roster.students;
  const boardKey = classBoardKey(classId, sundayKey);
  // Each result is tagged with the key it was loaded for, so a previous class/week is never shown or saved.
  const [attendanceState, setAttendanceState] = useState<{ key: string; rows: AttendanceDoc[] } | null>(null);
  const [weeklyState, setWeeklyState] = useState<{ key: string; rows: SchoolWeeklyDoc[] } | null>(null);
  const attendance = useMemo(
    () => (attendanceState?.key === boardKey ? attendanceState.rows : []),
    [attendanceState, boardKey],
  );
  const weekly = useMemo(() => (weeklyState?.key === boardKey ? weeklyState.rows : []), [weeklyState, boardKey]);
  const [previousWeekly, setPreviousWeekly] = useState<SchoolWeeklyDoc[]>([]);
  const [previousJourney, setPreviousJourney] = useState<SchoolJourneyDoc[]>([]);
  const [readingRows, setReadingRows] = useState<ReadingYearDoc[]>([]);
  const showReading = isReadingClass(classId);
  const [drafts, setDrafts] = useState<Record<string, Partial<ClassRowDraft>>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Fresh drafts whenever the class or Sunday changes.
  useEffect(() => {
    setDrafts({});
    setMessage(null);
    setLoadError(false);
    setAttendanceState(null);
    setWeeklyState(null);
    setPreviousWeekly([]);
    setPreviousJourney([]);
  }, [classId, sundayKey]);

  useEffect(() => {
    const onError = () => setLoadError(true);
    const unsubs = [
      subscribeAttendanceForGroup(classId, [sundayKey], (rows) => setAttendanceState({ key: boardKey, rows }), onError),
      subscribeSchoolWeekly(classId, sundayKey, (rows) => setWeeklyState({ key: boardKey, rows }), onError),
      subscribeSchoolWeekly(classId, previousSundayKey(sundayKey), setPreviousWeekly, onError),
      subscribeJourneyForClass(classId, previousSundayKey(sundayKey), setPreviousJourney, onError),
    ];
    setReadingRows([]);
    if (isReadingClass(classId)) {
      unsubs.push(subscribeReadingForClass(classId, readingYearFor(sundayKey), setReadingRows, onError));
    }
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [classId, sundayKey, boardKey]);

  const status = getClassBoardStatus({
    key: boardKey,
    rosterLoaded: roster.loaded,
    attendanceKey: attendanceState?.key ?? null,
    weeklyKey: weeklyState?.key ?? null,
    hasError: loadError || roster.error,
  });
  const ready = status === 'ready';

  const baseRows = useMemo(() => buildRowDrafts(students, attendance, weekly), [students, attendance, weekly]);
  const rows = useMemo(
    () => baseRows.map((row) => ({ ...row, ...drafts[row.uid] })),
    [baseRows, drafts],
  );
  const previousPromises = useMemo(() => previousPromiseByUid(previousWeekly), [previousWeekly]);
  const previousCounts = useMemo(() => countsByStudent(previousJourney), [previousJourney]);
  const readingByUid = useMemo(() => new Map(readingRows.map((row) => [row.studentUid, row.chaptersRead ?? 0])), [readingRows]);

  const patch = (rowUid: string, change: Partial<ClassRowDraft>) => {
    setMessage(null);
    setDrafts((current) => ({ ...current, [rowUid]: { ...current[rowUid], ...change } }));
  };

  const save = async () => {
    if (saving || !ready || rows.length === 0) return;
    setSaving(true);
    setMessage(null);
    try {
      const weeklyWrites = buildWeeklyWrites(rows, classId, memoryTarget, new Set(weekly.map((doc) => doc.studentUid)));
      await saveClassRows({ weekKey: sundayKey, classId, checkedBy: uid, rows, weeklyWrites });
      setDrafts({});
      setMessage({ kind: 'ok', text: '저장했습니다.' });
    } catch {
      console.error('Failed to save the class screen');
      setMessage({ kind: 'error', text: '저장하지 못했습니다. 잠시 뒤에 다시 시도해 주세요.' });
    } finally {
      setSaving(false);
    }
  };

  const grid = withPromise ? ROW_GRID_FULL : ROW_GRID_SEED;

  return (
    <div className="mt-4">
      {withPromise && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-black leading-6">
            실천 약속은 아이가 말한 것을 받아 적고, 너무 쉽거나 막연하면 함께 구체적으로 다듬어 주세요.
          </p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {PROMPTS.map((prompt) => (
              <li key={prompt.label} className="leading-6">
                <span className="font-black">{prompt.label}</span>{' '}
                <span className="text-amber-900">{prompt.hint}</span>
              </li>
            ))}
          </ul>
          {promiseExamples.length > 0 && (
            <div className="mt-3 border-t border-amber-200 pt-2">
              <p className="font-black">이번 주 예시</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 leading-6">
                {promiseExamples.map((example) => (
                  <li key={example}>{example}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {!withPromise && (
        <p className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-900">
          씨앗반은 출석만 확인합니다. 주중에는 주일에 함께 읽은 말씀 동화를 다시 읽습니다.
        </p>
      )}

      {status === 'error' && (
        <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
          기록을 불러오지 못했습니다. 화면을 새로 고쳐 주세요.
        </p>
      )}
      {status === 'loading' && (
        <p role="status" className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-600">
          기록을 불러오는 중입니다. 잠시만 기다려 주세요.
        </p>
      )}

      <div className="mt-4">
        <div className={`hidden rounded-lg bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-900 ${grid}`} aria-hidden="true">
          <span>이름 · 지난주 기록</span>
          <span className="text-center">1교시</span>
          <span className="text-center">2교시</span>
          <span className="text-center">공예배</span>
          {withPromise && <span className="text-center">{showMemory ? `지난주 암송 (${memoryTarget?.label})` : ''}</span>}
          {withPromise && <span>이번 주 실천 약속</span>}
          {withPromise && <span>지난주 약속</span>}
        </div>

        {!ready ? null : rows.length === 0 ? (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            이 반에 배정된 아이가 아직 없습니다. 교역자가 아이를 반에 배정하면 여기에 보입니다.
          </p>
        ) : (
          <ul className="mt-2 space-y-3 md:space-y-1">
            {rows.map((row) => {
              const lastPromise = previousPromises.get(row.uid);
              return (
                <li
                  key={row.uid}
                  className={`rounded-2xl border border-slate-200 bg-white p-3 md:rounded-lg md:border-0 md:border-b md:px-3 md:py-2 ${grid}`}
                >
                  <div>
                    <p className="text-base font-black text-slate-900">{row.name}</p>
                    <p className="text-xs font-bold text-slate-500">
                      <span className="md:hidden">지난주 기록 </span>
                      {formatCountsLine(previousCounts.get(row.uid))}
                    </p>
                    {showReading && (
                      <p className="text-xs font-bold text-slate-500">
                        성경 읽기: {formatReadThrough(readingByUid.get(row.uid) ?? 0)}
                        {(readingByUid.get(row.uid) ?? 0) > 0 ? ` (${percentRead(readingByUid.get(row.uid) ?? 0)}%)` : ''}
                      </p>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 md:mt-0 md:contents">
                    <div className="md:flex md:justify-center">
                      <Toggle label="1교시" checked={row.present} disabled={saving} onChange={(next) => patch(row.uid, { present: next })} />
                    </div>
                    <div className="md:flex md:justify-center">
                      <Toggle label="2교시" checked={row.period2} disabled={saving} onChange={(next) => patch(row.uid, { period2: next })} />
                    </div>
                    <div className="md:flex md:justify-center">
                      <Toggle label="공예배" checked={row.publicWorship} disabled={saving} onChange={(next) => patch(row.uid, { publicWorship: next })} />
                    </div>
                  </div>
                  {withPromise && (
                    <>
                      <div className="mt-2 md:mt-0 md:flex md:justify-center">
                        {showMemory ? (
                          <Toggle
                            label={`지난주 암송 ${memoryTarget?.label ?? ''}`}
                            checked={row.memoryChecked}
                            disabled={saving}
                            onChange={(next) => patch(row.uid, { memoryChecked: next })}
                          />
                        ) : null}
                      </div>
                      <label className="mt-2 block md:mt-0">
                        <span className="text-xs font-black text-slate-600 md:sr-only">이번 주 실천 약속</span>
                        <input
                          type="text"
                          value={row.promise}
                          maxLength={PROMISE_MAX_LENGTH}
                          disabled={saving}
                          onChange={(e) => patch(row.uid, { promise: e.target.value })}
                          placeholder="아이가 말한 약속"
                          aria-label={`${row.name} 이번 주 실천 약속`}
                          className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm md:mt-0"
                        />
                      </label>
                      <p className="mt-2 text-sm leading-6 text-slate-600 md:mt-0">
                        <span className="text-xs font-black text-slate-500 md:hidden">지난주 약속 </span>
                        {lastPromise ?? <span className="text-slate-400">-</span>}
                      </p>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !ready || rows.length === 0}
          className="min-h-[44px] rounded-xl bg-emerald-700 px-6 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-50"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
        {message && (
          <p role="status" className={`text-sm font-bold ${message.kind === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>
            {message.text}
          </p>
        )}
      </div>
      {curriculumLine === undefined && withPromise && (
        <p className="mt-3 text-xs text-slate-500">이번 주 진도표가 아직 없습니다.</p>
      )}
    </div>
  );
}

export default function SchoolClassPage() {
  const { user, member, loading, isPastor, isMember } = useNextGenerationAuth();
  const [searchParams] = useSearchParams();
  const catalog = useSundaySchoolCatalog();
  const allowed = canUseClassScreen({ isPastor, isMember, isTeacher: hasDepartment(member, '교사') });

  const defaultSundayKey = useMemo(() => getActiveSundayKey(), []);
  const overrideKey = isPastor ? sundayKeyFromDateParam(searchParams.get('date')) : null;
  const sundayKey = overrideKey || defaultSundayKey;

  const classIds = useMemo(() => manageableClassIds(isPastor, member?.groupIds), [isPastor, member?.groupIds]);
  const [picked, setPicked] = useState<SchoolClassId | null>(null);
  const classId = picked && classIds.includes(picked) ? picked : classIds[0];

  const info = useMemo(() => getWeekCurriculumInfo(catalog.curriculum, sundayKey), [catalog.curriculum, sundayKey]);
  const memoryTarget = useMemo(
    () => (classId ? getMemoryCheckTarget(catalog.curriculum, sundayKey, classId) : undefined),
    [catalog.curriculum, sundayKey, classId],
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
      </div>
    );
  }
  if (!user || !allowed) return <Navigate to={SCHOOL_PATH} replace />;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-black text-emerald-950">반 관리</h1>
      <p className="mt-1 text-sm font-bold text-slate-600">
        {sundayKey} 주일{info.line ? ` · ${info.line}` : ''}
      </p>

      {classIds.length === 0 || !classId ? (
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
          아직 맡은 반이 없습니다. 교역자가 반을 배정하면 이곳에 보입니다.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2 border-b border-[#DADFDD]" role="tablist" aria-label="반 선택">
            {classIds.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={id === classId}
                onClick={() => setPicked(id)}
                className={`min-h-[44px] px-3 text-sm font-black transition ${
                  id === classId ? CLASS_COLORS[id].active : CLASS_COLORS[id].idle
                }`}
              >
                {SCHOOL_CLASS_NAMES[id]}
              </button>
            ))}
          </div>
          <ClassBoard
            classId={classId}
            sundayKey={sundayKey}
            uid={user.uid}
            curriculumLine={info.line}
            promiseExamples={info.promiseExamples}
            memoryTarget={memoryTarget}
          />
        </>
      )}
    </main>
  );
}
