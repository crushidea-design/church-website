import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { collection, query, orderBy, deleteDoc, doc, updateDoc, limit, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/utils';
import { Mail, Trash2, ChevronDown, ChevronUp, AlertCircle, Inbox, Clock3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  read?: boolean;
  createdAt: any;
}

const replySubject = '[함께 지어져가는 교회] 문의하신 내용에 답변드립니다.';

export default function AdminContacts() {
  const { role, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (role !== 'admin') {
      navigate('/');
      return;
    }

    const fetchMessages = async () => {
      try {
        const q = query(collection(db, 'contacts'), orderBy('createdAt', 'desc'), limit(100));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((contactDoc) => ({
          id: contactDoc.id,
          ...contactDoc.data(),
        })) as ContactMessage[];
        setMessages(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching messages:', error);
        handleFirestoreError(error, OperationType.GET, 'contacts');
        setLoading(false);
      }
    };

    fetchMessages();
  }, [role, authLoading, navigate]);

  const unreadCount = useMemo(() => messages.filter((message) => !message.read).length, [messages]);

  const latestMessageDate = useMemo(() => {
    if (!messages.length || !messages[0].createdAt) {
      return '-';
    }

    return formatDate(messages[0].createdAt);
  }, [messages]);

  const handleExpand = async (id: string, isRead: boolean) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(id);
    if (!isRead) {
      try {
        await updateDoc(doc(db, 'contacts', id), { read: true });
        setMessages((prev) =>
          prev.map((message) =>
            message.id === id
              ? {
                  ...message,
                  read: true,
                }
              : message
          )
        );
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    try {
      await deleteDoc(doc(db, 'contacts', id));
      setMessages((prev) => prev.filter((message) => message.id !== id));
      setShowDeleteConfirm(null);
      if (expandedId === id) {
        setExpandedId(null);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('메시지를 삭제하는 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(null);
    }
  };

  const buildReplyHref = (message: ContactMessage) => {
    const body = `${message.name}님 안녕하세요.\n\n문의하신 내용에 답변드립니다.\n\n\n\n--- 이전 문의 내용 ---\n${message.message}`;
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${message.email}&su=${encodeURIComponent(replySubject)}&body=${encodeURIComponent(body)}`;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wood-50">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-wood-900" />
      </div>
    );
  }

  return (
    <AdminLayout
      title="문의 관리"
      description="홈페이지로 들어온 문의를 빠르게 읽고, 답변이 필요한 항목을 정리할 수 있도록 구성했습니다."
      backTo="/admin"
      backLabel="관리자 대시보드"
      badge="소통"
      icon={<Mail size={14} />}
      maxWidthClassName="max-w-5xl"
      aside={
        <div className="grid min-w-[220px] gap-3">
          <div className="flex items-center justify-between gap-4">
            <span className="text-wood-500">전체 문의</span>
            <strong className="text-wood-900">{messages.length}</strong>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-wood-500">읽지 않음</span>
            <strong className="text-amber-700">{unreadCount}</strong>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-wood-500">최근 문의</span>
            <strong className="text-wood-900">{latestMessageDate}</strong>
          </div>
        </div>
      }
    >
      {messages.length === 0 ? (
        <div className="rounded-[2rem] border border-wood-200 bg-white p-12 text-center text-wood-500 shadow-sm">
          <Inbox className="mx-auto mb-4 h-12 w-12 text-wood-300" />
          <p className="text-lg font-medium text-wood-700">아직 접수된 문의가 없습니다.</p>
          <p className="mt-2 text-sm text-wood-500">새 문의가 들어오면 이 화면에서 바로 확인할 수 있습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((message) => {
            const isExpanded = expandedId === message.id;
            const isUnread = !message.read;

            return (
              <motion.div
                key={message.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-[1.75rem] border border-wood-200 bg-white shadow-sm"
              >
                <div
                  className={`flex cursor-pointer items-center justify-between gap-4 p-6 transition hover:bg-wood-50 ${isUnread ? 'bg-amber-50/50' : ''}`}
                  onClick={() => handleExpand(message.id, !isUnread ? true : false)}
                >
                  <div className="grid flex-grow grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_auto]">
                    <div className="flex items-center gap-3">
                      {isUnread && <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />}
                      <div>
                        <p className="mb-1 text-xs font-bold uppercase tracking-wider text-wood-400">보낸 분</p>
                        <p className="font-medium text-wood-900">{message.name}</p>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-wood-400">이메일</p>
                      <div className="flex items-center gap-2">
                        <a
                          href={buildReplyHref(message)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="truncate text-wood-600 transition-colors hover:text-wood-900 hover:underline"
                        >
                          {message.email}
                        </a>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            navigator.clipboard.writeText(message.email);
                          }}
                          className="rounded-full p-1 text-wood-400 transition hover:bg-wood-100 hover:text-wood-700"
                          title="이메일 복사"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-3.5 w-3.5"
                          >
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-sm text-wood-500">
                      <Clock3 size={16} className="mt-0.5 text-wood-400" />
                      <span>{formatDate(message.createdAt)}</span>
                    </div>
                  </div>

                  <div className="ml-2 flex items-center gap-3">
                    {showDeleteConfirm !== message.id ? (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setShowDeleteConfirm(message.id);
                        }}
                        className="rounded-full p-2 text-wood-400 transition hover:bg-red-50 hover:text-red-600"
                        title="문의 삭제"
                      >
                        <Trash2 size={18} />
                      </button>
                    ) : (
                      <div
                        className="flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-2 py-1"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          onClick={() => handleDelete(message.id)}
                          disabled={isDeleting === message.id}
                          className="rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                        >
                          {isDeleting === message.id ? '삭제 중' : '삭제'}
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(null)}
                          disabled={isDeleting === message.id}
                          className="rounded-full bg-white px-3 py-1 text-xs font-medium text-wood-700 transition hover:bg-wood-100"
                        >
                          취소
                        </button>
                      </div>
                    )}

                    {isExpanded ? (
                      <ChevronUp size={20} className="text-wood-400" />
                    ) : (
                      <ChevronDown size={20} className="text-wood-400" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="border-t border-wood-100 bg-wood-50/40 px-6 pb-6 pt-3"
                  >
                    <div className="rounded-[1.5rem] border border-wood-100 bg-white p-6 shadow-inner">
                      <div className="mb-5 flex items-start justify-between gap-4">
                        <div>
                          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-wood-400">문의 내용</p>
                          <p className="whitespace-pre-wrap leading-7 text-wood-800">{message.message}</p>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <a
                          href={buildReplyHref(message)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-full bg-wood-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-wood-800"
                        >
                          <Mail size={16} className="mr-2" />
                          Gmail로 답장 보내기
                        </a>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}

          <div className="rounded-[1.5rem] border border-blue-100 bg-blue-50 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="mt-0.5 text-blue-700" />
              <div>
                <p className="font-medium text-blue-900">운영 메모</p>
                <p className="mt-1 text-sm leading-6 text-blue-800">
                  문의를 열면 읽음 처리되고, 답장은 Gmail 작성 화면으로 바로 이어집니다. 삭제는 즉시 반영되므로, 처리 기록이 필요하면
                  먼저 답장을 남긴 뒤 정리하는 흐름이 안전합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
