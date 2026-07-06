import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Edit2, Check, X as CloseIcon } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/utils';
import { useStore } from '../store/useStore';
import SiteCmsSections from '../components/SiteCmsSections';

const DEFAULT_HERO_IMAGE = "https://lh3.googleusercontent.com/d/1V0VulPP6zYJLhZCS_Ytmq2Ad2tndcEm0";

export default function Home() {
  const { user, role } = useAuth();
  const { homeLatestPosts, homeLatestPostsFetched, researchCategories, setHomeLatestPosts, setCategories } = useStore();
  
  const [heroImage, setHeroImage] = useState(DEFAULT_HERO_IMAGE);
  const [isEditing, setIsEditing] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(!homeLatestPostsFetched);

  useEffect(() => {
    const fetchLatestPosts = async () => {
      if (homeLatestPostsFetched) {
        setLoadingPosts(false);
        return;
      }

      // Check cache first
      const CACHE_KEY = 'home_latest_posts_cache';
      const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
      const cachedData = localStorage.getItem(CACHE_KEY);
      
      if (cachedData) {
        try {
          const { posts, timestamp } = JSON.parse(cachedData);
          const cacheNeedsCategoryId = posts.some((post: any) => post.category === 'research' && !post.researchCategoryId);
          if (!cacheNeedsCategoryId && Date.now() - timestamp < CACHE_TTL) {
            setHomeLatestPosts(posts);
            setLoadingPosts(false);
            return;
          }
          if (cacheNeedsCategoryId) {
            localStorage.removeItem(CACHE_KEY);
          }
        } catch (e) {
          localStorage.removeItem(CACHE_KEY);
        }
      }

      setLoadingPosts(true);
      try {
        // Optimization: Read from a pre-computed summary document
        const summarySnap = await getDoc(doc(db, 'settings', 'latest_posts_summary'));
        
        if (summarySnap.exists()) {
          const summaryData = summarySnap.data();
          const categories = ['sermon', 'research', 'journal', 'community'];
          const postsData: any[] = [];
          
          categories.forEach(cat => {
            if (summaryData[cat]) {
              // Permission check for sermon
              if (cat === 'sermon' && role !== 'regular' && role !== 'admin') {
                return;
              }
              postsData.push(summaryData[cat]);
            }
          });

          await Promise.all(postsData.map(async (post) => {
            if (post.category !== 'research' || post.researchCategoryId || !post.id) return;

            const postSnap = await getDoc(doc(db, 'posts', post.id));
            if (postSnap.exists()) {
              const data = postSnap.data();
              post.researchCategoryId = data.researchCategoryId || null;
              post.subCategory = data.subCategory || post.subCategory;
            }
          }));

          // Sort by createdAt descending
          postsData.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA;
          });

          const finalPosts = postsData.slice(0, 3);
          setHomeLatestPosts(finalPosts);
          
          // Cache the result
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            posts: finalPosts,
            timestamp: Date.now()
          }));
          
          setLoadingPosts(false);
          return;
        }

        // Fallback to original query if summary doesn't exist
        const categories = ['community', 'research', 'journal'];
        if (role === 'regular' || role === 'admin') {
          categories.push('sermon');
        }

        const postsData: any[] = [];
        await Promise.all(categories.map(async (cat) => {
          const q = query(
            collection(db, 'posts'),
            where('category', '==', cat),
            orderBy('createdAt', 'desc'),
            limit(1)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            postsData.push({ id: snap.docs[0].id, ...snap.docs[0].data() });
          }
        }));

        // Sort by createdAt descending
        postsData.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
          const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
          return dateB - dateA;
        });

        setHomeLatestPosts(postsData.slice(0, 3));
      } catch (error: any) {
        console.error('Error fetching latest posts:', error);
      } finally {
        setLoadingPosts(false);
      }
    };
    fetchLatestPosts();
  }, [role, homeLatestPostsFetched]);

  useEffect(() => {
    const getDirectImageUrl = (url: string) => {
      if (!url) return url;
      const driveMatch = url.match(/\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/);
      if (driveMatch && driveMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
      }
      return url;
    };

    const fetchHeroImage = async () => {
      // Check cache with TTL (30 minutes)
      const CACHE_TTL = 30 * 60 * 1000;
      const cachedHero = localStorage.getItem('hero_image_data');
      if (cachedHero) {
        try {
          const { url, timestamp } = JSON.parse(cachedHero);
          setHeroImage(url);
          if (Date.now() - timestamp < CACHE_TTL) {
            return;
          }
        } catch (e) {
          localStorage.removeItem('hero_image_data');
        }
      }

      try {
        const heroDoc = await getDoc(doc(db, 'settings', 'hero'));
        if (heroDoc.exists()) {
          const rawUrl = heroDoc.data().heroImageUrl;
          const directUrl = getDirectImageUrl(rawUrl) || DEFAULT_HERO_IMAGE;
          setHeroImage(directUrl);
          localStorage.setItem('hero_image_data', JSON.stringify({
            url: directUrl,
            timestamp: Date.now()
          }));
        }
      } catch (error: any) {
        console.error('Error fetching hero image:', error);
      }
    };

    fetchHeroImage();
  }, []);

  useEffect(() => {
    const hasResearchPost = homeLatestPosts.some((post: any) => post.category === 'research');
    if (!hasResearchPost) return;

    const fetchResearchCategories = async () => {
      try {
        const catQ = query(collection(db, 'research_categories'), orderBy('order', 'asc'));
        const catSnap = await getDocs(catQ);
        const cats = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCategories('researchCategories', cats);
      } catch (error) {
        console.error('Error fetching research categories for home:', error);
      }
    };

    fetchResearchCategories();
  }, [homeLatestPosts, setCategories]);

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

  const generateSummary = (content: string) => {
    if (!content) return '';
    const plainText = content.replace(/<[^>]+>/g, '').trim();
    const firstSentenceMatch = plainText.match(/^.*?[.!?](?:\s|$)/);
    let summary = firstSentenceMatch ? firstSentenceMatch[0].trim() : plainText.substring(0, 100);
    
    if (summary.length > 100) {
      summary = summary.substring(0, 97) + '...';
    } else if (plainText.length > summary.length && !firstSentenceMatch) {
      summary += '...';
    }
    
    return summary;
  };

  const getCategoryName = (post: any) => {
    if (post.category === 'research') {
      const categoryName = researchCategories.find((category: any) => category.id === post.researchCategoryId)?.name;
      if (categoryName) return categoryName;

      return post.subCategory === 'worship' ? '예배' :
             post.subCategory === 'preaching' ? '설교' :
             post.subCategory === 'pastoring' ? '목양' :
             post.subCategory === 'governing' ? '치리' :
             post.subCategory === 'general' ? '일반' : '연구실';
    } else if (post.category === 'sermon') {
      if (post.sermonCategoryId) return '말씀 서재';
      return post.subCategory === 'past_sermons' ? '지난 설교들' :
             post.subCategory === 'pilgrims_progress' ? '천로역정' : '말씀 서재';
    } else if (post.category === 'journal') {
      return '개척 일지';
    } else {
      return '소통 게시판';
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
            loading="lazy"
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
            className="absolute top-24 right-8 z-20 bg-white/20 hover:bg-white/40 text-white p-3 rounded-full transition-all border border-white/30 group"
            title="배경 이미지 수정"
          >
            <Edit2 size={20} className="group-hover:scale-110 transition-transform" />
          </button>
        )}

        {/* Admin Edit Modal/Overlay */}
        {isEditing && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-wood-950/60 p-4">
            <div className="bg-white rounded-md p-8 max-w-lg w-full shadow-lg border border-wood-200">
              <h3 className="text-2xl font-serif font-bold text-wood-900 mb-6">배경 이미지 수정</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-wood-700 mb-2">이미지 URL</label>
                  <input
                    type="text"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="구글 드라이브 링크 또는 이미지 주소"
                    className="w-full px-4 py-3 rounded-sm border border-wood-200 focus:border-wood-500 outline-none transition bg-wood-50"
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
                    className="flex-1 bg-wood-900 text-white py-3 rounded-sm font-medium hover:bg-wood-800 transition flex items-center justify-center gap-2 disabled:opacity-50"
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
                    className="flex-1 bg-wood-100 text-wood-700 py-3 rounded-sm font-medium hover:bg-wood-200 transition flex items-center justify-center gap-2"
                  >
                    <CloseIcon size={18} />
                    취소
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[11px] md:text-xs font-semibold uppercase tracking-[0.35em] text-gold-400 mb-6">
            Built Together Church
          </p>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-serif font-bold text-white mb-8 leading-tight">
            함께 지어져가는 교회
          </h1>
          <p className="text-base md:text-xl text-wood-100/90 mb-3 max-w-3xl mx-auto font-serif leading-relaxed">
            너희도 성령 안에서 하나님이 거하실 처소가 되기 위하여
            <br />
            그리스도 예수 안에서 함께 지어져 가느니라
          </p>
          <p className="text-sm md:text-base text-gold-300 font-serif mb-14 tracking-widest">에베소서 2장 22절</p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/intro"
              className="inline-flex items-center justify-center px-8 py-3.5 text-sm font-semibold rounded-sm text-wood-900 bg-white hover:bg-wood-100 transition"
            >
              교회 소개
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center px-8 py-3.5 text-sm font-semibold rounded-sm text-white border border-white/50 hover:bg-white/10 transition"
            >
              개척 모임 참여
            </Link>
          </div>
        </div>
      </section>

      <SiteCmsSections pageSlug="home" placement="top" />

      {/* Latest Posts Section */}
      <section className="py-24 bg-wood-50 border-t border-wood-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-14">
            <p className="overline-label mb-3">Latest</p>
            <h2 className="text-3xl font-serif font-bold text-wood-950 mb-3">최신 게시물</h2>
            <p className="text-base text-wood-600">함께 지어져가는 교회의 최근 소식과 나눔입니다.</p>
          </div>

          {loadingPosts ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-wood-700"></div>
            </div>
          ) : homeLatestPosts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-md border border-wood-200">
              <p className="text-wood-500">아직 등록된 게시물이 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-wood-200 border border-wood-200">
              {homeLatestPosts.map((post) => (
                <div key={post.id} className="group bg-white">
                  <Link to={`/post/${post.id}`} className="block h-full">
                    <div className="h-full p-8 flex flex-col">
                      <div className="flex items-baseline justify-between mb-5">
                        <span className="text-xs font-semibold tracking-wider text-gold-700">
                          {getCategoryName(post)}
                        </span>
                        <span className="text-xs text-wood-500">
                          {formatDate(post.createdAt, 'yyyy.MM.dd')}
                        </span>
                      </div>

                      <h3 className="text-xl font-serif font-bold text-wood-950 mb-4 line-clamp-2 leading-snug group-hover:underline decoration-gold-500 underline-offset-4">
                        {post.title}
                      </h3>

                      <p className="text-wood-600 text-sm leading-relaxed flex-grow line-clamp-3">
                        {generateSummary(post.content)}
                      </p>

                      <div className="mt-8 flex items-center text-wood-700 text-sm font-medium">
                        자세히 보기 <ArrowRight size={15} className="ml-1.5" />
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <SiteCmsSections pageSlug="home" placement="bottom" />
    </div>
  );
}
