import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/utils';
import { Mail, Trash2, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: any;
}

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

    const q = query(collection(db, 'contacts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ContactMessage[];
      setMessages(data);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching messages:', error);
      handleFirestoreError(error, OperationType.GET, 'contacts');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [role, authLoading, navigate]);

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    try {
      await deleteDoc(doc(db, 'contacts', id));
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('메시지 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wood-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wood-900"></div>
      </div>
    );
  }

  return (
    <div className="bg-wood-100 min-h-screen py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-white rounded-2xl shadow-sm border border-wood-200">
            <Mail className="text-wood-900" size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-wood-900">문의 메시지 관리</h1>
            <p className="text-wood-600">사용자들이 남긴 문의 내용을 확인하고 관리합니다.</p>
          </div>
        </div>

        {messages.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-wood-200 p-12 text-center text-wood-500">
            <Mail className="mx-auto h-12 w-12 text-wood-300 mb-4" />
            <p className="text-lg">접수된 문의 메시지가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-sm border border-wood-200 overflow-hidden"
              >
                <div 
                  className="p-6 cursor-pointer hover:bg-wood-50 transition flex items-center justify-between"
                  onClick={() => setExpandedId(expandedId === msg.id ? null : msg.id)}
                >
                  <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-xs font-bold text-wood-400 uppercase tracking-wider block mb-1">보낸 사람</span>
                      <span className="font-medium text-wood-900">{msg.name}</span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-wood-400 uppercase tracking-wider block mb-1">이메일</span>
                      <span className="text-wood-600">{msg.email}</span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-wood-400 uppercase tracking-wider block mb-1">날짜</span>
                      <span className="text-wood-500">{formatDate(msg.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-4">
                    {showDeleteConfirm !== msg.id ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(msg.id);
                        }}
                        className="p-2 text-wood-400 hover:text-red-600 transition rounded-full hover:bg-red-50"
                        title="삭제"
                      >
                        <Trash2 size={18} />
                      </button>
                    ) : (
                      <div className="flex items-center space-x-2 bg-red-50 p-1 rounded-lg border border-red-100" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(msg.id)}
                          disabled={isDeleting === msg.id}
                          className="text-[10px] bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50 transition"
                        >
                          {isDeleting === msg.id ? '...' : '삭제'}
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(null)}
                          disabled={isDeleting === msg.id}
                          className="text-[10px] bg-wood-200 text-wood-700 px-2 py-1 rounded hover:bg-wood-300 transition"
                        >
                          취소
                        </button>
                      </div>
                    )}
                    {expandedId === msg.id ? <ChevronUp size={20} className="text-wood-400" /> : <ChevronDown size={20} className="text-wood-400" />}
                  </div>
                </div>
                
                {expandedId === msg.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="px-6 pb-6 pt-2 border-t border-wood-100 bg-wood-50/30"
                  >
                    <div className="bg-white p-6 rounded-xl border border-wood-100 shadow-inner">
                      <span className="text-xs font-bold text-wood-400 uppercase tracking-wider block mb-3">내용</span>
                      <p className="text-wood-800 whitespace-pre-wrap leading-relaxed">
                        {msg.message}
                      </p>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
