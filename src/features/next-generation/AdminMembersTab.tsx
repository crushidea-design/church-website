// Members tab body extracted from NextGenerationAdmin.tsx. Includes
// the per-member row card; all data and callbacks flow in via props.
import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import { Department, NextGenerationMember, NEXT_GENERATION_DEPARTMENTS } from '../../lib/nextGenerationAuth';
import { getMemberDepartments, getPrimaryDepartment } from '../../lib/nextGenerationRoles';
import {
  AdminTab,
  DEPT_COLORS,
  NEXT_NOTIFICATION_TARGETS,
  NOTIFICATION_DEPARTMENT_OPTIONS,
  StatusRow,
  formatAdminDate as formatDate,
} from './adminHelpers';

export type SystemHealth = {
  ok: boolean;
  adminInitialized: boolean;
  messagingAvailable: boolean;
  firestoreReachable: boolean;
  activeTokenCount: number;
  error?: string;
};

type NotificationAudience = 'all' | Department[];

function MemberRow({
  m,
  expandedId,
  submitting,
  onToggleExpand,
  onApprove,
  onOpenReject,
  onToggleAdmin,
  onUpdateRoles,
  onDelete,
}: {
  m: NextGenerationMember;
  expandedId: string | null;
  submitting: boolean;
  onToggleExpand: (id: string | null) => void;
  onApprove: (uid: string) => void;
  onOpenReject: (uid: string) => void;
  onToggleAdmin: (m: NextGenerationMember) => void;
  onUpdateRoles: (member: NextGenerationMember, departments: Department[], primaryDepartment: Department) => void;
  onDelete: (uid: string) => void;
}) {
  const isExpanded = expandedId === m.uid;
  const primaryDepartment = getPrimaryDepartment(m);
  const departments = getMemberDepartments(m);
  const [draftDepartments, setDraftDepartments] = useState<Department[]>(departments);
  const [draftPrimaryDepartment, setDraftPrimaryDepartment] = useState<Department>(primaryDepartment);

  useEffect(() => {
    setDraftDepartments(departments);
    setDraftPrimaryDepartment(primaryDepartment);
  }, [m.uid, departments.join('|'), primaryDepartment]);

  const toggleDraftDepartment = (department: Department) => {
    setDraftDepartments((current) => {
      if (current.includes(department)) {
        if (current.length === 1) return current;
        const next = current.filter((item) => item !== department);
        if (!next.includes(draftPrimaryDepartment)) {
          setDraftPrimaryDepartment(next[0]);
        }
        return next;
      }
      return [...current, department];
    });
  };

  const roleChanged =
    draftPrimaryDepartment !== primaryDepartment ||
    draftDepartments.length !== departments.length ||
    draftDepartments.some((department) => !departments.includes(department));

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-2">
      <button
        onClick={() => onToggleExpand(isExpanded ? null : m.uid)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 text-sm">{m.displayName}</span>
            {departments.map((department) => (
              <span
                key={department}
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${DEPT_COLORS[department]} ${
                  department === primaryDepartment ? 'ring-2 ring-offset-1 ring-amber-300' : ''
                }`}
                title={department === primaryDepartment ? '대표 역할' : undefined}
              >
                {department}
              </span>
            ))}
            {m.role === 'pending' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">대기중</span>
            )}
            {m.role === 'member' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">승인</span>
            )}
            {m.isNextGenerationAdmin && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-900 text-white font-medium">
                <ShieldCheck size={11} /> 관리자
              </span>
            )}
            {m.role === 'rejected' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">반려</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {m.email} · {m.church} · {formatDate(m.createdAt)}
          </p>
        </div>
        {isExpanded ? (
          <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-3">
          {m.intro && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">자기소개</p>
              <p className="text-sm text-gray-700">{m.intro}</p>
            </div>
          )}
          {m.role === 'rejected' && m.rejectionReason && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">반려 사유</p>
              <p className="text-sm text-red-600">{m.rejectionReason}</p>
            </div>
          )}
          <div className="rounded-lg border border-amber-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-amber-800">역할 수정</p>
                <p className="mt-0.5 text-[11px] leading-4 text-gray-500">
                  기존 회원도 여러 역할을 가질 수 있습니다. 대표 역할은 화면에서 가장 먼저 보입니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onUpdateRoles(m, draftDepartments, draftPrimaryDepartment)}
                disabled={submitting || !roleChanged}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                저장
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {NEXT_GENERATION_DEPARTMENTS.map((department) => (
                <label
                  key={department}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
                    draftDepartments.includes(department)
                      ? 'border-amber-300 bg-amber-50 text-amber-900'
                      : 'border-gray-200 bg-gray-50 text-gray-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={draftDepartments.includes(department)}
                    onChange={() => toggleDraftDepartment(department)}
                    className="h-3.5 w-3.5 rounded border-amber-300 text-amber-600 focus:ring-amber-400"
                  />
                  {department}
                </label>
              ))}
            </div>
            <label className="mt-3 block text-xs font-bold text-gray-600">
              대표 역할
              <select
                value={draftPrimaryDepartment}
                onChange={(e) => setDraftPrimaryDepartment(e.target.value as Department)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {draftDepartments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex gap-2 flex-wrap">
            {m.role === 'pending' && (
              <>
                <button
                  onClick={() => onApprove(m.uid)}
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-lg transition-colors disabled:opacity-60"
                >
                  <CheckCircle size={14} /> 승인
                </button>
                <button
                  onClick={() => onOpenReject(m.uid)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
                >
                  <XCircle size={14} /> 반려
                </button>
              </>
            )}
            {m.role === 'rejected' && (
              <button
                onClick={() => onApprove(m.uid)}
                disabled={submitting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-lg transition-colors disabled:opacity-60"
              >
                <CheckCircle size={14} /> 승인으로 변경
              </button>
            )}
            {m.role === 'member' && (
              <button
                onClick={() => onToggleAdmin(m)}
                disabled={submitting}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-60 ${
                  m.isNextGenerationAdmin
                    ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                <ShieldCheck size={14} />
                {m.isNextGenerationAdmin ? '관리자 해제' : '관리자 부여'}
              </button>
            )}
            <button
              onClick={() => onDelete(m.uid)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-lg transition-colors ml-auto"
            >
              <Trash2 size={14} /> 삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminMembersTab({
  search,
  onSearchChange,
  systemHealth,
  checkingHealth,
  onCheckHealth,
  notificationAudience,
  notificationAudienceCount,
  onSetAudienceAll,
  onToggleAudienceDepartment,
  notificationTitle,
  onNotificationTitleChange,
  notificationBody,
  onNotificationBodyChange,
  notificationTargetUrl,
  onNotificationTargetUrlChange,
  sendingNotification,
  onSendNotification,
  pendingMembers,
  approvedMembers,
  rejectedMembers,
  filteredMembers,
  members,
  expandedId,
  submitting,
  onTabChange,
  onToggleExpand,
  onApproveMember,
  onOpenReject,
  onToggleAdmin,
  onUpdateMemberRoles,
  onDeleteMember,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  systemHealth: SystemHealth | null;
  checkingHealth: boolean;
  onCheckHealth: () => void;
  notificationAudience: NotificationAudience;
  notificationAudienceCount: number;
  onSetAudienceAll: (all: boolean) => void;
  onToggleAudienceDepartment: (dept: Department) => void;
  notificationTitle: string;
  onNotificationTitleChange: (value: string) => void;
  notificationBody: string;
  onNotificationBodyChange: (value: string) => void;
  notificationTargetUrl: string;
  onNotificationTargetUrlChange: (value: string) => void;
  sendingNotification: boolean;
  onSendNotification: () => void;
  pendingMembers: NextGenerationMember[];
  approvedMembers: NextGenerationMember[];
  rejectedMembers: NextGenerationMember[];
  filteredMembers: NextGenerationMember[];
  members: NextGenerationMember[];
  expandedId: string | null;
  submitting: boolean;
  onTabChange: (tab: AdminTab) => void;
  onToggleExpand: (id: string | null) => void;
  onApproveMember: (uid: string) => void;
  onOpenReject: (uid: string) => void;
  onToggleAdmin: (m: NextGenerationMember) => void;
  onUpdateMemberRoles: (member: NextGenerationMember, departments: Department[], primaryDepartment: Department) => void;
  onDeleteMember: (uid: string) => void;
}) {
  const memberRowProps = {
    expandedId,
    submitting,
    onToggleExpand,
    onApprove: onApproveMember,
    onOpenReject,
    onToggleAdmin,
    onUpdateRoles: onUpdateMemberRoles,
    onDelete: onDeleteMember,
  };

  return (
    <div>
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="pr-2">
            <p className="text-sm font-semibold text-amber-900">학생 성경 읽기 기록표</p>
            <p className="mt-1 text-xs leading-5 text-amber-800">
              학생별 성경 읽기 기록표를 열어 읽은 책을 바로 색칠하거나 해제할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onTabChange('bibleReading')}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
          >
            <BookOpen size={14} />
            기록표 열기
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="이름, 이메일, 교회 검색"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      {/* 알림 시스템 상태 */}
      <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <ShieldCheck size={13} />
            알림 시스템 상태
          </p>
          <button
            type="button"
            onClick={onCheckHealth}
            disabled={checkingHealth}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={11} className={checkingHealth ? 'animate-spin' : ''} />
            {checkingHealth ? '확인 중...' : '상태 확인'}
          </button>
        </div>
        {!systemHealth && !checkingHealth && (
          <p className="mt-2 text-xs text-gray-400">"상태 확인" 버튼을 눌러 Firebase 연결 상태를 확인하세요.</p>
        )}
        {systemHealth && (
          <div className="mt-2 space-y-1">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <StatusRow ok={systemHealth.adminInitialized} label="Firebase Admin" />
              <StatusRow ok={systemHealth.messagingAvailable} label="FCM 메시징" />
              <StatusRow ok={systemHealth.firestoreReachable} label="Firestore" />
              <span className="text-gray-600">
                활성 토큰 <strong>{systemHealth.activeTokenCount}</strong>개 (최근 30일)
              </span>
            </div>
            {systemHealth.error && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle size={11} /> {systemHealth.error}
              </p>
            )}
            {systemHealth.ok && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 size={11} /> 모든 시스템 정상
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="mb-3 flex items-start gap-2">
          <Bell size={16} className="mt-0.5 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900">다음세대 푸시 알림 보내기</p>
            <p className="mt-1 text-xs leading-5 text-amber-800">
              여기서 보낸 알림은 다음세대 앱에서 알림을 허용한 사용자에게만 전달되고, 누르면 아래에서 정한 `/next` 경로로 이동합니다.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-sm text-gray-800">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationAudience === 'all'}
                  onChange={(e) => onSetAudienceAll(e.target.checked)}
                  className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-400"
                />
                <span className="font-medium">전체 회원</span>
              </label>
              <span className="text-amber-300">|</span>
              {NOTIFICATION_DEPARTMENT_OPTIONS.map((dept) => {
                const checked =
                  notificationAudience !== 'all' && notificationAudience.includes(dept);
                return (
                  <label key={dept} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={notificationAudience === 'all'}
                      onChange={() => onToggleAudienceDepartment(dept)}
                      className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-400 disabled:opacity-40"
                    />
                    <span className={notificationAudience === 'all' ? 'text-gray-400' : ''}>{dept}</span>
                  </label>
                );
              })}
              <span className="ml-auto text-xs text-gray-600">
                현재 대상 {notificationAudienceCount}명
              </span>
            </div>
          </div>
          <input
            type="text"
            value={notificationTitle}
            onChange={(e) => onNotificationTitleChange(e.target.value)}
            placeholder="알림 제목"
            className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <textarea
            value={notificationBody}
            onChange={(e) => onNotificationBodyChange(e.target.value)}
            rows={3}
            placeholder="알림 내용"
            className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
          />
          <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
            <select
              value={
                NEXT_NOTIFICATION_TARGETS.some((entry) => entry.value === notificationTargetUrl)
                  ? notificationTargetUrl
                  : '__custom__'
              }
              onChange={(e) => {
                if (e.target.value !== '__custom__') {
                  onNotificationTargetUrlChange(e.target.value);
                }
              }}
              className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {NEXT_NOTIFICATION_TARGETS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
              <option value="__custom__">직접 입력</option>
            </select>
            <input
              type="text"
              value={notificationTargetUrl}
              onChange={(e) => onNotificationTargetUrlChange(e.target.value)}
              placeholder="/next/elementary"
              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-amber-700">예: `/next`, `/next/young-adults`, `/next/post/문서ID`</p>
            <button
              type="button"
              onClick={onSendNotification}
              disabled={sendingNotification}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
            >
              <Bell size={14} />
              {sendingNotification ? '보내는 중...' : '다음세대 알림 보내기'}
            </button>
          </div>
        </div>
      </div>

      {pendingMembers.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Clock size={12} /> 승인 대기 ({pendingMembers.length})
          </p>
          {(search ? filteredMembers.filter((m) => m.role === 'pending') : pendingMembers).map((m) => (
            <MemberRow key={m.uid} m={m} {...memberRowProps} />
          ))}
        </div>
      )}

      {approvedMembers.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2 flex items-center gap-1">
            <CheckCircle size={12} /> 승인된 회원 ({approvedMembers.length})
          </p>
          {(search ? filteredMembers.filter((m) => m.role === 'member') : approvedMembers).map((m) => (
            <MemberRow key={m.uid} m={m} {...memberRowProps} />
          ))}
        </div>
      )}

      {rejectedMembers.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2 flex items-center gap-1">
            <XCircle size={12} /> 반려된 신청 ({rejectedMembers.length})
          </p>
          {(search ? filteredMembers.filter((m) => m.role === 'rejected') : rejectedMembers).map((m) => (
            <MemberRow key={m.uid} m={m} {...memberRowProps} />
          ))}
        </div>
      )}

      {members.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Users size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">가입 신청이 없습니다.</p>
        </div>
      )}
    </div>
  );
}
