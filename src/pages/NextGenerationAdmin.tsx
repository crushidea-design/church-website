import React, { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot, doc, updateDoc,
  deleteDoc, addDoc, serverTimestamp, orderBy, Timestamp, deleteField,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { NextGenerationMember, Department } from '../lib/nextGenerationAuth';
import {
  Users, CheckCircle, XCircle, Trash2, ChevronDown, ChevronUp,
  Bell, MessageSquare, Mail, Clock, Search,
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

interface ContactItem {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: Timestamp;
  isRead: boolean;
}

type AdminTab = 'members' | 'qa' | 'contacts';

const DEPT_COLORS: Record<Department, string> = {
  '청년': 'bg-blue-100 text-blue-700',
  '교사': 'bg-green-100 text-green-700',
  '학부모': 'bg-purple-100 text-purple-700',
};

function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return '-';
  const d = ts.toDate();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function NextGenerationAdmin({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<AdminTab>('members');
  const [members, setMembers] = useState<NextGenerationMember[]>([]);
  const [qaItems, setQaItems] = useState<QAItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Reject modal
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // QA answer modal
  const [answerTargetId, setAnswerTargetId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');

  // Subscribe to members
  useEffect(() => {
    const q = query(collection(db, 'next_generation_members'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setMembers(snap.docs.map(d => ({ ...d.data() } as NextGenerationMember)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  // Subscribe to QA
  useEffect(() => {
    const q = query(collection(db, 'next_generation_qa'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setQaItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as QAItem)));
    });
    return () => unsub();
  }, []);

  // Subscribe to contacts
  useEffect(() => {
    const q = query(collection(db, 'next_generation_contacts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setContacts(snap.docs.map(d => ({ id: d.id, ...d.data() } as ContactItem)));
    });
    return () => unsub();
  }, []);

  const pendingMembers = members.filter(m => m.role === 'pending');
  const approvedMembers = members.filter(m => m.role === 'member');
  const rejectedMembers = members.filter(m => m.role === 'rejected');
  const unreadContacts = contacts.filter(c => !c.isRead).length;
  const unansweredQA = qaItems.filter(q => !q.isAnswered).length;

  const filteredMembers = members.filter(m =>
    m.displayName.includes(search) ||
    m.email.includes(search) ||
    m.church.includes(search)
  );

  const approveMember = async (uid: string) => {
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'next_generation_members', uid), {
        role: 'member',
        approvedAt: serverTimestamp(),
        rejectedAt: deleteField(),
        rejectionReason: deleteField(),
      });
      await addDoc(collection(db, 'next_generation_notifications'), {
        uid,
        type: 'approved',
        message: '다음세대 가입 신청이 승인되었습니다.',
        createdAt: serverTimestamp(),
        isRead: false,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const rejectMember = async () => {
    if (!rejectTargetId) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'next_generation_members', rejectTargetId), {
        role: 'rejected',
        rejectedAt: serverTimestamp(),
        rejectionReason: rejectReason.trim() || '승인 거부',
      });
      await addDoc(collection(db, 'next_generation_notifications'), {
        uid: rejectTargetId,
        type: 'rejected',
        message: '다음세대 가입 신청이 반려되었습니다.',
        rejectionReason: rejectReason.trim() || '승인 거부',
        createdAt: serverTimestamp(),
        isRead: false,
      });
      setRejectTargetId(null);
      setRejectReason('');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteMember = async (uid: string) => {
    if (!confirm('회원을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    await deleteDoc(doc(db, 'next_generation_members', uid));
  };

  const answerQA = async () => {
    if (!answerTargetId || !answerText.trim()) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'next_generation_qa', answerTargetId), {
        answer: answerText.trim(),
        answeredAt: serverTimestamp(),
        answeredBy: '목사님',
        isAnswered: true,
      });
      setAnswerTargetId(null);
      setAnswerText('');
    } finally {
      setSubmitting(false);
    }
  };

  const markContactRead = async (id: string) => {
    await updateDoc(doc(db, 'next_generation_contacts', id), { isRead: true });
  };

  const MemberRow = ({ m }: { m: NextGenerationMember }) => {
    const isExpanded = expandedId === m.uid;
    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden mb-2">
        <button
          onClick={() => setExpandedId(isExpanded ? null : m.uid)}
          className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900 text-sm">{m.displayName}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DEPT_COLORS[m.department]}`}>
                {m.department}
              </span>
              {m.role === 'pending' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">대기중</span>
              )}
              {m.role === 'member' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">승인</span>
              )}
              {m.role === 'rejected' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">반려</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{m.email} · {m.church} · {formatDate(m.createdAt)}</p>
          </div>
          {isExpanded ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
        </button>

        {isExpanded && (
          <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-3">
            {m.intro && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">자기소개</p>
                <p className="text-sm text-gray-700">{m.intro}</p>
              </div>
            )}
            {m.role === 'rejected' && m.rejectionReason && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">반려 사유</p>
                <p className="text-sm text-red-600">{m.rejectionReason}</p>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              {m.role === 'pending' && (
                <>
                  <button
                    onClick={() => approveMember(m.uid)}
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-lg transition-colors disabled:opacity-60"
                  >
                    <CheckCircle size={14} /> 승인
                  </button>
                  <button
                    onClick={() => { setRejectTargetId(m.uid); setRejectReason(''); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
                  >
                    <XCircle size={14} /> 반려
                  </button>
                </>
              )}
              {m.role === 'rejected' && (
                <button
                  onClick={() => approveMember(m.uid)}
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-lg transition-colors disabled:opacity-60"
                >
                  <CheckCircle size={14} /> 승인으로 변경
                </button>
              )}
              <button
                onClick={() => deleteMember(m.uid)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-lg transition-colors ml-auto"
              >
                <Trash2 size={14} /> 삭제
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-amber-500" />
            <h2 className="text-lg font-bold text-gray-900">다음세대 관리</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {([
            { key: 'members', label: '회원 관리', badge: pendingMembers.length },
            { key: 'qa', label: 'Q&A', badge: unansweredQA },
            { key: 'contacts', label: '문의', badge: unreadContacts },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {t.badge > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none min-w-[18px] text-center">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="text-center py-8 text-gray-400 text-sm">로딩 중...</div>
          )}

          {/* MEMBERS TAB */}
          {!loading && tab === 'members' && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="이름, 이메일, 교회 검색"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              {pendingMembers.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Clock size={12} /> 승인 대기 ({pendingMembers.length})
                  </p>
                  {(search ? filteredMembers.filter(m => m.role === 'pending') : pendingMembers).map(m => (
                    <MemberRow key={m.uid} m={m} />
                  ))}
                </div>
              )}

              {approvedMembers.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <CheckCircle size={12} /> 승인된 회원 ({approvedMembers.length})
                  </p>
                  {(search ? filteredMembers.filter(m => m.role === 'member') : approvedMembers).map(m => (
                    <MemberRow key={m.uid} m={m} />
                  ))}
                </div>
              )}

              {rejectedMembers.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <XCircle size={12} /> 반려된 신청 ({rejectedMembers.length})
                  </p>
                  {(search ? filteredMembers.filter(m => m.role === 'rejected') : rejectedMembers).map(m => (
                    <MemberRow key={m.uid} m={m} />
                  ))}
                </div>
              )}

              {members.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Users size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">가입 신청이 없습니다.</p>
                </div>
              )}
            </div>
          )}

          {/* QA TAB */}
          {!loading && tab === 'qa' && (
            <div className="space-y-3">
              {qaItems.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <MessageSquare size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">등록된 질문이 없습니다.</p>
                </div>
              )}
              {qaItems.map(item => {
                const isExpanded = expandedId === item.id;
                return (
                  <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="w-full flex items-start gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            item.isAnswered ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {item.isAnswered ? '답변완료' : '미답변'}
                          </span>
                          <span className="text-xs text-gray-400">{item.authorName} · {formatDate(item.createdAt)}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                      </div>
                      {isExpanded ? <ChevronUp size={16} className="text-gray-400 mt-0.5 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-3">
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">질문</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.content}</p>
                        </div>
                        {item.isAnswered && item.answer && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <p className="text-xs font-medium text-amber-600 mb-1">목사님 답변 ({formatDate(item.answeredAt)})</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.answer}</p>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setAnswerTargetId(item.id); setAnswerText(item.answer || ''); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm rounded-lg transition-colors"
                          >
                            <MessageSquare size={14} /> {item.isAnswered ? '답변 수정' : '답변하기'}
                          </button>
                          <button
                            onClick={() => deleteDoc(doc(db, 'next_generation_qa', item.id))}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-lg transition-colors ml-auto"
                          >
                            <Trash2 size={14} /> 삭제
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* CONTACTS TAB */}
          {!loading && tab === 'contacts' && (
            <div className="space-y-3">
              {contacts.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Mail size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">등록된 문의가 없습니다.</p>
                </div>
              )}
              {contacts.map(item => {
                const isExpanded = expandedId === item.id;
                return (
                  <div key={item.id} className={`border rounded-lg overflow-hidden ${!item.isRead ? 'border-amber-300' : 'border-gray-200'}`}>
                    <button
                      onClick={() => {
                        setExpandedId(isExpanded ? null : item.id);
                        if (!item.isRead) markContactRead(item.id);
                      }}
                      className="w-full flex items-start gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          {!item.isRead && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">새 문의</span>
                          )}
                          <span className="text-xs text-gray-400">{item.name} · {item.email} · {formatDate(item.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-700 truncate">{item.message}</p>
                      </div>
                      {isExpanded ? <ChevronUp size={16} className="text-gray-400 mt-0.5 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-2">
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">문의 내용</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.message}</p>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <a
                            href={`mailto:${item.email}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm rounded-lg transition-colors"
                          >
                            <Mail size={14} /> 이메일 답장
                          </a>
                          <button
                            onClick={() => deleteDoc(doc(db, 'next_generation_contacts', item.id))}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-lg transition-colors"
                          >
                            <Trash2 size={14} /> 삭제
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {rejectTargetId && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-gray-900 mb-3">가입 신청 반려</h3>
            <p className="text-sm text-gray-600 mb-3">반려 사유를 입력해 주세요. 신청자에게 전달됩니다.</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none mb-4"
              placeholder="반려 사유 (선택)"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setRejectTargetId(null); setRejectReason(''); }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={rejectMember}
                disabled={submitting}
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                반려
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Answer Modal */}
      {answerTargetId && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-900 mb-3">Q&A 답변</h3>
            <textarea
              value={answerText}
              onChange={e => setAnswerText(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none mb-4"
              placeholder="답변을 입력해 주세요"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setAnswerTargetId(null); setAnswerText(''); }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={answerQA}
                disabled={submitting || !answerText.trim()}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                답변 등록
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
