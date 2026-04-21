import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function NextGenerationContact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('이름을 입력해 주세요.'); return; }
    if (!isValidEmail(email.trim())) { setError('올바른 이메일 주소를 입력해 주세요.'); return; }
    if (!message.trim()) { setError('문의 내용을 입력해 주세요.'); return; }
    if (message.trim().length > 5000) { setError('문의 내용은 5000자 이하로 입력해 주세요.'); return; }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'next_generation_contacts'), {
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        createdAt: serverTimestamp(),
        isRead: false,
      });
      setSubmitted(true);
    } catch (err: any) {
      setError('전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 px-4">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-amber-500" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">문의가 접수되었습니다</h3>
        <p className="text-gray-500 text-sm mb-6">
          목사님께 전달되었습니다. 빠른 시일 내에 연락 드리겠습니다.
        </p>
        <button
          onClick={() => { setSubmitted(false); setName(''); setEmail(''); setMessage(''); }}
          className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors text-sm"
        >
          새 문의 작성
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900">문의하기</h3>
        <p className="text-sm text-gray-500 mt-1">
          다음세대 사역에 대한 문의나 제안을 보내주세요.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            maxLength={100}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
            placeholder="이름을 입력해 주세요"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            이메일 <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
            placeholder="답장 받으실 이메일"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            문의 내용 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            required
            rows={6}
            maxLength={5000}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm resize-none"
            placeholder="문의 내용을 자유롭게 작성해 주세요"
          />
          <p className="text-right text-xs text-gray-400 mt-1">{message.length}/5000</p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <><Loader2 size={16} className="animate-spin" /> 전송 중...</>
          ) : (
            <><Send size={16} /> 문의 보내기</>
          )}
        </button>
      </form>
    </div>
  );
}
