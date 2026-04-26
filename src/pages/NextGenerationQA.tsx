import React, { useState, useEffect } from 'react';
import {
  collection, query, where, orderBy, onSnapshot, addDoc, deleteDoc,
  doc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNextGenerationAuth } from '../lib/nextGenerationAuth';
import {
  MessageSquare, Plus, ChevronDown, ChevronUp, Trash2,
  CheckCircle, Clock, Lock, Loader2, AlertCircle, HelpCircle,
  EyeOff,
} from 'lucide-react';

export type NextGenerationQADepartment = 'elementary' | 'young-adults';

interface QAItem {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  department?: NextGenerationQADepartment;
  isPrivate?: boolean;
  createdAt: Timestamp;
  isAnswered: boolean;
  answer?: string;
  answeredAt?: Timestamp;
  answeredBy?: string;
}

interface Props {
  department: NextGenerationQADepartment;
  compact?: boolean;
}

function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return '-';
  const d = ts.toDate();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function NextGenerationQA({ department, compact = false }: Props) {
  const { user, member, isMember, isPastor, hasAccess } = useNextGenerationAuth();
  const [items, setItems] = useState<QAItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Subscribe to QA. Pastor sees everything in one query; everyone else needs
  // two queries (public + own) merged client-side because Firestore rules
  // hide private posts from non-author non-pastor readers and the listener
  // would fail if a single query attempted to return them.
  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    const matchesDepartment = (item: QAItem) => (item.department ?? 'young-adults') === department;
    const sortByCreatedDesc = (a: QAItem, b: QAItem) =>
      (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);

    if (isPastor) {
      const q = query(collection(db, 'next_generation_qa'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as QAItem));
          setItems(all.filter(matchesDepartment));
          setLoading(false);
        },
        () => setLoading(false),
      );
      return () => unsub();
    }

    let publicItems: QAItem[] = [];
    let ownItems: QAItem[] = [];
    let publicLoaded = false;
    let ownLoaded = false;

    const update = () => {
      if (!publicLoaded || !ownLoaded) return;
      const map = new Map<string, QAItem>();
      [...publicItems, ...ownItems].forEach((item) => map.set(item.id, item));
      const merged = [...map.values()].filter(matchesDepartment).sort(sortByCreatedDesc);
      setItems(merged);
      setLoading(false);
    };

    const publicQuery = query(
      collection(db, 'next_generation_qa'),
      where('isPrivate', '==', false),
      orderBy('createdAt', 'desc'),
    );
    const unsubPublic = onSnapshot(
      publicQuery,
      (snap) => {
        publicItems = snap.docs.map((d) => ({ id: d.id, ...d.data() } as QAItem));
        publicLoaded = true;
        update();
      },
      () => {
        publicLoaded = true;
        update();
      },
    );

    const ownQuery = query(
      collection(db, 'next_generation_qa'),
      where('authorId', '==', user.uid),
      orderBy('createdAt', 'desc'),
    );
    const unsubOwn = onSnapshot(
      ownQuery,
      (snap) => {
        ownItems = snap.docs.map((d) => ({ id: d.id, ...d.data() } as QAItem));
        ownLoaded = true;
        update();
      },
      () => {
        ownLoaded = true;
        update();
      },
    );

    return () => {
      unsubPublic();
      unsubOwn();
    };
  }, [department, user, isPastor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!title.trim()) { setFormError('제목을 입력해 주세요.'); return; }
    if (!content.trim()) { setFormError('내용을 입력해 주세요.'); return; }
    if (!user) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'next_generation_qa'), {
        title: title.trim(),
        content: content.trim(),
        authorId: user.uid,
        authorName: member?.displayName ?? user.displayName ?? '목사님',
        department,
        isPrivate,
        createdAt: serverTimestamp(),
        isAnswered: false,
      });
      setTitle('');
      setContent('');
      setIsPrivate(false);
      setShowForm(false);
    } catch (err: any) {
      setFormError('등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: QAItem) => {
    if (!confirm('질문을 삭제하시겠습니까?')) return;
    await deleteDoc(doc(db, 'next_generation_qa', item.id));
  };

  return (
    <div className={compact ? '' : 'mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8'}>
      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <HelpCircle size={26} />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-normal text-emerald-950">질문 있습니다</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              말씀을 듣다 생긴 질문, 신앙의 여정에서 맞닥뜨린 고민을 자유롭게 남겨 주세요.<br className="hidden sm:block" />
              목사님이 직접 답변드립니다. 민감한 내용은 <span className="inline-flex items-center gap-0.5 font-bold text-amber-700"><EyeOff size={12} />비공개</span> 옵션으로 작성하시면 본인과 목사님만 볼 수 있습니다.
            </p>
          </div>
        </div>
        {(isMember || isPastor) && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex shrink-0 items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
          >
            <Plus size={16} /> 질문하기
          </button>
        )}
      </div>

      <div className="max-w-2xl">

      {/* Write Form */}
      {showForm && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <h4 className="font-semibold text-gray-800 mb-3">새 질문</h4>
          {formError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-3">
              <AlertCircle size={14} /> {formError}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="제목"
            />
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              required
              rows={4}
              maxLength={5000}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              placeholder="질문 내용을 자세히 적어 주세요"
            />
            <label className="flex items-start gap-2.5 cursor-pointer rounded-lg border border-amber-200 bg-white px-3 py-2.5">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-400"
              />
              <span className="text-sm text-gray-700">
                <span className="inline-flex items-center gap-1 font-bold text-gray-800">
                  <EyeOff size={13} /> 비공개 질문
                </span>
                <span className="ml-1 text-xs text-gray-500">
                  목사님과 본인만 질문·답변을 볼 수 있어요. 다른 회원에게는 목록에도 보이지 않습니다.
                </span>
              </span>
            </label>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setShowForm(false); setTitle(''); setContent(''); setIsPrivate(false); setFormError(''); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 flex items-center gap-1.5"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                등록
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-gray-400 text-sm">로딩 중...</div>
      )}

      {/* Empty */}
      {!loading && items.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <MessageSquare size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">아직 질문이 없습니다.</p>
          {(isMember || isPastor) && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              첫 번째 질문 남기기
            </button>
          )}
        </div>
      )}

      {/* Q&A List */}
      <div className="space-y-3">
        {items.map(item => {
          const isExpanded = expandedId === item.id;
          const isOwner = user?.uid === item.authorId;

          return (
            <div
              key={item.id}
              className={`border rounded-xl overflow-hidden transition-shadow ${
                isExpanded ? 'shadow-md' : 'shadow-sm hover:shadow-md'
              } ${item.isAnswered ? 'border-gray-200' : 'border-amber-200'}`}
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="w-full flex items-start gap-3 p-4 text-left"
              >
                <div className="mt-0.5 flex-shrink-0">
                  {item.isAnswered
                    ? <CheckCircle size={18} className="text-emerald-500" />
                    : <Clock size={18} className="text-amber-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="flex items-center gap-1.5 font-medium text-gray-900 text-sm leading-snug">
                    {item.isPrivate && (
                      <span
                        className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800"
                        title="비공개 질문"
                      >
                        <EyeOff size={10} /> 비공개
                      </span>
                    )}
                    <span className="truncate">{item.title}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {item.authorName} · {formatDate(item.createdAt)}
                    {item.isAnswered && (
                      <span className="ml-2 text-emerald-600 font-medium">답변 완료</span>
                    )}
                  </p>
                </div>
                {isExpanded
                  ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                  : <ChevronDown size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                }
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-4">
                  {!user ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-gray-400">
                      <Lock size={16} />
                      <span className="text-sm">내용은 로그인 후 확인할 수 있습니다.</span>
                    </div>
                  ) : (
                    <>
                      {item.isPrivate && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          <EyeOff size={14} className="mt-0.5 shrink-0" />
                          <span>
                            비공개 질문입니다. 본인과 목사님만 이 질문과 답변을 볼 수 있어요.
                          </span>
                        </div>
                      )}

                      {/* Question content */}
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-gray-500 mb-1.5">질문</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{item.content}</p>
                      </div>

                      {/* Answer */}
                      {item.isAnswered && item.answer && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-xs font-medium text-amber-600 mb-1.5">
                            목사님 답변 · {formatDate(item.answeredAt)}
                          </p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{item.answer}</p>
                        </div>
                      )}

                      {/* Actions */}
                      {(isOwner || isPastor) && (
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleDelete(item)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs rounded-lg transition-colors"
                          >
                            <Trash2 size={13} /> 삭제
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
