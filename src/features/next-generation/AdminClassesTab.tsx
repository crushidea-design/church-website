// Classes tab body extracted from NextGenerationAdmin.tsx. Shows the
// teacher-facing class dashboard, attendance grid, and per-student
// reading/QA stats.
import React from 'react';
import { MessageSquare, Search } from 'lucide-react';
import {
  ClassDashboardGroup,
  ClassDashboardSummary,
} from '../../lib/nextGenerationClassDashboard';
import { formatActivityDate } from './adminHelpers';

export default function AdminClassesTab({
  classDashboard,
  filteredClassGroups,
  classSearch,
  classGroupFilter,
  attendanceDrafts,
  savingAttendanceGroup,
  onSearchChange,
  onGroupFilterChange,
  onSaveAttendance,
  getAttendanceChecked,
  setAttendanceDraft,
}: {
  classDashboard: ClassDashboardSummary;
  filteredClassGroups: ClassDashboardGroup[];
  classSearch: string;
  classGroupFilter: string;
  attendanceDrafts: Record<string, boolean | undefined>;
  savingAttendanceGroup: string | null;
  onSearchChange: (value: string) => void;
  onGroupFilterChange: (value: string) => void;
  onSaveAttendance: (group: ClassDashboardGroup) => void;
  getAttendanceChecked: (uid: string, fallback: boolean) => boolean;
  setAttendanceDraft: (uid: string, checked: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-900">교사용 반별 관리 대시보드</p>
            <p className="mt-1 text-xs leading-5 text-emerald-800">
              승인된 학생을 반별로 묶고 성경읽기, 질문, 미답변 상태를 한눈에 확인합니다.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-lg bg-white px-3 py-2 text-center shadow-sm">
              <p className="font-bold text-slate-400">학생</p>
              <p className="mt-1 text-lg font-black text-emerald-900">{classDashboard.totalStudents}</p>
            </div>
            <div className="rounded-lg bg-white px-3 py-2 text-center shadow-sm">
              <p className="font-bold text-slate-400">완료 권수</p>
              <p className="mt-1 text-lg font-black text-emerald-900">{classDashboard.totalCompletedBooks}</p>
            </div>
            <div className="rounded-lg bg-white px-3 py-2 text-center shadow-sm">
              <p className="font-bold text-slate-400">질문</p>
              <p className="mt-1 text-lg font-black text-emerald-900">{classDashboard.totalQuestions}</p>
            </div>
            <div className="rounded-lg bg-white px-3 py-2 text-center shadow-sm">
              <p className="font-bold text-slate-400">미답변</p>
              <p className="mt-1 text-lg font-black text-amber-700">{classDashboard.totalUnansweredQuestions}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-2 text-xs sm:grid-cols-4">
        <div className="rounded-xl border border-sky-100 bg-white px-3 py-3 text-center shadow-sm">
          <p className="font-bold text-slate-400">이번 주 출석</p>
          <p className="mt-1 text-lg font-black text-sky-700">{classDashboard.currentPresentCount}</p>
        </div>
        <div className="rounded-xl border border-rose-100 bg-white px-3 py-3 text-center shadow-sm">
          <p className="font-bold text-slate-400">이번 주 미출석</p>
          <p className="mt-1 text-lg font-black text-rose-700">{classDashboard.currentAbsentCount}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-white px-3 py-3 text-center shadow-sm">
          <p className="font-bold text-slate-400">미체크</p>
          <p className="mt-1 text-lg font-black text-amber-700">{classDashboard.currentUncheckedCount}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-white px-3 py-3 text-center shadow-sm">
          <p className="font-bold text-slate-400">최근 4주 출석률</p>
          <p className="mt-1 text-lg font-black text-emerald-700">{classDashboard.recentAttendancePercent}%</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={classSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="학생 이름, 이메일, 교회 검색"
            className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <select
          value={classGroupFilter}
          onChange={(e) => onGroupFilterChange(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <option value="all">전체 반</option>
          {classDashboard.groups.map((group) => (
            <option key={group.groupId} value={group.groupId}>
              {group.groupLabel} ({group.students.length})
            </option>
          ))}
        </select>
      </div>

      {filteredClassGroups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">
          조건에 맞는 승인 학생이 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredClassGroups.map((group) => (
            <section key={group.groupId} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-black text-emerald-950">{group.groupLabel}</h3>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    이번 주 출석 {group.currentPresentCount}명 · 미출석 {group.currentAbsentCount}명 · 미체크 {group.currentUncheckedCount}명 · 최근 4주 {group.recentAttendancePercent}%
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    학생 {group.students.length}명 · 완료 {group.totalCompletedBooks}권 · 미답변 {group.totalUnansweredQuestions}개
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSaveAttendance(group)}
                  disabled={savingAttendanceGroup === group.groupId || group.students.length === 0}
                  className="inline-flex shrink-0 items-center justify-center rounded-lg bg-sky-600 px-3 py-2 text-xs font-black text-white transition hover:bg-sky-700 disabled:opacity-60"
                >
                  {savingAttendanceGroup === group.groupId ? '저장 중...' : '출석 저장'}
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {group.students.map((student) => (
                  <div key={student.uid} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1.2fr)_120px_120px_120px_90px] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-black text-slate-900">{student.displayName || '이름 없음'}</p>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                          {student.groupLabel}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs font-medium text-slate-500">
                        {student.email || '-'} · {student.church || '-'}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                        <span>성경읽기</span>
                        <span>{student.completedBooks}/66</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-emerald-500"
                          style={{ width: `${student.readingPercent}%` }}
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={getAttendanceChecked(student.uid, student.currentAttendanceStatus === 'present')}
                        onChange={(event) => setAttendanceDraft(student.uid, event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400"
                      />
                      <span>
                        {getAttendanceChecked(student.uid, student.currentAttendanceStatus === 'present') ? '출석' : '미출석'}
                        {student.currentAttendanceStatus === 'unchecked' && attendanceDrafts[student.uid] === undefined
                          ? ' (미체크)'
                          : ''}
                      </span>
                    </label>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600 sm:justify-center">
                      <MessageSquare size={14} className="text-amber-500" />
                      질문 {student.questionCount}
                      {student.unansweredQuestionCount > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                          미답변 {student.unansweredQuestionCount}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-500 sm:text-right">
                      최근 {formatActivityDate(student.lastActivityMillis)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
