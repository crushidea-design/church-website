// One child's journey for one week: four steps, stamp rows, promise, memory, fruit.
import React, { useEffect, useMemo, useState } from 'react';
import WordFruitTree from '../../word-fruit/WordFruitTree';
import type { AttendanceDoc } from '../../word-fruit/attendanceApi';
import { SCHOOL_CLASS_NAMES } from '../classScreen';
import { findWeekMemoryEntry, getMemoryLines } from '../memory';
import type { CurriculumEntry, SchoolWeeklyDoc } from '../types';
import StampRow from './StampRow';
import {
  FRUIT_MESSAGES,
  JOURNEY_STATE_LABELS,
  SEED_PRACTICE_TEXT,
  buildJourneySteps,
  buildLastWeekSummary,
  canCheckStep,
  cleanDates,
  extraDayCount,
  formatPracticeSummary,
  formatWorshipSummary,
  fruitStageFromSteps,
  isWeekOpen,
  nextWeekKey,
  practiceChecker,
  previousWeekKey,
} from './journey';
import type { JourneyStepState } from './journey';
import {
  saveJourneyDate,
  subscribeAttendanceForStudentWeek,
  subscribeJourneyForStudent,
  subscribeWeeklyForStudent,
} from './journeyApi';
import type { SchoolJourneyDoc } from './journeyApi';
import type { JourneyChild } from './useJourneyChildren';

const STATE_STYLES: Record<JourneyStepState, string> = {
  done: 'bg-emerald-100 text-emerald-800',
  active: 'bg-amber-100 text-amber-800',
  waiting: 'bg-slate-100 text-slate-600',
};

const STEP_HINTS: Record<string, string> = {
  learn: '주일 공과 시간에 함께 배워요. 교사가 출석을 확인하면 채워져요.',
  worship: '가정예배지로 가정예배를 드린 날을 눌러 주세요. 여러 날 드려도 좋아요.',
  practice: '약속한 실천을 한 날을 눌러 주세요. 여러 날 해도 좋아요.',
  memory: '다음 주일에 교사가 함께 확인해요.',
};

