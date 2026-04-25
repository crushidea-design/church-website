import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import AdminLayout from '../components/AdminLayout';
import {
  NEXT_GEN_BADGE_CLASS_OPTIONS,
  NEXT_GEN_HERO_CLASS_OPTIONS,
  NextGenerationCmsProvider,
  NextGenerationDepartment,
  NextGenerationIconName,
  NextGenerationIntroSection,
  NextGenerationResourceTab,
  PROTECTED_NEXT_GEN_DEPARTMENT_SLUGS,
  PROTECTED_NEXT_GEN_TAB_SLUGS,
  normalizeCmsSlug,
  seedNextGenerationCmsIfEmpty,
  upsertNextGenerationDepartment,
  upsertNextGenerationIntroSection,
  upsertNextGenerationTab,
  useNextGenerationCms,
} from '../lib/nextGenerationCms';
import { Loader2, Settings, Save, Trash2, Plus, ArchiveRestore, Archive, ExternalLink, Wrench } from 'lucide-react';

type AdminTab = 'departments' | 'resourceTabs' | 'intro' | 'materials' | 'tools';

const isProtectedDepartmentSlug = (slug: string) =>
  (PROTECTED_NEXT_GEN_DEPARTMENT_SLUGS as readonly string[]).includes(slug);
const isProtectedTabSlug = (slug: string) =>
  (PROTECTED_NEXT_GEN_TAB_SLUGS as readonly string[]).includes(slug);

const ELEMENTARY_TAB_HINT_SLUGS = ['elementary_script', 'elementary_workbook', 'elementary_guide', 'family_column', 'elementary_weekly', 'summer_bible_school'];
const YOUNG_ADULT_TAB_HINT_SLUGS = ['pilgrim_lecture', 'podcast_review', 'retreat_materials'];

interface NextGenerationPostSummary {
  id: string;
  title: string;
  subCategory?: string;
  nextGenerationDepartmentSlug?: string;
  nextGenerationTabSlug?: string;
  nextGenerationWeekKey?: string;
  nextGenerationTopicId?: string;
  authorName?: string;
  isArchived?: boolean;
  createdAt?: any;
}

