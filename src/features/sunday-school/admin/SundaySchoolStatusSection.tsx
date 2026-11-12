import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { seedSundaySchoolCatalogIfEmpty } from '../api';
import type { SundaySchoolCatalog } from '../api';
import { cardClass, primaryButtonClass } from './ui';

const LABELS = { terms: '학사 일정', curriculum: '진도표', classes: '반' } as const;

export default function SundaySchoolStatusSection({ catalog }: { catalog: SundaySchoolCatalog }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSeed = async () => {
    if (!window.confirm('비어 있는 컬렉션에만 기본값(학사 일정·진도표·반)을 저장합니다. 이미 데이터가 있는 컬렉션은 건드리지 않습니다. 진행할까요?')) return;
    setBusy(true);
    setResult(null);
    try {
      const seeded = await seedSundaySchoolCatalogIfEmpty();
      const done = (Object.keys(LABELS) as Array<keyof typeof LABELS>).filter((key) => seeded[key]).map((key) => LABELS[key]);
      setResult(done.length > 0 ? `기본값을 저장했습니다: ${done.join(', ')}` : '모든 컬렉션에 이미 데이터가 있어 저장한 것이 없습니다.');
    } catch (error) {
      console.error('Failed to seed sunday school catalog', error);
      setResult('기본값 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cardClass}>
      <h3 className="text-lg font-bold text-wood-900">상태와 기본값</h3>
      <p className="mt-1 text-xs font-bold text-wood-500">
        2027 주일학교 데이터가 Firestore에서 불러온 값인지, 코드의 기본값을 임시로 쓰는 중인지 보여 줍니다.
      </p>
      <ul className="mt-3 grid gap-2 md:grid-cols-3">
        {(Object.keys(LABELS) as Array<keyof typeof LABELS>).map((key) => (
          <li key={key} className="flex items-center justify-between rounded-lg border border-wood-200 px-3 py-2 text-sm">
            <span className="font-bold text-wood-800">{LABELS[key]}</span>
            {catalog.loading ? (
              <span className="text-xs text-wood-500">확인 중...</span>
            ) : catalog.fallback[key] ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">기본값 사용 중</span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">Firestore 저장됨</span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={handleSeed} disabled={busy || catalog.loading} className={primaryButtonClass}>
          {busy ? <Loader2 size={12} className="inline animate-spin" /> : null} 기본값 채우기
        </button>
        {result && <span className="text-xs font-bold text-wood-700">{result}</span>}
      </div>
    </div>
  );
}
