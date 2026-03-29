import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { ArrowLeft, Save, Loader2, Info } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function AdminChurchInfo() {
  const navigate = useNavigate();
  const { role, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  
  // Basic Info
  const [introTitle1, setIntroTitle1] = useState('');
  const [introContent1, setIntroContent1] = useState('');
  const [introTitle2, setIntroTitle2] = useState('');
  const [introContent2, setIntroContent2] = useState('');
  const [quote, setQuote] = useState('');

  // Church Name Meaning
  const [nameQuote, setNameQuote] = useState('');
  const [nameQuoteSource, setNameQuoteSource] = useState('');
  const [nameDescription, setNameDescription] = useState('');
  const [nameMeaningTitle, setNameMeaningTitle] = useState('');
  const [nameMeaningIntro, setNameMeaningIntro] = useState('');
  const [namePoint1Title, setNamePoint1Title] = useState('');
  const [namePoint1Desc, setNamePoint1Desc] = useState('');
  const [namePoint2Title, setNamePoint2Title] = useState('');
  const [namePoint2Sub, setNamePoint2Sub] = useState('');
  const [namePoint2Desc, setNamePoint2Desc] = useState('');

  // Vision
  const [visionTitle, setVisionTitle] = useState('');
  const [visionDesc, setVisionDesc] = useState('');
  const [visionPoint1Title, setVisionPoint1Title] = useState('');
  const [visionPoint1Desc, setVisionPoint1Desc] = useState('');
  const [visionPoint2Title, setVisionPoint2Title] = useState('');
  const [visionPoint2Desc, setVisionPoint2Desc] = useState('');
  const [visionPoint3Title, setVisionPoint3Title] = useState('');
  const [visionPoint3Desc, setVisionPoint3Desc] = useState('');

  // CI Meaning
  const [ciTitle, setCiTitle] = useState('');
  const [ciSub, setCiSub] = useState('');
  const [ciPoint1Title, setCiPoint1Title] = useState('');
  const [ciPoint1Desc, setCiPoint1Desc] = useState('');
  const [ciPoint2Title, setCiPoint2Title] = useState('');
  const [ciPoint2Desc, setCiPoint2Desc] = useState('');
  const [ciPoint3Title, setCiPoint3Title] = useState('');
  const [ciPoint3Desc, setCiPoint3Desc] = useState('');
  const [ciPoint4Title, setCiPoint4Title] = useState('');
  const [ciPoint4Desc, setCiPoint4Desc] = useState('');
  const [ciPoint5Title, setCiPoint5Title] = useState('');
  const [ciPoint5Desc, setCiPoint5Desc] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (role !== 'admin') {
      navigate('/');
      return;
    }

    const fetchChurchInfo = async () => {
      try {
        const docRef = doc(db, 'settings', 'church_info');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setIntroTitle1(data.introTitle1 || '개혁주의 신학의 정체성');
          setIntroContent1(data.introContent1 || "'함께 지어져가는 교회'는 역사적 개혁주의 신앙고백(웨스트민스터 신앙고백서, 하이델베르크 요리문답 등)을 우리의 신앙과 삶의 표준으로 삼습니다. 오직 성경, 오직 은혜, 오직 믿음, 오직 그리스도, 오직 하나님께 영광이라는 종교개혁의 5대 솔라(Sola)를 굳게 붙듭니다.");
          setIntroTitle2(data.introTitle2 || '개척 준비 과정');
          setIntroContent2(data.introContent2 || '현재 우리는 하나님의 인도하심을 구하며 교회를 세워가기 위한 기도의 시간을 갖고 있습니다. 바른 말씀 선포와 참된 예배의 회복을 갈망하는 성도들과 함께, 에베소서 2장 22절 말씀처럼 그리스도 예수 안에서 성령의 전으로 지어져 가기를 소망합니다.');
          setQuote(data.quote || '"우리는 건물이 아니라 사람을 세우는 일에 부름받았습니다. 하나님의 말씀이 선포되고, 성례가 바르게 집행되며, 권징이 신실하게 시행되는 참된 교회의 표지를 회복하는 여정에 여러분을 초대합니다."');

          setNameQuote(data.nameQuote || '“성령 안에서 하나님이 거하실 처소가 되기 위하여 그리스도 예수 안에서 함께 지어져 가느니라”');
          setNameQuoteSource(data.nameQuoteSource || '(에베소서 2:22)');
          setNameDescription(data.nameDescription || '함께 지어져가는 교회의 이름과 로고는 삼위일체 하나님의 현존과 성도의 연합, 그리고 멈추지 않는 영적 갱신을 향한 우리의 고백을 담고 있습니다.');
          setNameMeaningTitle(data.nameMeaningTitle || '교회 이름의 의미');
          setNameMeaningIntro(data.nameMeaningIntro || '‘함께 지어져가는 교회’는 완성된 건물로서의 결과가 아닌, 날마다 새롭게 세워져 가는 ‘거룩한 과정’에 집중합니다.');
          setNamePoint1Title(data.namePoint1Title || '현재진행형의 공동체');
          setNamePoint1Desc(data.namePoint1Desc || '우리는 이미 구원받은 백성이지만, 동시에 그리스도의 장성한 분량에 이르기까지 끊임없이 자라나야 하는 존재입니다.');
          setNamePoint2Title(data.namePoint2Title || '개혁된 교회는 항상 개혁되어야 합니다');
          setNamePoint2Sub(data.namePoint2Sub || '“Ecclesia reformata, semper reformanda”');
          setNamePoint2Desc(data.namePoint2Desc || '우리 교회는 과거의 전통에 안주하지 않고 오직 하나님의 말씀이라는 척도 아래 날마다 자신을 개혁하며, 거룩한 처소로 지어져 가기를 멈추지 않을 것입니다.');

          setVisionTitle(data.visionTitle || '우리의 비전');
          setVisionDesc(data.visionDesc || '개혁주의 신학의 든든한 반석 위에 서서, 성경적 예배와 목양을 통해\n하나님의 영광을 드러내는 공동체를 세워갑니다.');
          setVisionPoint1Title(data.visionPoint1Title || '바른 말씀');
          setVisionPoint1Desc(data.visionPoint1Desc || '오직 성경(Sola Scriptura)의 원리에 따라, 개혁주의 신학에 기초한 강해 설교를 지향합니다.');
          setVisionPoint2Title(data.visionPoint2Title || '참된 예배');
          setVisionPoint2Desc(data.visionPoint2Desc || '하나님 중심의 경건하고 질서 있는 예배를 통해 삼위일체 하나님께 영광을 돌립니다.');
          setVisionPoint3Title(data.visionPoint3Title || '사랑의 교제');
          setVisionPoint3Desc(data.visionPoint3Desc || '그리스도의 몸 된 지체로서 서로를 돌아보고 세워주는 성경적 목양과 교제를 나눕니다.');

          setCiTitle(data.ciTitle || 'CI의 의미');
          setCiSub(data.ciSub || '함께 지어져가는 교회의 삼위일체 신학적 고백');
          setCiPoint1Title(data.ciPoint1Title || '성부 하나님의 영광 (임재의 구름 - 쉐키나)');
          setCiPoint1Desc(data.ciPoint1Desc || '로고 배경을 감싸는 은은한 빛과 구름 효과는 하나님의 영광과 임재를 상징합니다. 이는 구약의 성막과 성전에 가득했던 하나님의 영광(쉐키나)을 의미하며, 우리 공동체가 하나님의 주권적인 통치와 임재 안에 있음을 고백합니다. 모든 사역의 시작과 끝이 하나님의 영광을 위한 것임을 나타냅니다.');
          setCiPoint2Title(data.ciPoint2Title || '성자 하나님: 말씀의 토대 (성경)');
          setCiPoint2Desc(data.ciPoint2Desc || '하단의 견고하고 두꺼운 성경은 모든 신앙과 삶의 유일한 표준인 하나님의 말씀을 상징합니다. 개혁주의 신학의 핵심 가치인 \'오직 성경(Sola Scriptura)\' 위에 교회가 세워져야 함을 강조하며, 기록된 말씀인 성경을 통해 계시된 예수 그리스도가 우리 신앙의 유일한 기초임을 고백합니다.');
          setCiPoint3Title(data.ciPoint3Title || '성도의 연합: 2-3-2 구조의 7개 벽돌');
          setCiPoint3Desc(data.ciPoint3Desc || '7개의 벽돌은 성경적 완전수로서 온전한 공동체를 의미합니다. 2-3-2의 견고한 쌓임과 틈 없이 밀착된 구조는 성령 안에서 각 지체가 서로 연결되어 하나의 거룩한 전으로 지어져 감을 상징합니다. 이는 에베소서 2:22 말씀처럼 우리가 그리스도 안에서 함께 지어져 가는 유기적 공동체임을 나타냅니다.');
          setCiPoint4Title(data.ciPoint4Title || '그리스도의 중심성: 십자가');
          setCiPoint4Desc(data.ciPoint4Desc || '벽돌 공동체 한가운데 선명하게 새겨진 십자가는 예수 그리스도가 교회의 머리이시며 모든 사역과 교제의 중심임을 나타냅니다. 십자가 복음만이 우리를 하나로 묶는 유일한 끈이며, 교회의 모든 존재 이유가 오직 그리스도의 대속적 은혜에 있음을 고백하는 신앙의 정수입니다.');
          setCiPoint5Title(data.ciPoint5Title || '성령 하나님: 생명의 불꽃');
          setCiPoint5Desc(data.ciPoint5Desc || '상단의 역동적인 불꽃은 공동체 위에 임하시는 성령의 생명력과 인도를 상징합니다. 교회가 단순한 조직이나 건물이 아니라, 성령의 조명하심을 통해 살아 움직이는 유기체임을 지향합니다. 우리를 진리 가운데로 인도하시고 거룩하게 하시는 성령의 역사를 소망하는 마음을 담았습니다.');
        } else {
          // Default values if not set
          setIntroTitle1('개혁주의 신학의 정체성');
          setIntroContent1("'함께 지어져가는 교회'는 역사적 개혁주의 신앙고백(웨스트민스터 신앙고백서, 하이델베르크 요리문답 등)을 우리의 신앙과 삶의 표준으로 삼습니다. 오직 성경, 오직 은혜, 오직 믿음, 오직 그리스도, 오직 하나님께 영광이라는 종교개혁의 5대 솔라(Sola)를 굳게 붙듭니다.");
          setIntroTitle2('개척 준비 과정');
          setIntroContent2('현재 우리는 하나님의 인도하심을 구하며 교회를 세워가기 위한 기도의 시간을 갖고 있습니다. 바른 말씀 선포와 참된 예배의 회복을 갈망하는 성도들과 함께, 에베소서 2장 22절 말씀처럼 그리스도 예수 안에서 성령의 전으로 지어져 가기를 소망합니다.');
          setQuote('"우리는 건물이 아니라 사람을 세우는 일에 부름받았습니다. 하나님의 말씀이 선포되고, 성례가 바르게 집행되며, 권징이 신실하게 시행되는 참된 교회의 표지를 회복하는 여정에 여러분을 초대합니다."');

          setNameQuote('“성령 안에서 하나님이 거하실 처소가 되기 위하여 그리스도 예수 안에서 함께 지어져 가느니라”');
          setNameQuoteSource('(에베소서 2:22)');
          setNameDescription('함께 지어져가는 교회의 이름과 로고는 삼위일체 하나님의 현존과 성도의 연합, 그리고 멈추지 않는 영적 갱신을 향한 우리의 고백을 담고 있습니다.');
          setNameMeaningTitle('교회 이름의 의미');
          setNameMeaningIntro('‘함께 지어져가는 교회’는 완성된 건물로서의 결과가 아닌, 날마다 새롭게 세워져 가는 ‘거룩한 과정’에 집중합니다.');
          setNamePoint1Title('현재진행형의 공동체');
          setNamePoint1Desc('우리는 이미 구원받은 백성이지만, 동시에 그리스도의 장성한 분량에 이르기까지 끊임없이 자라나야 하는 존재입니다.');
          setNamePoint2Title('개혁된 교회는 항상 개혁되어야 합니다');
          setNamePoint2Sub('“Ecclesia reformata, semper reformanda”');
          setNamePoint2Desc('우리 교회는 과거의 전통에 안주하지 않고 오직 하나님의 말씀이라는 척도 아래 날마다 자신을 개혁하며, 거룩한 처소로 지어져 가기를 멈추지 않을 것입니다.');

          setVisionTitle('우리의 비전');
          setVisionDesc('개혁주의 신학의 든든한 반석 위에 서서, 성경적 예배와 목양을 통해\n하나님의 영광을 드러내는 공동체를 세워갑니다.');
          setVisionPoint1Title('바른 말씀');
          setVisionPoint1Desc('오직 성경(Sola Scriptura)의 원리에 따라, 개혁주의 신학에 기초한 강해 설교를 지향합니다.');
          setVisionPoint2Title('참된 예배');
          setVisionPoint2Desc('하나님 중심의 경건하고 질서 있는 예배를 통해 삼위일체 하나님께 영광을 돌립니다.');
          setVisionPoint3Title('사랑의 교제');
          setVisionPoint3Desc('그리스도의 몸 된 지체로서 서로를 돌아보고 세워주는 성경적 목양과 교제를 나눕니다.');

          setCiTitle('CI의 의미');
          setCiSub('함께 지어져가는 교회의 삼위일체 신학적 고백');
          setCiPoint1Title('성부 하나님의 영광 (임재의 구름 - 쉐키나)');
          setCiPoint1Desc('로고 배경을 감싸는 은은한 빛과 구름 효과는 하나님의 영광과 임재를 상징합니다. 이는 구약의 성막과 성전에 가득했던 하나님의 영광(쉐키나)을 의미하며, 우리 공동체가 하나님의 주권적인 통치와 임재 안에 있음을 고백합니다. 모든 사역의 시작과 끝이 하나님의 영광을 위한 것임을 나타냅니다.');
          setCiPoint2Title('성자 하나님: 말씀의 토대 (성경)');
          setCiPoint2Desc('하단의 견고하고 두꺼운 성경은 모든 신앙과 삶의 유일한 표준인 하나님의 말씀을 상징합니다. 개혁주의 신학의 핵심 가치인 \'오직 성경(Sola Scriptura)\' 위에 교회가 세워져야 함을 강조하며, 기록된 말씀인 성경을 통해 계시된 예수 그리스도가 우리 신앙의 유일한 기초임을 고백합니다.');
          setCiPoint3Title('성도의 연합: 2-3-2 구조의 7개 벽돌');
          setCiPoint3Desc('7개의 벽돌은 성경적 완전수로서 온전한 공동체를 의미합니다. 2-3-2의 견고한 쌓임과 틈 없이 밀착된 구조는 성령 안에서 각 지체가 서로 연결되어 하나의 거룩한 전으로 지어져 감을 상징합니다. 이는 에베소서 2:22 말씀처럼 우리가 그리스도 안에서 함께 지어져 가는 유기적 공동체임을 나타냅니다.');
          setCiPoint4Title('그리스도의 중심성: 십자가');
          setCiPoint4Desc('벽돌 공동체 한가운데 선명하게 새겨진 십자가는 예수 그리스도가 교회의 머리이시며 모든 사역과 교제의 중심임을 나타냅니다. 십자가 복음만이 우리를 하나로 묶는 유일한 끈이며, 교회의 모든 존재 이유가 오직 그리스도의 대속적 은혜에 있음을 고백하는 신앙의 정수입니다.');
          setCiPoint5Title('성령 하나님: 생명의 불꽃');
          setCiPoint5Desc('상단의 역동적인 불꽃은 공동체 위에 임하시는 성령의 생명력과 인도를 상징합니다. 교회가 단순한 조직이나 건물이 아니라, 성령의 조명하심을 통해 살아 움직이는 유기체임을 지향합니다. 우리를 진리 가운데로 인도하시고 거룩하게 하시는 성령의 역사를 소망하는 마음을 담았습니다.');
        }
      } catch (error) {
        console.error('Error fetching church info:', error);
        handleFirestoreError(error, OperationType.GET, 'settings/church_info');
      } finally {
        setLoading(false);
      }
    };

    fetchChurchInfo();
  }, [role, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccess(false);

    try {
      const docRef = doc(db, 'settings', 'church_info');
      await setDoc(docRef, {
        introTitle1, introContent1, introTitle2, introContent2, quote,
        nameQuote, nameQuoteSource, nameDescription, nameMeaningTitle, nameMeaningIntro,
        namePoint1Title, namePoint1Desc, namePoint2Title, namePoint2Sub, namePoint2Desc,
        visionTitle, visionDesc, visionPoint1Title, visionPoint1Desc, visionPoint2Title, visionPoint2Desc, visionPoint3Title, visionPoint3Desc,
        ciTitle, ciSub, ciPoint1Title, ciPoint1Desc, ciPoint2Title, ciPoint2Desc, ciPoint3Title, ciPoint3Desc, ciPoint4Title, ciPoint4Desc, ciPoint5Title, ciPoint5Desc,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating church info:', error);
      alert('저장 중 오류가 발생했습니다.');
      handleFirestoreError(error, OperationType.UPDATE, 'settings/church_info');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wood-50">
        <Loader2 className="animate-spin h-12 w-12 text-wood-900" />
      </div>
    );
  }

  const tabs = [
    { id: 'basic', name: '기본 소개' },
    { id: 'name', name: '교회 이름 의미' },
    { id: 'vision', name: '우리의 비전' },
    { id: 'ci', name: '로고(CI) 의미' },
  ];

  return (
    <div className="bg-wood-100 min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate('/admin')}
          className="inline-flex items-center text-sm font-medium text-wood-600 hover:text-wood-900 mb-8 transition"
        >
          <ArrowLeft size={16} className="mr-2" />
          관리자 대시보드
        </button>

        <div className="bg-white rounded-3xl shadow-sm border border-wood-200 overflow-hidden">
          <div className="p-8 md:p-12 border-b border-wood-100 bg-wood-50/50">
            <h1 className="text-3xl font-serif font-bold text-wood-900 mb-2">교회 정보 관리</h1>
            <p className="text-wood-600">교회 소개 페이지의 모든 텍스트를 수정할 수 있습니다.</p>
          </div>

          <div className="border-b border-wood-200 px-8 md:px-12 pt-4 bg-white">
            <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    activeTab === tab.id
                      ? 'border-wood-900 text-wood-900'
                      : 'border-transparent text-wood-500 hover:text-wood-700 hover:border-wood-300',
                    'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors'
                  )}
                >
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-8">
            <div className="bg-blue-50 p-4 rounded-xl flex items-start gap-3 text-blue-800 border border-blue-100 mb-8">
              <Info size={20} className="mt-0.5 flex-shrink-0" />
              <p className="text-sm leading-relaxed">
                이곳에서 수정하는 내용은 '교회 소개' 페이지에 즉시 반영됩니다. 
                각 탭을 이동하며 내용을 수정한 뒤, 하단의 '저장하기' 버튼을 눌러주세요.
              </p>
            </div>

            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-wood-900 border-b border-wood-100 pb-2">첫 번째 섹션</h3>
                  <div>
                    <label className="block text-sm font-medium text-wood-700 mb-2">제목</label>
                    <input type="text" value={introTitle1} onChange={(e) => setIntroTitle1(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-wood-700 mb-2">내용</label>
                    <textarea rows={4} value={introContent1} onChange={(e) => setIntroContent1(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-wood-900 border-b border-wood-100 pb-2">두 번째 섹션</h3>
                  <div>
                    <label className="block text-sm font-medium text-wood-700 mb-2">제목</label>
                    <input type="text" value={introTitle2} onChange={(e) => setIntroTitle2(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-wood-700 mb-2">내용</label>
                    <textarea rows={4} value={introContent2} onChange={(e) => setIntroContent2(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-wood-900 border-b border-wood-100 pb-2">인용구 (강조 텍스트)</h3>
                  <div>
                    <textarea rows={4} value={quote} onChange={(e) => setQuote(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50 font-serif italic" required />
                  </div>
                </div>
              </div>
            )}

            {/* Church Name Meaning Tab */}
            {activeTab === 'name' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-wood-900 border-b border-wood-100 pb-2">상단 인용구 및 설명</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-wood-700 mb-2">인용구</label>
                      <input type="text" value={nameQuote} onChange={(e) => setNameQuote(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-wood-700 mb-2">출처</label>
                      <input type="text" value={nameQuoteSource} onChange={(e) => setNameQuoteSource(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-wood-700 mb-2">설명</label>
                    <textarea rows={3} value={nameDescription} onChange={(e) => setNameDescription(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-wood-900 border-b border-wood-100 pb-2">의미 소개</h3>
                  <div>
                    <label className="block text-sm font-medium text-wood-700 mb-2">섹션 제목</label>
                    <input type="text" value={nameMeaningTitle} onChange={(e) => setNameMeaningTitle(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-wood-700 mb-2">도입부 설명</label>
                    <textarea rows={2} value={nameMeaningIntro} onChange={(e) => setNameMeaningIntro(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-wood-900 border-b border-wood-100 pb-2">포인트 1</h3>
                  <div>
                    <label className="block text-sm font-medium text-wood-700 mb-2">제목</label>
                    <input type="text" value={namePoint1Title} onChange={(e) => setNamePoint1Title(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-wood-700 mb-2">내용</label>
                    <textarea rows={2} value={namePoint1Desc} onChange={(e) => setNamePoint1Desc(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-wood-900 border-b border-wood-100 pb-2">포인트 2</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-wood-700 mb-2">제목</label>
                      <input type="text" value={namePoint2Title} onChange={(e) => setNamePoint2Title(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-wood-700 mb-2">부제목 (라틴어 등)</label>
                      <input type="text" value={namePoint2Sub} onChange={(e) => setNamePoint2Sub(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-wood-700 mb-2">내용</label>
                    <textarea rows={2} value={namePoint2Desc} onChange={(e) => setNamePoint2Desc(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                  </div>
                </div>
              </div>
            )}

            {/* Vision Tab */}
            {activeTab === 'vision' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-wood-900 border-b border-wood-100 pb-2">메인 타이틀 및 설명</h3>
                  <div>
                    <label className="block text-sm font-medium text-wood-700 mb-2">섹션 제목</label>
                    <input type="text" value={visionTitle} onChange={(e) => setVisionTitle(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-wood-700 mb-2">주요 설명</label>
                    <textarea rows={3} value={visionDesc} onChange={(e) => setVisionDesc(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-wood-900 border-b border-wood-100 pb-2">비전 1</h3>
                  <div>
                    <label className="block text-sm font-medium text-wood-700 mb-2">제목</label>
                    <input type="text" value={visionPoint1Title} onChange={(e) => setVisionPoint1Title(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-wood-700 mb-2">내용</label>
                    <textarea rows={2} value={visionPoint1Desc} onChange={(e) => setVisionPoint1Desc(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-wood-900 border-b border-wood-100 pb-2">비전 2</h3>
                  <div>
                    <label className="block text-sm font-medium text-wood-700 mb-2">제목</label>
                    <input type="text" value={visionPoint2Title} onChange={(e) => setVisionPoint2Title(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-wood-700 mb-2">내용</label>
                    <textarea rows={2} value={visionPoint2Desc} onChange={(e) => setVisionPoint2Desc(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-wood-900 border-b border-wood-100 pb-2">비전 3</h3>
                  <div>
                    <label className="block text-sm font-medium text-wood-700 mb-2">제목</label>
                    <input type="text" value={visionPoint3Title} onChange={(e) => setVisionPoint3Title(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-wood-700 mb-2">내용</label>
                    <textarea rows={2} value={visionPoint3Desc} onChange={(e) => setVisionPoint3Desc(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                  </div>
                </div>
              </div>
            )}

            {/* CI Meaning Tab */}
            {activeTab === 'ci' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-wood-900 border-b border-wood-100 pb-2">모달 타이틀</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-wood-700 mb-2">제목</label>
                      <input type="text" value={ciTitle} onChange={(e) => setCiTitle(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-wood-700 mb-2">부제목</label>
                      <input type="text" value={ciSub} onChange={(e) => setCiSub(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                    </div>
                  </div>
                </div>

                {[
                  { num: 1, t: ciPoint1Title, setT: setCiPoint1Title, d: ciPoint1Desc, setD: setCiPoint1Desc },
                  { num: 2, t: ciPoint2Title, setT: setCiPoint2Title, d: ciPoint2Desc, setD: setCiPoint2Desc },
                  { num: 3, t: ciPoint3Title, setT: setCiPoint3Title, d: ciPoint3Desc, setD: setCiPoint3Desc },
                  { num: 4, t: ciPoint4Title, setT: setCiPoint4Title, d: ciPoint4Desc, setD: setCiPoint4Desc },
                  { num: 5, t: ciPoint5Title, setT: setCiPoint5Title, d: ciPoint5Desc, setD: setCiPoint5Desc },
                ].map((item) => (
                  <div key={item.num} className="space-y-4">
                    <h3 className="text-lg font-bold text-wood-900 border-b border-wood-100 pb-2">포인트 {item.num}</h3>
                    <div>
                      <label className="block text-sm font-medium text-wood-700 mb-2">제목</label>
                      <input type="text" value={item.t} onChange={(e) => item.setT(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-wood-700 mb-2">내용</label>
                      <textarea rows={3} value={item.d} onChange={(e) => item.setD(e.target.value)} className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50" required />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-8 border-t border-wood-100">
              {success && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-emerald-600 font-medium flex items-center gap-2"
                >
                  <Save size={18} />
                  성공적으로 저장되었습니다.
                </motion.span>
              )}
              <div className="ml-auto">
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className="mr-4 px-6 py-2.5 text-sm font-medium text-wood-600 hover:text-wood-900 transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center px-8 py-2.5 border border-transparent text-sm font-medium rounded-full shadow-sm text-white bg-wood-900 hover:bg-wood-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-wood-500 transition disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                      저장 중...
                    </>
                  ) : (
                    <>
                      <Save className="-ml-1 mr-2 h-4 w-4" />
                      저장하기
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
