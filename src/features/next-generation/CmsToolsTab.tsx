// Tools tab body extracted from AdminNextGenerationCms.tsx.
import React from 'react';
import { ExternalLink, Wrench } from 'lucide-react';
import {
  PROTECTED_NEXT_GEN_DEPARTMENT_SLUGS,
  PROTECTED_NEXT_GEN_TAB_SLUGS,
} from '../../lib/nextGenerationCms';
import { NextGenerationPostSummary } from './cmsAdminHelpers';

export default function CmsToolsTab({
  toolsBusy,
  toolsResult,
  orphanPosts,
  onNormalize,
  onBackfill,
  onDetectOrphans,
}: {
  toolsBusy: string | null;
  toolsResult: string | null;
  orphanPosts: NextGenerationPostSummary[];
  onNormalize: () => void;
  onBackfill: () => void;
  onDetectOrphans: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-wood-200 bg-white p-5">
        <h3 className="flex items-center gap-2 text-lg font-bold text-wood-900">
          <Wrench size={16} />
          운영 도구
        </h3>
        <p className="mt-1 text-xs leading-5 text-wood-600">
          데이터 정합성 보정과 외부 화면 진입을 한곳에 모았습니다. 변경은 즉시 Firestore에 반영됩니다.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <a
            href="/next"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-wood-300 bg-white px-3 py-3 text-sm font-bold text-wood-800 hover:bg-wood-50"
          >
            <ExternalLink size={14} />
            다음세대 사이트 새 탭에서 열기
          </a>
          <a
            href="/admin/notifications"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-3 py-3 text-sm font-bold text-white hover:bg-orange-500"
          >
            알림 발송 화면
          </a>
          <a
            href="/admin"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-wood-900 px-3 py-3 text-sm font-bold text-white hover:bg-wood-800"
          >
            관리자 대시보드
          </a>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-wood-500">
          회원 가입 승인·반려·문의 답변·푸시 발송은 다음세대 페이지 우상단 "관리" 패널({' '}
          <a href="/next" target="_blank" rel="noreferrer" className="underline">/next</a>)에서 별도 운영합니다.
          여기서는 부서·탭·소개·자료의 데이터 모델만 관리합니다.
        </p>
      </div>

      <div className="rounded-2xl border border-wood-200 bg-white p-5">
        <h4 className="text-base font-bold text-wood-900">데이터 정합성 보정</h4>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <button
            type="button"
            onClick={onNormalize}
            disabled={!!toolsBusy}
            className="rounded-lg bg-emerald-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {toolsBusy === 'normalize' ? '정규화 중...' : '정렬값 1..N으로 정규화'}
          </button>
          <button
            type="button"
            onClick={onBackfill}
            disabled={!!toolsBusy}
            className="rounded-lg bg-indigo-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {toolsBusy === 'backfill' ? '보정 중...' : '소속 부서 누락 자료 추정 보정'}
          </button>
          <button
            type="button"
            onClick={onDetectOrphans}
            disabled={!!toolsBusy}
            className="rounded-lg bg-amber-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {toolsBusy === 'orphans' ? '탐지 중...' : '고아 자료 탐지'}
          </button>
        </div>
        {toolsResult && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
            {toolsResult}
          </div>
        )}
        {orphanPosts.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-bold text-amber-900">
              부서/탭이 CMS에 존재하지 않는 자료 {orphanPosts.length}건:
            </p>
            <ul className="mt-2 max-h-60 overflow-auto text-xs text-amber-900">
              {orphanPosts.map((post) => (
                <li key={post.id} className="border-t border-amber-200 py-1.5 first:border-0">
                  <span className="font-bold">{post.title || '(제목 없음)'}</span>
                  <span className="ml-2 text-amber-700">
                    dept={post.nextGenerationDepartmentSlug || '∅'} / tab=
                    {post.nextGenerationTabSlug || post.subCategory || '∅'}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-amber-700">
              "자료 관리" 탭에서 인라인 셀렉터로 부서/탭을 다시 지정해 주세요.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-wood-200 bg-white p-5 text-sm text-wood-700">
        <h4 className="text-base font-bold text-wood-900">코드에서 직접 참조하는 핵심 슬러그</h4>
        <p className="mt-1 text-xs text-wood-500">
          아래 슬러그들은 다음세대 페이지의 게스트 공개·주간 묶음 로직에 직접 사용되어 변경 시 동작이 깨집니다.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs font-bold text-wood-700">부서 (PROTECTED_NEXT_GEN_DEPARTMENT_SLUGS)</p>
            <ul className="mt-1 text-xs">
              {PROTECTED_NEXT_GEN_DEPARTMENT_SLUGS.map((slug) => (
                <li key={slug} className="font-mono">- {slug}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold text-wood-700">탭 (PROTECTED_NEXT_GEN_TAB_SLUGS)</p>
            <ul className="mt-1 text-xs">
              {PROTECTED_NEXT_GEN_TAB_SLUGS.map((slug) => (
                <li key={slug} className="font-mono">- {slug}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