export default function JourneyChildCard({
  child,
  weekKey,
  todayKey,
  uid,
  curriculum,
  weekLine,
}: {
  child: JourneyChild;
  weekKey: string;
  todayKey: string;
  uid: string;
  curriculum: CurriculumEntry[];
  weekLine?: string;
}) {
  const classId = child.classId;
  const [journey, setJourney] = useState<SchoolJourneyDoc | null>(null);
  const [attendance, setAttendance] = useState<AttendanceDoc[]>([]);
  const [weekly, setWeekly] = useState<SchoolWeeklyDoc[]>([]);
  const [lastJourney, setLastJourney] = useState<SchoolJourneyDoc | null>(null);
  const [lastAttendance, setLastAttendance] = useState<AttendanceDoc[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const followingKey = nextWeekKey(weekKey);
  const lastKey = previousWeekKey(weekKey);

  useEffect(() => {
    setJourney(null);
    setAttendance([]);
    setWeekly([]);
    setLastJourney(null);
    setLastAttendance([]);
    if (!classId) return;
    const unsubs = [
      subscribeJourneyForStudent(child.uid, weekKey, (rows) => setJourney(rows[0] ?? null)),
      subscribeAttendanceForStudentWeek(child.uid, weekKey, setAttendance),
      subscribeWeeklyForStudent(child.uid, [lastKey, weekKey, followingKey], setWeekly),
      // Last week's journey stays visible: its memory check is recorded on this week's weekly record.
      subscribeJourneyForStudent(child.uid, lastKey, (rows) => setLastJourney(rows[0] ?? null)),
      subscribeAttendanceForStudentWeek(child.uid, lastKey, setLastAttendance),
    ];
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [child.uid, classId, weekKey, followingKey, lastKey]);

  const worshipDates = useMemo(() => cleanDates(journey?.familyWorshipDates, weekKey), [journey, weekKey]);
  const practiceDates = useMemo(() => cleanDates(journey?.practiceDates, weekKey), [journey, weekKey]);

  if (!classId) {
    return (
      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-lg font-black text-emerald-950">{child.name}</h3>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
          아직 반이 정해지지 않았어요. 교역자가 반을 배정하면 여정이 시작됩니다.
        </p>
      </article>
    );
  }

  const thisWeekly = weekly.find((row) => row.weekKey === weekKey);
  const nextWeekly = weekly.find((row) => row.weekKey === followingKey);
  const promise = thisWeekly?.promise?.trim() || undefined;
  const present = attendance.some((row) => row.present);
  const weekOpen = isWeekOpen(weekKey, todayKey);

  const lastSummary = buildLastWeekSummary({
    classId,
    present: lastAttendance.some((row) => row.present),
    worshipDates: cleanDates(lastJourney?.familyWorshipDates, lastKey),
    practiceDates: cleanDates(lastJourney?.practiceDates, lastKey),
    promise: weekly.find((row) => row.weekKey === lastKey)?.promise?.trim() || undefined,
    memoryChecked: !!thisWeekly?.memoryChecked,
  });

  const steps = buildJourneySteps({
    classId,
    present,
    worshipDates,
    practiceDates,
    promise,
    memoryChecked: !!nextWeekly?.memoryChecked,
    weekOpen,
  });
  const stage = fruitStageFromSteps(steps);
  const extra = extraDayCount(worshipDates.length, practiceDates.length);

  const memoryEntry = findWeekMemoryEntry(curriculum, weekKey);
  const memoryLine = getMemoryLines(memoryEntry, classId)[0];
  const memoryQuestion = memoryEntry?.memory?.question;

  const canWorship = canCheckStep({ step: 'worship', classId, viewer: child.viewer });
  const practiceAllowed = canCheckStep({ step: 'practice', classId, viewer: child.viewer, isProxyChild: child.isProxy });
  const practiceReady = classId === 'seed' || !!promise;
  const practiceWho = child.isProxy ? '부모님' : practiceChecker(classId) === 'parent' ? '부모님' : '학생 본인';

  const toggle = async (kind: 'worship' | 'practice', date: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const current = kind === 'worship' ? worshipDates : practiceDates;
      await saveJourneyDate({
        weekKey,
        studentUid: child.uid,
        studentName: child.name,
        classId,
        kind,
        date,
        checked: !current.includes(date),
        updatedBy: uid,
      });
    } catch {
      console.error('Failed to save the journey stamp');
      setError('저장하지 못했어요. 잠시 뒤에 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-black text-emerald-950">{child.name}</h3>
          <p className="mt-0.5 text-xs font-bold text-slate-500">{SCHOOL_CLASS_NAMES[classId]}</p>
          {weekLine && <p className="mt-2 text-sm font-black leading-6 text-emerald-900">{weekLine}</p>}
        </div>
        <div className="w-24 shrink-0 sm:w-28">
          <WordFruitTree stage={stage} fruitName={`${child.name}의 이번 주 열매`} />
        </div>
      </div>
      <p className="mt-1 text-sm font-bold text-emerald-800">{FRUIT_MESSAGES[stage]}</p>
      {extra > 0 && <p className="text-xs font-bold text-slate-500">더 드린 날과 실천한 날만큼 열매가 풍성해요.</p>}

      <ol className="mt-4 space-y-2">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-emerald-800">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-slate-900">{step.label}</p>
              <p className="text-xs leading-5 text-slate-500">{STEP_HINTS[step.id]}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${STATE_STYLES[step.state]}`}>
              {JOURNEY_STATE_LABELS[step.state]}
            </span>
          </li>
        ))}
      </ol>

      <section className="mt-4">
        <h4 className="text-sm font-black text-emerald-950">가정예배</h4>
        <p className="mt-0.5 text-xs font-bold text-slate-500">{formatWorshipSummary(worshipDates.length)}</p>
        <div className="mt-2">
          <StampRow
            label="가정예배"
            weekKey={weekKey}
            todayKey={todayKey}
            checkedDates={worshipDates}
            canEdit={canWorship}
            busy={busy}
            onToggle={(date) => toggle('worship', date)}
          />
        </div>
        {!canWorship && <p className="mt-1 text-xs text-slate-500">가정예배는 부모님이 체크해요.</p>}
      </section>

      <section className="mt-4">
        <h4 className="text-sm font-black text-emerald-950">실천</h4>
        <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold leading-6 text-amber-950">
          {classId === 'seed' ? SEED_PRACTICE_TEXT : (promise ?? '교사가 이번 주 실천 약속을 적어 주면 시작해요.')}
        </p>
        <p className="mt-1 text-xs font-bold text-slate-500">{formatPracticeSummary(practiceDates.length)}</p>
        <div className="mt-2">
          <StampRow
            label="실천"
            weekKey={weekKey}
            todayKey={todayKey}
            checkedDates={practiceDates}
            canEdit={practiceAllowed && practiceReady}
            busy={busy}
            onToggle={(date) => toggle('practice', date)}
          />
        </div>
        {!practiceAllowed && <p className="mt-1 text-xs text-slate-500">실천은 {practiceWho}이 체크해요. 옆에서 응원해 주세요.</p>}
      </section>

      {classId !== 'seed' && (
        <section className="mt-4">
          <h4 className="text-sm font-black text-emerald-950">
            이번 주 암송{memoryQuestion !== undefined ? ` (${memoryQuestion}문)` : ''}
          </h4>
          <p className="mt-1 whitespace-pre-line rounded-lg bg-emerald-50 px-3 py-2 text-sm leading-6 text-emerald-950">
            {memoryLine?.text ?? '이번 주 암송 문구는 준비 중이에요.'}
          </p>
        </section>
      )}

      {lastSummary.hasRecord && (
        <section className="mt-4 rounded-xl bg-slate-50 px-3 py-2" aria-label="지난주 여정">
          <h4 className="text-xs font-black text-slate-700">
            지난주 여정 ({lastKey}) · {lastSummary.completed ? '열매를 맺었어요' : '열매가 익어 가는 중이에요'}
          </h4>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {lastSummary.steps.map((step) => (
              <li key={step.id} className={`rounded-full px-2.5 py-1 text-xs font-black ${STATE_STYLES[step.state]}`}>
                {step.label} {JOURNEY_STATE_LABELS[step.state]}
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
          {error}
        </p>
      )}
    </article>
  );
}
