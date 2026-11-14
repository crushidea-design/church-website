import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  fetchPostsForInventory,
  fetchUnpublishedPreparationPosts,
  publishPreparationPosts,
  setSundaySchool2027Flag,
} from '../api';
import type { PreparationPostSummary, SundaySchoolCatalog } from '../api';
import { useSundaySchool2027Flag } from '../flags';
import { useNextGenerationCms } from '../../../lib/nextGenerationCms';
import { getNextGenerationTopicLabel } from '../../../lib/nextGenerationTopics';
import { buildPreservationInventory, hasPosts, isSchoolTransitionPost } from './transition';
import type { PreservationInventory } from './transition';
import { cardClass, dangerButtonClass, primaryButtonClass, subtleButtonClass } from './ui';

const CHECKLIST = [
  '1. 백업: Firestore 내보내기를 먼저 해 둡니다.',
  '2. 보존 점검: 아래 "점검하기"로 탭별·주제별 게시물 수를 확인합니다.',
  '3. 비공개 준비 자료를 모두 공개합니다.',
  '4. 주일학교 화면을 켭니다.',
  '5. 모바일에서 메뉴, 주일학교 홈, 이용 안내를 확인합니다.',
  '되돌리기: "주일학교 화면 끄기"만 누르면 기존 유초등부 화면으로 돌아갑니다. 자료는 지워지지 않습니다.',
];

function errorMessage(error: unknown, fallback: string) {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'permission-denied') return '권한이 없습니다. 사이트 관리자 계정으로 로그인했는지 확인해 주세요.';
  return fallback;
}

