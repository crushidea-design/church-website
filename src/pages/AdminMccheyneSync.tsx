import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { useAuth } from '../lib/auth';

type Row = { id: string; name: string; status: string; code: string; date?: string; postId?: string };
type Status = { folderYears: Record<string, number>; mode: string; stopped: boolean; busy: boolean; records: Row[]; lastRun?: { success: number; held: number; failed: number; skipped: number; pending: number; code: string } };
type Preview = { id: string; name: string; sourceHash: string; text: string; date: string; conflict: boolean; siteVersion?: string | null; siteCode?: string | null };
const messages: Record<string, string> = {
  STOPPED: '관리자가 자동 등록을 껐습니다. 재개는 운영 설정 확인 후 별도로 진행합니다.',
  SITE_POST_EDITED: '홈페이지에서 수정한 글입니다. 현재 공개본을 유지하며 자동 반영을 보류합니다.',
  SITE_POST_DELETED: '홈페이지에서 삭제한 글입니다. 재승인 없이 다시 등록하지 않습니다.',
  SITE_CHANGED: '홈페이지 글 상태가 바뀌었습니다. 미리보기를 다시 열어 확인해 주세요.',
  AUTHOR_NOT_CONFIGURED: '자동 등록 작성자의 관리자 프로필을 확인해 주세요.',
  YEAR_FOLDER_MISMATCH: '원문 또는 승인 날짜의 연도가 소속 폴더 연도와 다릅니다. 문서와 폴더를 확인해 주세요.',
  APPROVAL_FOLDER_CHANGED: '승인 폴더 위치가 변경되었습니다. 등록된 부모 폴더를 확인해 주세요.',
  DISABLED: '운영 연결 전입니다.', BUSY: '다른 실행이 진행 중입니다.', COMPLETE: '처리 완료', MORE_PENDING: '남은 문서는 다음 실행에서 처리합니다.',
  PUBLISHED: '등록 완료', WOULD_PUBLISH: '시험 통과 · 실제 등록 안 함', APPROVED: '현재 버전 승인 완료', YEAR_REQUIRED: '묵상 연도 확인 필요',
  REAPPROVAL_REQUIRED: '원본 수정됨 · 재승인 필요', APPROVAL_EVIDENCE_REQUIRED: '이동 승인 증거 확인 필요 · 최대 3회 확인 후 내용 승인 가능', SOURCE_CHANGED: '문서가 변경되었습니다. 다시 미리보기를 열어 주세요.',
  APPROVER_NOT_CONFIGURED: '승인 사용자 연결을 확인해 주세요.',
  READ_ONLY_MODE: '읽기 전용 시험에서는 승인·게시·처리 기록을 저장하지 않습니다.',
  EXISTING_POST_REQUIRES_LINK: '기존 게시글 후보가 있습니다. 별도 연결 확인 전에는 등록하지 않습니다.', INVALID_HEADING: '첫 문단의 날짜·성경 본문·제목을 확인해 주세요.',
  DATE_MISMATCH: '묵상 날짜가 원문과 일치하지 않습니다.', DRIVE_AUTH_REQUIRED: 'Drive 읽기 권한 연결을 확인해 주세요.', DRIVE_NOT_CONFIGURED: 'Drive 연결 전입니다.',
  INDEX_REQUIRED: '게시글 중복 검사 인덱스가 필요합니다.', OUTSIDE_APPROVED_FOLDER: '검수완료 폴더 밖의 문서입니다.',
  INVALID_SINGLE_TARGET: 'Google Docs 문서 링크와 묵상 날짜를 확인해 주세요.',
  SINGLE_TARGET_NOT_FOUND: '지정한 문서가 검수완료 폴더에 없습니다.', AMBIGUOUS_SINGLE_TARGET: '문서를 하나로 확인하지 못해 반영하지 않았습니다.',
  SINGLE_TARGET_DATE_MISMATCH: '지정한 날짜가 원문 날짜와 달라 반영하지 않았습니다.', SINGLE_TARGET_ID_MISMATCH: '문서가 일치하지 않아 반영하지 않았습니다.',
};
const label = (code: string) => messages[code] ?? '처리 보류 · 관리자 점검이 필요합니다.';

