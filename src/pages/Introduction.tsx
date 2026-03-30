import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Edit2, Check, X as CloseIcon, BookOpen, Heart, Users } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../lib/auth';
import Logo from '../components/Logo';

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
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);

  // New State Variables
  const [nameQuote, setNameQuote] = useState('“성령 안에서 하나님이 거하실 처소가 되기 위하여 그리스도 예수 안에서 함께 지어져 가느니라”');
  const [nameQuoteSource, setNameQuoteSource] = useState('(에베소서 2:22)');
  const [nameDescription, setNameDescription] = useState('함께 지어져가는 교회의 이름과 로고는 삼위일체 하나님의 현존과 성도의 연합, 그리고 멈추지 않는 영적 갱신을 향한 우리의 고백을 담고 있습니다.');
  const [nameMeaningTitle, setNameMeaningTitle] = useState('교회 이름의 의미');
  const [nameMeaningIntro, setNameMeaningIntro] = useState('‘함께 지어져가는 교회’는 완성된 건물로서의 결과가 아닌, 날마다 새롭게 세워져 가는 ‘거룩한 과정’에 집중합니다.');
  const [namePoint1Title, setNamePoint1Title] = useState('현재진행형의 공동체');
  const [namePoint1Desc, setNamePoint1Desc] = useState('우리는 이미 구원받은 백성이지만, 동시에 그리스도의 장성한 분량에 이르기까지 끊임없이 자라나야 하는 존재입니다.');
  const [namePoint2Title, setNamePoint2Title] = useState('개혁된 교회는 항상 개혁되어야 합니다');
  const [namePoint2Sub, setNamePoint2Sub] = useState('“Ecclesia reformata, semper reformanda”');
  const [namePoint2Desc, setNamePoint2Desc] = useState('우리 교회는 과거의 전통에 안주하지 않고 오직 하나님의 말씀이라는 척도 아래 날마다 자신을 개혁하며, 거룩한 처소로 지어져 가기를 멈추지 않을 것입니다.');

  const [visionTitle, setVisionTitle] = useState('우리의 비전');
  const [visionDesc, setVisionDesc] = useState('개혁주의 신학의 든든한 반석 위에 서서, 성경적 예배와 목양을 통해\n하나님의 영광을 드러내는 공동체를 세워갑니다.');
  const [visionPoint1Title, setVisionPoint1Title] = useState('바른 말씀');
  const [visionPoint1Desc, setVisionPoint1Desc] = useState('오직 성경(Sola Scriptura)의 원리에 따라, 개혁주의 신학에 기초한 강해 설교를 지향합니다.');
  const [visionPoint2Title, setVisionPoint2Title] = useState('참된 예배');
  const [visionPoint2Desc, setVisionPoint2Desc] = useState('하나님 중심의 경건하고 질서 있는 예배를 통해 삼위일체 하나님께 영광을 돌립니다.');
  const [visionPoint3Title, setVisionPoint3Title] = useState('사랑의 교제');
  const [visionPoint3Desc, setVisionPoint3Desc] = useState('그리스도의 몸 된 지체로서 서로를 돌아보고 세워주는 성경적 목양과 교제를 나눕니다.');

  const [ciTitle, setCiTitle] = useState('로고의 의미');
  const [ciSub, setCiSub] = useState('함께 지어져가는 교회의 삼위일체 신학적 고백');
  const [ciPoint1Title, setCiPoint1Title] = useState('성부 하나님의 영광 (임재의 구름 - 쉐키나)');
  const [ciPoint1Desc, setCiPoint1Desc] = useState('로고 배경을 감싸는 은은한 빛과 구름 효과는 하나님의 영광과 임재를 상징합니다. 이는 구약의 성막과 성전에 가득했던 하나님의 영광(쉐키나)을 의미하며, 우리 공동체가 하나님의 주권적인 통치와 임재 안에 있음을 고백합니다. 모든 사역의 시작과 끝이 하나님의 영광을 위한 것임을 나타냅니다.');
  const [ciPoint2Title, setCiPoint2Title] = useState('성자 하나님: 말씀의 토대 (성경)');
  const [ciPoint2Desc, setCiPoint2Desc] = useState('하단의 견고하고 두꺼운 성경은 모든 신앙과 삶의 유일한 표준인 하나님의 말씀을 상징합니다. 개혁주의 신학의 핵심 가치인 \'오직 성경(Sola Scriptura)\' 위에 교회가 세워져야 함을 강조하며, 기록된 말씀인 성경을 통해 계시된 예수 그리스도가 우리 신앙의 유일한 기초임을 고백합니다.');
  const [ciPoint3Title, setCiPoint3Title] = useState('성도의 연합: 2-3-2 구조의 7개 벽돌');
  const [ciPoint3Desc, setCiPoint3Desc] = useState('7개의 벽돌은 성경적 완전수로서 온전한 공동체를 의미합니다. 2-3-2의 견고한 쌓임과 틈 없이 밀착된 구조는 성령 안에서 각 지체가 서로 연결되어 하나의 거룩한 전으로 지어져 감을 상징합니다. 이는 에베소서 2:22 말씀처럼 우리가 그리스도 안에서 함께 지어져 가는 유기적 공동체임을 나타냅니다.');
  const [ciPoint4Title, setCiPoint4Title] = useState('그리스도의 중심성: 십자가');
  const [ciPoint4Desc, setCiPoint4Desc] = useState('벽돌 공동체 한가운데 선명하게 새겨진 십자가는 예수 그리스도가 교회의 머리이시며 모든 사역과 교제의 중심임을 나타냅니다. 십자가 복음만이 우리를 하나로 묶는 유일한 끈이며, 교회의 모든 존재 이유가 오직 그리스도의 대속적 은혜에 있음을 고백하는 신앙의 정수입니다.');
  const [ciPoint5Title, setCiPoint5Title] = useState('성령 하나님: 생명의 불꽃');
  const [ciPoint5Desc, setCiPoint5Desc] = useState('상단의 역동적인 불꽃은 공동체 위에 임하시는 성령의 생명력과 인도를 상징합니다. 교회가 단순한 조직이나 건물이 아니라, 성령의 조명하심을 통해 살아 움직이는 유기체임을 지향합니다. 우리를 진리 가운데로 인도하시고 거룩하게 하시는 성령의 역사를 소망하는 마음을 담았습니다.');

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
    }, (error) => {
      console.error('Error fetching intro image:', error);
      handleFirestoreError(error, OperationType.GET, 'settings/intro');
    });

    const unsubText = onSnapshot(doc(db, 'settings', 'church_info'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.introTitle1) setIntroTitle1(data.introTitle1);
        if (data.introContent1) setIntroContent1(data.introContent1);
        if (data.introTitle2) setIntroTitle2(data.introTitle2);
        if (data.introContent2) setIntroContent2(data.introContent2);
        if (data.quote) setQuote(data.quote);

        if (data.nameQuote) setNameQuote(data.nameQuote);
        if (data.nameQuoteSource) setNameQuoteSource(data.nameQuoteSource);
        if (data.nameDescription) setNameDescription(data.nameDescription);
        if (data.nameMeaningTitle) setNameMeaningTitle(data.nameMeaningTitle);
        if (data.nameMeaningIntro) setNameMeaningIntro(data.nameMeaningIntro);
        if (data.namePoint1Title) setNamePoint1Title(data.namePoint1Title);
        if (data.namePoint1Desc) setNamePoint1Desc(data.namePoint1Desc);
        if (data.namePoint2Title) setNamePoint2Title(data.namePoint2Title);
        if (data.namePoint2Sub) setNamePoint2Sub(data.namePoint2Sub);
        if (data.namePoint2Desc) setNamePoint2Desc(data.namePoint2Desc);

        if (data.visionTitle) setVisionTitle(data.visionTitle);
        if (data.visionDesc) setVisionDesc(data.visionDesc);
        if (data.visionPoint1Title) setVisionPoint1Title(data.visionPoint1Title);
        if (data.visionPoint1Desc) setVisionPoint1Desc(data.visionPoint1Desc);
        if (data.visionPoint2Title) setVisionPoint2Title(data.visionPoint2Title);
        if (data.visionPoint2Desc) setVisionPoint2Desc(data.visionPoint2Desc);
        if (data.visionPoint3Title) setVisionPoint3Title(data.visionPoint3Title);
        if (data.visionPoint3Desc) setVisionPoint3Desc(data.visionPoint3Desc);

        if (data.ciTitle) setCiTitle(data.ciTitle);
        if (data.ciSub) setCiSub(data.ciSub);
        if (data.ciPoint1Title) setCiPoint1Title(data.ciPoint1Title);
        if (data.ciPoint1Desc) setCiPoint1Desc(data.ciPoint1Desc);
        if (data.ciPoint2Title) setCiPoint2Title(data.ciPoint2Title);
        if (data.ciPoint2Desc) setCiPoint2Desc(data.ciPoint2Desc);
        if (data.ciPoint3Title) setCiPoint3Title(data.ciPoint3Title);
        if (data.ciPoint3Desc) setCiPoint3Desc(data.ciPoint3Desc);
        if (data.ciPoint4Title) setCiPoint4Title(data.ciPoint4Title);
        if (data.ciPoint4Desc) setCiPoint4Desc(data.ciPoint4Desc);
        if (data.ciPoint5Title) setCiPoint5Title(data.ciPoint5Title);
        if (data.ciPoint5Desc) setCiPoint5Desc(data.ciPoint5Desc);
      }
    }, (error) => {
      console.error('Error fetching church info:', error);
      handleFirestoreError(error, OperationType.GET, 'settings/church_info');
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
          <div className="mb-16">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-serif font-bold text-wood-900 mb-4">교회 소개</h1>
              <div className="w-24 h-1 bg-gold-500 mx-auto" />
            </div>

            {/* Quote and Description at the top */}
            <div className="mb-16 space-y-6 text-center max-w-4xl mx-auto">
              <div className="bg-wood-50 p-6 sm:p-8 rounded-3xl border-l-4 border-r-4 border-wood-900 shadow-sm">
                <p className="font-serif italic text-wood-900 text-xl sm:text-2xl leading-relaxed">
                  {nameQuote} <span className="block mt-3 text-base text-wood-600 not-italic">{nameQuoteSource}</span>
                </p>
              </div>
              
              <p className="text-wood-800 text-lg sm:text-xl leading-relaxed font-medium">
                {nameDescription}
              </p>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-wood-100 p-6 md:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-stretch">
                {/* Logo Button */}
                <div className="lg:col-span-3 flex justify-center lg:justify-start">
                  <button
                    onClick={() => setShowLogoModal(true)}
                    className="group flex flex-col items-center w-full h-full transition-all duration-500"
                  >
                    <div className="w-full h-full min-h-[160px] lg:min-h-[200px] pt-10 pb-6 px-4 bg-stone-50 rounded-[2.5rem] border border-stone-100 shadow-sm group-hover:shadow-xl group-hover:bg-white transition-all duration-500 transform group-hover:-translate-y-2 flex flex-col items-center justify-center relative">
                      <Logo size={140} className="group-hover:scale-110 transition-transform duration-700 drop-shadow-md" />
                      <span className="absolute top-6 left-6 sm:left-8 text-xs sm:text-sm text-wood-400 font-medium tracking-tight group-hover:text-wood-600 transition-colors">로고 의미 보기</span>
                    </div>
                  </button>
                </div>

                {/* Church Name Button */}
                <div className="lg:col-span-9 flex justify-center lg:justify-start">
                  <button
                    onClick={() => setShowNameModal(true)}
                    className="group flex flex-col items-center lg:items-start w-full h-full transition-all duration-500"
                  >
                    <div className="w-full h-full min-h-[160px] lg:min-h-[200px] pt-10 pb-6 px-6 sm:px-8 lg:px-10 bg-stone-50 rounded-[2.5rem] border border-stone-100 shadow-sm group-hover:shadow-xl group-hover:bg-white transition-all duration-500 transform group-hover:-translate-y-2 flex flex-col justify-center relative">
                      <div className="w-full flex flex-col justify-center group-hover:scale-105 transition-transform duration-700 origin-center lg:origin-left">
                        <div className="flex justify-between font-serif font-bold text-[1.3rem] min-[400px]:text-2xl sm:text-4xl lg:text-[3rem] text-wood-900 leading-tight w-full">
                          {Array.from("함께 지어져가는 교회").map((c, i) => (
                            <span key={i} className={c === ' ' ? 'w-1.5 sm:w-2.5 lg:w-3' : ''}>{c}</span>
                          ))}
                        </div>
                        <div className="flex justify-between text-[0.65rem] min-[400px]:text-[0.8rem] sm:text-base lg:text-xl text-gold-700 font-bold uppercase opacity-80 leading-none mt-3 sm:mt-4 lg:mt-6 w-full">
                          {Array.from("BUILT TOGETHER CHURCH").map((c, i) => (
                            <span key={i} className={c === ' ' ? 'w-1.5 sm:w-2.5 lg:w-3' : ''}>{c}</span>
                          ))}
                        </div>
                      </div>
                      <span className="absolute top-6 left-6 sm:left-8 lg:left-10 text-xs sm:text-sm text-wood-400 font-medium tracking-tight group-hover:text-wood-600 transition-colors">교회 이름 의미 보기</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
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

      {/* Logo Meaning Modal */}
      {showLogoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLogoModal(false)}
            className="absolute inset-0 bg-wood-950/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative bg-white w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-[2rem] shadow-2xl border border-wood-100"
          >
            <button
              onClick={() => setShowLogoModal(false)}
              className="absolute top-6 right-6 p-2 hover:bg-wood-100 rounded-full transition-colors z-10"
            >
              <CloseIcon size={24} className="text-wood-500" />
            </button>

            <div className="p-8 sm:p-12">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="flex justify-center p-12 bg-stone-50 rounded-[3rem] border border-stone-100 shadow-inner relative overflow-hidden group">
                  {/* Shekinah Cloud Effect */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[140%] h-[140%] bg-amber-100/40 rounded-full blur-[80px] animate-pulse"></div>
                    <div className="absolute w-full h-full bg-[radial-gradient(circle_at_center,transparent_0%,rgba(255,255,255,0.8)_100%)]"></div>
                  </div>
                  <Logo size={320} className="relative z-10 drop-shadow-2xl transform transition-transform duration-700 group-hover:scale-105" />
                </div>

                <div className="space-y-8">
                  <div>
                    <h2 className="text-3xl font-serif font-bold text-wood-900 mb-2">{ciTitle}</h2>
                    <p className="text-gold-700 font-medium">{ciSub}</p>
                    <div className="w-12 h-1 bg-gold-500 mt-4" />
                  </div>

                  <div className="space-y-6">
                    <div className="flex gap-5">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg shadow-sm">1</div>
                      <div>
                        <h3 className="text-xl font-bold text-wood-900 mb-2">{ciPoint1Title}</h3>
                        <p className="text-wood-700 leading-relaxed whitespace-pre-line">
                          {ciPoint1Desc}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-5">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg shadow-sm">2</div>
                      <div>
                        <h3 className="text-xl font-bold text-wood-900 mb-2">{ciPoint2Title}</h3>
                        <p className="text-wood-700 leading-relaxed whitespace-pre-line">
                          {ciPoint2Desc}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-5">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg shadow-sm">3</div>
                      <div>
                        <h3 className="text-xl font-bold text-wood-900 mb-2">{ciPoint3Title}</h3>
                        <p className="text-wood-700 leading-relaxed whitespace-pre-line">
                          {ciPoint3Desc}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-5">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg shadow-sm">4</div>
                      <div>
                        <h3 className="text-xl font-bold text-wood-900 mb-2">{ciPoint4Title}</h3>
                        <p className="text-wood-700 leading-relaxed whitespace-pre-line">
                          {ciPoint4Desc}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-5">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg shadow-sm">5</div>
                      <div>
                        <h3 className="text-xl font-bold text-wood-900 mb-2">{ciPoint5Title}</h3>
                        <p className="text-wood-700 leading-relaxed whitespace-pre-line">
                          {ciPoint5Desc}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Name Meaning Modal */}
      {showNameModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowNameModal(false)}
            className="absolute inset-0 bg-wood-950/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[2rem] shadow-2xl border border-wood-100"
          >
            <button
              onClick={() => setShowNameModal(false)}
              className="absolute top-6 right-6 p-2 hover:bg-wood-100 rounded-full transition-colors z-10"
            >
              <CloseIcon size={24} className="text-wood-500" />
            </button>

            <div className="p-8 sm:p-12">
              <div className="text-center mb-10">
                <h2 className="text-3xl font-serif font-bold text-wood-900 mb-4">{nameMeaningTitle}</h2>
                <div className="w-16 h-1 bg-gold-500 mx-auto" />
              </div>

              <div className="space-y-8">
                <p className="text-wood-800 leading-relaxed text-xl whitespace-pre-line text-center font-medium">
                  {nameMeaningIntro}
                </p>
                
                <div className="bg-wood-50 p-8 rounded-2xl border border-wood-100 shadow-sm">
                  <h4 className="text-xl font-bold text-wood-900 mb-3 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-gold-500"></div>
                    {namePoint1Title}
                  </h4>
                  <p className="text-wood-700 leading-relaxed text-lg pl-5 whitespace-pre-line">
                    {namePoint1Desc}
                  </p>
                </div>

                <div className="bg-wood-50 p-8 rounded-2xl border border-wood-100 shadow-sm">
                  <h4 className="text-xl font-bold text-wood-900 mb-2 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-gold-500"></div>
                    {namePoint2Title}
                  </h4>
                  <p className="text-wood-500 text-base italic mb-3 pl-5">
                    {namePoint2Sub}
                  </p>
                  <p className="text-wood-700 leading-relaxed text-lg pl-5 whitespace-pre-line">
                    {namePoint2Desc}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Vision Section */}
      <section className="py-24 bg-wood-50 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-serif font-bold text-wood-900 mb-4">{visionTitle}</h2>
            <div className="w-24 h-1 bg-gold-500 mx-auto mb-8" />
            <p className="text-lg text-wood-700 max-w-2xl mx-auto leading-relaxed whitespace-pre-line">
              {visionDesc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                icon: BookOpen,
                title: visionPoint1Title,
                desc: visionPoint1Desc
              },
              {
                icon: Heart,
                title: visionPoint2Title,
                desc: visionPoint2Desc
              },
              {
                icon: Users,
                title: visionPoint3Title,
                desc: visionPoint3Desc
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
