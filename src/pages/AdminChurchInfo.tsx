import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { ArrowLeft, Save, Loader2, Info } from 'lucide-react';
import { motion } from 'motion/react';

export default function AdminChurchInfo() {
  const navigate = useNavigate();
  const { role, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [introTitle1, setIntroTitle1] = useState('');
  const [introContent1, setIntroContent1] = useState('');
  const [introTitle2, setIntroTitle2] = useState('');
  const [introContent2, setIntroContent2] = useState('');
  const [quote, setQuote] = useState('');

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
          setIntroTitle1(data.introTitle1 || '');
          setIntroContent1(data.introContent1 || '');
          setIntroTitle2(data.introTitle2 || '');
          setIntroContent2(data.introContent2 || '');
          setQuote(data.quote || '');
        } else {
          // Default values if not set
          setIntroTitle1('개혁주의 신학의 정체성');
          setIntroContent1("'함께 지어져가는 교회'는 역사적 개혁주의 신앙고백(웨스트민스터 신앙고백서, 하이델베르크 요리문답 등)을 우리의 신앙과 삶의 표준으로 삼습니다. 오직 성경, 오직 은혜, 오직 믿음, 오직 그리스도, 오직 하나님께 영광이라는 종교개혁의 5대 솔라(Sola)를 굳게 붙듭니다.");
          setIntroTitle2('개척 준비 과정');
          setIntroContent2('현재 우리는 하나님의 인도하심을 구하며 교회를 세워가기 위한 기도의 시간을 갖고 있습니다. 바른 말씀 선포와 참된 예배의 회복을 갈망하는 성도들과 함께, 에베소서 2장 22절 말씀처럼 그리스도 예수 안에서 성령의 전으로 지어져 가기를 소망합니다.');
          setQuote('"우리는 건물이 아니라 사람을 세우는 일에 부름받았습니다. 하나님의 말씀이 선포되고, 성례가 바르게 집행되며, 권징이 신실하게 시행되는 참된 교회의 표지를 회복하는 여정에 여러분을 초대합니다."');
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
        introTitle1,
        introContent1,
        introTitle2,
        introContent2,
        quote,
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

  return (
    <div className="bg-wood-100 min-h-screen py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
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
            <p className="text-wood-600">교회 소개 페이지에 표시되는 텍스트를 수정합니다.</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-8">
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-xl flex items-start gap-3 text-blue-800 border border-blue-100">
                <Info size={20} className="mt-0.5 flex-shrink-0" />
                <p className="text-sm leading-relaxed">
                  이곳에서 수정하는 내용은 '교회 소개' 페이지에 즉시 반영됩니다. 
                  각 섹션의 제목과 내용을 정성껏 작성해 주세요.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-8">
                {/* Section 1 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-wood-900 border-b border-wood-100 pb-2">첫 번째 섹션</h3>
                  <div>
                    <label className="block text-sm font-medium text-wood-700 mb-2">제목</label>
                    <input
                      type="text"
                      value={introTitle1}
                      onChange={(e) => setIntroTitle1(e.target.value)}
                      className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50"
                      placeholder="예: 개혁주의 신학의 정체성"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-wood-700 mb-2">내용</label>
                    <textarea
                      rows={4}
                      value={introContent1}
                      onChange={(e) => setIntroContent1(e.target.value)}
                      className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50"
                      placeholder="섹션 내용을 입력하세요"
                      required
                    />
                  </div>
                </div>

                {/* Section 2 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-wood-900 border-b border-wood-100 pb-2">두 번째 섹션</h3>
                  <div>
                    <label className="block text-sm font-medium text-wood-700 mb-2">제목</label>
                    <input
                      type="text"
                      value={introTitle2}
                      onChange={(e) => setIntroTitle2(e.target.value)}
                      className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50"
                      placeholder="예: 개척 준비 과정"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-wood-700 mb-2">내용</label>
                    <textarea
                      rows={4}
                      value={introContent2}
                      onChange={(e) => setIntroContent2(e.target.value)}
                      className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50"
                      placeholder="섹션 내용을 입력하세요"
                      required
                    />
                  </div>
                </div>

                {/* Quote Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-wood-900 border-b border-wood-100 pb-2">인용구 (강조 텍스트)</h3>
                  <div>
                    <label className="block text-sm font-medium text-wood-700 mb-2">인용구 내용</label>
                    <textarea
                      rows={4}
                      value={quote}
                      onChange={(e) => setQuote(e.target.value)}
                      className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50 font-serif italic"
                      placeholder="강조하고 싶은 문구를 입력하세요"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

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