export default function AdminMccheyneSync() {
  const { user, role } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [trialCursor, setTrialCursor] = useState<string>();
  const [notice, setNotice] = useState('');
  const [trialRecords, setTrialRecords] = useState<Row[]>([]);
  const [singleLink, setSingleLink] = useState('');
  const [singleDate, setSingleDate] = useState('');
  const call = useCallback(async (body?: unknown) => {
    if (!user || role !== 'admin') throw new Error('AUTH_REQUIRED');
    const response = await fetch('/api/mccheyne/sync', {
      method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${await user.getIdToken()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      cache: 'no-store', ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.code === 'string' ? data.code : 'REQUEST_FAILED');
    return data;
  }, [user, role]);
  const refresh = useCallback(async () => { const value = await call(); setStatus(value); }, [call]);
  useEffect(() => { if (role === 'admin') refresh().catch(() => setNotice('상태를 불러오지 못했습니다. 다시 확인해 주세요.')); }, [role, refresh]);
  const act = async (work: () => Promise<void>) => {
    setBusy(true); setNotice('');
    try { await work(); await refresh(); } catch (e) { setNotice(label(e instanceof Error ? e.message : 'REQUEST_FAILED')); } finally { setBusy(false); }
  };
  const stop = async () => {
    setStopping(true);
    try { const r = await call({ action: 'stop' }); setNotice(label(r.code)); setPreview(null); await refresh(); }
    catch (e) { setNotice(label(e instanceof Error ? e.message : 'REQUEST_FAILED')); }
    finally { setStopping(false); }
  };
  if (!user || role !== 'admin') return <div className="p-10">관리자만 사용할 수 있습니다.</div>;
  const enabled = status && status.mode !== 'off';
  const records = status?.mode === 'dry_run' ? trialRecords : status?.records;
  return <AdminLayout title="맥체인 검수 문서 등록" description="검수완료 폴더의 승인된 문서를 매일 오전 5시(한국시간)에 확인합니다. 과거·미래 날짜 모두 원래 묵상 날짜로 등록합니다.">
    <section className="bg-white rounded-md p-6 border border-wood-200 space-y-4">
      <p>{status?.stopped ? label('STOPPED') : status?.mode === 'publish' ? '자동 등록 사용 중' : status?.mode === 'dry_run' ? '읽기 전용 시험 · 게시글·승인·처리 기록을 저장하지 않습니다. 결과는 이 화면에서만 확인합니다.' : '운영 연결 전 · 자동 등록이 꺼져 있습니다.'}</p>
      <a className="underline" href="https://drive.google.com/drive/folders/1XxgBRwigRQmgGgk_mvXQBVUqen51iARX" target="_blank" rel="noreferrer">검수완료 폴더 열기</a>
      <p className="text-sm">검수완료 바로 아래 문서는 2026년입니다. 확인된 2026·2027·2028 하위 폴더의 문서는 각 폴더 연도를 적용합니다. 원문 연도가 폴더와 다르면 보류하며, 해가 바뀌어도 기준을 자동 변경하지 않습니다.</p>
      <div className="flex gap-3">
        <button className="rounded bg-wood-800 text-white px-4 py-2 disabled:opacity-40" disabled={busy || stopping || !enabled || status?.busy} onClick={() => act(async () => { const r = await call({ action: 'run', ...(status?.mode === 'dry_run' && trialCursor ? { cursor: trialCursor } : {}) }); setTrialRecords(r.records ?? []); setTrialCursor(r.cursor); setNotice(`${label(r.code)} · 성공 ${r.success ?? 0} · 보류 ${r.held ?? 0} · 실패 ${r.failed ?? 0} · 남음 ${r.pending ?? 0}`); })}>{busy ? '처리 중…' : status?.mode === 'dry_run' ? '지금 시험' : '지금 반영'}</button>
        <button className="border border-red-700 text-red-800 rounded px-4 py-2 disabled:opacity-40" disabled={stopping || status?.mode !== 'publish'} onClick={stop}>{stopping ? '끄는 중…' : '자동 등록 끄기'}</button>
        <button className="border rounded px-4 py-2" disabled={busy} onClick={() => act(refresh)}>상태 새로고침</button>
      </div>
      <p className="text-sm">한 번에 최대 20개 문서를 확인하며 남은 문서는 다음 실행에서 이어갑니다. 끄기는 새 실행과 다음 문서 처리를 막습니다. 이미 완료된 게시를 되돌리지는 않습니다. 읽기 전용 시험은 쓰기를 하지 않으므로 끄기 설정도 변경하지 않습니다.</p>
      <fieldset className="border rounded p-4 space-y-3" disabled={busy || stopping || !enabled || status?.busy}>
        <legend className="font-semibold px-2">문서 한 건만 반영</legend>
        <label className="block">Google Docs 문서 링크<input type="url" className="block border rounded p-2 w-full" value={singleLink} onChange={e => setSingleLink(e.target.value)} /></label>
        <label className="block">게시할 묵상 날짜<input type="date" className="block border rounded p-2" value={singleDate} onChange={e => setSingleDate(e.target.value)} /></label>
        <p className="text-sm">검수완료 폴더의 지정한 문서만 확인합니다. 원문 날짜·승인 기록이 맞지 않거나 기존 글과 충돌하면 반영하지 않습니다. 예약 설정은 바뀌지 않습니다.</p>
        <button className="rounded bg-wood-800 text-white px-4 py-2 disabled:opacity-40" disabled={!singleLink || !singleDate} onClick={() => act(async () => {
          let id: string | undefined;
          try { const url = new URL(singleLink); if (url.protocol === 'https:' && url.hostname === 'docs.google.com') id = /^\/document\/d\/([A-Za-z0-9_-]{10,200})(?:\/|$)/.exec(url.pathname)?.[1]; } catch { /* Reject malformed links without any request. */ }
          if (!id) throw new Error('INVALID_SINGLE_TARGET');
          const r = await call({ action: 'run_one', id, date: singleDate });
          setTrialRecords(r.records ?? []); setNotice(`${label(r.code)} · 성공 ${r.success ?? 0} · 변경 없음 ${r.skipped ?? 0} · 보류 ${r.held ?? 0} · 실패 ${r.failed ?? 0}`);
        })}>이 문서 한 건만 반영</button>
      </fieldset>
      {status?.lastRun && <p>최근 실행: 성공 {status.lastRun.success} · 변경 없음 {status.lastRun.skipped} · 보류 {status.lastRun.held} · 실패 {status.lastRun.failed} · 남음 {status.lastRun.pending} — {label(status.lastRun.code)}</p>}
      {notice && <p role="status">{notice}</p>}
      <p className="text-sm text-wood-600">등록 후 원본이 바뀌면 기존 공개본을 유지합니다. 아래에서 현재 내용을 확인하고 재승인한 뒤 반영할 수 있습니다. 기존 수동 게시글 후보는 자동 연결하거나 덮어쓰지 않습니다.</p>
    </section>
    <section className="mt-5 space-y-3" aria-label="문서별 처리 결과">
      {records?.length === 0 && <p>아직 처리 기록이 없습니다.</p>}
      {records?.map(row => <article key={row.id} className="bg-white border rounded p-4 flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-semibold">{row.name}</p><p>{row.date} · {label(row.code)}</p>{row.postId && <Link className="underline" to={`/post/${row.postId}`}>게시글 보기</Link>}</div>
        <button className="border rounded px-3 py-2" disabled={busy || !enabled} onClick={() => act(async () => { const p = await call({ action: 'preview', id: row.id }); setPreview(p); setDate(p.date); })}>내용 확인 / 재승인</button>
      </article>)}
    </section>
    {preview && <section className="mt-6 bg-white border rounded p-6 space-y-4" aria-label="현재 문서 버전 승인">
      <h2 className="font-semibold">{preview.name} · 현재 버전 확인</h2>
      <p>이 화면에 표시된 버전만 승인합니다. 이후 편집된 내용은 다시 승인해야 합니다.</p>
      <label className="block">묵상 날짜 <input className="border p-2" type="date" value={date} readOnly /></label>
      <p className="text-sm">문서의 월·일과 소속 폴더의 연도를 확인해 주세요. 날짜 수정이 필요하면 Drive 원문이나 소속 연도 폴더를 먼저 수정해 주세요.</p>
      <pre className="whitespace-pre-wrap max-h-96 overflow-auto border p-4 font-sans">{preview.text}</pre>
      {preview.conflict && <p>{label('EXISTING_POST_REQUIRES_LINK')}</p>}
      {preview.siteCode && <p className="text-red-800">{label(preview.siteCode)} 아래 승인 버튼은 홈페이지 수정본을 이 Drive 내용으로 교체하거나 삭제한 글을 다시 등록하는 승인입니다.</p>}
      <button className="rounded bg-wood-800 text-white px-4 py-2 disabled:opacity-40" disabled={busy || status?.mode !== 'publish' || !date || preview.conflict} onClick={() => act(async () => { await call({ action: 'approve', id: preview.id, sourceHash: preview.sourceHash, date, ...(preview.siteVersion ? { siteVersion: preview.siteVersion } : {}) }); setPreview(null); setNotice('현재 버전을 승인했습니다. 다음 자동 실행 또는 지금 반영에서 처리합니다.'); })}>{preview.siteCode ? 'Drive 내용으로 교체 / 재게시 승인' : '이 내용과 날짜 승인'}</button>
      <button className="ml-3 border rounded px-4 py-2" onClick={() => setPreview(null)}>닫기</button>
    </section>}
  </AdminLayout>;
}
