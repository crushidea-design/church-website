// Migration tab body extracted from NextGenerationAdmin.tsx. Receives
// the migration state and the two action callbacks via props.
import React from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { MigrationRow } from './adminHelpers';

export default function AdminMigrationTab({
  migrationRunning,
  migrationScanned,
  migrationRows,
  migrationDone,
  migrationError,
  migrationPending,
  onScan,
  onRun,
}: {
  migrationRunning: boolean;
  migrationScanned: boolean;
  migrationRows: MigrationRow[];
  migrationDone: number;
  migrationError: number;
  migrationPending: number;
  onScan: () => void;
  onRun: () => void;
}) {
  return (
    <div>
      {/* Description */}
      <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-4 mb-4">
        <ShieldCheck size={20} className="text-amber-500 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-amber-800 space-y-1">
          <p className="font-semibold">자료 URL 보안 이전</p>
          <p>이전에 등록된 다음세대 자료 중 PDF/첨부파일 URL이 공개 문서에 저장된 게시물을 찾아, 정회원 전용 보안 저장소로 이전합니다.</p>
          <p className="text-xs text-amber-600">이전 후에는 기존 다운로드 링크가 그대로 유지되며 정회원만 접근 가능해집니다.</p>
        </div>
      </div>

      {/* Step 1: Scan */}
      <div className="mb-4">
        <button
          onClick={onScan}
          disabled={migrationRunning}
          className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
        >
          <Search size={15} />
          이전 대상 게시물 검색
        </button>
      </div>

      {migrationScanned && (
        <>
          {/* Scan result summary */}
          {migrationRows.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700 mb-4">
              <CheckCircle2 size={18} />
              <span>이전이 필요한 게시물이 없습니다. 모두 안전합니다.</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700">
                  이전 대상: <span className="font-bold text-amber-600">{migrationRows.length}개</span>
                  {migrationDone > 0 && (
                    <span className="ml-2 text-emerald-600">✓ 완료 {migrationDone}</span>
                  )}
                  {migrationError > 0 && (
                    <span className="ml-2 text-red-500">✗ 오류 {migrationError}</span>
                  )}
                </p>
                <button
                  onClick={onRun}
                  disabled={migrationRunning || migrationPending === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                >
                  {migrationRunning
                    ? <><RefreshCw size={14} className="animate-spin" /> 이전 중...</>
                    : <><ShieldCheck size={14} /> 일괄 이전 실행</>}
                </button>
              </div>

              {/* Progress bar */}
              {migrationRunning && (
                <div className="mb-3">
                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.round((migrationDone + migrationError) / migrationRows.length * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Row list */}
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {migrationRows.map(row => (
                  <div
                    key={row.postId}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                      row.status === 'done'    ? 'border-emerald-200 bg-emerald-50' :
                      row.status === 'error'   ? 'border-red-200 bg-red-50' :
                      row.status === 'skipped' ? 'border-gray-200 bg-gray-50' :
                                                 'border-gray-200 bg-white'
                    }`}
                  >
                    <span className="flex-shrink-0">
                      {row.status === 'done'    && <CheckCircle2 size={15} className="text-emerald-500" />}
                      {row.status === 'error'   && <AlertTriangle size={15} className="text-red-500" />}
                      {row.status === 'skipped' && <span className="text-gray-400 text-xs">-</span>}
                      {row.status === 'pending' && (
                        migrationRunning
                          ? <RefreshCw size={14} className="animate-spin text-sky-400" />
                          : <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-gray-300" />
                      )}
                    </span>
                    <span className="flex-1 truncate text-gray-800 font-medium">{row.title}</span>
                    <span className="flex-shrink-0 text-xs text-gray-400">
                      {row.status === 'done'    && '완료'}
                      {row.status === 'error'   && (row.error || '오류')}
                      {row.status === 'skipped' && '건너뜀'}
                      {row.status === 'pending' && '대기'}
                    </span>
                  </div>
                ))}
              </div>

              {/* All done message */}
              {!migrationRunning && migrationPending === 0 && migrationDone > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 mt-3 text-sm text-emerald-700">
                  <CheckCircle2 size={16} />
                  <span>이전 완료. 자료 URL이 정회원 전용 저장소로 안전하게 이동되었습니다.</span>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
