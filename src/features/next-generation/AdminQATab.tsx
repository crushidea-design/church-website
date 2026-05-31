// Q&A tab body extracted from NextGenerationAdmin.tsx.
import React from 'react';
import { ChevronDown, ChevronUp, MessageSquare, Trash2 } from 'lucide-react';
import {
  QADepartment,
  QAItem,
  QA_DEPARTMENT_BADGE,
  QA_DEPARTMENT_LABEL,
  formatAdminDate as formatDate,
} from './adminHelpers';

export default function AdminQATab({
  qaItems,
  qaFilter,
  qaBackfilling,
  expandedId,
  onFilterChange,
  onToggleExpand,
  onBackfillDepartments,
  onBackfillPrivacy,
  onOpenAnswer,
  onDelete,
}: {
  qaItems: QAItem[];
  qaFilter: 'all' | QADepartment;
  qaBackfilling: boolean;
  expandedId: string | null;
  onFilterChange: (next: 'all' | QADepartment) => void;
  onToggleExpand: (id: string | null) => void;
  onBackfillDepartments: () => void;
  onBackfillPrivacy: () => void;
  onOpenAnswer: (id: string, currentAnswer: string) => void;
  onDelete: (id: string) => void;
}) {
  const filteredQa = qaItems.filter((item) => {
    const dept = (item.department ?? 'young-adults') as QADepartment;
    return qaFilter === 'all' ? true : dept === qaFilter;
  });
  const legacyDeptCount = qaItems.filter((item) => !item.department).length;
  const legacyPrivacyCount = qaItems.filter((item) => typeof item.isPrivate !== 'boolean').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {([
            { id: 'all', label: '전체' },
            { id: 'elementary', label: '유초등부' },
            { id: 'young-adults', label: '청년부' },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onFilterChange(opt.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${
                qaFilter === opt.id
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <span className="ml-2 text-xs text-gray-500">{filteredQa.length}건</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {legacyDeptCount > 0 && (
            <button
              type="button"
              disabled={qaBackfilling}
              onClick={onBackfillDepartments}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-50"
            >
              {qaBackfilling ? '보정 중...' : `부서 미지정 ${legacyDeptCount}건 → 청년부로 보정`}
            </button>
          )}
          {legacyPrivacyCount > 0 && (
            <button
              type="button"
              disabled={qaBackfilling}
              onClick={onBackfillPrivacy}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50"
              title="이 보정을 실행해야 일반 회원이 기존 질문을 볼 수 있습니다."
            >
              {qaBackfilling ? '보정 중...' : `공개 미지정 ${legacyPrivacyCount}건 → 공개로 보정`}
            </button>
          )}
        </div>
      </div>
      {filteredQa.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <MessageSquare size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">조건에 맞는 질문이 없습니다.</p>
        </div>
      )}
      {filteredQa.map((item) => {
        const isExpanded = expandedId === item.id;
        const dept = (item.department ?? 'young-adults') as QADepartment;
        return (
          <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => onToggleExpand(isExpanded ? null : item.id)}
              className="w-full flex items-start gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${QA_DEPARTMENT_BADGE[dept]}`}>
                    {QA_DEPARTMENT_LABEL[dept]}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    item.isAnswered ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {item.isAnswered ? '답변완료' : '미답변'}
                  </span>
                  {item.isPrivate && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium border border-amber-200 bg-amber-50 text-amber-800">
                      비공개
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {item.authorName} · {formatDate(item.createdAt)}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
              </div>
              {isExpanded ? (
                <ChevronUp size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
              ) : (
                <ChevronDown size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
              )}
            </button>

            {isExpanded && (
              <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">질문</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.content}</p>
                </div>
                {item.isAnswered && item.answer && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-amber-600 mb-1">
                      목사님 답변 ({formatDate(item.answeredAt)})
                    </p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.answer}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => onOpenAnswer(item.id, item.answer || '')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm rounded-lg transition-colors"
                  >
                    <MessageSquare size={14} /> {item.isAnswered ? '답변 수정' : '답변하기'}
                  </button>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-lg transition-colors ml-auto"
                  >
                    <Trash2 size={14} /> 삭제
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
