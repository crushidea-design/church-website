import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Bell, Send, ArrowLeft, Users, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function AdminNotifications() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    if (role !== 'admin') {
      navigate('/');
      return;
    }

    const fetchTokenCount = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'fcm_tokens'));
        setTokenCount(snapshot.size);
      } catch (error) {
        console.error('Error fetching tokens:', error);
      }
    };

    fetchTokenCount();
  }, [role, navigate]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) return;

    setLoading(true);
    setStatus(null);

    try {
      // Fetch all tokens
      const snapshot = await getDocs(collection(db, 'fcm_tokens'));
      const tokens = snapshot.docs.map(doc => doc.data().token);

      if (tokens.length === 0) {
        setStatus({ type: 'error', message: '알림을 받을 수 있는 기기가 없습니다.' });
        setLoading(false);
        return;
      }

      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, targetTokens: tokens }),
      });

      const result = await response.json();

      if (result.success) {
        setStatus({ 
          type: 'success', 
          message: `알림 발송 성공! (성공: ${result.successCount}, 실패: ${result.failureCount})` 
        });
        setTitle('');
        setBody('');
      } else {
        setStatus({ type: 'error', message: result.error || '알림 발송에 실패했습니다.' });
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      setStatus({ type: 'error', message: '서버 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-wood-100 min-h-screen py-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/admin')}
            className="p-2 hover:bg-white rounded-full transition shadow-sm border border-wood-200"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-serif font-bold text-wood-900">알림 발송</h1>
            <p className="text-wood-600">성도들에게 모바일 푸시 알림을 보냅니다.</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 border border-wood-200 shadow-sm">
          <div className="flex items-center gap-3 mb-8 p-4 bg-orange-50 rounded-2xl border border-orange-100">
            <Users className="text-orange-600" />
            <div>
              <p className="text-sm text-orange-800 font-medium">현재 알림 수신 가능 기기</p>
              <p className="text-2xl font-bold text-orange-900">{tokenCount}대</p>
            </div>
          </div>

          <form onSubmit={handleSend} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-wood-700 mb-2">알림 제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 이번 주 주보 안내"
                className="w-full px-4 py-3 rounded-xl border border-wood-200 focus:ring-2 focus:ring-gold-500 outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-wood-700 mb-2">알림 내용</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="성도들에게 전달할 내용을 입력하세요."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-wood-200 focus:ring-2 focus:ring-gold-500 outline-none transition resize-none"
                required
              />
            </div>

            {status && (
              <div className={`p-4 rounded-xl flex items-center gap-3 ${
                status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
              }`}>
                {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                <p className="text-sm font-medium">{status.message}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !title || !body}
              className="w-full bg-wood-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-wood-800 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <Send size={20} />
                  알림 발송하기
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-8 p-6 bg-blue-50 rounded-2xl border border-blue-100">
          <h4 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
            <AlertCircle size={16} />
            알림 발송 전 확인사항
          </h4>
          <ul className="text-xs text-blue-800 space-y-1 list-disc pl-4">
            <li>알림은 '알림 허용'을 한 성도들에게만 발송됩니다.</li>
            <li>너무 잦은 알림은 성도들에게 불편을 줄 수 있으니 주의해 주세요.</li>
            <li>발송 후에는 취소할 수 없습니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
