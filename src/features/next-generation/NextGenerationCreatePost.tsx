// "Create post" form extracted from NextGeneration.tsx. Handles the
// new-post flow for next-generation posts (uploads, topic selection,
// weekly grouping). Self-contained: no props from the parent.
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ArrowLeft, FileText, Loader2, X } from 'lucide-react';
import { db, handleFirestoreError, OperationType, storage } from '../../lib/firebase';
import { useAuth } from '../../lib/auth';
import { useNextGenerationCms } from '../../lib/nextGenerationCms';
import {
  MATERIAL_FILE_ACCEPT,
  MaterialAttachment,
  formatFileSize,
  getFirstPdfAttachment,
  serializeMaterialAttachments,
  uploadMaterialFiles,
  validateMaterialFiles,
} from '../../lib/attachments';
import {
  NEXT_GENERATION_PATH,
  getCurrentSundayKey,
  getResourceDepartmentPath,
  getResourceTab,
  getYouTubeVideoId,
} from '../../lib/nextGenerationResources';
import {
  NEXT_GENERATION_TOPIC_OPTIONS,
  inferNextGenerationTopicId,
  supportsNextGenerationTopic,
} from '../../lib/nextGenerationTopics';
import { generateSortOrder } from '../../lib/sortUtils';
import {
  ResourceTabItem,
  allResourceTabs,
  iconMap,
  isElementaryWeeklyResource,
  supportsNextGenerationYoutubeUrl,
  youngAdultResourceTabs,
} from './sharedConstants';

const NEXT_GENERATION_CATEGORY = 'next_generation';

