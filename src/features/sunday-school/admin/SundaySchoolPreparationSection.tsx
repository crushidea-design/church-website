import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { createMissingPreparationCatalog } from '../api';
import type { PreparationCatalogResult } from '../api';
import { buildHeidelbergTopics, buildPreparationTabs } from './preparationCatalog';
import { cardClass, primaryButtonClass } from './ui';

export default function SundaySchoolPreparationSection() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PreparationCatalogResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!window.confirm('2027용 자료 탭 6개와 하이델베르크 주제 52개 중 아직 없는 것만 숨김 상태로 만듭니다. 이미 있는 탭·주제는 수정하지 않습니다. 진행할까요?')) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await createMissingPreparationCatalog());
    } catch (err) {
      console.error('Failed to create preparation catalog', err);
      setError('탭·주제를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const tabs = buildPreparationTabs();
  return (
    <div className={cardClass}>
      <h3 className="text-lg font-bold text-wood-900">자료 탭 · 주제 준비</h3>
      <p className="mt-1 text-xs font-bold text-wood-500">
        만들어질 탭: {tabs.map((tab) => tab.name).join(', ')} / 주제: {buildHeidelbergTopics().length}개 (하이델베르크 제1~52주일)
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className={primaryButtonClass} disabled={busy} onClick={handleCreate}>
          {busy ? <Loader2 size={12} className="inline animate-spin" /> : null} 2027 탭·주제 만들기 (숨김 상태)
        </button>
        {result && (
          <span className="text-xs font-bold text-wood-700">
            탭: 기존 {result.tabs.existing}개 · 새로 생성 {result.tabs.created}개 / 주제: 기존 {result.topics.existing}개 · 새로 생성 {result.topics.created}개
          </span>
        )}
        {error && <span className="text-xs font-bold text-red-600">{error}</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link key={tab.slug} to={`/next/create?resource=${tab.slug}`} className="rounded-full border border-wood-300 px-3 py-1 text-xs font-bold text-wood-700 hover:bg-wood-50">
            {tab.name} 자료 올리기
          </Link>
        ))}
      </div>
      <p className="mt-2 text-xs text-wood-500">숨김 상태라 성도 화면에는 보이지 않습니다. 개강 전환 때 공개합니다.</p>
    </div>
  );
}
