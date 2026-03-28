import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, increment, orderBy } from 'firebase/firestore';
import { Heart, Lock, Edit2, Trash2, X as CloseIcon } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { logActivity } from '../utils/logger';

interface PrayerRequest {
  id: string;
  uid: string;
  authorName: string;
  content: string;
  isPrivate: boolean;
  prayCount: number;
  prayedBy: string[];
  createdAt: any;
}

const CANDLE_IMAGE = "https://lh3.googleusercontent.com/d/1yzsm7fX2PrakJfFQt0tzEuwmaHYvQ6lq";
const BACKGROUND_IMAGE = "https://lh3.googleusercontent.com/d/1opPxflZvaSvu30ags7dlFhnp76A-yD72";

export default function PrayerRoom() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<PrayerRequest[]>([]);
  const [content, setContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    if (role !== 'regular' && role !== 'admin') {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'prayer_requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PrayerRequest));
      const filtered = data.filter(r => 
        role === 'admin' || !r.isPrivate || r.uid === user?.uid
      );
      setRequests(filtered);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [role, user]);

  if (!loading && role !== 'regular' && role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#f5f2ed] text-[#5a5a40] flex items-center justify-center p-4">
        <div className="bg-[#ffffff]/80 p-8 rounded-2xl text-center shadow-lg border border-[#e5e7eb]">
          <p className="mb-6">‘기도자의 방’은 정회원 성도님들이 서로의 짐을 나누는 은밀한 공간입니다. 목사님께 등급 조정을 요청해 주세요.</p>
          <button onClick={() => navigate('/')} className="bg-[#5a5a40] text-white px-6 py-2 rounded-full font-bold hover:bg-[#4a4a35] transition">홈으로</button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user) return;
    await addDoc(collection(db, 'prayer_requests'), {
      uid: user.uid,
      authorName: user.displayName,
      content,
      isPrivate,
      prayCount: 0,
      prayedBy: [],
      createdAt: serverTimestamp()
    });
    setContent('');
    setIsPrivate(false);
  };

  const handleUpdate = async (id: string) => {
    await updateDoc(doc(db, 'prayer_requests', id), { 
      content: editContent,
      updatedAt: serverTimestamp() 
    });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'prayer_requests', id));
      setDeletingId(null);
    } catch (error) {
      console.error('Error deleting document:', error);
      try {
        handleFirestoreError(error, OperationType.DELETE, `prayer_requests/${id}`);
      } catch (e: any) {
        const info = JSON.parse(e.message);
        alert(`삭제에 실패했습니다: ${info.error}`);
      }
    }
  };

  const handlePray = async (id: string, prayedBy: string[] = []) => {
    if (!user) return;
    if (prayedBy.includes(user.uid)) {
      alert('이미 기도하셨습니다.');
      return;
    }
    await updateDoc(doc(db, 'prayer_requests', id), {
      prayCount: increment(1),
      prayedBy: [...prayedBy, user.uid],
      updatedAt: serverTimestamp()
    });
    
    // Action Tracking
    logActivity(user, role, '기도 응원 참여', `/prayer-room/pray/${id}`);
  };

  if (loading) return <div className="min-h-screen bg-[#f5f2ed] text-[#5a5a40] flex items-center justify-center">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-black">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 1 }}
        className="min-h-screen bg-cover bg-center text-[#fef3c7] p-4 md:p-8 relative overflow-hidden" style={{ backgroundImage: `url(${BACKGROUND_IMAGE})` }}
      >
        <div className="absolute inset-0 bg-black/30 z-0"></div>

      <div className="max-w-7xl mx-auto relative z-10 h-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-32 h-full min-h-[calc(100vh-160px)]">
          {/* Left Side: Verse and Input - Vertically Centered */}
          <div className="flex flex-col justify-center h-full py-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.5, duration: 1 }}
            >
              <header className="text-center bg-[#1e1e1e]/60 p-8 rounded-2xl backdrop-blur-sm border border-[#333] mb-8">
                <h1 className="font-serif text-xl md:text-2xl mb-4 text-[#fef3c7] leading-relaxed">"너는 기도할 때에 네 골방에 들어가 문을 닫고 은밀한 중에 계신 네 아버지께 기도하라..."</h1>
                <p className="text-[#f59e0b] font-serif text-xl">- 마태복음 6:6 -</p>
              </header>

              <form onSubmit={handleSubmit} className="bg-[#1e1e1e]/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-[#333]">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="기도 제목을 작성해주세요."
                  className="w-full bg-transparent border-b border-[#444] p-2 mb-6 focus:outline-none focus:border-[#f59e0b] transition text-[#fef3c7] placeholder-[#666] text-lg"
                  rows={4}
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-[#fef3c7]">
                    <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="accent-[#f59e0b]" />
                    <span className="text-sm">목사님께만 공개(비공개)</span>
                  </label>
                  <button type="submit" className="bg-[#f59e0b] text-black px-8 py-3 rounded-full font-bold hover:bg-[#d97706] transition shadow-lg">기도 올리기</button>
                </div>
              </form>
            </motion.div>
          </div>

          {/* Right Side: Prayer Requests List with Scroll Indicator */}
          <div className="relative h-full max-h-[calc(100vh-160px)] flex flex-col">
            <div className="space-y-6 overflow-y-auto pr-2 no-scrollbar flex-1 pb-20">
              {requests.length === 0 ? (
                <div className="text-center py-20 bg-[#1e1e1e]/40 rounded-2xl border border-[#333] backdrop-blur-sm">
                  <p className="text-[#fef3c7]/60 italic">아직 올라온 기도제목이 없습니다.</p>
                </div>
              ) : (
                requests.map((req, index) => (
                  <motion.div 
                    key={req.id} 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: 1.8 + (index * 0.1), duration: 0.5 }}
                    className="bg-[#2d2a1a]/80 backdrop-blur-sm p-6 rounded-2xl border border-[#f59e0b]/30 shadow-lg"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <p className="font-bold text-[#fef3c7]">{req.authorName}</p>
                      <div className="flex items-center gap-4">
                        {req.isPrivate && <Lock size={18} className="text-[#f59e0b]" />}
                      {(role === 'admin' || req.uid === user?.uid) && (
                        <div className="flex items-center gap-2">
                          {deletingId === req.id ? (
                            <div className="flex items-center gap-2 bg-red-900/50 px-3 py-1 rounded-lg border border-red-500/50">
                              <span className="text-xs font-bold text-red-200">삭제할까요?</span>
                              <button onClick={() => handleDelete(req.id)} className="text-red-400 hover:text-red-200 font-bold text-xs underline">예</button>
                              <button onClick={() => setDeletingId(null)} className="text-gray-400 hover:text-white font-bold text-xs underline">아니오</button>
                            </div>
                          ) : (
                            <>
                              <button onClick={() => { setEditingId(req.id); setEditContent(req.content); }} className="text-[#fef3c7] hover:text-[#f59e0b] p-1 transition-colors"><Edit2 size={18} /></button>
                              <button onClick={() => setDeletingId(req.id)} className="text-red-400 hover:text-red-300 p-1 transition-colors"><Trash2 size={18} /></button>
                            </>
                          )}
                        </div>
                      )}
                      </div>
                    </div>
                    {editingId === req.id ? (
                      <div className="mb-6">
                        <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full bg-[#1e1e1e] p-2 rounded text-[#fef3c7]" rows={3} />
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => handleUpdate(req.id)} className="bg-[#f59e0b] text-black px-4 py-1 rounded font-bold text-sm">저장</button>
                          <button onClick={() => setEditingId(null)} className="bg-[#444] text-white px-4 py-1 rounded font-bold text-sm">취소</button>
                        </div>
                      </div>
                    ) : <p className="mb-6 whitespace-pre-wrap text-[#fef3c7] leading-relaxed">{req.content}</p>}
                    <button onClick={() => handlePray(req.id, req.prayedBy || [])} className="flex items-center gap-2 text-[#f59e0b] hover:text-[#d97706] transition group">
                      <Heart size={18} className={req.prayedBy?.includes(user?.uid || '') ? "fill-[#f59e0b]" : "group-hover:scale-110 transition-transform"} />
                      <span className="font-bold">함께 기도합니다 ({req.prayCount})</span>
                    </button>
                  </motion.div>
                ))
              )}
            </div>
            
            {/* Scroll Indicator Gradient */}
            {requests.length > 2 && (
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none rounded-b-2xl flex items-end justify-center pb-6">
                <motion.div
                  animate={{ y: [0, 8, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  className="text-[#f59e0b] flex flex-col items-center gap-2"
                >
                  <span className="text-[10px] uppercase tracking-[0.2em] font-black drop-shadow-lg">기도제목 더보기</span>
                  <div className="w-px h-12 bg-gradient-to-b from-[#f59e0b] to-transparent shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                </motion.div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
    </div>
  );
}