const formatPostDate = (value: any) => {
  const date = value?.toDate?.() || (typeof value === 'string' ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ko-KR');
};

const ICON_OPTIONS: NextGenerationIconName[] = [
  'CalendarDays',
  'FileText',
  'BookMarked',
  'ClipboardList',
  'HeartHandshake',
  'Sparkles',
  'Users',
];

function AdminNextGenerationCmsInner() {
  const navigate = useNavigate();
  const { role, loading: authLoading } = useAuth();
  const { loading, departments, tabs, introSections } = useNextGenerationCms();
  const [activeTab, setActiveTab] = useState<AdminTab>('departments');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [materials, setMaterials] = useState<NextGenerationPostSummary[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterTab, setFilterTab] = useState('');
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [moveDepartmentSlug, setMoveDepartmentSlug] = useState('');
  const [moveTabSlug, setMoveTabSlug] = useState('');

  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [newDepartmentSlug, setNewDepartmentSlug] = useState('');
  const [newDepartmentDescription, setNewDepartmentDescription] = useState('');
  const [newDepartmentHeroTitle, setNewDepartmentHeroTitle] = useState('');
  const [newDepartmentHeroDescription, setNewDepartmentHeroDescription] = useState('');
  const [newDepartmentImage, setNewDepartmentImage] = useState('');
  const [archivedFilter, setArchivedFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [toolsBusy, setToolsBusy] = useState<string | null>(null);
  const [toolsResult, setToolsResult] = useState<string | null>(null);
  const [orphanPosts, setOrphanPosts] = useState<NextGenerationPostSummary[]>([]);

  const [newTabName, setNewTabName] = useState('');
  const [newTabSlug, setNewTabSlug] = useState('');
  const [newTabDepartmentSlug, setNewTabDepartmentSlug] = useState('');
  const [newTabIcon, setNewTabIcon] = useState<NextGenerationIconName>('FileText');
  const [newTabWeeklyGroup, setNewTabWeeklyGroup] = useState(false);
  const [newTabUseWeekKey, setNewTabUseWeekKey] = useState(false);
  const [newTabUseTopic, setNewTabUseTopic] = useState(false);
  const [newTabGuestOpen, setNewTabGuestOpen] = useState(false);

  const [newIntroDepartmentSlug, setNewIntroDepartmentSlug] = useState('');
  const [newIntroTitle, setNewIntroTitle] = useState('');
  const [newIntroType, setNewIntroType] = useState<NextGenerationIntroSection['sectionType']>('text');
  const [newIntroParagraphs, setNewIntroParagraphs] = useState('');
  const [newIntroHighlights, setNewIntroHighlights] = useState('');
  const [newIntroGallery, setNewIntroGallery] = useState('');

  useEffect(() => {
    if (!authLoading && role !== 'admin') navigate('/');
  }, [authLoading, role, navigate]);

  useEffect(() => {
    if (departments.length > 0) {
      if (!newTabDepartmentSlug) setNewTabDepartmentSlug(departments[0].slug);
      if (!newIntroDepartmentSlug) setNewIntroDepartmentSlug(departments[0].slug);
      if (!moveDepartmentSlug) setMoveDepartmentSlug(departments[0].slug);
    }
  }, [departments, newIntroDepartmentSlug, newTabDepartmentSlug, moveDepartmentSlug]);

  useEffect(() => {
    const targetTabs = tabs.filter((tab) => tab.departmentSlug === moveDepartmentSlug && tab.isVisible);
    if (targetTabs.length > 0 && !targetTabs.some((tab) => tab.slug === moveTabSlug)) {
      setMoveTabSlug(targetTabs[0].slug);
    }
  }, [moveDepartmentSlug, moveTabSlug, tabs]);

  useEffect(() => {
    const run = async () => {
      if (role !== 'admin') return;
      await seedNextGenerationCmsIfEmpty();
    };
    run();
  }, [role]);

  useEffect(() => {
    const fetchMaterials = async () => {
      setMaterialsLoading(true);
      try {
        const snap = await getDocs(
          query(collection(db, 'posts'), where('category', '==', 'next_generation'), orderBy('createdAt', 'desc'), limit(300))
        );
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as NextGenerationPostSummary[];
        setMaterials(rows);
      } finally {
        setMaterialsLoading(false);
      }
    };
    fetchMaterials();
  }, [busy]);

  const tabsByDepartment = useMemo(
    () =>
      departments.map((department) => ({
        department,
        tabs: tabs
          .filter((tab) => tab.departmentSlug === department.slug)
          .sort((a, b) => a.order - b.order),
      })),
    [departments, tabs]
  );

  const filteredMaterials = useMemo(() => {
    const byText = search.trim().toLowerCase();
    return materials.filter((post) => {
      if (filterDepartment && post.nextGenerationDepartmentSlug !== filterDepartment) return false;
      if (filterTab && (post.nextGenerationTabSlug || post.subCategory) !== filterTab) return false;
      if (archivedFilter === 'active' && post.isArchived) return false;
      if (archivedFilter === 'archived' && !post.isArchived) return false;
      if (!byText) return true;
      return (post.title || '').toLowerCase().includes(byText);
    });
  }, [materials, filterDepartment, filterTab, archivedFilter, search]);

  const tabsByDepartmentSlug = useMemo(() => {
    const map: Record<string, NextGenerationResourceTab[]> = {};
    tabs.forEach((tab) => {
      const list = map[tab.departmentSlug] || (map[tab.departmentSlug] = []);
      list.push(tab);
    });
    Object.values(map).forEach((list) => list.sort((a, b) => a.order - b.order));
    return map;
  }, [tabs]);

  const inferDepartmentSlugFromTab = (tabSlug: string | undefined): string | null => {
    if (!tabSlug) return null;
    const cmsTab = tabs.find((tab) => tab.slug === tabSlug);
    if (cmsTab) return cmsTab.departmentSlug;
    if (ELEMENTARY_TAB_HINT_SLUGS.includes(tabSlug)) return 'elementary';
    if (YOUNG_ADULT_TAB_HINT_SLUGS.includes(tabSlug)) return 'young-adults';
    return null;
  };

  const showDone = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 3000);
  };

  const parseLines = (value: string) =>
    value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

  const parseGalleryLines = (value: string) =>
    parseLines(value).map((line) => {
      const [src, altRaw] = line.split('|');
      return { src: src?.trim() || '', alt: (altRaw || '이미지').trim() };
    }).filter((item) => !!item.src);

  const saveDepartment = async (department: NextGenerationDepartment, patch: Partial<NextGenerationDepartment>) => {
    setBusy(true);
    try {
      await upsertNextGenerationDepartment(department.slug, {
        ...department,
        ...patch,
        order: patch.order ?? department.order,
        isVisible: patch.isVisible ?? department.isVisible,
      });
    } finally {
      setBusy(false);
    }
  };

  const saveTab = async (tab: NextGenerationResourceTab, patch: Partial<NextGenerationResourceTab>) => {
    setBusy(true);
    try {
      await upsertNextGenerationTab(tab.slug, {
        ...tab,
        ...patch,
        order: patch.order ?? tab.order,
        isVisible: patch.isVisible ?? tab.isVisible,
      });
    } finally {
      setBusy(false);
    }
  };

  const saveIntroSection = async (section: NextGenerationIntroSection, patch: Partial<NextGenerationIntroSection>) => {
    setBusy(true);
    try {
      await upsertNextGenerationIntroSection(section.id, {
        ...section,
        ...patch,
        order: patch.order ?? section.order,
        isVisible: patch.isVisible ?? section.isVisible,
      });
    } finally {
      setBusy(false);
    }
  };

  const addDepartment = async () => {
    const slug = normalizeCmsSlug(newDepartmentSlug || newDepartmentName);
    if (!slug || !newDepartmentName.trim()) return;
    if (departments.some((d) => d.slug === slug)) {
      alert('이미 같은 slug의 부서가 있습니다.');
      return;
    }
    setBusy(true);
    try {
      await upsertNextGenerationDepartment(slug, {
        name: newDepartmentName.trim(),
        description: newDepartmentDescription.trim(),
        image: newDepartmentImage.trim(),
        heroTitle: newDepartmentHeroTitle.trim(),
        heroDescription: newDepartmentHeroDescription.trim(),
        heroClassName: 'bg-white',
        badgeClassName: 'bg-sky-100 text-emerald-950',
        guestPostLimit: 4,
        isVisible: true,
        order: departments.length + 1,
      });
      setNewDepartmentName('');
      setNewDepartmentSlug('');
      setNewDepartmentDescription('');
      setNewDepartmentHeroTitle('');
      setNewDepartmentHeroDescription('');
      setNewDepartmentImage('');
      showDone('부서를 추가했습니다. 비어 있는 항목은 부서 카드에서 채워 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const addResourceTab = async () => {
    const slug = normalizeCmsSlug(newTabSlug || newTabName);
    if (!slug || !newTabName.trim() || !newTabDepartmentSlug) return;
    const order = tabs.filter((tab) => tab.departmentSlug === newTabDepartmentSlug).length + 1;
    setBusy(true);
    try {
      await upsertNextGenerationTab(slug, {
        departmentSlug: newTabDepartmentSlug,
        name: newTabName.trim(),
        description: '',
        iconName: newTabIcon,
        isVisible: true,
        order,
        isGuestOpen: newTabGuestOpen,
        isWeeklyGroup: newTabWeeklyGroup,
        useWeekKey: newTabUseWeekKey,
        useTopic: newTabUseTopic,
      });
      setNewTabName('');
      setNewTabSlug('');
      setNewTabUseWeekKey(false);
      setNewTabUseTopic(false);
      setNewTabWeeklyGroup(false);
      setNewTabGuestOpen(false);
      showDone('탭을 추가했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const addIntroSection = async () => {
    if (!newIntroDepartmentSlug || !newIntroTitle.trim()) return;
    const id = `${newIntroDepartmentSlug}_${Date.now()}`;
    const order = introSections.filter((section) => section.departmentSlug === newIntroDepartmentSlug).length + 1;
    setBusy(true);
    try {
      await upsertNextGenerationIntroSection(id, {
        departmentSlug: newIntroDepartmentSlug,
        title: newIntroTitle.trim(),
        sectionType: newIntroType,
        paragraphs: parseLines(newIntroParagraphs),
        highlights: parseLines(newIntroHighlights),
        gallery: parseGalleryLines(newIntroGallery),
        isVisible: true,
        order,
      });
      setNewIntroTitle('');
      setNewIntroType('text');
      setNewIntroParagraphs('');
      setNewIntroHighlights('');
      setNewIntroGallery('');
      showDone('소개 섹션을 추가했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const deleteDepartmentWithMove = async (department: NextGenerationDepartment) => {
    if (isProtectedDepartmentSlug(department.slug)) {
      alert(`'${department.slug}'은(는) 코드에서 직접 참조하는 핵심 부서로 삭제할 수 없습니다.\n노출만 끄려면 '노출/숨김' 버튼을 사용하세요.`);
      return;
    }
    if (departments.length < 2) {
      alert('부서는 최소 1개 이상 유지되어야 합니다.');
      return;
    }
    const otherDepartments = departments.filter((item) => item.slug !== department.slug);
    const target = prompt(
      `삭제할 부서(${department.name})의 자료를 옮길 부서 slug를 입력하세요:\n${otherDepartments.map((d) => `- ${d.slug}`).join('\n')}`
    );
    if (!target) return;
    const targetDepartment = otherDepartments.find((item) => item.slug === target.trim());
    if (!targetDepartment) {
      alert('유효한 대상 부서 slug를 입력해 주세요.');
      return;
    }

    setBusy(true);
    try {
      const batch = writeBatch(db);
      const movingTabs = tabs.filter((tab) => tab.departmentSlug === department.slug);
      const movingIntros = introSections.filter((section) => section.departmentSlug === department.slug);

      movingTabs.forEach((tab) => {
        batch.update(doc(db, 'next_generation_resource_tabs', tab.slug), {
          departmentSlug: targetDepartment.slug,
        });
      });
      movingIntros.forEach((section) => {
        batch.update(doc(db, 'next_generation_intro_sections', section.id), {
          departmentSlug: targetDepartment.slug,
        });
      });

      const postSnap = await getDocs(
        query(collection(db, 'posts'), where('category', '==', 'next_generation'), limit(500))
      );
      postSnap.docs.forEach((item) => {
        const data = item.data() as any;
        if ((data.nextGenerationDepartmentSlug || '') === department.slug) {
          batch.update(item.ref, { nextGenerationDepartmentSlug: targetDepartment.slug });
        }
      });

      batch.delete(doc(db, 'next_generation_departments', department.slug));
      await batch.commit();
      showDone('부서를 삭제하고 관련 데이터를 이동했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const deleteTabWithMove = async (tab: NextGenerationResourceTab) => {
    if (isProtectedTabSlug(tab.slug)) {
      alert(`'${tab.slug}'은(는) 코드에서 직접 참조하는 핵심 탭으로 삭제할 수 없습니다.\n노출만 끄려면 '노출/숨김' 버튼을 사용하세요.`);
      return;
    }
    const candidateTabs = tabs.filter((item) => item.slug !== tab.slug && item.departmentSlug === tab.departmentSlug);
    if (candidateTabs.length === 0) {
      alert('같은 부서에 이동할 탭이 없어 삭제할 수 없습니다.');
      return;
    }
    const target = prompt(
      `삭제할 탭(${tab.name})의 자료를 옮길 탭 slug를 입력하세요:\n${candidateTabs.map((item) => `- ${item.slug}`).join('\n')}`
    );
    if (!target) return;
    const targetTab = candidateTabs.find((item) => item.slug === target.trim());
    if (!targetTab) {
      alert('유효한 대상 탭 slug를 입력해 주세요.');
      return;
    }

    setBusy(true);
    try {
      const postSnap = await getDocs(
        query(collection(db, 'posts'), where('category', '==', 'next_generation'), limit(500))
      );
      const batch = writeBatch(db);
      postSnap.docs.forEach((item) => {
        const data = item.data() as any;
        const tabSlug = data.nextGenerationTabSlug || data.subCategory || '';
        if (tabSlug === tab.slug) {
          batch.update(item.ref, {
            subCategory: targetTab.slug,
            nextGenerationTabSlug: targetTab.slug,
            nextGenerationDepartmentSlug: targetTab.departmentSlug,
          });
        }
      });
      batch.delete(doc(db, 'next_generation_resource_tabs', tab.slug));
      await batch.commit();
      showDone('탭을 삭제하고 게시물을 이동했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const archivePost = async (postId: string, archived: boolean) => {
    setBusy(true);
    try {
      await updateDoc(doc(db, 'posts', postId), {
        isArchived: archived,
        archivedAt: archived ? new Date() : null,
        archivedBy: archived ? 'admin' : null,
      });
      showDone(archived ? '휴지통으로 이동했습니다.' : '복구했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const setMaterialPlacement = async (
    post: NextGenerationPostSummary,
    nextDepartmentSlug: string,
    nextTabSlug: string,
  ) => {
    if (!nextDepartmentSlug || !nextTabSlug) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, 'posts', post.id), {
        nextGenerationDepartmentSlug: nextDepartmentSlug,
        nextGenerationTabSlug: nextTabSlug,
        subCategory: nextTabSlug,
        updatedAt: serverTimestamp(),
      });
      showDone('자료를 이동했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const normalizeDepartmentOrder = async () => {
    setToolsBusy('normalize');
    try {
      const sorted = [...departments].sort((a, b) => (a.order || 0) - (b.order || 0));
      const batch = writeBatch(db);
      sorted.forEach((department, index) => {
        const desiredOrder = index + 1;
        if (department.order !== desiredOrder) {
          batch.update(doc(db, 'next_generation_departments', department.slug), {
            order: desiredOrder,
            updatedAt: serverTimestamp(),
          });
        }
      });

      Object.values(tabsByDepartmentSlug).forEach((groupTabs) => {
        groupTabs.forEach((tab, index) => {
          const desiredOrder = index + 1;
          if (tab.order !== desiredOrder) {
            batch.update(doc(db, 'next_generation_resource_tabs', tab.slug), {
              order: desiredOrder,
              updatedAt: serverTimestamp(),
            });
          }
        });
      });

      const introByDepartment: Record<string, NextGenerationIntroSection[]> = {};
      introSections.forEach((section) => {
        const list = introByDepartment[section.departmentSlug] || (introByDepartment[section.departmentSlug] = []);
        list.push(section);
      });
      Object.values(introByDepartment).forEach((list) => {
        list.sort((a, b) => (a.order || 0) - (b.order || 0));
        list.forEach((section, index) => {
          const desiredOrder = index + 1;
          if (section.order !== desiredOrder) {
            batch.update(doc(db, 'next_generation_intro_sections', section.id), {
              order: desiredOrder,
              updatedAt: serverTimestamp(),
            });
          }
        });
      });

      await batch.commit();
      setToolsResult('정렬값을 1..N으로 정규화했습니다.');
    } finally {
      setToolsBusy(null);
    }
  };

  const backfillDepartmentSlug = async () => {
    setToolsBusy('backfill');
    try {
      const snap = await getDocs(
        query(collection(db, 'posts'), where('category', '==', 'next_generation'), limit(500))
      );
      const batch = writeBatch(db);
      let updated = 0;
      let skipped = 0;
      snap.docs.forEach((item) => {
        const data = item.data() as any;
        if (data.nextGenerationDepartmentSlug) return;
        const tabSlug = data.nextGenerationTabSlug || data.subCategory;
        const inferred = inferDepartmentSlugFromTab(tabSlug);
        if (inferred) {
          batch.update(item.ref, {
            nextGenerationDepartmentSlug: inferred,
            updatedAt: serverTimestamp(),
          });
          updated += 1;
        } else {
          skipped += 1;
        }
      });
      if (updated > 0) await batch.commit();
      setToolsResult(`소속 부서 보정: ${updated}건 갱신, ${skipped}건은 추정 불가 (수동 이동 필요)`);
    } finally {
      setToolsBusy(null);
    }
  };

  const detectOrphans = async () => {
    setToolsBusy('orphans');
    try {
      const validDepartmentSlugs = new Set(departments.map((d) => d.slug));
      const validTabSlugs = new Set(tabs.map((t) => t.slug));
      const orphans = materials.filter((post) => {
        const ds = post.nextGenerationDepartmentSlug;
        const ts = post.nextGenerationTabSlug || post.subCategory;
        const dsBad = !ds || !validDepartmentSlugs.has(ds);
        const tsBad = !ts || !validTabSlugs.has(ts);
        return dsBad || tsBad;
      });
      setOrphanPosts(orphans);
      setToolsResult(`고아 자료 ${orphans.length}건 탐지 완료.`);
    } finally {
      setToolsBusy(null);
    }
  };

  const moveSelectedPosts = async () => {
    if (selectedPostIds.length === 0 || !moveDepartmentSlug || !moveTabSlug) return;
    setBusy(true);
    try {
      const batch = writeBatch(db);
      selectedPostIds.forEach((id) => {
        batch.update(doc(db, 'posts', id), {
          nextGenerationDepartmentSlug: moveDepartmentSlug,
          nextGenerationTabSlug: moveTabSlug,
          subCategory: moveTabSlug,
        });
      });
      await batch.commit();
      setSelectedPostIds([]);
      showDone(`${selectedPostIds.length}개 자료를 이동했습니다.`);
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wood-50">
        <Loader2 className="h-12 w-12 animate-spin text-wood-800" />
      </div>
    );
  }

  const targetMoveTabs = tabs.filter((tab) => tab.departmentSlug === moveDepartmentSlug && tab.isVisible);

  return (
    <AdminLayout
      title="다음세대 CMS"
      description="부서/탭/소개/자료를 관리자 화면에서 통합 관리합니다."
      backTo="/admin"
      backLabel="관리자 대시보드"
      icon={<Settings size={14} />}
      maxWidthClassName="max-w-6xl"
    >
      <div className="space-y-6">
        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            {message}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'departments', label: '부서 관리' },
            { id: 'resourceTabs', label: '탭 관리' },
            { id: 'intro', label: '소개 관리' },
            { id: 'materials', label: '자료 관리' },
            { id: 'tools', label: '운영도구' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeTab === tab.id ? 'bg-wood-900 text-white' : 'bg-white border border-wood-200 text-wood-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'departments' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-wood-200 bg-white p-5">
              <h3 className="text-lg font-bold text-wood-900">부서 추가</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input
                  value={newDepartmentName}
                  onChange={(e) => setNewDepartmentName(e.target.value)}
                  placeholder="부서명 (필수)"
                  className="rounded-lg border border-wood-300 px-3 py-2"
                />
                <input
                  value={newDepartmentSlug}
                  onChange={(e) => setNewDepartmentSlug(normalizeCmsSlug(e.target.value))}
                  placeholder="slug (예: youth-2)"
                  className="rounded-lg border border-wood-300 px-3 py-2"
                />
                <input
                  value={newDepartmentDescription}
                  onChange={(e) => setNewDepartmentDescription(e.target.value)}
                  placeholder="카드 설명 (선택)"
                  className="rounded-lg border border-wood-300 px-3 py-2 md:col-span-2"
                />
                <input
                  value={newDepartmentHeroTitle}
                  onChange={(e) => setNewDepartmentHeroTitle(e.target.value)}
                  placeholder="자료실 Hero 제목 (선택)"
                  className="rounded-lg border border-wood-300 px-3 py-2"
                />
                <input
                  value={newDepartmentImage}
                  onChange={(e) => setNewDepartmentImage(e.target.value)}
                  placeholder="대표 이미지 경로 (선택, 예: /next-generation-2026.png)"
                  className="rounded-lg border border-wood-300 px-3 py-2"
                />
                <textarea
                  value={newDepartmentHeroDescription}
                  onChange={(e) => setNewDepartmentHeroDescription(e.target.value)}
                  placeholder="자료실 Hero 설명 (선택)"
                  rows={2}
                  className="rounded-lg border border-wood-300 px-3 py-2 md:col-span-2"
                />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={addDepartment}
                className="mt-3 inline-flex items-center justify-center rounded-lg bg-wood-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                <Plus size={14} className="mr-1" />
                부서 추가
              </button>
              <p className="mt-2 text-xs text-wood-500">
                비워둔 항목은 부서 카드에서 나중에 채울 수 있습니다. 빈 값으로 시드되어 사이트에 placeholder 문구가 노출되지 않습니다.
              </p>
            </div>

            {departments.map((department) => {
              const protectedSlug = isProtectedDepartmentSlug(department.slug);
              return (
                <div key={department.slug} className="rounded-2xl border border-wood-200 bg-white p-5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <strong className="text-wood-900">{department.name}</strong>
                      {protectedSlug && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                          핵심 부서 (slug 보호)
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteDepartmentWithMove(department)}
                      disabled={protectedSlug}
                      className="inline-flex items-center rounded-lg border border-red-200 px-3 py-1.5 text-sm font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 size={14} className="mr-1" />
                      삭제(이동)
                    </button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      defaultValue={department.name}
                      onBlur={(e) => saveDepartment(department, { name: e.target.value.trim() || department.name })}
                      className="rounded-lg border border-wood-300 px-3 py-2"
                      placeholder="부서명"
                    />
                    <input
                      defaultValue={department.slug}
                      readOnly
                      className="rounded-lg border border-wood-200 bg-wood-50 px-3 py-2 text-wood-500"
                    />
                    <input
                      defaultValue={department.description}
                      onBlur={(e) => saveDepartment(department, { description: e.target.value })}
                      className="rounded-lg border border-wood-300 px-3 py-2 md:col-span-2"
                      placeholder="카드 설명"
                    />
                    <input
                      defaultValue={department.heroTitle}
                      onBlur={(e) => saveDepartment(department, { heroTitle: e.target.value })}
                      className="rounded-lg border border-wood-300 px-3 py-2 md:col-span-2"
                      placeholder="자료실 Hero 제목"
                    />
                    <textarea
                      defaultValue={department.heroDescription}
                      onBlur={(e) => saveDepartment(department, { heroDescription: e.target.value })}
                      className="rounded-lg border border-wood-300 px-3 py-2 md:col-span-2"
                      rows={2}
                      placeholder="자료실 Hero 설명"
                    />
                    <input
                      defaultValue={department.image}
                      onBlur={(e) => saveDepartment(department, { image: e.target.value })}
                      className="rounded-lg border border-wood-300 px-3 py-2 md:col-span-2"
                      placeholder="대표 이미지 경로"
                    />
                    <label className="text-xs font-bold text-wood-700">
                      Hero 배경 색상
                      <select
                        defaultValue={department.heroClassName || 'bg-white'}
                        onChange={(e) => saveDepartment(department, { heroClassName: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-wood-300 px-3 py-2 text-sm font-normal"
                      >
                        {NEXT_GEN_HERO_CLASS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-bold text-wood-700">
                      배지 색상
                      <select
                        defaultValue={department.badgeClassName || 'bg-sky-100 text-emerald-950'}
                        onChange={(e) => saveDepartment(department, { badgeClassName: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-wood-300 px-3 py-2 text-sm font-normal"
                      >
                        {NEXT_GEN_BADGE_CLASS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-bold text-wood-700">
                      비로그인 노출 글 수 (guestPostLimit)
                      <input
                        type="number"
                        min={0}
                        defaultValue={department.guestPostLimit ?? 0}
                        onBlur={(e) => saveDepartment(department, { guestPostLimit: Math.max(0, Number(e.target.value) || 0) })}
                        className="mt-1 w-full rounded-lg border border-wood-300 px-3 py-2 text-sm font-normal"
                      />
                    </label>
                    <label className="text-xs font-bold text-wood-700">
                      순서 (order)
                      <input
                        type="number"
                        min={1}
                        defaultValue={department.order}
                        onBlur={(e) => saveDepartment(department, { order: Math.max(1, Number(e.target.value) || department.order) })}
                        className="mt-1 w-full rounded-lg border border-wood-300 px-3 py-2 text-sm font-normal"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => saveDepartment(department, { isVisible: !department.isVisible })}
                      className="rounded-lg border border-wood-200 px-3 py-1.5 text-sm font-bold text-wood-700"
                    >
                      {department.isVisible ? '노출 중' : '숨김 중'}
                    </button>
                    <button
                      type="button"
                      onClick={() => saveDepartment(department, { order: Math.max(1, department.order - 1) })}
                      className="rounded-lg border border-wood-200 px-3 py-1.5 text-sm font-bold text-wood-700"
                    >
                      ↑ 순서 올리기
                    </button>
                    <button
                      type="button"
                      onClick={() => saveDepartment(department, { order: department.order + 1 })}
                      className="rounded-lg border border-wood-200 px-3 py-1.5 text-sm font-bold text-wood-700"
                    >
                      ↓ 순서 내리기
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'resourceTabs' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-wood-200 bg-white p-5">
              <h3 className="text-lg font-bold text-wood-900">탭 추가</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <input
                  value={newTabName}
                  onChange={(e) => setNewTabName(e.target.value)}
                  placeholder="탭명"
                  className="rounded-lg border border-wood-300 px-3 py-2"
                />
                <input
                  value={newTabSlug}
                  onChange={(e) => setNewTabSlug(normalizeCmsSlug(e.target.value))}
                  placeholder="tab slug"
                  className="rounded-lg border border-wood-300 px-3 py-2"
                />
                <select
                  value={newTabDepartmentSlug}
                  onChange={(e) => setNewTabDepartmentSlug(e.target.value)}
                  className="rounded-lg border border-wood-300 px-3 py-2"
                >
                  {departments.map((department) => (
                    <option key={department.slug} value={department.slug}>
                      {department.name}
                    </option>
                  ))}
                </select>
                <select
                  value={newTabIcon}
                  onChange={(e) => setNewTabIcon(e.target.value as NextGenerationIconName)}
                  className="rounded-lg border border-wood-300 px-3 py-2"
                >
                  {ICON_OPTIONS.map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm font-medium text-wood-700">
                  <input type="checkbox" checked={newTabGuestOpen} onChange={(e) => setNewTabGuestOpen(e.target.checked)} />
                  비로그인 공개 탭
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-wood-700">
                  <input type="checkbox" checked={newTabWeeklyGroup} onChange={(e) => setNewTabWeeklyGroup(e.target.checked)} />
                  주간 묶음 탭
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-wood-700">
                  <input type="checkbox" checked={newTabUseWeekKey} onChange={(e) => setNewTabUseWeekKey(e.target.checked)} />
                  주차 키 사용
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-wood-700">
                  <input type="checkbox" checked={newTabUseTopic} onChange={(e) => setNewTabUseTopic(e.target.checked)} />
                  주제 폴더 사용
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={addResourceTab}
                  className="inline-flex items-center justify-center rounded-lg bg-wood-900 px-3 py-2 text-sm font-bold text-white"
                >
                  <Plus size={14} className="mr-1" />
                  추가
                </button>
              </div>
            </div>

            {tabsByDepartment.map(({ department, tabs: groupTabs }) => (
              <div key={department.slug} className="rounded-2xl border border-wood-200 bg-white p-5">
                <h4 className="font-bold text-wood-900">{department.name}</h4>
                <div className="mt-3 space-y-3">
                  {groupTabs.map((tab) => {
                    const protectedTab = isProtectedTabSlug(tab.slug);
                    return (
                      <div key={tab.slug} className="rounded-xl border border-wood-100 p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <strong className="text-sm text-wood-900">{tab.name}</strong>
                          {protectedTab && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              핵심 탭 (slug 보호)
                            </span>
                          )}
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          <input
                            defaultValue={tab.name}
                            onBlur={(e) => saveTab(tab, { name: e.target.value.trim() || tab.name })}
                            className="rounded-lg border border-wood-300 px-3 py-2"
                          />
                          <input defaultValue={tab.slug} readOnly className="rounded-lg border border-wood-200 bg-wood-50 px-3 py-2" />
                          <textarea
                            defaultValue={tab.description}
                            onBlur={(e) => saveTab(tab, { description: e.target.value })}
                            className="rounded-lg border border-wood-300 px-3 py-2 md:col-span-2"
                            rows={2}
                            placeholder="탭 설명"
                          />
                          <label className="text-xs font-bold text-wood-700">
                            아이콘
                            <select
                              defaultValue={tab.iconName}
                              onChange={(e) => saveTab(tab, { iconName: e.target.value as NextGenerationIconName })}
                              className="mt-1 w-full rounded-lg border border-wood-300 px-3 py-2 text-sm font-normal"
                            >
                              {ICON_OPTIONS.map((icon) => (
                                <option key={icon} value={icon}>{icon}</option>
                              ))}
                            </select>
                          </label>
                          <label className="text-xs font-bold text-wood-700">
                            순서 (order)
                            <input
                              type="number"
                              min={1}
                              defaultValue={tab.order}
                              onBlur={(e) => saveTab(tab, { order: Math.max(1, Number(e.target.value) || tab.order) })}
                              className="mt-1 w-full rounded-lg border border-wood-300 px-3 py-2 text-sm font-normal"
                            />
                          </label>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => saveTab(tab, { isVisible: !tab.isVisible })}
                            className="rounded-lg border border-wood-200 px-2.5 py-1 text-xs font-bold text-wood-700"
                          >
                            {tab.isVisible ? '노출' : '숨김'}
                          </button>
                          <button type="button" onClick={() => saveTab(tab, { isGuestOpen: !tab.isGuestOpen })} className="rounded-lg border border-wood-200 px-2.5 py-1 text-xs font-bold text-wood-700">
                            비로그인 {tab.isGuestOpen ? '공개' : '잠금'}
                          </button>
                          <button type="button" onClick={() => saveTab(tab, { isWeeklyGroup: !tab.isWeeklyGroup })} className="rounded-lg border border-wood-200 px-2.5 py-1 text-xs font-bold text-wood-700">
                            주간묶음 {tab.isWeeklyGroup ? 'ON' : 'OFF'}
                          </button>
                          <button type="button" onClick={() => saveTab(tab, { useWeekKey: !tab.useWeekKey })} className="rounded-lg border border-wood-200 px-2.5 py-1 text-xs font-bold text-wood-700">
                            주차키 {tab.useWeekKey ? 'ON' : 'OFF'}
                          </button>
                          <button type="button" onClick={() => saveTab(tab, { useTopic: !tab.useTopic })} className="rounded-lg border border-wood-200 px-2.5 py-1 text-xs font-bold text-wood-700">
                            주제 {tab.useTopic ? 'ON' : 'OFF'}
                          </button>
                          <button type="button" onClick={() => saveTab(tab, { order: Math.max(1, tab.order - 1) })} className="rounded-lg border border-wood-200 px-2.5 py-1 text-xs font-bold text-wood-700">
                            ↑
                          </button>
                          <button type="button" onClick={() => saveTab(tab, { order: tab.order + 1 })} className="rounded-lg border border-wood-200 px-2.5 py-1 text-xs font-bold text-wood-700">
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTabWithMove(tab)}
                            disabled={protectedTab}
                            className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            삭제(이동)
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'intro' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-wood-200 bg-white p-5">
              <h3 className="text-lg font-bold text-wood-900">소개 섹션 추가</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <select
                  value={newIntroDepartmentSlug}
                  onChange={(e) => setNewIntroDepartmentSlug(e.target.value)}
                  className="rounded-lg border border-wood-300 px-3 py-2"
                >
                  {departments.map((department) => (
                    <option key={department.slug} value={department.slug}>
                      {department.name}
                    </option>
                  ))}
                </select>
                <select value={newIntroType} onChange={(e) => setNewIntroType(e.target.value as any)} className="rounded-lg border border-wood-300 px-3 py-2">
                  <option value="text">text</option>
                  <option value="highlights">highlights</option>
                  <option value="gallery">gallery</option>
                </select>
                <input
                  value={newIntroTitle}
                  onChange={(e) => setNewIntroTitle(e.target.value)}
                  placeholder="섹션 제목"
                  className="rounded-lg border border-wood-300 px-3 py-2 md:col-span-2"
                />
                <textarea
                  value={newIntroParagraphs}
                  onChange={(e) => setNewIntroParagraphs(e.target.value)}
                  rows={4}
                  placeholder="문단(줄바꿈으로 구분)"
                  className="rounded-lg border border-wood-300 px-3 py-2"
                />
                <textarea
                  value={newIntroHighlights}
                  onChange={(e) => setNewIntroHighlights(e.target.value)}
                  rows={4}
                  placeholder="하이라이트(줄바꿈으로 구분)"
                  className="rounded-lg border border-wood-300 px-3 py-2"
                />
                <textarea
                  value={newIntroGallery}
                  onChange={(e) => setNewIntroGallery(e.target.value)}
                  rows={4}
                  placeholder="갤러리: 이미지경로|설명 (줄바꿈)"
                  className="rounded-lg border border-wood-300 px-3 py-2 md:col-span-2"
                />
                <button
                  type="button"
                  onClick={addIntroSection}
                  className="inline-flex items-center justify-center rounded-lg bg-wood-900 px-3 py-2 text-sm font-bold text-white md:col-span-2"
                >
                  <Plus size={14} className="mr-1" />
                  추가
                </button>
              </div>
            </div>

            {departments.map((department) => (
              <div key={department.slug} className="rounded-2xl border border-wood-200 bg-white p-5">
                <h4 className="font-bold text-wood-900">{department.name}</h4>
                <div className="mt-3 space-y-3">
                  {introSections
                    .filter((section) => section.departmentSlug === department.slug)
                    .sort((a, b) => a.order - b.order)
                    .map((section) => (
                      <div key={section.id} className="rounded-xl border border-wood-100 p-3 space-y-2">
                        <div className="grid gap-2 md:grid-cols-[1fr_140px_100px]">
                          <input
                            defaultValue={section.title}
                            onBlur={(e) => saveIntroSection(section, { title: e.target.value })}
                            className="rounded-lg border border-wood-300 px-3 py-2"
                            placeholder="섹션 제목"
                          />
                          <select
                            defaultValue={section.sectionType}
                            onChange={(e) => saveIntroSection(section, { sectionType: e.target.value as NextGenerationIntroSection['sectionType'] })}
                            className="rounded-lg border border-wood-300 px-3 py-2 text-sm"
                          >
                            <option value="text">text</option>
                            <option value="highlights">highlights</option>
                            <option value="gallery">gallery</option>
                          </select>
                          <input
                            type="number"
                            min={1}
                            defaultValue={section.order}
                            onBlur={(e) => saveIntroSection(section, { order: Math.max(1, Number(e.target.value) || section.order) })}
                            className="rounded-lg border border-wood-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <textarea
                          defaultValue={section.paragraphs.join('\n')}
                          onBlur={(e) => saveIntroSection(section, { paragraphs: parseLines(e.target.value) })}
                          className="w-full rounded-lg border border-wood-300 px-3 py-2"
                          rows={3}
                          placeholder="문단 (줄바꿈으로 구분)"
                        />
                        <textarea
                          defaultValue={section.highlights.join('\n')}
                          onBlur={(e) => saveIntroSection(section, { highlights: parseLines(e.target.value) })}
                          className="w-full rounded-lg border border-wood-300 px-3 py-2"
                          rows={2}
                          placeholder="하이라이트 (줄바꿈으로 구분)"
                        />
                        <textarea
                          defaultValue={section.gallery.map((item) => `${item.src}|${item.alt}`).join('\n')}
                          onBlur={(e) => saveIntroSection(section, { gallery: parseGalleryLines(e.target.value) })}
                          className="w-full rounded-lg border border-wood-300 px-3 py-2"
                          rows={2}
                          placeholder="갤러리: 이미지경로|설명 (줄바꿈)"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => saveIntroSection(section, { isVisible: !section.isVisible })} className="rounded-lg border border-wood-200 px-2.5 py-1 text-xs font-bold text-wood-700">
                            {section.isVisible ? '노출' : '숨김'}
                          </button>
                          <button type="button" onClick={() => saveIntroSection(section, { order: Math.max(1, section.order - 1) })} className="rounded-lg border border-wood-200 px-2.5 py-1 text-xs font-bold text-wood-700">
                            ↑
                          </button>
                          <button type="button" onClick={() => saveIntroSection(section, { order: section.order + 1 })} className="rounded-lg border border-wood-200 px-2.5 py-1 text-xs font-bold text-wood-700">
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm('소개 섹션을 삭제할까요?')) return;
                              await deleteDoc(doc(db, 'next_generation_intro_sections', section.id));
                              showDone('소개 섹션을 삭제했습니다.');
                            }}
                            className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-bold text-red-600"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'materials' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-wood-200 bg-white p-5 space-y-3">
              <h3 className="text-lg font-bold text-wood-900">자료 필터/일괄 이동</h3>
              <div className="grid gap-3 md:grid-cols-5">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="제목 검색" className="rounded-lg border border-wood-300 px-3 py-2" />
                <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)} className="rounded-lg border border-wood-300 px-3 py-2">
                  <option value="">전체 부서</option>
                  {departments.map((department) => (
                    <option key={department.slug} value={department.slug}>
                      {department.name}
                    </option>
                  ))}
                </select>
                <select value={filterTab} onChange={(e) => setFilterTab(e.target.value)} className="rounded-lg border border-wood-300 px-3 py-2">
                  <option value="">전체 탭</option>
                  {departments.map((department) => (
                    <optgroup key={department.slug} label={department.name}>
                      {(tabsByDepartmentSlug[department.slug] || []).map((tab) => (
                        <option key={tab.slug} value={tab.slug}>
                          {tab.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <select value={archivedFilter} onChange={(e) => setArchivedFilter(e.target.value as 'all' | 'active' | 'archived')} className="rounded-lg border border-wood-300 px-3 py-2">
                  <option value="all">전체 상태</option>
                  <option value="active">노출</option>
                  <option value="archived">휴지통</option>
                </select>
                <div className="text-sm text-wood-600 flex items-center">
                  총 {filteredMaterials.length}건 · 선택 {selectedPostIds.length}건
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <select value={moveDepartmentSlug} onChange={(e) => setMoveDepartmentSlug(e.target.value)} className="rounded-lg border border-wood-300 px-3 py-2">
                  {departments.map((department) => (
                    <option key={department.slug} value={department.slug}>
                      이동 부서: {department.name}
                    </option>
                  ))}
                </select>
                <select value={moveTabSlug} onChange={(e) => setMoveTabSlug(e.target.value)} className="rounded-lg border border-wood-300 px-3 py-2">
                  {targetMoveTabs.map((tab) => (
                    <option key={tab.slug} value={tab.slug}>
                      이동 탭: {tab.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={selectedPostIds.length === 0 || !moveTabSlug}
                  onClick={moveSelectedPosts}
                  className="inline-flex items-center justify-center rounded-lg bg-wood-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  <Save size={14} className="mr-1" />
                  선택 자료 이동
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-wood-200 bg-white p-5">
              {materialsLoading ? (
                <div className="py-10 text-center text-wood-500">
                  <Loader2 className="mx-auto h-7 w-7 animate-spin" />
                </div>
              ) : filteredMaterials.length === 0 ? (
                <p className="py-6 text-center text-sm text-wood-500">조건에 해당하는 자료가 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {filteredMaterials.map((post) => {
                    const tabSlug = post.nextGenerationTabSlug || post.subCategory || '';
                    const departmentSlug = post.nextGenerationDepartmentSlug || '';
                    const inlineTabs = tabsByDepartmentSlug[departmentSlug] || tabs;
                    const checked = selectedPostIds.includes(post.id);
                    return (
                      <div key={post.id} className="rounded-xl border border-wood-100 p-3">
                        <div className="flex flex-col gap-2">
                          <label className="inline-flex items-start gap-2 text-sm font-bold text-wood-900">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={checked}
                              onChange={(e) => {
                                setSelectedPostIds((current) =>
                                  e.target.checked ? [...current, post.id] : current.filter((id) => id !== post.id)
                                );
                              }}
                            />
                            <span>{post.title || '(제목 없음)'}</span>
                          </label>
                          <p className="text-xs text-wood-500">
                            {post.authorName || '익명'} · {formatPostDate(post.createdAt)}
                            {post.nextGenerationWeekKey ? ` · 주차 ${post.nextGenerationWeekKey}` : ''}
                            {post.nextGenerationTopicId ? ` · 주제 ${post.nextGenerationTopicId}` : ''}
                            {' · '}
                            {post.isArchived ? '휴지통' : '노출'}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <select
                              value={departmentSlug}
                              onChange={(e) => {
                                const nextDept = e.target.value;
                                const firstTab = (tabsByDepartmentSlug[nextDept] || [])[0];
                                if (firstTab) {
                                  setMaterialPlacement(post, nextDept, firstTab.slug);
                                } else if (nextDept) {
                                  setMaterialPlacement(post, nextDept, tabSlug);
                                }
                              }}
                              className="rounded-lg border border-wood-300 px-2 py-1"
                            >
                              <option value="">(부서 미지정)</option>
                              {departments.map((department) => (
                                <option key={department.slug} value={department.slug}>{department.name}</option>
                              ))}
                            </select>
                            <select
                              value={tabSlug}
                              onChange={(e) => setMaterialPlacement(post, departmentSlug || departments[0]?.slug || '', e.target.value)}
                              className="rounded-lg border border-wood-300 px-2 py-1"
                            >
                              <option value="">(탭 미지정)</option>
                              {inlineTabs.map((tab) => (
                                <option key={tab.slug} value={tab.slug}>{tab.name}</option>
                              ))}
                            </select>
                            {post.isArchived ? (
                              <button
                                type="button"
                                onClick={() => archivePost(post.id, false)}
                                className="inline-flex items-center rounded-lg border border-emerald-200 px-3 py-1 font-bold text-emerald-700"
                              >
                                <ArchiveRestore size={12} className="mr-1" />
                                복구
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => archivePost(post.id, true)}
                                className="inline-flex items-center rounded-lg border border-amber-200 px-3 py-1 font-bold text-amber-700"
                              >
                                <Archive size={12} className="mr-1" />
                                휴지통
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-wood-200 bg-white p-5">
              <h3 className="flex items-center gap-2 text-lg font-bold text-wood-900">
                <Wrench size={16} />
                운영 도구
              </h3>
              <p className="mt-1 text-xs leading-5 text-wood-600">
                데이터 정합성 보정과 외부 화면 진입을 한곳에 모았습니다. 변경은 즉시 Firestore에 반영됩니다.
              </p>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <a
                  href="/next"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-wood-300 bg-white px-3 py-3 text-sm font-bold text-wood-800 hover:bg-wood-50"
                >
                  <ExternalLink size={14} />
                  다음세대 사이트 새 탭에서 열기
                </a>
                <a
                  href="/admin/notifications"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-3 py-3 text-sm font-bold text-white hover:bg-orange-500"
                >
                  알림 발송 화면
                </a>
                <a
                  href="/admin"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-wood-900 px-3 py-3 text-sm font-bold text-white hover:bg-wood-800"
                >
                  관리자 대시보드
                </a>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-wood-500">
                회원 가입 승인·반려·문의 답변·푸시 발송은 다음세대 페이지 우상단 "관리" 패널({' '}
                <a href="/next" target="_blank" rel="noreferrer" className="underline">/next</a>)에서 별도 운영합니다.
                여기서는 부서·탭·소개·자료의 데이터 모델만 관리합니다.
              </p>
            </div>

            <div className="rounded-2xl border border-wood-200 bg-white p-5">
              <h4 className="text-base font-bold text-wood-900">데이터 정합성 보정</h4>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <button
                  type="button"
                  onClick={normalizeDepartmentOrder}
                  disabled={!!toolsBusy}
                  className="rounded-lg bg-emerald-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {toolsBusy === 'normalize' ? '정규화 중...' : '정렬값 1..N으로 정규화'}
                </button>
                <button
                  type="button"
                  onClick={backfillDepartmentSlug}
                  disabled={!!toolsBusy}
                  className="rounded-lg bg-indigo-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {toolsBusy === 'backfill' ? '보정 중...' : '소속 부서 누락 자료 추정 보정'}
                </button>
                <button
                  type="button"
                  onClick={detectOrphans}
                  disabled={!!toolsBusy}
                  className="rounded-lg bg-amber-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {toolsBusy === 'orphans' ? '탐지 중...' : '고아 자료 탐지'}
                </button>
              </div>
              {toolsResult && (
                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
                  {toolsResult}
                </div>
              )}
              {orphanPosts.length > 0 && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-bold text-amber-900">
                    부서/탭이 CMS에 존재하지 않는 자료 {orphanPosts.length}건:
                  </p>
                  <ul className="mt-2 max-h-60 overflow-auto text-xs text-amber-900">
                    {orphanPosts.map((post) => (
                      <li key={post.id} className="border-t border-amber-200 py-1.5 first:border-0">
                        <span className="font-bold">{post.title || '(제목 없음)'}</span>
                        <span className="ml-2 text-amber-700">
                          dept={post.nextGenerationDepartmentSlug || '∅'} / tab=
                          {post.nextGenerationTabSlug || post.subCategory || '∅'}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-amber-700">
                    "자료 관리" 탭에서 인라인 셀렉터로 부서/탭을 다시 지정해 주세요.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-wood-200 bg-white p-5 text-sm text-wood-700">
              <h4 className="text-base font-bold text-wood-900">코드에서 직접 참조하는 핵심 슬러그</h4>
              <p className="mt-1 text-xs text-wood-500">아래 슬러그들은 다음세대 페이지의 게스트 공개·주간 묶음 로직에 직접 사용되어 변경 시 동작이 깨집니다.</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs font-bold text-wood-700">부서 (PROTECTED_NEXT_GEN_DEPARTMENT_SLUGS)</p>
                  <ul className="mt-1 text-xs">
                    {PROTECTED_NEXT_GEN_DEPARTMENT_SLUGS.map((slug) => (
                      <li key={slug} className="font-mono">- {slug}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold text-wood-700">탭 (PROTECTED_NEXT_GEN_TAB_SLUGS)</p>
                  <ul className="mt-1 text-xs">
                    {PROTECTED_NEXT_GEN_TAB_SLUGS.map((slug) => (
                      <li key={slug} className="font-mono">- {slug}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {busy && (
        <div className="fixed bottom-6 right-6 rounded-full bg-wood-900 px-4 py-2 text-xs font-bold text-white shadow-lg">
          처리 중...
        </div>
      )}
    </AdminLayout>
  );
}

export default function AdminNextGenerationCms() {
  return (
    <NextGenerationCmsProvider>
      <AdminNextGenerationCmsInner />
    </NextGenerationCmsProvider>
  );
}
