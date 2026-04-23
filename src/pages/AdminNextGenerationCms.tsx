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
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import AdminLayout from '../components/AdminLayout';
import {
  NextGenerationCmsProvider,
  NextGenerationDepartment,
  NextGenerationIconName,
  NextGenerationIntroSection,
  NextGenerationResourceTab,
  normalizeCmsSlug,
  seedNextGenerationCmsIfEmpty,
  upsertNextGenerationDepartment,
  upsertNextGenerationIntroSection,
  upsertNextGenerationTab,
  useNextGenerationCms,
} from '../lib/nextGenerationCms';
import { Loader2, Settings, Save, Trash2, Plus, ArchiveRestore, Archive } from 'lucide-react';

type AdminTab = 'departments' | 'resourceTabs' | 'intro' | 'materials';

interface NextGenerationPostSummary {
  id: string;
  title: string;
  subCategory?: string;
  nextGenerationDepartmentSlug?: string;
  nextGenerationTabSlug?: string;
  isArchived?: boolean;
  createdAt?: any;
}

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
      if (!byText) return true;
      return (post.title || '').toLowerCase().includes(byText);
    });
  }, [materials, filterDepartment, filterTab, search]);

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
    await upsertNextGenerationDepartment(department.slug, {
      ...department,
      ...patch,
      order: patch.order ?? department.order,
      isVisible: patch.isVisible ?? department.isVisible,
    });
  };

  const saveTab = async (tab: NextGenerationResourceTab, patch: Partial<NextGenerationResourceTab>) => {
    await upsertNextGenerationTab(tab.slug, {
      ...tab,
      ...patch,
      order: patch.order ?? tab.order,
      isVisible: patch.isVisible ?? tab.isVisible,
    });
  };

  const saveIntroSection = async (section: NextGenerationIntroSection, patch: Partial<NextGenerationIntroSection>) => {
    await upsertNextGenerationIntroSection(section.id, {
      ...section,
      ...patch,
      order: patch.order ?? section.order,
      isVisible: patch.isVisible ?? section.isVisible,
    });
  };

  const addDepartment = async () => {
    const slug = normalizeCmsSlug(newDepartmentSlug || newDepartmentName);
    if (!slug || !newDepartmentName.trim()) return;
    setBusy(true);
    try {
      await upsertNextGenerationDepartment(slug, {
        name: newDepartmentName.trim(),
        description: '새 부서 설명을 입력해 주세요.',
        image: '/next-generation-2026.png',
        heroTitle: '부서 제목을 입력해 주세요',
        heroDescription: '부서 설명을 입력해 주세요.',
        heroClassName: 'bg-white',
        badgeClassName: 'bg-sky-100 text-emerald-950',
        guestPostLimit: 4,
        isVisible: true,
        order: departments.length + 1,
      });
      setNewDepartmentName('');
      setNewDepartmentSlug('');
      showDone('부서를 추가했습니다.');
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
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <input
                  value={newDepartmentName}
                  onChange={(e) => setNewDepartmentName(e.target.value)}
                  placeholder="부서명"
                  className="rounded-lg border border-wood-300 px-3 py-2"
                />
                <input
                  value={newDepartmentSlug}
                  onChange={(e) => setNewDepartmentSlug(normalizeCmsSlug(e.target.value))}
                  placeholder="slug (예: youth-2)"
                  className="rounded-lg border border-wood-300 px-3 py-2"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={addDepartment}
                  className="inline-flex items-center justify-center rounded-lg bg-wood-900 px-3 py-2 text-sm font-bold text-white"
                >
                  <Plus size={14} className="mr-1" />
                  추가
                </button>
              </div>
            </div>

            {departments.map((department) => (
              <div key={department.slug} className="rounded-2xl border border-wood-200 bg-white p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-wood-900">{department.name}</strong>
                  <button
                    type="button"
                    onClick={() => deleteDepartmentWithMove(department)}
                    className="inline-flex items-center rounded-lg border border-red-200 px-3 py-1.5 text-sm font-bold text-red-600"
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
                    순서 올리기
                  </button>
                  <button
                    type="button"
                    onClick={() => saveDepartment(department, { order: department.order + 1 })}
                    className="rounded-lg border border-wood-200 px-3 py-1.5 text-sm font-bold text-wood-700"
                  >
                    순서 내리기
                  </button>
                </div>
              </div>
            ))}
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
                  {groupTabs.map((tab) => (
                    <div key={tab.slug} className="rounded-xl border border-wood-100 p-3">
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
                        />
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
                          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-bold text-red-600"
                        >
                          삭제(이동)
                        </button>
                      </div>
                    </div>
                  ))}
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
                        <input
                          defaultValue={section.title}
                          onBlur={(e) => saveIntroSection(section, { title: e.target.value })}
                          className="w-full rounded-lg border border-wood-300 px-3 py-2"
                        />
                        <textarea
                          defaultValue={section.paragraphs.join('\n')}
                          onBlur={(e) => saveIntroSection(section, { paragraphs: parseLines(e.target.value) })}
                          className="w-full rounded-lg border border-wood-300 px-3 py-2"
                          rows={3}
                        />
                        <textarea
                          defaultValue={section.highlights.join('\n')}
                          onBlur={(e) => saveIntroSection(section, { highlights: parseLines(e.target.value) })}
                          className="w-full rounded-lg border border-wood-300 px-3 py-2"
                          rows={2}
                        />
                        <textarea
                          defaultValue={section.gallery.map((item) => `${item.src}|${item.alt}`).join('\n')}
                          onBlur={(e) => saveIntroSection(section, { gallery: parseGalleryLines(e.target.value) })}
                          className="w-full rounded-lg border border-wood-300 px-3 py-2"
                          rows={2}
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
              <div className="grid gap-3 md:grid-cols-4">
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
                  {tabs.map((tab) => (
                    <option key={tab.slug} value={tab.slug}>
                      {tab.name}
                    </option>
                  ))}
                </select>
                <div className="text-sm text-wood-600 flex items-center">
                  총 {filteredMaterials.length}건
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
              ) : (
                <div className="space-y-2">
                  {filteredMaterials.map((post) => {
                    const tabSlug = post.nextGenerationTabSlug || post.subCategory || '';
                    const checked = selectedPostIds.includes(post.id);
                    return (
                      <div key={post.id} className="rounded-xl border border-wood-100 p-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <label className="inline-flex items-center gap-2 text-sm font-bold text-wood-900">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  setSelectedPostIds((current) =>
                                    e.target.checked ? [...current, post.id] : current.filter((id) => id !== post.id)
                                  );
                                }}
                              />
                              {post.title || '(제목 없음)'}
                            </label>
                            <p className="mt-1 text-xs text-wood-500">
                              {post.nextGenerationDepartmentSlug || '-'} / {tabSlug || '-'} / {post.isArchived ? '휴지통' : '노출'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {post.isArchived ? (
                              <button
                                type="button"
                                onClick={() => archivePost(post.id, false)}
                                className="inline-flex items-center rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700"
                              >
                                <ArchiveRestore size={12} className="mr-1" />
                                복구
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => archivePost(post.id, true)}
                                className="inline-flex items-center rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-700"
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
