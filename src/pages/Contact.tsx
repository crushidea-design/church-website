import React, { useState } from 'react';
import { motion } from 'motion/react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Mail, MapPin, Phone } from 'lucide-react';

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'contacts'), {
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        createdAt: serverTimestamp()
      });
      setSuccess(true);
      setName('');
      setEmail('');
      setMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'contacts');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-wood-100 py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-serif font-bold text-wood-900 mb-4">문의 및 개척 모임 참여</h1>
          <div className="w-24 h-1 bg-gold-500 mx-auto mb-8" />
          <p className="text-lg text-wood-700 max-w-2xl mx-auto leading-relaxed">
            '함께 지어져가는 교회'의 개척 준비 모임에 참여하시거나,
            목사님께 궁금한 점이 있으시다면 언제든 연락해 주세요.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="bg-wood-50 rounded-3xl p-10 lg:p-12 flex flex-col justify-center border border-wood-200"
          >
            <h2 className="text-2xl font-bold text-wood-900 mb-8">연락처 정보</h2>
            <div className="space-y-8">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <Mail className="h-6 w-6 text-gold-500" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-wood-900">이메일</h3>
                  <p className="mt-1 text-wood-600">crushidea@gmail.com</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <MapPin className="h-6 w-6 text-gold-500" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-wood-900">예배 및 모임 장소</h3>
                  <p className="mt-1 text-wood-600">현재 개척 준비 중으로, 모임 장소는 개별 안내해 드립니다.</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <Phone className="h-6 w-6 text-gold-500" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-wood-900">전화번호</h3>
                  <p className="mt-1 text-wood-600">이메일로 먼저 연락 주시면 회신드리겠습니다.</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="bg-white rounded-3xl shadow-lg border border-wood-100 p-10 lg:p-12"
          >
            {success ? (
              <div className="text-center py-12">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-forest-100 mb-6">
                  <svg className="h-8 w-8 text-forest-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-wood-900 mb-2">메시지가 전송되었습니다</h3>
                <p className="text-wood-600">
                  소중한 연락 감사합니다. 빠른 시일 내에 답변드리겠습니다.
                </p>
                <button
                  onClick={() => setSuccess(false)}
                  className="mt-8 text-wood-900 font-medium hover:underline"
                >
                  새로운 메시지 보내기
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-wood-700 mb-2">
                    이름
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full rounded-xl border-wood-200 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-4 bg-wood-50"
                    placeholder="홍길동"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-wood-700 mb-2">
                    이메일
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-xl border-wood-200 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-4 bg-wood-50"
                    placeholder="example@email.com"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-wood-700 mb-2">
                    문의 내용
                  </label>
                  <textarea
                    id="message"
                    rows={6}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="block w-full rounded-xl border-wood-200 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-4 bg-wood-50"
                    placeholder="개척 모임 참여 희망, 또는 궁금한 점을 남겨주세요."
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex justify-center py-4 px-4 border border-transparent rounded-full shadow-sm text-base font-medium text-white bg-wood-900 hover:bg-wood-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-wood-500 disabled:opacity-50 transition"
                >
                  {submitting ? '전송 중...' : '메시지 보내기'}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
