import React, { useState } from 'react';
import { saveSchoolIdentity, useSchoolIdentity } from '../identity';
import type { SchoolIdentity } from '../identity';
import { cardClass, inputClass, primaryButtonClass } from './ui';

const FIELDS: Array<{ key: keyof SchoolIdentity; label: string; multiline?: boolean }> = [
  { key: 'name', label: '이름' },
  { key: 'nameEn', label: '영문 이름' },
  { key: 'period', label: '기간' },
  { key: 'verseRef', label: '근거 구절' },
  { key: 'motto', label: '구절 문구' },
  { key: 'description', label: '소개 문장', multiline: true },
];

export default function SundaySchoolIdentitySection() {
  const { identity, loading, stored } = useSchoolIdentity();
  const [draft, setDraft] = useState<SchoolIdentity | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const current = draft ?? identity;

  const save = async () => {
    if (!current.name.trim()) {
      setMessage('이름을 입력해 주세요.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await saveSchoolIdentity(current);
      setDraft(null);
      setMessage('저장했습니다.');
    } catch (error) {
      console.error('Failed to save school identity', error);
      const code = (error as { code?: string })?.code;
      setMessage(code === 'permission-denied' ? '사이트 관리자 계정만 저장할 수 있습니다.' : '저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cardClass}>
      <h3 className="text-lg font-bold text-wood-900">주일학교 이름</h3>
      <p className="mt-1 text-sm text-wood-600">
        한 교육 과정 동안 쓰는 이름입니다. 과정이 바뀌면 여기서 새 이름으로 바꿉니다. 주일학교 화면과, 전환 후 다음세대 소개 첫머리에 쓰입니다.
        {!loading && !stored && ' (아직 저장 전이라 기본값을 보여 줍니다.)'}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <label key={field.key} className={`block text-xs font-bold text-wood-700 ${field.multiline ? 'sm:col-span-2' : ''}`}>
            {field.label}
            {field.multiline ? (
              <textarea
                className={`${inputClass} mt-1`}
                rows={3}
                value={current[field.key]}
                disabled={loading || busy}
                onChange={(event) => setDraft({ ...current, [field.key]: event.target.value })}
              />
            ) : (
              <input
                className={`${inputClass} mt-1`}
                value={current[field.key]}
                disabled={loading || busy}
                onChange={(event) => setDraft({ ...current, [field.key]: event.target.value })}
              />
            )}
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" className={primaryButtonClass} disabled={loading || busy} onClick={save}>
          {busy ? '저장 중…' : '저장'}
        </button>
        {message && <span className="text-sm text-wood-700">{message}</span>}
      </div>
    </div>
  );
}
