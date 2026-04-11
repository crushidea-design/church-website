import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar as CalendarIcon, Edit, ExternalLink, CheckCircle2, Circle } from 'lucide-react';
import { format, getDayOfYear, startOfDay, endOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
// @ts-ignore
import ReadingPlan from 'bible-in-one-year';

const bookNameMap: Record<string, string> = {
  'Genesis': '창세기', 'Exodus': '출애굽기', 'Leviticus': '레위기', 'Numbers': '민수기', 'Deuteronomy': '신명기',
  'Joshua': '여호수아', 'Judges': '사사기', 'Ruth': '룻기', '1 Samuel': '사무엘상', '2 Samuel': '사무엘하',
  '1 Kings': '열왕기상', '2 Kings': '열왕기하', '1 Chronicles': '역대상', '2 Chronicles': '역대하',
  'Ezra': '에스라', 'Nehemiah': '느헤미야', 'Esther': '에스더', 'Job': '욥기',
  'Psalm': '시편', 'Psalms': '시편', 'Proverbs': '잠언', 'Ecclesiastes': '전도서', 'Song of Solomon': '아가',
  'Isaiah': '이사야', 'Jeremiah': '예레미야', 'Lamentations': '예레미야 애가', 'Ezekiel': '에스겔',
  'Daniel': '다니엘', 'Hosea': '호세아', 'Joel': '요엘', 'Amos': '아모스', 'Obadiah': '오바댜',
  'Jonah': '요나', 'Micah': '미가', 'Nahum': '나훔', 'Habakkuk': '하박국', 'Zephaniah': '스바냐',
  'Haggai': '학개', 'Zechariah': '스가랴', 'Malachi': '말라기',
  'Matthew': '마태복음', 'Mark': '마가복음', 'Luke': '누가복음', 'John': '요한복음', 'Acts': '사도행전',
  'Romans': '로마서', '1 Corinthians': '고린도전서', '2 Corinthians': '고린도후서', 'Galatians': '갈라디아서',
  'Ephesians': '에베소서', 'Philippians': '빌립보서', 'Colossians': '골로새서',
  '1 Thessalonians': '데살로니가전서', '2 Thessalonians': '데살로니가후서', '1 Timothy': '디모데전서',
  '2 Timothy': '디모데후서', 'Titus': '디도서', 'Philemon': '빌레몬서', 'Hebrews': '히브리서',
  'James': '야고보서', '1 Peter': '베드로전서', '2 Peter': '베드로후서', '1 John': '요한일서',
  '2 John': '요한이서', '3 John': '요한삼서', 'Jude': '유다서', 'Revelation': '요한계시록'
};

const bookCodeMap: Record<string, string> = {
  'Genesis': 'gen', 'Exodus': 'exo', 'Leviticus': 'lev', 'Numbers': 'num', 'Deuteronomy': 'deu',
  'Joshua': 'jos', 'Judges': 'jdg', 'Ruth': 'rut', '1 Samuel': '1sa', '2 Samuel': '2sa',
  '1 Kings': '1ki', '2 Kings': '2ki', '1 Chronicles': '1ch', '2 Chronicles': '2ch',
  'Ezra': 'ezr', 'Nehemiah': 'neh', 'Esther': 'est', 'Job': 'job',
  'Psalm': 'psa', 'Psalms': 'psa', 'Proverbs': 'pro', 'Ecclesiastes': 'ecc', 'Song of Solomon': 'sng',
  'Isaiah': 'isa', 'Jeremiah': 'jer', 'Lamentations': 'lam', 'Ezekiel': 'ezk',
  'Daniel': 'dan', 'Hosea': 'hos', 'Joel': 'jol', 'Amos': 'amo', 'Obadiah': 'oba',
  'Jonah': 'jnh', 'Micah': 'mic', 'Nahum': 'nam', 'Habakkuk': 'hab', 'Zephaniah': 'zep',
  'Haggai': 'hag', 'Zechariah': 'zec', 'Malachi': 'mal',
  'Matthew': 'mat', 'Mark': 'mrk', 'Luke': 'luk', 'John': 'jhn', 'Acts': 'act',
  'Romans': 'rom', '1 Corinthians': '1co', '2 Corinthians': '2co', 'Galatians': 'gal',
  'Ephesians': 'eph', 'Philippians': 'php', 'Colossians': 'col',
  '1 Thessalonians': '1th', '2 Thessalonians': '2th', '1 Timothy': '1ti',
  '2 Timothy': '2ti', 'Titus': 'tit', 'Philemon': 'phm', 'Hebrews': 'heb',
  'James': 'jas', '1 Peter': '1pe', '2 Peter': '2pe', '1 John': '1jn',
  '2 John': '2jn', '3 John': '3jn', 'Jude': 'jud', 'Revelation': 'rev'
};

interface ReadingPassage {
  text: string;
  gaeLink: string;
  saeHangeulLink: string;
}

const translatePassage = (passage: string): ReadingPassage => {
  const match = passage.trim().match(/^([1-3]?\s*[A-Za-z\s]+)(.*)$/);
  if (match) {
    const bookName = match[1].trim();
    const chapterAndVerses = match[2].trim();
    const koreanBookName = bookNameMap[bookName] || bookName;
    let translated = `${koreanBookName} ${chapterAndVerses}`.trim();
    if (/\d$/.test(translated)) {
      if (koreanBookName === '시편') {
        translated += '편';
      } else {
        translated += '장';
      }
    }
    
    const chapterMatch = chapterAndVerses.match(/^(\d+)/);
    const chapter = chapterMatch ? chapterMatch[1] : '1';
    const bookCode = bookCodeMap[bookName] || 'gen';
    const saeHangeulCode = bookCode === 'jnh' ? 'JON' : bookCode.toUpperCase();
    
    return {
      text: translated,
      gaeLink: `https://www.bskorea.or.kr/bible/korbibReadpage.php?version=GAE&book=${bookCode}&chap=${chapter}`,
      saeHangeulLink: `https://www.bskorea.or.kr/KNT/index.php?version=d7a4326402395391-01&abbr=engKJVCPB&chapter=${saeHangeulCode}.${chapter}`
    };
  }
  return {
    text: passage,
    gaeLink: 'https://www.bskorea.or.kr/bible/korbibReadpage.php',
    saeHangeulLink: 'https://www.bskorea.or.kr/KNT/index.php'
  };
};

const getMcheyneReadingPlan = (date: Date): ReadingPassage[] => {
  try {
    // Check if ReadingPlan is a constructor
    if (typeof ReadingPlan !== 'function') {
      console.error('ReadingPlan is not a constructor. Check the bible-in-one-year package export.');
      return [];
    }
    const plan = new ReadingPlan('mcheyne');
    const dayOfYear = getDayOfYear(date);
    const index = (dayOfYear - 1) % 365;
    const readingsStr = plan.getDay(index);
    if (!readingsStr) return [];
    
    return readingsStr.split(',').map((p: string) => translatePassage(p));
  } catch (error) {
    console.error('Error getting reading plan:', error);
    return [];
  }
};

import { useStore } from '../store/useStore';

export default function TodayWord() {
  const { user, role } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const dateInputRef = React.useRef<HTMLInputElement>(null);
  const [latestPost, setLatestPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Reading Progress & Meditation State
  const [readingProgress, setReadingProgress] = useState<boolean[]>([]);
  const [meditation, setMeditation] = useState('');
  const [savingProgress, setSavingProgress] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Bridge Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');

  const readingPlan = getMcheyneReadingPlan(selectedDate);
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  
  const { todayWords, todayWordProgress, setTodayWord, setTodayWordProgress } = useStore();

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

  // Fetch Post and User Progress for selected date
  useEffect(() => {
    let ignore = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Post
        if (todayWords[dateStr] !== undefined) {
          if (!ignore) setLatestPost(todayWords[dateStr]);
        } else {
          const start = startOfDay(selectedDate);
          const end = endOfDay(selectedDate);
          
          const q = query(
            collection(db, 'posts'),
            where('category', '==', 'today_word'),
            where('createdAt', '>=', start),
            where('createdAt', '<=', end),
            limit(10) // Fetch a few to filter client-side
          );
          const snapshot = await getDocs(q);
          
          if (!snapshot.empty) {
            let validPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
            
            // Filter out unpublished scheduled posts for non-admins
            if (role !== 'admin') {
              validPosts = validPosts.filter(p => p.isPublished !== false);
            }
            
            if (validPosts.length > 0) {
              const postData = validPosts[0];
              
              // Handle long content reassembly
              if (postData.isLongContent) {
                console.log('Long content detected in TodayWord. Fetching chunks...');
                try {
                  const chunksQuery = query(
                    collection(db, 'post_contents'),
                    where('postId', '==', postData.id),
                    orderBy('index', 'asc')
                  );
                  const chunksSnap = await getDocs(chunksQuery);
                  if (!chunksSnap.empty) {
                    const fullContent = chunksSnap.docs.map(doc => doc.data().content).join('');
                    postData.content = fullContent;
                    console.log('Long content reassembled for TodayWord.');
                  }
                } catch (e) {
                  console.error('Error reassembling long content in TodayWord:', e);
                }
              }

              if (!ignore) setLatestPost(postData);
              setTodayWord(dateStr, postData);
            } else {
              if (!ignore) setLatestPost(null);
              setTodayWord(dateStr, null);
            }
          } else {
            if (!ignore) setLatestPost(null);
            setTodayWord(dateStr, null);
          }
        }

        // 2. Fetch User Progress
        if (user) {
          const cacheKey = `${user.uid}_${dateStr}`;
          if (todayWordProgress[cacheKey]) {
            const data = todayWordProgress[cacheKey];
            if (!ignore) {
              setReadingProgress(data.progress || new Array(readingPlan.length).fill(false));
              setMeditation(data.meditation || '');
            }
          } else {
            const progressRef = doc(db, 'users', user.uid, 'readings', dateStr);
            const progressSnap = await getDoc(progressRef);
            if (progressSnap.exists()) {
              const data = progressSnap.data();
              if (!ignore) {
                setReadingProgress(data.progress || new Array(readingPlan.length).fill(false));
                setMeditation(data.meditation || '');
              }
              setTodayWordProgress(cacheKey, data);
            } else {
              if (!ignore) {
                setReadingProgress(new Array(readingPlan.length).fill(false));
                setMeditation('');
              }
              setTodayWordProgress(cacheKey, { progress: new Array(readingPlan.length).fill(false), meditation: '' });
            }
          }
        } else {
          if (!ignore) {
            setReadingProgress(new Array(readingPlan.length).fill(false));
            setMeditation('');
          }
        }

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchData();

    return () => {
      ignore = true;
    };
  }, [selectedDate, user, dateStr, readingPlan.length, todayWords, todayWordProgress, setTodayWord, setTodayWordProgress]);

  const handleToggleProgress = async (index: number) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    const newProgress = [...readingProgress];
    newProgress[index] = !newProgress[index];
    setReadingProgress(newProgress);
    saveProgress(newProgress, meditation);
  };

  const handleMeditationChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMeditation(e.target.value);
  };

  const saveProgress = async (progress: boolean[], med: string) => {
    if (!user) return;
    setSavingProgress(true);
    setSaveMessage('');
    try {
      const progressRef = doc(db, 'users', user.uid, 'readings', dateStr);
      await setDoc(progressRef, {
        date: dateStr,
        progress,
        meditation: med,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      // Update cache
      const cacheKey = `${user.uid}_${dateStr}`;
      setTodayWordProgress(cacheKey, { progress, meditation: med });
      
      setSaveMessage('저장되었습니다.');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch (error) {
      console.error('Error saving progress:', error);
      setSaveMessage('저장 실패');
    } finally {
      setSavingProgress(false);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    if (!isNaN(newDate.getTime())) {
      setSelectedDate(newDate);
      setReadingProgress([]);
      setMeditation('');
    }
  };

  return (
    <div className="space-y-8">
      {/* 오늘의 묵상 설명 섹션 */}
      <div className="mb-8 border-b border-wood-200 pb-6">
        <p className="text-lg text-wood-600">매일의 성경 읽기와 묵상 가이드라인을 통해 하나님의 말씀을 깊이 있게 만나는 시간입니다.</p>
      </div>

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
          <h3 className="text-2xl font-serif font-bold text-wood-900">오늘의 묵상</h3>
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
            <div className="pt-6 border-t border-wood-100 flex justify-end mb-8">
              <Link 
                to={`/post/${latestPost.id}`}
                className="text-gold-600 hover:text-gold-700 font-medium text-sm flex items-center gap-1"
              >
                자세히 보기 및 댓글 달기 &rarr;
              </Link>
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
                  onClick={() => saveProgress(readingProgress, meditation)}
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
