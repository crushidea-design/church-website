import React, { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar as CalendarIcon, Edit, ExternalLink, CheckCircle2, Circle } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import ArchiveIntroSection from '../components/ArchiveIntroSection';
import { useTodayWordData } from '../hooks/useTodayWordData';

export default function TodayWord() {
  const { user, role } = useAuth();
  const dateInputRef = React.useRef<HTMLInputElement>(null);

  const {
    selectedDate,
    setSelectedDate,
    dateStr,
    readingPlan,
    isSelectedLeapDay,
    latestPost,
    loading,
    readingProgress,
    meditation,
    setMeditation,
    toggleProgress,
    saveProgress,
    savingProgress,
    saveMessage,
  } = useTodayWordData();

  // Bridge Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');

  const openBridgeModal = (link: string, version: string) => {
    setSelectedLink(link);
    setSelectedVersion(version);
    setIsModalOpen(true);
  };

  const handleOpenBible = () => {
    const width = 1000;
    const height = 800;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    window.open(
      selectedLink,
      'BibleViewer',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
    );
    setIsModalOpen(false);
  };

  const handleToggleProgress = async (index: number) => {
    await toggleProgress(index);
  };

  const handleMeditationChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMeditation(e.target.value);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    if (!isNaN(newDate.getTime())) {
      setSelectedDate(newDate);
    }
  };

  return (
    <div className="space-y-8">
      {/* 오늘의 묵상 설명 섹션 */}
      <ArchiveIntroSection description="매일의 성경 읽기와 묵상 가이드라인을 통해 하나님의 말씀을 깊이 있게 만나는 시간입니다." />

      {/* 오늘의 묵상 읽기표 섹션 */}
      <div className="bg-white rounded-2xl shadow-sm border border-wood-200 overflow-hidden">
        <div className="bg-wood-900 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-xl font-serif font-bold text-white flex items-center gap-2">
            <CalendarIcon size={20} className="text-gold-400" />
            맥체인 성경 읽기
          </h2>
          
          {/* Date Picker moved here */}
          <div 
            onClick={() => {
              if (dateInputRef.current?.showPicker) {
                dateInputRef.current.showPicker();
              } else {
                dateInputRef.current?.click();
              }
            }}
            className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl border border-white/20 hover:bg-white/20 transition-colors cursor-pointer relative group"
          >
            <CalendarIcon size={16} className="text-white/80 group-hover:text-white transition-colors" />
            <span className="text-white font-medium">{dateStr}</span>
            <span className="text-white/60 text-sm">({format(selectedDate, 'EEEE', { locale: ko })})</span>
            <input 
              ref={dateInputRef}
              type="date" 
              value={dateStr}
              onChange={handleDateChange}
              max={format(new Date(), 'yyyy-MM-dd')}
              className="sr-only"
              aria-hidden="true"
            />
          </div>
        </div>
        <div className="p-6">
          {isSelectedLeapDay && (
            <div className="mb-4 rounded-xl border border-gold-300 bg-gold-50 px-4 py-3 text-sm text-wood-800">
              2월 29일은 윤년 보정일입니다. 맥체인 성경읽기표는 365일 기준이므로 오늘은 밀린 본문을 보충하거나 2월 28일 본문을 다시 읽으며 묵상해 주세요.
            </div>
          )}

          {readingPlan.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {readingPlan.map((passage, index) => (
                <div key={index} className="bg-wood-50 rounded-xl p-4 border border-wood-100 flex flex-col items-center justify-center text-center relative overflow-hidden">
                  {/* Checkbox for reading progress */}
                  <button 
                    onClick={() => handleToggleProgress(index)}
                    className="absolute top-3 right-3 text-wood-400 hover:text-gold-500 transition-colors"
                    title={readingProgress[index] ? "읽음 취소" : "읽음 완료"}
                  >
                    {readingProgress[index] ? (
                      <CheckCircle2 size={24} className="text-gold-500 fill-gold-50" />
                    ) : (
                      <Circle size={24} />
                    )}
                  </button>

                  <span className={`text-lg font-bold mb-3 mt-2 ${readingProgress[index] ? 'text-wood-400 line-through' : 'text-wood-900'}`}>
                    {passage.text}
                  </span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => openBridgeModal(passage.gaeLink, '개역개정')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-wood-100 text-wood-700 rounded-full text-sm font-medium hover:bg-wood-200 hover:text-wood-900 transition-colors"
                    >
                      <BookOpen size={14} />
                      개역개정
                    </button>
                    <button 
                      onClick={() => openBridgeModal(passage.saeHangeulLink, '새한글성경')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-wood-100 text-wood-700 rounded-full text-sm font-medium hover:bg-wood-200 hover:text-wood-900 transition-colors"
                    >
                      <BookOpen size={14} />
                      새한글성경
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-wood-200 bg-wood-50 px-4 py-8 text-center text-wood-600">
              오늘은 별도의 읽기표를 표시하지 않습니다.
            </div>
          )}
        </div>
      </div>

      {/* Bridge Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-wood-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-wood-900 p-4 text-center">
              <BookOpen className="mx-auto text-gold-400 mb-2" size={32} />
              <h3 className="text-xl font-serif font-bold text-white">외부 사이트 이동 안내</h3>
            </div>
            <div className="p-8 text-center">
              <p className="text-wood-800 font-medium mb-2">
                대한성서공회 사이트로 이동합니다.
              </p>
              <p className="text-wood-600 text-sm leading-relaxed mb-8">
                성경을 모두 읽으신 후에는 브라우저 상단의 <span className="text-wood-900 font-bold">'완료'</span> 또는 <span className="text-wood-900 font-bold">'닫기'</span> 버튼을 눌러 다시 홈페이지로 돌아와 주세요.
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleOpenBible}
                  className="w-full py-3 bg-wood-900 text-white rounded-xl font-bold hover:bg-wood-800 transition-all shadow-lg shadow-wood-200 flex items-center justify-center gap-2"
                >
                  {selectedVersion} 읽기 시작
                  <ExternalLink size={16} />
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-full py-3 bg-white text-wood-500 border border-wood-200 rounded-xl font-medium hover:bg-wood-50 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 묵상 가이드라인 섹션 */}
      <div className="bg-white rounded-2xl shadow-sm border border-wood-200 p-6 md:p-8">
        <div className="flex justify-between items-center mb-6 border-b border-wood-100 pb-4">
          <h3 className="text-2xl font-serif font-bold text-wood-900">묵상 가이드</h3>
          {role === 'admin' && (
            <Link
              to="/create-post?type=today_word"
              className="inline-flex items-center gap-2 px-4 py-2 bg-wood-900 text-white text-sm font-medium rounded-full hover:bg-wood-800 transition-colors"
            >
              <Edit size={16} />
              가이드라인 작성
            </Link>
          )}
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wood-900"></div>
          </div>
        ) : latestPost ? (
          <div>
            <h4 className="text-xl font-bold text-wood-900 mb-2">{latestPost.title}</h4>
            <div className="text-sm text-wood-500 mb-6 flex items-center gap-4">
              <span>작성자: {latestPost.authorName}</span>
              <span>{latestPost.createdAt?.toDate ? format(latestPost.createdAt.toDate(), 'yyyy.MM.dd') : ''}</span>
            </div>
            <div className="prose prose-wood max-w-none whitespace-pre-wrap text-wood-800 leading-relaxed mb-8">
              {latestPost.content}
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-wood-500 bg-wood-50 rounded-xl border border-wood-100 border-dashed mb-8">
            <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
            <p>해당 날짜에 등록된 묵상 가이드라인이 없습니다.</p>
          </div>
        )}

        {/* 오늘의 한줄 묵상 (Private) */}
        <div className="mt-8 bg-wood-50 rounded-xl p-6 border border-wood-100">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-bold text-wood-900 flex items-center gap-2">
              <Edit size={18} className="text-wood-500" />
              오늘의 한줄 묵상
            </h4>
            <div className="flex items-center gap-3">
              <span className="text-xs text-wood-400 font-medium">
                {savingProgress ? '저장 중...' : saveMessage}
              </span>
              {user && (
                <button
                  onClick={() => saveProgress()}
                  disabled={savingProgress}
                  className="px-4 py-1.5 bg-wood-900 text-white text-sm font-bold rounded-lg hover:bg-wood-800 transition-colors disabled:opacity-50"
                >
                  저장
                </button>
              )}
            </div>
          </div>
          <textarea
            value={meditation}
            onChange={handleMeditationChange}
            placeholder="다른 사람에게 공개되지 않습니다. 나의 묵상을 자유롭게 작성해보세요."
            className="w-full bg-white border border-wood-200 rounded-xl p-4 text-wood-800 focus:ring-2 focus:ring-wood-500 focus:border-transparent outline-none resize-none transition-shadow placeholder:text-wood-300"
            rows={3}
          />
          {!user && (
            <p className="text-sm text-red-500 mt-2">로그인 후 묵상을 기록할 수 있습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
