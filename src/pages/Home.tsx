import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Users, Heart, Edit2, Check, X as CloseIcon } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../lib/auth';

const DEFAULT_HERO_IMAGE = "https://lh3.googleusercontent.com/d/1V0VulPP6zYJLhZCS_Ytmq2Ad2tndcEm0";

export default function Home() {
  const { role } = useAuth();
  const [heroImage, setHeroImage] = useState(DEFAULT_HERO_IMAGE);
  const [isEditing, setIsEditing] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const getDirectImageUrl = (url: string) => {
      if (!url) return url;
      const driveMatch = url.match(/\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/);
      if (driveMatch && driveMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
      }
      return url;
    };

    const unsub = onSnapshot(doc(db, 'settings', 'hero'), (doc) => {
      if (doc.exists()) {
        const rawUrl = doc.data().heroImageUrl;
        setHeroImage(getDirectImageUrl(rawUrl) || DEFAULT_HERO_IMAGE);
      }
    });
    return () => unsub();
  }, []);

  const handleUpdateHero = async () => {
    let url = newImageUrl.trim();
    if (!url) return;

    // Convert Google Drive sharing link to direct link (using lh3.googleusercontent.com for better reliability)
    const driveMatch = url.match(/\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      url = `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    }

    setSubmitting(true);
    try {
      await setDoc(doc(db, 'settings', 'hero'), {
        heroImageUrl: url,
        updatedAt: serverTimestamp()
      });
      setIsEditing(false);
      setNewImageUrl('');
    } catch (error) {
      console.error('Error updating hero image:', error);
      alert('이미지 업데이트에 실패했습니다. 관리자 권한으로 로그인되어 있는지 확인해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative h-[80vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            key={heroImage} // Force re-render when image changes
            src={heroImage}
            alt="Beautiful stone church architecture"
            className="w-full h-full object-cover transition-opacity duration-1000"
            referrerPolicy="no-referrer"
            onError={(e) => {
              console.error('Image failed to load:', heroImage);
              // Fallback if the URL is invalid
              if (heroImage !== DEFAULT_HERO_IMAGE) {
                setHeroImage(DEFAULT_HERO_IMAGE);
              }
            }}
          />
          <div className="absolute inset-0 bg-wood-950/70 mix-blend-multiply" />
        </div>

        {/* Admin Edit Button */}
        {role === 'admin' && !isEditing && (
          <button
            onClick={() => {
              setNewImageUrl(heroImage);
              setIsEditing(true);
            }}
            className="absolute top-24 right-8 z-20 bg-white/20 hover:bg-white/40 text-white p-3 rounded-full backdrop-blur-sm transition-all border border-white/30 group"
            title="배경 이미지 수정"
          >
            <Edit2 size={20} className="group-hover:scale-110 transition-transform" />
          </button>
        )}

        {/* Admin Edit Modal/Overlay */}
        {isEditing && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-wood-950/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl border border-wood-100"
            >
              <h3 className="text-2xl font-serif font-bold text-wood-900 mb-6">배경 이미지 수정</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-wood-700 mb-2">이미지 URL</label>
                  <input
                    type="text"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="구글 드라이브 링크 또는 이미지 주소"
                    className="w-full px-4 py-3 rounded-xl border border-wood-200 focus:ring-2 focus:ring-wood-500 focus:border-transparent outline-none transition bg-wood-50"
                  />
                  <p className="mt-2 text-xs text-wood-500">
                    구글 드라이브 공유 링크를 붙여넣으시면 자동으로 변환됩니다.<br />
                    (파일이 '링크가 있는 모든 사용자'에게 공개되어 있어야 합니다.)
                  </p>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleUpdateHero}
                    disabled={submitting}
                    className="flex-1 bg-wood-900 text-white py-3 rounded-xl font-medium hover:bg-wood-800 transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Check size={18} />
                        저장하기
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex-1 bg-wood-100 text-wood-700 py-3 rounded-xl font-medium hover:bg-wood-200 transition flex items-center justify-center gap-2"
                  >
                    <CloseIcon size={18} />
                    취소
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <h1 className="text-4xl md:text-6xl font-serif font-bold text-white mb-6 leading-tight drop-shadow-lg">
              함께 지어져가는 <span className="text-gold-400">교회</span>
            </h1>
            <p className="text-xl md:text-2xl text-wood-100 mb-2 max-w-3xl mx-auto font-serif font-light leading-relaxed">
              "너희도 성령 안에서 하나님이 거하실 처소가 되기 위하여<br className="hidden md:block" />
              그리스도 예수 안에서 함께 지어져 가느니라"
            </p>
            <p className="text-xl md:text-2xl text-wood-100 font-serif font-light mb-12">에베소서 2:22</p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/intro"
                className="inline-flex items-center justify-center px-8 py-4 text-base font-medium rounded-full text-wood-900 bg-white hover:bg-wood-50 transition shadow-lg"
              >
                교회 소개
                <ArrowRight className="ml-2" size={20} />
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center px-8 py-4 text-base font-medium rounded-full text-white border-2 border-white/30 hover:bg-white/10 transition"
              >
                개척 모임 참여
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Vision Section */}
      <section className="py-24 bg-wood-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-serif font-bold text-wood-900 mb-4">우리의 비전</h2>
            <div className="w-24 h-1 bg-gold-500 mx-auto mb-8" />
            <p className="text-lg text-wood-700 max-w-2xl mx-auto leading-relaxed">
              개혁주의 신학의 든든한 반석 위에 서서, 성경적 예배와 목양을 통해<br />
              하나님의 영광을 드러내는 공동체를 세워갑니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                icon: BookOpen,
                title: "바른 말씀",
                desc: "오직 성경(Sola Scriptura)의 원리에 따라, 개혁주의 신학에 기초한 강해 설교를 지향합니다."
              },
              {
                icon: Heart,
                title: "참된 예배",
                desc: "하나님 중심의 경건하고 질서 있는 예배를 통해 삼위일체 하나님께 영광을 돌립니다."
              },
              {
                icon: Users,
                title: "사랑의 교제",
                desc: "그리스도의 몸 된 지체로서 서로를 돌아보고 세워주는 성경적 목양과 교제를 나눕니다."
              }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className="bg-white p-8 rounded-2xl shadow-sm border border-wood-100 text-center hover:shadow-md transition"
              >
                <div className="w-16 h-16 bg-wood-50 rounded-full flex items-center justify-center mx-auto mb-6 text-wood-900">
                  <item.icon size={32} />
                </div>
                <h3 className="text-xl font-bold text-wood-900 mb-4">{item.title}</h3>
                <p className="text-wood-600 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
