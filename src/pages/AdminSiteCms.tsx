import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { Archive, ArchiveRestore, Loader2, Save, Settings, Trash2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import AdminLayout from '../components/AdminLayout';
import {
  normalizeSiteCmsSlug,
  seedSiteCmsIfEmpty,
  SiteCmsProvider,
  SiteCmsSection,
  upsertSiteCmsPage,
  upsertSiteCmsSection,
  upsertSiteCmsToolState,
  useSiteCms,
} from '../lib/siteCms';
import { generateSortOrder } from '../lib/sortUtils';

type CmsTab = 'pages' | 'sections' | 'posts' | 'categories' | 'tools';

interface PostSummary {
  id: string;
  title: string;
  category?: string;
  subCategory?: string;
  authorName?: string;
  createdAt?: any;
  sortOrder?: number;
  sermonCategoryId?: string | null;
  researchCategoryId?: string | null;
  isArchived?: boolean;
}

interface CategoryItem {
  id: string;
  name: string;
  order: number;
}

function formatCreatedAt(value: any) {
  const date = value?.toDate?.() || (typeof value === 'string' ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ko-KR');
}

function AdminSiteCmsInner() {
  const navigate = useNavigate();
  const { role, user, loading: authLoading } = useAuth();
  const { pages, sections } = useSiteCms();
  const [activeTab, setActiveTab] = useState<CmsTab>('pages');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageLabel, setNewPageLabel] = useState('');
  const [newPageSlug, setNewPageSlug] = useState('');

  const [selectedPageSlug, setSelectedPageSlug] = useState('home');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionType, setNewSectionType] = useState<SiteCmsSection['type']>('text');
  const [newSectionContent, setNewSectionContent] = useState('');
  const [newSectionHighlights, setNewSectionHighlights] = useState('');
  const [newSectionMedia, setNewSectionMedia] = useState('');

  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubCategory, setFilterSubCategory] = useState('');
  const [filterArchived, setFilterArchived] = useState<'all' | 'active' | 'archived'>('all');
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [moveCategory, setMoveCategory] = useState('community');
  const [moveSubCategory, setMoveSubCategory] = useState('');

  const [sermonCategories, setSermonCategories] = useState<CategoryItem[]>([]);
  const [researchCategories, setResearchCategories] = useState<CategoryItem[]>([]);
  const [newSermonCategory, setNewSermonCategory] = useState('');
  const [newResearchCategory, setNewResearchCategory] = useState('');

  useEffect(() => {
    if (!authLoading && role !== 'admin') navigate('/');
  }, [authLoading, role, navigate]);

  useEffect(() => {
    const run = async () => {
      if (role !== 'admin') return;
      await seedSiteCmsIfEmpty();
    };
    run();
  }, [role]);

  useEffect(() => {
    if (!selectedPageSlug && pages.length > 0) setSelectedPageSlug(pages[0].slug);
  }, [pages, selectedPageSlug]);

  useEffect(() => {
    const fetchPosts = async () => {
      if (role !== 'admin') return;
      setPostsLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(400)));
        setPosts(snap.docs.map((item) => ({ id: item.id, ...(item.data() as any) })) as PostSummary[]);
      } finally {
        setPostsLoading(false);
      }
    };
    fetchPosts();
  }, [role, busy]);

  useEffect(() => {
    const fetchCategories = async () => {
      if (role !== 'admin') return;
      const [sermonSnap, researchSnap] = await Promise.all([
        getDocs(query(collection(db, 'sermon_categories'), orderBy('order', 'asc'), limit(100))),
        getDocs(query(collection(db, 'research_categories'), orderBy('order', 'asc'), limit(100))),
      ]);
      setSermonCategories(sermonSnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) })) as CategoryItem[]);
      setResearchCategories(researchSnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) })) as CategoryItem[]);
    };
    fetchCategories();
  }, [role, busy]);

  const showNotice = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 3000);
  };

  const parseLines = (value: string) =>
    value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

  const parseMediaLines = (value: string) =>
    parseLines(value)
      .map((line) => {
        const [src, altRaw] = line.split('|');
        return { src: (src || '').trim(), alt: (altRaw || '이미지').trim() };
      })
      .filter((item) => !!item.src);

  const filteredSections = useMemo(
    () => sections.filter((item) => item.pageSlug === selectedPageSlug).sort((a, b) => a.order - b.order),
    [sections, selectedPageSlug]
  );

  const filteredPosts = useMemo(() => {
    const text = search.trim().toLowerCase();
    return posts.filter((post) => {
      if (filterCategory && post.category !== filterCategory) return false;
      if (filterSubCategory && post.subCategory !== filterSubCategory) return false;
      if (filterArchived === 'active' && post.isArchived) return false;
      if (filterArchived === 'archived' && !post.isArchived) return false;
      if (!text) return true;
      return (post.title || '').toLowerCase().includes(text) || (post.authorName || '').toLowerCase().includes(text);
    });
  }, [filterArchived, filterCategory, filterSubCategory, posts, search]);

  const addPage = async () => {
    const slug = normalizeSiteCmsSlug(newPageSlug || newPageTitle);
    if (!slug || !newPageTitle.trim()) return;
    setBusy(true);
    try {
      await upsertSiteCmsPage(slug, {
        title: newPageTitle.trim(),
        label: (newPageLabel || newPageTitle).trim(),
        routeSlug: slug,
        targetPath: `/${slug}`,
        order: pages.length + 1,
        visible: true,
      });
      setNewPageTitle('');
      setNewPageLabel('');
      setNewPageSlug('');
      showNotice('페이지를 추가했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const savePage = async (
    id: string,
    patch: Partial<{ title: string; label: string; routeSlug: string; targetPath: string; order: number; visible: boolean }>
  ) => {
    await updateDoc(doc(db, 'site_cms_pages', id), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  };

  const deletePage = async (slug: string) => {
    const hasSections = sections.some((section) => section.pageSlug === slug);
    if (hasSections) {
      alert('해당 페이지에 연결된 섹션이 있어 먼저 섹션을 이동/삭제해야 합니다.');
      return;
    }
    if (!window.confirm('페이지를 삭제하시겠습니까?')) return;
    await deleteDoc(doc(db, 'site_cms_pages', slug));
    showNotice('페이지를 삭제했습니다.');
  };

  const addSection = async () => {
    if (!selectedPageSlug || !newSectionTitle.trim()) return;
    const id = `${selectedPageSlug}_${Date.now()}`;
    setBusy(true);
    try {
      await upsertSiteCmsSection(id, {
        pageSlug: selectedPageSlug,
        type: newSectionType,
        title: newSectionTitle.trim(),
        content: newSectionContent.trim(),
        highlights: parseLines(newSectionHighlights),
        media: parseMediaLines(newSectionMedia),
        order: filteredSections.length + 1,
        visible: true,
      });
      setNewSectionTitle('');
      setNewSectionType('text');
      setNewSectionContent('');
      setNewSectionHighlights('');
      setNewSectionMedia('');
      showNotice('섹션을 추가했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const saveSection = async (
    id: string,
    patch: Partial<{ title: string; content: string; order: number; visible: boolean; type: SiteCmsSection['type'] }>
  ) => {
    await updateDoc(doc(db, 'site_cms_sections', id), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  };

  const deleteSection = async (id: string) => {
    if (!window.confirm('섹션을 삭제하시겠습니까?')) return;
    await deleteDoc(doc(db, 'site_cms_sections', id));
    showNotice('섹션을 삭제했습니다.');
  };

  const toggleSelectPost = (id: string) => {
    setSelectedPostIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const updateSelectedPosts = async (patch: Record<string, any>, doneMessage: string) => {
    if (selectedPostIds.length === 0) return;
    setBusy(true);
    try {
      const batch = writeBatch(db);
      selectedPostIds.forEach((id) => {
        batch.update(doc(db, 'posts', id), {
          ...patch,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      setSelectedPostIds([]);
      showNotice(doneMessage);
    } finally {
      setBusy(false);
    }
  };

  const moveSelectedPosts = async () => {
    if (selectedPostIds.length === 0 || !moveCategory) return;
    await updateSelectedPosts(
      {
        category: moveCategory,
        subCategory: moveSubCategory || '',
      },
      '선택한 게시물을 이동했습니다.'
    );
  };

  const archiveSelectedPosts = async () => {
    await updateSelectedPosts(
      {
        isArchived: true,
        archivedAt: serverTimestamp(),
        archivedBy: user?.uid || null,
      },
      '선택한 게시물을 보관함으로 이동했습니다.'
    );
  };

  const restoreSelectedPosts = async () => {
    await updateSelectedPosts(
      {
        isArchived: false,
        archivedAt: null,
        archivedBy: null,
      },
      '선택한 게시물을 복구했습니다.'
    );
  };

  const addCategory = async (type: 'sermon' | 'research') => {
    const value = (type === 'sermon' ? newSermonCategory : newResearchCategory).trim();
    if (!value) return;
    const current = type === 'sermon' ? sermonCategories : researchCategories;
    setBusy(true);
    try {
      await addDoc(collection(db, type === 'sermon' ? 'sermon_categories' : 'research_categories'), {
        name: value,
        order: current.length + 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (type === 'sermon') setNewSermonCategory('');
      else setNewResearchCategory('');
      showNotice('카테고리를 추가했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const saveCategory = async (type: 'sermon' | 'research', id: string, patch: Partial<CategoryItem>) => {
    await updateDoc(doc(db, type === 'sermon' ? 'sermon_categories' : 'research_categories', id), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  };

  const deleteCategoryWithMove = async (type: 'sermon' | 'research', categoryId: string) => {
    const targetId = prompt('삭제 전 이동할 대상 카테고리 ID를 입력해 주세요.');
    if (!targetId || targetId === categoryId) return;
    const categories = type === 'sermon' ? sermonCategories : researchCategories;
    const targetExists = categories.some((category) => category.id === targetId);
    if (!targetExists) {
      alert('이동 대상 카테고리 ID가 유효하지 않습니다.');
      return;
    }
    const collectionName = type === 'sermon' ? 'sermon_categories' : 'research_categories';
    const fieldName = type === 'sermon' ? 'sermonCategoryId' : 'researchCategoryId';

    setBusy(true);
    try {
      const postSnap = await getDocs(query(collection(db, 'posts'), where(fieldName, '==', categoryId), limit(500)));
      const batch = writeBatch(db);
      postSnap.docs.forEach((item) => {
        batch.update(item.ref, { [fieldName]: targetId, updatedAt: serverTimestamp() });
      });
      batch.delete(doc(db, collectionName, categoryId));
      await batch.commit();
      showNotice('카테고리를 이동 후 삭제했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const refreshLatestSummary = async () => {
    setBusy(true);
    try {
      const categories = ['sermon', 'research', 'community', 'journal'];
      const summary: Record<string, any> = {};
      await Promise.all(
        categories.map(async (category) => {
          const snap = await getDocs(
            query(collection(db, 'posts'), where('category', '==', category), orderBy('createdAt', 'desc'), limit(1))
          );
          if (snap.empty) return;
          const item = snap.docs[0];
          const data = item.data() as any;
          summary[category] = {
            id: item.id,
            title: data.title || '',
            content: (data.content || '').substring(0, 500),
            category,
            subCategory: data.subCategory || '',
            sermonCategoryId: data.sermonCategoryId || null,
            researchCategoryId: data.researchCategoryId || null,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            authorName: data.authorName || '',
          };
        })
      );

      await setDoc(
        doc(db, 'settings', 'latest_posts_summary'),
        {
          ...summary,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      localStorage.removeItem('home_latest_posts_cache');
      showNotice('최신 요약을 재생성했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const resetCaches = async () => {
    setBusy(true);
    try {
      localStorage.removeItem('home_latest_posts_cache');
      localStorage.removeItem('hero_image_data');
      localStorage.removeItem('admin_unread_messages');
      await upsertSiteCmsToolState('cache_reset_version', String(Date.now()));
      showNotice('로컬 캐시를 초기화했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const repairSortOrderAndSlug = async () => {
    setBusy(true);
    try {
      const snap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'asc'), limit(500)));
      const batch = writeBatch(db);
      let updated = 0;
      snap.docs.forEach((item) => {
        const data = item.data() as any;
        const patch: Record<string, any> = {};
        if (!data.sortOrder) {
          patch.sortOrder = generateSortOrder(data.title || '');
        }
        if ((data.category === 'research' || data.category === 'community') && !('subCategory' in data)) {
          patch.subCategory = data.category === 'research' ? 'general' : 'free_board';
        }
        if (Object.keys(patch).length > 0) {
          patch.updatedAt = serverTimestamp();
          batch.update(item.ref, patch);
          updated += 1;
        }
      });
      if (updated > 0) {
        await batch.commit();
      }
      await upsertSiteCmsToolState('repair_sort_slug_last_run', String(Date.now()));
      showNotice(`정렬/슬러그 보정 완료 (${updated}건)`);
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-wood-100">
        <Loader2 className="h-10 w-10 animate-spin text-wood-700" />
      </div>
    );
  }

  return (
    <AdminLayout
      title="기본 홈페이지 CMS"
      description="홈/소개/아카이브/커뮤니티를 단일 CMS 화면에서 관리합니다."
      backTo="/admin"
      backLabel="관리자 대시보드"
      icon={<Settings size={14} />}
      maxWidthClassName="max-w-7xl"
      aside={
        <div>
          <p className="text-xs font-semibold text-wood-700">운영 요약</p>
          <p className="mt-1 text-xs text-wood-600">페이지 {pages.length}개 / 섹션 {sections.length}개</p>
        </div>
      }
    >
      <div className="mb-5 flex flex-wrap gap-2">
        {[
          { id: 'pages', label: '페이지구조' },
          { id: 'sections', label: '콘텐츠섹션' },
          { id: 'posts', label: '게시물정리' },
          { id: 'categories', label: '카테고리' },
          { id: 'tools', label: '운영도구' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as CmsTab)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              activeTab === tab.id ? 'bg-wood-900 text-white' : 'bg-white text-wood-700 hover:bg-wood-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {notice && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{notice}</div>}

      {activeTab === 'pages' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-wood-200 bg-white p-5">
            <h3 className="text-lg font-bold text-wood-900">페이지 추가</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <input value={newPageTitle} onChange={(e) => setNewPageTitle(e.target.value)} className="rounded-lg border border-wood-200 px-3 py-2 text-sm" placeholder="페이지 제목" />
              <input value={newPageLabel} onChange={(e) => setNewPageLabel(e.target.value)} className="rounded-lg border border-wood-200 px-3 py-2 text-sm" placeholder="메뉴 라벨" />
              <input value={newPageSlug} onChange={(e) => setNewPageSlug(e.target.value)} className="rounded-lg border border-wood-200 px-3 py-2 text-sm" placeholder="slug (선택)" />
              <button type="button" onClick={addPage} disabled={busy} className="rounded-lg bg-wood-900 px-3 py-2 text-sm font-bold text-white">추가</button>
            </div>
          </div>

          <div className="rounded-2xl border border-wood-200 bg-white p-5">
            <h3 className="mb-3 text-lg font-bold text-wood-900">페이지 목록</h3>
            <div className="space-y-3">
              {pages.map((page) => (
                <div key={page.id} className="grid gap-3 rounded-xl border border-wood-100 p-3 md:grid-cols-[1.2fr_1fr_1fr_120px_100px_80px]">
                  <input defaultValue={page.title} onBlur={(e) => savePage(page.id, { title: e.target.value.trim() || page.title })} className="rounded border border-wood-200 px-3 py-2 text-sm" />
                  <input defaultValue={page.label} onBlur={(e) => savePage(page.id, { label: e.target.value.trim() || page.label })} className="rounded border border-wood-200 px-3 py-2 text-sm" />
                  <input
                    defaultValue={(page as any).routeSlug || page.slug}
                    onBlur={(e) => {
                      const nextRouteSlug = normalizeSiteCmsSlug(e.target.value) || ((page as any).routeSlug || page.slug);
                      const targetPath = page.slug === 'home' ? '/' : `/${nextRouteSlug}`;
                      savePage(page.id, { routeSlug: nextRouteSlug, targetPath });
                    }}
                    className="rounded border border-wood-200 px-3 py-2 text-sm"
                  />
                  <input type="number" defaultValue={page.order} onBlur={(e) => savePage(page.id, { order: Number(e.target.value) || page.order })} className="rounded border border-wood-200 px-3 py-2 text-sm" />
                  <label className="flex items-center gap-2 text-sm font-medium text-wood-700">
                    <input type="checkbox" defaultChecked={page.visible} onChange={(e) => savePage(page.id, { visible: e.target.checked })} />
                    노출
                  </label>
                  <button type="button" onClick={() => deletePage(page.slug)} className="inline-flex items-center justify-center rounded border border-red-200 px-2 py-2 text-xs font-bold text-red-700 hover:bg-red-50">
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sections' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-wood-200 bg-white p-5">
            <h3 className="text-lg font-bold text-wood-900">섹션 추가</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <select value={selectedPageSlug} onChange={(e) => setSelectedPageSlug(e.target.value)} className="rounded-lg border border-wood-200 px-3 py-2 text-sm">
                {pages.map((page) => (
                  <option key={page.slug} value={page.slug}>{page.title}</option>
                ))}
              </select>
              <select value={newSectionType} onChange={(e) => setNewSectionType(e.target.value as SiteCmsSection['type'])} className="rounded-lg border border-wood-200 px-3 py-2 text-sm">
                <option value="text">text</option>
                <option value="highlights">highlights</option>
                <option value="gallery">gallery</option>
                <option value="hero">hero</option>
              </select>
              <input value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)} className="rounded-lg border border-wood-200 px-3 py-2 text-sm md:col-span-2" placeholder="섹션 제목" />
              <textarea value={newSectionContent} onChange={(e) => setNewSectionContent(e.target.value)} rows={4} className="rounded-lg border border-wood-200 px-3 py-2 text-sm md:col-span-2" placeholder="본문" />
              <textarea value={newSectionHighlights} onChange={(e) => setNewSectionHighlights(e.target.value)} rows={3} className="rounded-lg border border-wood-200 px-3 py-2 text-sm" placeholder="하이라이트 (줄바꿈)" />
              <textarea value={newSectionMedia} onChange={(e) => setNewSectionMedia(e.target.value)} rows={3} className="rounded-lg border border-wood-200 px-3 py-2 text-sm" placeholder="미디어: url|alt (줄바꿈)" />
            </div>
            <button type="button" onClick={addSection} disabled={busy} className="mt-3 rounded-lg bg-wood-900 px-4 py-2 text-sm font-bold text-white">
              섹션 추가
            </button>
          </div>

          <div className="rounded-2xl border border-wood-200 bg-white p-5">
            <h3 className="mb-3 text-lg font-bold text-wood-900">섹션 목록</h3>
            <div className="space-y-3">
              {filteredSections.map((section) => (
                <div key={section.id} className="rounded-xl border border-wood-100 p-3">
                  <div className="grid gap-2 md:grid-cols-[1.4fr_140px_110px_80px]">
                    <input defaultValue={section.title} onBlur={(e) => saveSection(section.id, { title: e.target.value.trim() || section.title })} className="rounded border border-wood-200 px-3 py-2 text-sm" />
                    <select defaultValue={section.type} onChange={(e) => saveSection(section.id, { type: e.target.value as SiteCmsSection['type'] })} className="rounded border border-wood-200 px-3 py-2 text-sm">
                      <option value="text">text</option>
                      <option value="highlights">highlights</option>
                      <option value="gallery">gallery</option>
                      <option value="hero">hero</option>
                    </select>
                    <input type="number" defaultValue={section.order} onBlur={(e) => saveSection(section.id, { order: Number(e.target.value) || section.order })} className="rounded border border-wood-200 px-3 py-2 text-sm" />
                    <label className="flex items-center gap-2 text-sm font-medium text-wood-700">
                      <input type="checkbox" defaultChecked={section.visible} onChange={(e) => saveSection(section.id, { visible: e.target.checked })} />
                      노출
                    </label>
                  </div>
                  <textarea defaultValue={section.content} onBlur={(e) => saveSection(section.id, { content: e.target.value })} rows={3} className="mt-2 w-full rounded border border-wood-200 px-3 py-2 text-sm" />
                  <button type="button" onClick={() => deleteSection(section.id)} className="mt-2 inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-50">
                    <Trash2 size={12} />
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'posts' && (
        <div className="rounded-2xl border border-wood-200 bg-white p-5">
          <h3 className="text-lg font-bold text-wood-900">게시물 정리</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-5">
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="rounded border border-wood-200 px-3 py-2 text-sm" placeholder="제목/작성자 검색" />
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="rounded border border-wood-200 px-3 py-2 text-sm">
              <option value="">전체 카테고리</option>
              <option value="sermon">sermon</option>
              <option value="research">research</option>
              <option value="community">community</option>
              <option value="journal">journal</option>
              <option value="today_word">today_word</option>
              <option value="next_generation">next_generation</option>
            </select>
            <input value={filterSubCategory} onChange={(e) => setFilterSubCategory(e.target.value)} className="rounded border border-wood-200 px-3 py-2 text-sm" placeholder="서브카테고리 필터" />
            <select value={filterArchived} onChange={(e) => setFilterArchived(e.target.value as 'all' | 'active' | 'archived')} className="rounded border border-wood-200 px-3 py-2 text-sm">
              <option value="all">전체 상태</option>
              <option value="active">공개</option>
              <option value="archived">보관</option>
            </select>
            <div className="text-sm text-wood-600">선택: {selectedPostIds.length}건</div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_120px_120px_120px]">
            <select value={moveCategory} onChange={(e) => setMoveCategory(e.target.value)} className="rounded border border-wood-200 px-3 py-2 text-sm">
              <option value="community">community</option>
              <option value="research">research</option>
              <option value="sermon">sermon</option>
              <option value="journal">journal</option>
              <option value="today_word">today_word</option>
            </select>
            <input value={moveSubCategory} onChange={(e) => setMoveSubCategory(e.target.value)} className="rounded border border-wood-200 px-3 py-2 text-sm" placeholder="subCategory (선택)" />
            <button type="button" onClick={moveSelectedPosts} className="rounded bg-wood-900 px-3 py-2 text-xs font-bold text-white">일괄 이동</button>
            <button type="button" onClick={archiveSelectedPosts} className="inline-flex items-center justify-center gap-1 rounded bg-amber-600 px-3 py-2 text-xs font-bold text-white"><Archive size={12} />보관</button>
            <button type="button" onClick={restoreSelectedPosts} className="inline-flex items-center justify-center gap-1 rounded bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><ArchiveRestore size={12} />복구</button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-wood-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-wood-50">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={filteredPosts.length > 0 && selectedPostIds.length === filteredPosts.length}
                      onChange={(e) => setSelectedPostIds(e.target.checked ? filteredPosts.map((post) => post.id) : [])}
                    />
                  </th>
                  <th className="px-3 py-2">제목</th>
                  <th className="px-3 py-2">카테고리</th>
                  <th className="px-3 py-2">서브카테고리</th>
                  <th className="px-3 py-2">작성일</th>
                  <th className="px-3 py-2">상태</th>
                </tr>
              </thead>
              <tbody>
                {postsLoading ? (
                  <tr><td className="px-3 py-3 text-wood-500" colSpan={6}>불러오는 중...</td></tr>
                ) : (
                  filteredPosts.map((post) => (
                    <tr key={post.id} className="border-t border-wood-100">
                      <td className="px-3 py-2"><input type="checkbox" checked={selectedPostIds.includes(post.id)} onChange={() => toggleSelectPost(post.id)} /></td>
                      <td className="px-3 py-2">{post.title || '(제목 없음)'}</td>
                      <td className="px-3 py-2">{post.category || '-'}</td>
                      <td className="px-3 py-2">{post.subCategory || '-'}</td>
                      <td className="px-3 py-2">{formatCreatedAt(post.createdAt)}</td>
                      <td className="px-3 py-2">{post.isArchived ? '보관' : '공개'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-wood-200 bg-white p-5">
            <h3 className="text-lg font-bold text-wood-900">말씀서재 카테고리</h3>
            <div className="mt-3 flex gap-2">
              <input value={newSermonCategory} onChange={(e) => setNewSermonCategory(e.target.value)} className="flex-1 rounded border border-wood-200 px-3 py-2 text-sm" placeholder="새 카테고리명" />
              <button type="button" onClick={() => addCategory('sermon')} className="rounded bg-wood-900 px-3 py-2 text-sm font-bold text-white">추가</button>
            </div>
            <div className="mt-3 space-y-2">
              {sermonCategories.map((category) => (
                <div key={category.id} className="grid grid-cols-[1fr_80px_80px] gap-2 rounded-lg border border-wood-100 p-2">
                  <input defaultValue={category.name} onBlur={(e) => saveCategory('sermon', category.id, { name: e.target.value.trim() || category.name })} className="rounded border border-wood-200 px-2 py-1 text-sm" />
                  <input type="number" defaultValue={category.order} onBlur={(e) => saveCategory('sermon', category.id, { order: Number(e.target.value) || category.order })} className="rounded border border-wood-200 px-2 py-1 text-sm" />
                  <button type="button" onClick={() => deleteCategoryWithMove('sermon', category.id)} className="rounded border border-red-200 px-2 py-1 text-xs font-bold text-red-700">삭제</button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-wood-200 bg-white p-5">
            <h3 className="text-lg font-bold text-wood-900">연구실 카테고리</h3>
            <div className="mt-3 flex gap-2">
              <input value={newResearchCategory} onChange={(e) => setNewResearchCategory(e.target.value)} className="flex-1 rounded border border-wood-200 px-3 py-2 text-sm" placeholder="새 카테고리명" />
              <button type="button" onClick={() => addCategory('research')} className="rounded bg-wood-900 px-3 py-2 text-sm font-bold text-white">추가</button>
            </div>
            <div className="mt-3 space-y-2">
              {researchCategories.map((category) => (
                <div key={category.id} className="grid grid-cols-[1fr_80px_80px] gap-2 rounded-lg border border-wood-100 p-2">
                  <input defaultValue={category.name} onBlur={(e) => saveCategory('research', category.id, { name: e.target.value.trim() || category.name })} className="rounded border border-wood-200 px-2 py-1 text-sm" />
                  <input type="number" defaultValue={category.order} onBlur={(e) => saveCategory('research', category.id, { order: Number(e.target.value) || category.order })} className="rounded border border-wood-200 px-2 py-1 text-sm" />
                  <button type="button" onClick={() => deleteCategoryWithMove('research', category.id)} className="rounded border border-red-200 px-2 py-1 text-xs font-bold text-red-700">삭제</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tools' && (
        <div className="space-y-3 rounded-2xl border border-wood-200 bg-white p-5">
          <h3 className="text-lg font-bold text-wood-900">운영 도구</h3>
          <div className="grid gap-2 md:grid-cols-3">
            <a href="/admin/church-info" className="inline-flex items-center justify-center gap-2 rounded-lg bg-wood-900 px-3 py-3 text-sm font-bold text-white">
              교회 정보 편집
            </a>
            <button type="button" onClick={refreshLatestSummary} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-3 text-sm font-bold text-white">
              <Save size={14} />
              최신 요약 재생성
            </button>
            <button type="button" onClick={resetCaches} disabled={busy} className="rounded-lg bg-amber-600 px-3 py-3 text-sm font-bold text-white">
              캐시 리셋
            </button>
            <button type="button" onClick={repairSortOrderAndSlug} disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-3 text-sm font-bold text-white">
              정렬/슬러그 보정
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default function AdminSiteCms() {
  return (
    <SiteCmsProvider>
      <AdminSiteCmsInner />
    </SiteCmsProvider>
  );
}
