// Confirm/answer modals reused by the NextGenerationAdmin page.
import React from 'react';

export function AdminRejectModal({
  open,
  reason,
  submitting,
  onReasonChange,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  reason: string;
  submitting: boolean;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-900 mb-3">가입 신청 반려</h3>
        <p className="text-sm text-gray-600 mb-3">반려 사유를 입력해 주세요. 신청자에게 전달됩니다.</p>
        <textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none mb-4"
          placeholder="반려 사유 (선택)"
        />
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
          >
            반려
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminAnswerModal({
  open,
  answer,
  submitting,
  onAnswerChange,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  answer: string;
  submitting: boolean;
  onAnswerChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="font-bold text-gray-900 mb-3">Q&A 답변</h3>
        <textarea
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          rows={5}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none mb-4"
          placeholder="답변을 입력해 주세요"
        />
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting || !answer.trim()}
            className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
          >
            답변 등록
          </button>
        </div>
      </div>
    </div>
  );
}
