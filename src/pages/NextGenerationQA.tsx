import React, { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot, addDoc, deleteDoc,
  doc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNextGenerationAuth } from '../lib/nextGenerationAuth';
import {
  MessageSquare, Plus, ChevronDown, ChevronUp, Trash2,
  CheckCircle, Clock, Lock, Loader2, AlertCircle,
} from 'lucide-react';

interface QAItem {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: Timestamp;
  isAnswered: boolean;
  answer?: string;
  answeredAt?: Timestamp;
  answeredBy?: string;
}

function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return '-';
  const d = ts.toDate();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function NextGenerationQA() {
  const { user, member, isMember, isPastor, hasAccess } = useNextGenerationAuth();
  const [items, setItems] = useState<QAItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'next_generation_qa'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as QAItem)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!title.trim()) { setFormError('제목을 입력해 주세요.'); return; }
    if (!content.trim()) { setFormError('내용을 입력해 주세요.'); return; }
    if (!user || !member) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'next_generation_qa'), {
        title: title.trim(),
        content: content.trim(),
        authorId: user.uid,
        authorName: member.displayName,
        createdAt: serverTimestamp(),
        isAnswered: false,
      });
      setTitle('');
      setContent('');
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

  if (!hasAccess) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 px-4">
        <Lock size={40} className="mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500 text-sm">회원 전용 공간입니다.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900">질문 있습니다</h3>
          <p className="text-sm text-gray-500 mt-1">궁금한 것을 자유롭게 질문해 주세요.</p>
        </div>
        {(isMember || isPastor) && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus size={16} /> 질문하기
          </button>
        )}
      </div>

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
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setShowForm(false); setTitle(''); setContent(''); setFormError(''); }}
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
                  <p className="font-medium text-gray-900 text-sm leading-snug">{item.title}</p>
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
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