export default function NextGenerationCreatePost() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { tabs: cmsTabs } = useNextGenerationCms();
  const [searchParams] = useSearchParams();
  const mergedTabs: ResourceTabItem[] = useMemo(
    () =>
      (cmsTabs.length > 0 ? cmsTabs : (allResourceTabs as any)).map((tab: any) => ({
        id: tab.slug || tab.id,
        slug: tab.slug || tab.id,
        name: tab.name,
        description: tab.description || '',
        icon: iconMap[tab.iconName] || tab.icon || FileText,
        departmentSlug: tab.departmentSlug || (youngAdultResourceTabs.some((item) => item.id === (tab.id || tab.slug)) ? 'young-adults' : 'elementary'),
        isGuestOpen: tab.isGuestOpen,
        isWeeklyGroup: tab.isWeeklyGroup || (tab.id === 'elementary_weekly'),
        useWeekKey: tab.useWeekKey || isElementaryWeeklyResource(tab.id || tab.slug),
        useTopic: tab.useTopic || supportsNextGenerationTopic(tab.id || tab.slug),
      })),
    [cmsTabs]
  );
  const activeTab = getResourceTab(searchParams.get('resource') || undefined, mergedTabs);
  const requestedTopic = searchParams.get('topic');
  const isWeeklyCreate = !!activeTab.isWeeklyGroup;
  const weeklyTabsInDepartment = mergedTabs.filter((tab) => tab.departmentSlug === activeTab.departmentSlug && tab.useWeekKey && !tab.isWeeklyGroup);
  const [selectedResourceId, setSelectedResourceId] = useState(
    isWeeklyCreate ? (weeklyTabsInDepartment[0]?.id || activeTab.id) : activeTab.id
  );
  const [selectedTopicId, setSelectedTopicId] = useState(
    NEXT_GENERATION_TOPIC_OPTIONS.some((topic) => topic.id === requestedTopic)
      ? requestedTopic!
      : NEXT_GENERATION_TOPIC_OPTIONS[0].id
  );
  const [weekKey, setWeekKey] = useState(getCurrentSundayKey());
  const backPath = requestedTopic
    ? `${getResourceDepartmentPath(activeTab.id, mergedTabs)}?resource=${activeTab.id}&topic=${requestedTopic}`
    : `${getResourceDepartmentPath(activeTab.id, mergedTabs)}?resource=${activeTab.id}`;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [materialFiles, setMaterialFiles] = useState<File[]>([]);
  const [weeklyMaterialFiles, setWeeklyMaterialFiles] = useState<Record<string, File[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successPostId, setSuccessPostId] = useState<string | null>(null);
  const [successPostCount, setSuccessPostCount] = useState(0);
  const selectedTab = mergedTabs.find((tab) => tab.id === selectedResourceId);
  const usesWeekKey = isWeeklyCreate || !!selectedTab?.useWeekKey;
  const usesTopic = !!selectedTab?.useTopic;
  const supportsYoutubeUrl = supportsNextGenerationYoutubeUrl(selectedResourceId);
  const weeklyMaterialFileCount = Object.values(weeklyMaterialFiles).reduce((total, files) => total + files.length, 0);

  useEffect(() => {
    setSelectedResourceId(isWeeklyCreate ? (weeklyTabsInDepartment[0]?.id || activeTab.id) : activeTab.id);
  }, [activeTab.id, isWeeklyCreate, weeklyTabsInDepartment]);

  useEffect(() => {
    if (!isWeeklyCreate) {
      setWeeklyMaterialFiles({});
      return;
    }

    setWeeklyMaterialFiles((current) => {
      const next: Record<string, File[]> = {};
      weeklyTabsInDepartment.forEach((tab) => {
        next[tab.id] = current[tab.id] || [];
      });
      return next;
    });
  }, [isWeeklyCreate, weeklyTabsInDepartment]);

  useEffect(() => {
    if (!usesTopic) {
      setSelectedTopicId(NEXT_GENERATION_TOPIC_OPTIONS[0].id);
    }
  }, [usesTopic]);

  useEffect(() => {
    if (
      requestedTopic &&
      NEXT_GENERATION_TOPIC_OPTIONS.some((topic) => topic.id === requestedTopic) &&
      usesTopic
    ) {
      setSelectedTopicId(requestedTopic);
    }
  }, [requestedTopic, selectedResourceId, usesTopic]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const validationError = validateMaterialFiles(files, materialFiles.length);
    if (validationError) {
      setError(validationError);
      event.target.value = '';
      return;
    }

    setMaterialFiles((currentFiles) => [...currentFiles, ...files]);
    setError(null);
    event.target.value = '';
  };

  const handleWeeklyFileChange = (tabId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const existingCount = weeklyMaterialFileCount - (weeklyMaterialFiles[tabId]?.length || 0);
    const validationError = validateMaterialFiles(files, existingCount);
    if (validationError) {
      setError(validationError);
      event.target.value = '';
      return;
    }

    setWeeklyMaterialFiles((current) => ({
      ...current,
      [tabId]: files,
    }));
    setError(null);
    event.target.value = '';
  };

  const removeMaterialFile = (indexToRemove: number) => {
    setMaterialFiles((currentFiles) => currentFiles.filter((_, index) => index !== indexToRemove));
  };

  const removeWeeklyMaterialFile = (tabId: string, indexToRemove: number) => {
    setWeeklyMaterialFiles((current) => ({
      ...current,
      [tabId]: (current[tabId] || []).filter((_, index) => index !== indexToRemove),
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !title.trim() || !content.trim() || submitting) return;

    setSubmitting(true);
    setUploadProgress(0);
    setError(null);

    try {
      if (isWeeklyCreate) {
        const weeklyTargets = weeklyTabsInDepartment
          .map((tab) => ({ tab, files: weeklyMaterialFiles[tab.id] || [] }))
          .filter((entry) => entry.files.length > 0);

        if (weeklyTargets.length === 0) {
          throw new Error('세부 탭별로 자료 파일을 1개 이상 첨부해 주세요.');
        }

        const isLongContent = new TextEncoder().encode(content).length > 1400;
        const createdPostIds: string[] = [];

        for (let targetIndex = 0; targetIndex < weeklyTargets.length; targetIndex += 1) {
          const target = weeklyTargets[targetIndex];
          const attachments = await uploadMaterialFiles(storage, target.files, (progress) => {
            setUploadProgress(Math.round(((targetIndex + progress / 100) / weeklyTargets.length) * 100));
          });
          const firstPdfAttachment = getFirstPdfAttachment(attachments);

          const postData: any = {
            title: title.trim(),
            content: content.trim(),
            category: NEXT_GENERATION_CATEGORY,
            subCategory: target.tab.id,
            nextGenerationTabSlug: target.tab.id,
            nextGenerationDepartmentSlug: target.tab.departmentSlug,
            isArchived: false,
            sortOrder: generateSortOrder(title.trim()),
            authorId: user.uid,
            authorName: user.displayName || '?듬챸',
            commentCount: 0,
            viewCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            isPublished: true,
            nextGenerationWeekKey: weekKey,
          };

          if (target.tab.useTopic) {
            postData.nextGenerationTopicId = selectedTopicId;
          }

          if (attachments.length > 0) {
            postData.attachmentCount = attachments.length;
          }

          if (isLongContent) {
            postData.content = content.substring(0, 400);
            postData.isLongContent = true;
            postData.fullContentLength = content.length;
          }

          let docRef;
          try {
            docRef = await addDoc(collection(db, 'posts'), postData);
          } catch (postError: any) {
            const shouldRetryWithoutTopic =
              postError?.code === 'permission-denied' && 'nextGenerationTopicId' in postData;

            if (!shouldRetryWithoutTopic) {
              throw postError;
            }

            const fallbackPostData = { ...postData };
            delete fallbackPostData.nextGenerationTopicId;
            docRef = await addDoc(collection(db, 'posts'), fallbackPostData);
          }

          if (isLongContent) {
            const chunkSize = 10000;
            const chunks = [];
            for (let i = 0; i < content.length; i += chunkSize) {
              chunks.push(content.substring(i, i + chunkSize));
            }

            for (let i = 0; i < chunks.length; i++) {
              await setDoc(doc(db, 'post_contents', `${docRef.id}_${i}`), {
                postId: docRef.id,
                index: i,
                content: chunks[i],
                createdAt: serverTimestamp(),
              });
            }
          }

          if (attachments.length > 0) {
            const fileData: any = {
              postId: docRef.id,
              updatedAt: serverTimestamp(),
              pdfBase64: serializeMaterialAttachments(attachments),
            };
            if (firstPdfAttachment) {
              fileData.pdfUrl = firstPdfAttachment.url;
              fileData.pdfName = firstPdfAttachment.name;
            }
            await setDoc(doc(db, 'next_generation_post_files', docRef.id), fileData);
          }

          createdPostIds.push(docRef.id);
        }

        setSuccessPostId(createdPostIds[0] || null);
        setSuccessPostCount(createdPostIds.length);
        setTitle('');
        setContent('');
        setYoutubeUrl('');
        setMaterialFiles([]);
        setWeeklyMaterialFiles({});
        setUploadProgress(0);
        return;
      }

      const attachments = await uploadMaterialFiles(storage, materialFiles, setUploadProgress);
      const firstPdfAttachment = getFirstPdfAttachment(attachments);

      const postData: any = {
        title: title.trim(),
        content: content.trim(),
        category: NEXT_GENERATION_CATEGORY,
        subCategory: selectedResourceId,
        nextGenerationTabSlug: selectedResourceId,
        nextGenerationDepartmentSlug: selectedTab?.departmentSlug || activeTab.departmentSlug,
        isArchived: false,
        sortOrder: generateSortOrder(title.trim()),
        authorId: user.uid,
        authorName: user.displayName || '익명',
        commentCount: 0,
        viewCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isPublished: true,
      };

      if (usesWeekKey) {
        postData.nextGenerationWeekKey = weekKey;
      }

      if (usesTopic) {
        postData.nextGenerationTopicId = selectedTopicId;
      }

      if (supportsYoutubeUrl && youtubeUrl.trim()) {
        postData.youtubeUrl = youtubeUrl.trim();
      }

      // Security (Option B): Do NOT store download URLs in the public post doc.
      // We only keep a non-sensitive count here so guests/non-members can see
      // "자료 N개" badge without being able to extract URLs via direct Firestore read.
      if (attachments.length > 0) {
        postData.attachmentCount = attachments.length;
      }

      const isLongContent = new TextEncoder().encode(content).length > 1400;
      if (isLongContent) {
        postData.content = content.substring(0, 400);
        postData.isLongContent = true;
        postData.fullContentLength = content.length;
      }

      let docRef;
      try {
        docRef = await addDoc(collection(db, 'posts'), postData);
      } catch (postError: any) {
        const shouldRetryWithoutTopic =
          postError?.code === 'permission-denied' && 'nextGenerationTopicId' in postData;

        if (!shouldRetryWithoutTopic) {
          throw postError;
        }

        const fallbackPostData = { ...postData };
        delete fallbackPostData.nextGenerationTopicId;
        docRef = await addDoc(collection(db, 'posts'), fallbackPostData);
      }

      if (isLongContent) {
        const chunkSize = 10000;
        const chunks = [];
        for (let i = 0; i < content.length; i += chunkSize) {
          chunks.push(content.substring(i, i + chunkSize));
        }

        for (let i = 0; i < chunks.length; i++) {
          await setDoc(doc(db, 'post_contents', `${docRef.id}_${i}`), {
            postId: docRef.id,
            index: i,
            content: chunks[i],
            createdAt: serverTimestamp(),
          });
        }
      }

      // Write downloadable file metadata to a restricted subcollection
      // that only approved members (and pastor) can read.
      if (attachments.length > 0) {
        const fileData: any = {
          postId: docRef.id,
          updatedAt: serverTimestamp(),
          pdfBase64: serializeMaterialAttachments(attachments),
        };
        if (firstPdfAttachment) {
          fileData.pdfUrl = firstPdfAttachment.url;
          fileData.pdfName = firstPdfAttachment.name;
        }
        await setDoc(doc(db, 'next_generation_post_files', docRef.id), fileData);
      }

      setSuccessPostId(docRef.id);
      setSuccessPostCount(1);
      setTitle('');
      setContent('');
      setYoutubeUrl('');
      setMaterialFiles([]);
      setWeeklyMaterialFiles({});
      setUploadProgress(0);
    } catch (err: any) {
      console.error('Error creating next generation post:', err);
      setError(err.message || '자료 등록 중 오류가 발생했습니다.');
      try {
        handleFirestoreError(err, OperationType.CREATE, 'posts');
      } catch (e) {}
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-sky-50">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-700" />
      </div>
    );
  }

  if (!user) {
    return (
      <main className="bg-sky-50 py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate(backPath)}
            className="mb-6 inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-bold text-emerald-950 shadow-sm transition hover:bg-emerald-50"
          >
            <ArrowLeft size={16} className="mr-2" />
            자료실로 돌아가기
          </button>
          <div className="rounded-lg border border-sky-100 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-black text-emerald-950">로그인이 필요합니다</h1>
            <p className="mt-3 text-slate-700">자료를 올리려면 먼저 관리자 계정으로 로그인해 주세요.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-sky-50 py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(backPath)}
          className="mb-6 inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-bold text-emerald-950 shadow-sm transition hover:bg-emerald-50"
        >
          <ArrowLeft size={16} className="mr-2" />
          자료실로 돌아가기
        </button>

        <section className="rounded-lg border border-white bg-white p-4 shadow-sm sm:p-6 lg:p-10">
          <span className="mb-4 inline-flex rounded-lg bg-amber-100 px-3 py-2 text-sm font-black text-emerald-950">
            {activeTab.name}
          </span>
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-normal text-emerald-950">다음세대 자료 등록</h1>
              <p className="mt-3 text-base leading-7 text-slate-700">{activeTab.description}</p>
            </div>
            <button
              type="submit"
              form="next-generation-create-form"
              disabled={submitting || !title.trim() || !content.trim()}
              className="inline-flex items-center justify-center rounded-lg bg-coral-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-coral-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? '등록 중...' : '등록하기'}
            </button>
          </div>

          {successPostId && (
            <div className="mb-6 flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-emerald-700">
                {successPostCount > 1
                  ? `${successPostCount}개의 자료가 각 세부 탭에 등록되었습니다.`
                  : '자료가 성공적으로 등록되었습니다.'}
              </p>
              <div className="flex shrink-0 gap-2">
                <Link
                  to={`${NEXT_GENERATION_PATH}/post/${successPostId}`}
                  className="inline-flex items-center rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                >
                  {successPostCount > 1 ? '첫 자료 보기' : '등록된 자료 보기'}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setSuccessPostId(null);
                    setSuccessPostCount(0);
                  }}
                  className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
                >
                  자료 추가 등록
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          <form id="next-generation-create-form" onSubmit={handleSubmit} className="space-y-6">
            {isWeeklyCreate && (
              <div className="rounded-lg border border-sky-100 bg-sky-50 p-4">
                <p className="text-sm font-black text-emerald-950">이번 저장에서 자동 생성될 세부 탭</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {weeklyTabsInDepartment.map((tab) => (
                    <span
                      key={tab.id}
                      className="inline-flex rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800"
                    >
                      {tab.name}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs font-bold text-slate-500">
                  제목, 내용, 주일, 주제는 같게 저장되고 각 세부 탭에는 해당 파일만 따로 등록됩니다.
                </p>
              </div>
            )}

            {usesWeekKey && (
              <div>
                <label htmlFor="next-generation-week" className="mb-2 block text-sm font-black text-emerald-950">
                  해당 주일
                </label>
                <input
                  id="next-generation-week"
                  type="date"
                  value={weekKey}
                  onChange={(event) => setWeekKey(event.target.value)}
                  className="block w-full rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                  required
                />
                <p className="mt-2 text-xs font-bold text-slate-500">
                  이번주 강의자료 탭은 이 날짜가 이번 주일과 같은 자료를 모아 보여줍니다.
                </p>
              </div>
            )}

            {usesTopic && (
              <div>
                <label htmlFor="next-generation-topic" className="mb-2 block text-sm font-black text-emerald-950">
                  주제 폴더
                </label>
                <select
                  id="next-generation-topic"
                  value={selectedTopicId}
                  onChange={(event) => setSelectedTopicId(event.target.value)}
                  className="block w-full rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                >
                  {NEXT_GENERATION_TOPIC_OPTIONS.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs font-bold text-slate-500">
                  같은 세부 탭 안에서도 시리즈 주제별로 자료를 묶어 보여줍니다.
                </p>
              </div>
            )}

            <div>
              <label htmlFor="next-generation-title" className="mb-2 block text-sm font-black text-emerald-950">
                제목
              </label>
              <input
                id="next-generation-title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="block w-full rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                placeholder="제목을 입력하세요"
                required
                maxLength={200}
              />
            </div>

            {supportsYoutubeUrl && (
              <div>
                <label htmlFor="next-generation-youtube-url" className="mb-2 block text-sm font-black text-emerald-950">
                  유튜브 링크
                </label>
                <input
                  id="next-generation-youtube-url"
                  type="url"
                  value={youtubeUrl}
                  onChange={(event) => setYoutubeUrl(event.target.value)}
                  className="block w-full rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                  placeholder="https://www.youtube.com/watch?v=..."
                  maxLength={500}
                />
                {youtubeUrl && !getYouTubeVideoId(youtubeUrl) && (
                  <p className="mt-2 text-xs font-bold text-red-600">유효한 유튜브 링크를 입력하세요.</p>
                )}
                {youtubeUrl && getYouTubeVideoId(youtubeUrl) && (
                  <p className="mt-2 text-xs font-bold text-emerald-700">유효한 유튜브 링크입니다.</p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="next-generation-content" className="mb-2 block text-sm font-black text-emerald-950">
                {selectedResourceId === 'podcast_review' ? '설명' : '내용'}
              </label>
              <textarea
                id="next-generation-content"
                rows={14}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className="block w-full rounded-lg border border-sky-100 bg-sky-50 p-4 text-sm leading-7 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                placeholder={selectedResourceId === 'podcast_review' ? '팟캐스트 설명을 입력하세요' : '자료 안내와 함께 나눌 내용을 입력하세요'}
                required
                maxLength={50000}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-black text-emerald-950">
                자료 파일 첨부
              </label>
              {isWeeklyCreate ? (
                <div className="space-y-4">
                  {weeklyTabsInDepartment.map((tab) => {
                    const files = weeklyMaterialFiles[tab.id] || [];
                    return (
                      <div key={tab.id} className="rounded-lg border border-sky-100 bg-sky-50 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-black text-emerald-950">{tab.name}</p>
                            <p className="text-xs font-bold text-slate-500">이 탭 게시판에만 들어갈 파일을 올려 주세요.</p>
                          </div>
                          <label
                            htmlFor={`next-generation-file-${tab.id}`}
                            className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-white px-3 py-2 text-xs font-bold text-emerald-800 shadow-sm transition hover:bg-sky-100"
                          >
                            파일 선택
                          </label>
                          <input
                            id={`next-generation-file-${tab.id}`}
                            type="file"
                            accept={MATERIAL_FILE_ACCEPT}
                            multiple
                            className="sr-only"
                            onChange={(event) => handleWeeklyFileChange(tab.id, event)}
                          />
                        </div>

                        {files.length > 0 ? (
                          <ul className="mt-4 space-y-2">
                            {files.map((file, index) => (
                              <li
                                key={`${tab.id}-${file.name}-${file.lastModified}-${index}`}
                                className="flex flex-col gap-3 rounded-lg bg-white p-3 text-left shadow-sm sm:flex-row sm:items-center sm:justify-between"
                              >
                                <span className="flex items-center gap-3 text-sm font-bold text-emerald-950">
                                  <FileText className="h-5 w-5 shrink-0 text-emerald-700" />
                                  <span>
                                    {file.name}
                                    <span className="ml-2 text-xs text-slate-500">{formatFileSize(file.size)}</span>
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeWeeklyMaterialFile(tab.id, index)}
                                  className="inline-flex w-fit items-center rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-red-50 hover:text-red-700"
                                >
                                  <X size={14} className="mr-1" />
                                  제거
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-4 text-xs font-bold text-slate-400">아직 선택된 파일이 없습니다.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border-2 border-dashed border-sky-200 bg-sky-50 p-6 transition hover:bg-sky-100">
                  <div className="text-center">
                    <FileText className="mx-auto mb-3 h-10 w-10 text-sky-500" />
                    <label htmlFor="next-generation-file" className="cursor-pointer text-sm font-black text-emerald-800 hover:text-emerald-950">
                      PDF/PPT 파일 선택
                    </label>
                    <p className="mt-2 text-xs font-bold text-slate-500">
                      여러 파일 선택 가능, 파일당 최대 20MB
                    </p>
                    <input
                      id="next-generation-file"
                      type="file"
                      accept={MATERIAL_FILE_ACCEPT}
                      multiple
                      className="sr-only"
                      onChange={handleFileChange}
                    />
                  </div>

                  {materialFiles.length > 0 && (
                    <ul className="mt-5 space-y-2">
                      {materialFiles.map((file, index) => (
                        <li
                          key={`${file.name}-${file.lastModified}-${index}`}
                          className="flex flex-col gap-3 rounded-lg bg-white p-3 text-left shadow-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="flex items-center gap-3 text-sm font-bold text-emerald-950">
                            <FileText className="h-5 w-5 shrink-0 text-emerald-700" />
                            <span>
                              {file.name}
                              <span className="ml-2 text-xs text-slate-500">{formatFileSize(file.size)}</span>
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => removeMaterialFile(index)}
                            className="inline-flex w-fit items-center rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-red-50 hover:text-red-700"
                          >
                            <X size={14} className="mr-1" />
                            제거
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {submitting && uploadProgress > 0 && uploadProgress < 100 && (
              <div>
                <div className="h-2.5 w-full rounded-full bg-sky-100">
                  <div className="h-2.5 rounded-full bg-emerald-600 transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="mt-2 text-right text-xs font-bold text-slate-500">자료 업로드 중... {uploadProgress}%</p>
              </div>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}
