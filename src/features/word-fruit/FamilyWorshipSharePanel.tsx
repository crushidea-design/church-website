import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ImagePlus, Loader2, Upload, X } from 'lucide-react';
import { useNextGenerationAuth } from '../../lib/nextGenerationAuth';
import {
  FamilyWorshipLog,
  getFamilyWorshipFamilyLabel,
  setFamilyWorshipLog,
  subscribeFamilyWorshipStats,
  subscribePublicFamilyWorshipLogs,
  uploadFamilyWorshipPhoto,
  validateFamilyWorshipPhoto,
} from './familyWorshipApi';

interface FamilyWorshipSharePanelProps {
  weekKey: string;
}

const formatCompletedAt = (value: any) => {
  if (typeof value?.toDate === 'function') {
    return value.toDate().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  }
  return '';
};

export default function FamilyWorshipSharePanel({ weekKey }: FamilyWorshipSharePanelProps) {
  const { user, member, hasAccess, isPastor } = useNextGenerationAuth();
  const [logs, setLogs] = useState<FamilyWorshipLog[]>([]);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const childIds = member?.childIds ?? [];
  const proxyChildren = member?.proxyChildren ?? [];
  const childUids = useMemo(
    () => [...childIds, ...proxyChildren.map((child) => child.id)],
    [childIds.join('|'), proxyChildren.map((child) => child.id).join('|')],
  );
  const childNames = useMemo(
    () => proxyChildren.map((child) => child.name).filter(Boolean),
    [proxyChildren.map((child) => child.name).join('|')],
  );
  const myLog = user ? logs.find((log) => log.parentUid === user.uid) : undefined;
  const canReviewAllLogs = isPastor || (member?.groupIds?.length ?? 0) > 0;

  useEffect(() => {
    if (!weekKey) return;
    if (canReviewAllLogs) {
      return subscribeFamilyWorshipStats([weekKey], setLogs, () => {
        setLogs([]);
      });
    }

    return subscribePublicFamilyWorshipLogs(weekKey, setLogs, () => {
      setLogs([]);
    });
  }, [weekKey, canReviewAllLogs]);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextPhoto = event.target.files?.[0] || null;
    const validationError = validateFamilyWorshipPhoto(nextPhoto);
    if (validationError) {
      setError(validationError);
      setPhoto(null);
      event.target.value = '';
      return;
    }

    setError('');
    setPhoto(nextPhoto);
  };

  const handleSubmit = async () => {
    if (!user) {
      setError('로그인 후 가정예배 기록을 남길 수 있습니다.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const uploadedPhoto = photo
        ? await uploadFamilyWorshipPhoto(user.uid, weekKey, photo)
        : {};

      await setFamilyWorshipLog({
        weekKey,
        parentUid: user.uid,
        parentName: member?.displayName || user.displayName || '',
        childUids,
        childNames,
        note: note.trim(),
        isPublic,
        ...uploadedPhoto,
      });

      setMessage(isPublic ? '가정예배 나눔을 올렸습니다.' : '가정예배 기록을 저장했습니다.');
      setNote('');
      setPhoto(null);
    } catch (err: any) {
      setError(err?.message || '가정예배 기록을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-xl border border-amber-100 bg-amber-50/60 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black text-amber-700">우리 가정 기록하기</p>
            <h3 className="mt-1 text-2xl font-black tracking-normal text-emerald-950">이번 주 가정예배 드렸어요</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{weekKey} 기준으로 저장됩니다.</p>
          </div>
          {myLog && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-black text-emerald-700">
              <CheckCircle2 size={14} /> 기록됨
            </span>
          )}
        </div>

        {!hasAccess ? (
          <p className="mt-5 rounded-lg bg-white px-4 py-3 text-sm font-bold text-slate-600">
            다음세대 로그인 후 가정예배 기록과 나눔을 남길 수 있습니다.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={600}
              rows={4}
              className="block w-full rounded-lg border border-amber-100 bg-white p-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-emerald-500"
              placeholder="오늘 함께 나눈 말씀, 감사한 점, 기도제목을 짧게 남겨 주세요."
            />

            <div className="rounded-lg border border-dashed border-amber-200 bg-white p-4">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700">
                <ImagePlus size={16} />
                인증샷 선택
                <input type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" className="sr-only" onChange={handlePhotoChange} />
              </label>
              <p className="mt-2 text-xs font-bold text-slate-500">선택 사항입니다. JPG/PNG, 최대 10MB</p>
              {photo && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-slate-700">
                  <span className="truncate">{photo.name}</span>
                  <button type="button" onClick={() => setPhoto(null)} className="rounded-full p-1 hover:bg-white">
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            <label className="flex items-start gap-3 rounded-lg bg-white px-4 py-3 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(event) => setIsPublic(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                다른 가정에도 공개
                <span className="block text-xs font-medium text-slate-500">체크를 끄면 관리자와 교사 확인용으로만 저장됩니다.</span>
              </span>
            </label>

            {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
            {message && <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p>}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-3 text-sm font-black text-white transition hover:bg-amber-600 disabled:bg-slate-300"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {saving ? '저장 중...' : '가정예배 기록 남기기'}
            </button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
        <p className="text-sm font-black text-sky-700">{canReviewAllLogs ? '교사/관리자 확인' : '이번 주 가정예배 나눔'}</p>
        <h3 className="mt-1 text-2xl font-black tracking-normal text-emerald-950">
          {canReviewAllLogs ? '이번 주 가정예배 기록' : '함께 드린 가정들'}
        </h3>
        {logs.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-sky-100 bg-sky-50 px-4 py-8 text-center text-sm font-bold text-slate-500">
            아직 공개된 가정예배 나눔이 없습니다.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {logs.map((log) => (
              <article key={log.id} className="overflow-hidden rounded-lg border border-sky-100 bg-sky-50/50">
                {log.photoUrl && (
                  <img src={log.photoUrl} alt="가정예배 인증샷" className="aspect-[4/3] w-full object-cover" />
                )}
                <div className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-emerald-950">{getFamilyWorshipFamilyLabel(log.parentName)}</p>
                    <span className="text-xs font-bold text-slate-500">
                      {log.isPublic ? '공개' : '비공개'} {formatCompletedAt(log.completedAt)}
                    </span>
                  </div>
                  {log.note && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{log.note}</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