export default function SundaySchoolTransitionSection({ catalog }: { catalog: SundaySchoolCatalog }) {
  const flag = useSundaySchool2027Flag();
  const { tabs, topics } = useNextGenerationCms();

  const [privatePosts, setPrivatePosts] = useState<PreparationPostSummary[] | null>(null);
  const [privateError, setPrivateError] = useState<string | null>(null);
  const [inventory, setInventory] = useState<PreservationInventory | null>(null);
  const [inventoryNote, setInventoryNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<'inventory' | 'publish' | 'flag' | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const loadPrivate = useCallback(async () => {
    setPrivateError(null);
    try {
      setPrivatePosts(await fetchUnpublishedPreparationPosts());
    } catch (error) {
      console.error('Failed to load unpublished posts', error);
      setPrivateError('비공개 자료 수를 불러오지 못했습니다.');
    }
  }, []);

  useEffect(() => {
    void loadPrivate();
  }, [loadPrivate]);

  // Only Sunday-school material is bulk-published; other private next-generation posts stay untouched.
  const schoolPosts = useMemo(() => (privatePosts ?? []).filter(isSchoolTransitionPost), [privatePosts]);
  const excludedCount = privatePosts ? privatePosts.length - schoolPosts.length : 0;

  const tabName = (id: string) => tabs.find((tab) => (tab.slug || tab.id) === id)?.name ?? id;

  const handleInventory = async () => {
    setBusy('inventory');
    setResult(null);
    setInventoryNote(null);
    try {
      const fetched = await fetchPostsForInventory();
      setInventory(buildPreservationInventory(fetched.published, fetched.unpublished, topics));
      if (fetched.truncated) setInventoryNote('게시물이 많아 일부만 집계되었을 수 있습니다. (조회 한도 도달)');
    } catch (error) {
      console.error('Failed to build preservation inventory', error);
      setResult(errorMessage(error, '보존 점검에 실패했습니다. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setBusy(null);
    }
  };

  const handlePublish = async () => {
    if (schoolPosts.length === 0) return;
    if (!window.confirm(`비공개 주일학교 준비 자료 ${schoolPosts.length}건을 모두 공개합니다. 공개하면 성도 화면의 자료실에서 바로 보일 수 있습니다. 진행할까요?`)) return;
    setBusy('publish');
    setResult(null);
    try {
      const outcome = await publishPreparationPosts(schoolPosts.map((post) => post.id));
      setResult(
        outcome.failed.length === 0
          ? `${outcome.published}건을 공개했습니다.`
          : `${outcome.published}건을 공개했고 ${outcome.failed.length}건은 실패했습니다. 권한을 확인하고 다시 시도해 주세요.`,
      );
      await loadPrivate();
    } finally {
      setBusy(null);
    }
  };

  const handleFlag = async (enabled: boolean) => {
    const message = enabled
      ? '주일학교 화면을 켭니다. 성도에게 보이는 메뉴가 "주일학교"로 바뀌고, /next/elementary 주소는 새 주일학교 화면으로 이동합니다. 진행할까요?'
      : '주일학교 화면을 끕니다. 메뉴와 화면이 기존 유초등부로 돌아갑니다. 자료는 지워지지 않습니다. 진행할까요?';
    if (!window.confirm(message)) return;
    setBusy('flag');
    setResult(null);
    try {
      await setSundaySchool2027Flag(enabled);
      setResult(enabled ? '주일학교 화면을 켰습니다.' : '주일학교 화면을 껐습니다.');
    } catch (error) {
      console.error('Failed to update sunday school flag', error);
      setResult(errorMessage(error, '화면 전환에 실패했습니다. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setBusy(null);
    }
  };

  const countLabel = (row: { published: number; private: number }) => (
    <>
      <td className="p-1.5 text-right">{row.published}</td>
      <td className="p-1.5 text-right">{row.private}</td>
    </>
  );

  return (
    <div className={cardClass}>
      <h3 className="text-lg font-bold text-wood-900">전환 준비</h3>
      <p className="mt-1 text-xs font-bold text-wood-500">
        개강에 맞춰 주일학교 화면으로 바꾸는 단계입니다. 화면을 끄면 언제든 기존 화면으로 돌아갑니다.
      </p>

      <h4 className="mt-4 text-sm font-bold text-wood-800">상태</h4>
      <ul className="mt-2 grid gap-2 md:grid-cols-4">
        <li className="flex items-center justify-between rounded-lg border border-wood-200 px-3 py-2 text-sm">
          <span className="font-bold text-wood-800">주일학교 화면</span>
          {flag.loading ? (
            <span className="text-xs text-wood-500">확인 중...</span>
          ) : flag.enabled ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">켜짐</span>
          ) : (
            <span className="rounded-full bg-wood-100 px-2 py-0.5 text-xs font-bold text-wood-700">꺼짐</span>
          )}
        </li>
        <li className="flex items-center justify-between rounded-lg border border-wood-200 px-3 py-2 text-sm">
          <span className="font-bold text-wood-800">비공개 준비 자료</span>
          <span className="text-xs font-bold text-wood-700">
            {privateError ?? (privatePosts ? `${schoolPosts.length}건` : '확인 중...')}
            {privatePosts && excludedCount > 0 && ` (다른 비공개 ${excludedCount}건 제외)`}
          </span>
        </li>
        <li className="flex items-center justify-between rounded-lg border border-wood-200 px-3 py-2 text-sm">
          <span className="font-bold text-wood-800">진도표</span>
          <span className="text-xs font-bold text-wood-700">{catalog.loading ? '확인 중...' : `${catalog.curriculum.length}행`}</span>
        </li>
        <li className="flex items-center justify-between rounded-lg border border-wood-200 px-3 py-2 text-sm">
          <span className="font-bold text-wood-800">학사 일정</span>
          <span className="text-xs font-bold text-wood-700">{catalog.loading ? '확인 중...' : `${catalog.terms.length}개`}</span>
        </li>
      </ul>

      <h4 className="mt-5 text-sm font-bold text-wood-800">보존 점검</h4>
      <p className="mt-1 text-xs font-bold text-wood-500">
        아무것도 옮기거나 지우지 않습니다. 지난 자료 탭(공과, 여름성경학교)은 메뉴에서만 빠지고 게시물은 그대로입니다.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" className={subtleButtonClass} disabled={busy !== null} onClick={() => void handleInventory()}>
          {busy === 'inventory' ? <Loader2 size={12} className="inline animate-spin" /> : null} 점검하기
        </button>
        {inventoryNote && <span className="text-xs font-bold text-amber-700">{inventoryNote}</span>}
      </div>
      {inventory && (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[300px] text-left text-sm">
              <thead>
                <tr className="text-xs text-wood-500">
                  <th className="p-1.5">탭 (유초등부)</th>
                  <th className="p-1.5 text-right">공개</th>
                  <th className="p-1.5 text-right">비공개</th>
                </tr>
              </thead>
              <tbody>
                {inventory.tabs.map((row) => (
                  <tr key={row.id} className={`border-t border-wood-100 ${hasPosts(row) ? '' : 'text-wood-400'}`}>
                    <td className="p-1.5 font-bold">
                      {tabName(row.id)}
                      {row.archived && <span className="ml-1 rounded-full bg-wood-100 px-1.5 py-0.5 text-[10px] text-wood-600">지난 자료</span>}
                    </td>
                    {countLabel(row)}
                  </tr>
                ))}
                <tr className="border-t border-wood-300 font-bold">
                  <td className="p-1.5">합계</td>
                  {countLabel(inventory.total)}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[300px] text-left text-sm">
              <thead>
                <tr className="text-xs text-wood-500">
                  <th className="p-1.5">주제 (강의원고·공과·가이드·칼럼)</th>
                  <th className="p-1.5 text-right">공개</th>
                  <th className="p-1.5 text-right">비공개</th>
                </tr>
              </thead>
              <tbody>
                {inventory.topics.map((row) => (
                  <tr key={row.id} className={`border-t border-wood-100 ${hasPosts(row) ? '' : 'text-wood-400'}`}>
                    <td className="p-1.5 font-bold">{getNextGenerationTopicLabel(row.id, topics)}</td>
                    {countLabel(row)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <h4 className="mt-5 text-sm font-bold text-wood-800">전환 실행</h4>
      <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs font-bold text-wood-600">
        {CHECKLIST.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {excludedCount > 0 && (
        <p className="mt-2 text-xs font-bold text-wood-500">
          주일학교 자료가 아닌 비공개 글 {excludedCount}건(예: 청년부)은 공개 대상에서 제외됩니다.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={primaryButtonClass}
          disabled={busy !== null || schoolPosts.length === 0}
          onClick={() => void handlePublish()}
        >
          {busy === 'publish' ? <Loader2 size={12} className="inline animate-spin" /> : null} 비공개 준비 자료 모두 공개
        </button>
        <button
          type="button"
          className={primaryButtonClass}
          disabled={busy !== null || flag.loading || flag.enabled}
          onClick={() => void handleFlag(true)}
        >
          주일학교 화면 켜기
        </button>
        <button
          type="button"
          className={dangerButtonClass}
          disabled={busy !== null || flag.loading || !flag.enabled}
          onClick={() => void handleFlag(false)}
        >
          주일학교 화면 끄기
        </button>
      </div>
      <p className="mt-2 text-xs font-bold text-wood-500">
        화면 켜기·끄기는 사이트 관리자 계정만 할 수 있습니다. 권한이 없으면 오류 메시지가 표시됩니다. 일괄 공개는 최근 100건씩 처리하므로 남은 자료가 있으면 한 번 더 눌러 주세요.
      </p>
      {result && <p className="mt-2 text-xs font-bold text-wood-800">{result}</p>}
    </div>
  );
}
