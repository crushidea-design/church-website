import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Edit2, Check, X as CloseIcon } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../lib/auth';

const DEFAULT_INTRO_IMAGE = "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80";

export default function Introduction() {
  const { role } = useAuth();
  const [introImage, setIntroImage] = useState(DEFAULT_INTRO_IMAGE);
  const [isEditing, setIsEditing] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const [introTitle1, setIntroTitle1] = useState('개혁주의 신학의 정체성');
  const [introContent1, setIntroContent1] = useState("'함께 지어져가는 교회'는 역사적 개혁주의 신앙고백(웨스트민스터 신앙고백서, 하이델베르크 요리문답 등)을 우리의 신앙과 삶의 표준으로 삼습니다. 오직 성경, 오직 은혜, 오직 믿음, 오직 그리스도, 오직 하나님께 영광이라는 종교개혁의 5대 솔라(Sola)를 굳게 붙듭니다.");
  const [introTitle2, setIntroTitle2] = useState('개척 준비 과정');
  const [introContent2, setIntroContent2] = useState('현재 우리는 하나님의 인도하심을 구하며 교회를 세워가기 위한 기도의 시간을 갖고 있습니다. 바른 말씀 선포와 참된 예배의 회복을 갈망하는 성도들과 함께, 에베소서 2장 22절 말씀처럼 그리스도 예수 안에서 성령의 전으로 지어져 가기를 소망합니다.');
  const [quote, setQuote] = useState('"우리는 건물이 아니라 사람을 세우는 일에 부름받았습니다. 하나님의 말씀이 선포되고, 성례가 바르게 집행되며, 권징이 신실하게 시행되는 참된 교회의 표지를 회복하는 여정에 여러분을 초대합니다."');

  useEffect(() => {
    const getDirectImageUrl = (url: string) => {
      if (!url) return url;
      const driveMatch = url.match(/\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/);
      if (driveMatch && driveMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
      }
      return url;
    };

    const unsubImage = onSnapshot(doc(db, 'settings', 'intro'), (doc) => {
      if (doc.exists()) {
        const rawUrl = doc.data().introImageUrl;
        setIntroImage(getDirectImageUrl(rawUrl) || DEFAULT_INTRO_IMAGE);
      }
    });

    const unsubText = onSnapshot(doc(db, 'settings', 'church_info'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.introTitle1) setIntroTitle1(data.introTitle1);
        if (data.introContent1) setIntroContent1(data.introContent1);
        if (data.introTitle2) setIntroTitle2(data.introTitle2);
        if (data.introContent2) setIntroContent2(data.introContent2);
        if (data.quote) setQuote(data.quote);
      }
    });

    return () => {
      unsubImage();
      unsubText();
    };
  }, []);

  const handleUpdateImage = async () => {
    let url = newImageUrl.trim();
    if (!url) return;

    const driveMatch = url.match(/\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      url = `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    }

    setSubmitting(true);
    try {
      await setDoc(doc(db, 'settings', 'intro'), {
        introImageUrl: url,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setIsEditing(false);
      setNewImageUrl('');
    } catch (error) {
      console.error('Error updating intro image:', error);
      alert('이미지 업데이트에 실패했습니다. 관리자 권한으로 로그인되어 있는지 확인해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white pt-5 pb-16 sm:pt-10 sm:pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="text-center mb-12">
            <h1 className="text-4xl font-serif font-bold text-wood-900 mb-4">교회 소개</h1>
            <div className="w-24 h-1 bg-gold-500 mx-auto" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="relative group">
              <img
                key={introImage}
                src={introImage}
                alt="Bible and light"
                className="rounded-2xl shadow-xl object-cover h-[500px] w-full border-4 border-wood-200 transition-opacity duration-500"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  console.error('Image failed to load:', introImage);
                  if (introImage !== DEFAULT_INTRO_IMAGE) {
                    setIntroImage(DEFAULT_INTRO_IMAGE);
                  }
                }}
              />
              
              {/* Admin Edit Button */}
              {role === 'admin' && !isEditing && (
                <button
                  onClick={() => {
                    setNewImageUrl(introImage);
                    setIsEditing(true);
                  }}
                  className="absolute top-4 right-4 z-20 bg-white/80 hover:bg-white text-wood-900 p-3 rounded-full backdrop-blur-sm transition-all shadow-md"
                  title="이미지 수정"
                >
                  <Edit2 size={20} className="hover:scale-110 transition-transform" />
                </button>
              )}

              {/* Admin Edit Modal/Overlay */}
              {isEditing && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-wood-950/60 backdrop-blur-sm p-4 rounded-2xl">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl p-6 w-full shadow-2xl border border-wood-100"
                  >
                    <h3 className="text-lg font-serif font-bold text-wood-900 mb-4">이미지 수정</h3>
                    <div className="space-y-4">
                      <div>
                        <input
                          type="text"
                          value={newImageUrl}
                          onChange={(e) => setNewImageUrl(e.target.value)}
                          placeholder="구글 드라이브 링크 또는 이미지 주소"
                          className="w-full px-3 py-2 text-sm rounded-xl border border-wood-200 focus:ring-2 focus:ring-wood-500 focus:border-transparent outline-none transition bg-wood-50"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleUpdateImage}
                          disabled={submitting}
                          className="flex-1 bg-wood-900 text-white py-2 rounded-xl text-sm font-medium hover:bg-wood-800 transition flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          {submitting ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <>
                              <Check size={16} />
                              저장
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setIsEditing(false)}
                          className="flex-1 bg-wood-100 text-wood-700 py-2 rounded-xl text-sm font-medium hover:bg-wood-200 transition flex items-center justify-center gap-1"
                        >
                          <CloseIcon size={16} />
                          취소
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </div>
            
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-wood-900 mb-4">{introTitle1}</h2>
                <p className="text-wood-700 leading-relaxed text-lg whitespace-pre-wrap">
                  {introContent1}
                </p>
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-wood-900 mb-4">{introTitle2}</h2>
                <p className="text-wood-700 leading-relaxed text-lg whitespace-pre-wrap">
                  {introContent2}
                </p>
              </div>

              <div className="bg-wood-50 p-6 rounded-xl border-l-4 border-wood-900">
                <p className="font-serif italic text-wood-900 text-lg leading-relaxed whitespace-pre-wrap">
                  {quote}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
