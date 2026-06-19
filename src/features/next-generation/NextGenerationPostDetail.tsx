// Post detail page extracted from NextGeneration.tsx.
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import { ArrowLeft, Download, Edit3, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../lib/auth';
import {
  STUDENT_ACCESSIBLE_TAB_SLUGS,
  isRestrictedDepartment,
  useNextGenerationAuth,
} from '../../lib/nextGenerationAuth';
import { useNextGenerationCms } from '../../lib/nextGenerationCms';
import {
  NEXT_GENERATION_PATH,
  formatShortDate,
  getNextGenerationPostBackPath,
  getPostYouTubeVideoId,
  getResourceLabel,
} from '../../lib/nextGenerationResources';
import {
  getNextGenerationTopicLabel,
  inferNextGenerationTopicId,
  supportsNextGenerationTopic,
} from '../../lib/nextGenerationTopics';
import {
  formatFileSize,
  getMaterialAttachmentLabel,
  getPostAttachments,
  getInlinePreviewAttachments,
} from '../../lib/attachments';
import PdfCanvasViewer from '../../components/PdfCanvasViewer';
import { formatDate } from '../../lib/utils';
import {
  DepartmentCardItem,
  NextGenerationPost,
  ResourceTabItem,
  allResourceTabs,
  elementaryImage,
  elementaryResourceTabs,
  iconMap,
  isElementaryWeeklyResource,
  sectionTabs,
  youngAdultResourceTabs,
} from './sharedConstants';

const NEXT_GENERATION_CATEGORY = 'next_generation';

export default function NextGenerationPostDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();
  const { hasAccess: ngAccess, user: ngUser, member, isPending, isRejected } = useNextGenerationAuth();
  const isRestricted = isRestrictedDepartment(member?.department);
  const { tabs: cmsTabs, departments: cmsDepartments } = useNextGenerationCms();
  const [post, setPost] = useState<NextGenerationPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);
  const isAdmin = role === 'admin';
  const downloadBlockedNotice = (ngUser && (isPending || isRejected))
    ? '\uB2E4\uC6B4\uB85C\uB4DC\uB294 \uC815\uD68C\uC6D0\uB9CC \uAC00\uB2A5\uD569\uB2C8\uB2E4. \uBAA9\uC0AC\uB2D8\uAED8 \uBB38\uC758\uB97C \uB0A8\uACA8\uC8FC\uC138\uC694.'
    : '\uB85C\uADF8\uC778\uD558\uC2DC\uBA74 \uB2E4\uC6B4\uB85C\uB4DC \uAE30\uB2A5\uC744 \uC774\uC6A9\uD558\uC2E4 \uC218 \uC788\uC2B5\uB2C8\uB2E4.';

  useEffect(() => {
    const fetchPost = async () => {
      setLoading(true);

      try {
        const postRef = doc(db, 'posts', id);
        const snapshot = await getDoc(postRef);

        if (!snapshot.exists()) {
          navigate(`${NEXT_GENERATION_PATH}/elementary`, { replace: true });
          return;
        }

        const data = { id: snapshot.id, ...snapshot.data() } as NextGenerationPost;
        if (data.category !== NEXT_GENERATION_CATEGORY) {
          navigate(`${NEXT_GENERATION_PATH}/elementary`, { replace: true });
          return;
        }

        if (isRestricted && !isAdmin) {
          const postTabSlug = data.nextGenerationTabSlug || data.subCategory || '';
          if (!(STUDENT_ACCESSIBLE_TAB_SLUGS as readonly string[]).includes(postTabSlug)) {
            navigate(`${NEXT_GENERATION_PATH}/elementary?resource=elementary_workbook`, { replace: true });
            return;
          }
        }

        if (data.isLongContent) {
          const chunksQuery = query(
            collection(db, 'post_contents'),
            where('postId', '==', id),
            orderBy('index', 'asc')
          );
          const chunksSnap = await getDocs(chunksQuery);
          if (!chunksSnap.empty) {
            data.content = chunksSnap.docs.map((chunkDoc) => chunkDoc.data().content).join('');
          }
        }

        // Load restricted download file metadata only if the user is an approved
        // member or pastor. Firestore rules block this read for others, so we
        // guard here to avoid surfacing a permission error in the console.
        if (true) {
          try {
            const fileSnap = await getDoc(doc(db, 'next_generation_post_files', id));
            if (fileSnap.exists()) {
              const fileData = fileSnap.data() as any;
              if (fileData.pdfUrl) (data as any).pdfUrl = fileData.pdfUrl;
              if (fileData.pdfName) (data as any).pdfName = fileData.pdfName;
              if (fileData.pdfBase64) (data as any).pdfBase64 = fileData.pdfBase64;
              if (fileData.attachments) (data as any).attachments = fileData.attachments;
            }
          } catch (e) {
            // Silent — rule may block for pending/rejected; badge still reflects count
          }
        }

        setPost(data);
      } catch (err: any) {
        console.error('Error fetching next generation post:', err);
        try {
          handleFirestoreError(err, OperationType.GET, `posts/${id}`);
        } catch (e) {}
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [id, navigate, ngAccess, isRestricted, isAdmin]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-sky-50">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-700" />
      </div>
    );
  }

  if (!post) return null;

  const mergedTabs: ResourceTabItem[] = (cmsTabs.length > 0 ? cmsTabs : (allResourceTabs as any)).map((tab: any) => ({
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
  }));
  const mergedDepartments: DepartmentCardItem[] = (cmsDepartments.length > 0 ? cmsDepartments : (sectionTabs as any)).map((department: any) => ({
    id: department.slug || department.id,
    slug: department.slug || department.id,
    name: department.name,
    path: `${NEXT_GENERATION_PATH}/${department.slug || department.id}`,
    image: department.image || elementaryImage,
    copy: department.description || department.copy || '',
    icon: iconMap.Sparkles,
  }));
  const inferredTopicId = inferNextGenerationTopicId(post);
  const postTabSlug = post.nextGenerationTabSlug || post.subCategory;
  const backPath = getNextGenerationPostBackPath(
    postTabSlug,
    mergedTabs,
    mergedDepartments,
    mergedTabs[0]?.id || elementaryResourceTabs[0].id,
    {
      sourcePath: (location.state as { nextGenerationBackPath?: string } | null)?.nextGenerationBackPath,
      topicId: inferredTopicId,
      includeTopic: supportsNextGenerationTopic(postTabSlug),
    }
  );
  const attachments = getPostAttachments(post);
  const inlinePreviewAttachments = getInlinePreviewAttachments(attachments);
  const youtubeVideoId = getPostYouTubeVideoId(post);

  return (
    <main className="bg-sky-50 py-10">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => navigate(backPath)}
            className="inline-flex w-fit items-center rounded-lg bg-white px-4 py-2 text-sm font-bold text-emerald-950 shadow-sm transition hover:bg-emerald-50"
          >
            <ArrowLeft size={16} className="mr-2" />
            자료 목록으로
          </button>

          {isAdmin && (
            <Link
              to={`${NEXT_GENERATION_PATH}/edit/${post.id}`}
              className="inline-flex w-fit items-center rounded-lg bg-coral-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-coral-700"
            >
              <Edit3 size={16} className="mr-2" />
              수정하기
            </Link>
          )}
        </div>

        <article className="rounded-lg border border-white bg-white p-6 shadow-sm sm:p-8 lg:p-10">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
                <span className="inline-flex w-fit rounded-lg bg-amber-100 px-3 py-2 text-sm font-black text-emerald-950">
                  {getResourceLabel(postTabSlug, mergedTabs)}
                </span>
              {supportsNextGenerationTopic(postTabSlug) && (
                <span className="inline-flex w-fit rounded-lg bg-sky-50 px-3 py-2 text-sm font-black text-emerald-950">
                  {getNextGenerationTopicLabel(inferredTopicId)}
                </span>
              )}
            </div>
            <span className="text-sm font-bold text-slate-500">{formatDate(post.createdAt, 'yyyy.MM.dd HH:mm')}</span>
          </div>

          <h1 className="text-3xl font-black leading-tight tracking-normal text-emerald-950 sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-3 text-sm font-bold text-slate-500">{post.authorName}</p>

          <>
          {youtubeVideoId && (
            <div className="mt-8 overflow-hidden rounded-lg border border-sky-100">
              <div className="relative aspect-video">
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeVideoId}`}
                  title={post.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
              </div>
              <div className="flex justify-end bg-white px-4 py-3">
                <a
                  href={`https://www.youtube.com/watch?v=${youtubeVideoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm font-bold text-emerald-800 transition hover:text-emerald-950"
                >
                  <ExternalLink className="mr-1.5 h-4 w-4" />
                  YouTube 앱에서 보기
                </a>
              </div>
            </div>
          )}

          <div className="mt-8 whitespace-pre-wrap text-base leading-8 text-slate-800">
            {post.content}
          </div>

          {attachments.length > 0 && (
            <div className="mt-10 border-t border-sky-100 pt-8">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="flex items-center text-xl font-black text-emerald-950">
                  <FileText className="mr-2 text-coral-700" />
                  첨부된 자료
                </h2>
              </div>

              {accessNotice && (
                <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                  {accessNotice}
                </div>
              )}

              <div className="space-y-4">
                {attachments.map((attachment, index) => (
                  <div key={`${attachment.url}-${index}`} className="rounded-lg border border-sky-100 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <span className="mb-2 inline-flex rounded-lg bg-sky-50 px-2 py-1 text-xs font-black text-emerald-950">
                          {getMaterialAttachmentLabel(attachment)}
                        </span>
                        <p className="break-all text-sm font-bold text-emerald-950">{attachment.name}</p>
                        {attachment.size && (
                          <p className="mt-1 text-xs font-bold text-slate-500">{formatFileSize(attachment.size)}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {ngAccess ? (
                          <>
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-lg bg-sky-50 px-3 py-2 text-xs font-bold text-emerald-950 transition hover:bg-sky-100"
                            >
                              새 창에서 열기
                            </a>
                            <a
                              href={attachment.url}
                              download={attachment.name}
                              className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
                            >
                              <Download size={14} className="mr-1" />
                              다운로드
                            </a>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setAccessNotice(downloadBlockedNotice)
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-500 transition hover:bg-gray-200"
                            title={'\uB85C\uADF8\uC778 \uD6C4 \uB2E4\uC6B4\uB85C\uB4DC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4'}
                          >
                            <Download size={14} className="mr-1" />
                            {'\uB2E4\uC6B4\uB85C\uB4DC'}
                          </button>
                        )}
                      </div>
                    </div>

                    {inlinePreviewAttachments.some((preview) => preview.url === attachment.url) && (
                      attachment.type === 'pdf' ? (
                        <div className="mt-4 overflow-hidden rounded-lg border border-sky-100 bg-white">
                          <PdfCanvasViewer
                            url={attachment.url}
                            onDownload={
                              ngAccess
                                ? () => window.open(attachment.url, '_blank', 'noopener,noreferrer')
                                : () =>
                                    setAccessNotice(downloadBlockedNotice)
                            }
                          />
                        </div>
                      ) : (
                        <figure className="mt-4 overflow-hidden rounded-lg border border-sky-100 bg-slate-50">
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="max-h-[80vh] w-full object-contain"
                            loading="lazy"
                          />
                          <figcaption className="border-t border-sky-100 bg-white px-3 py-2 text-xs font-bold text-slate-500">
                            {attachment.name}
                          </figcaption>
                        </figure>
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          </>
        </article>
      </div>
    </main>
  );
}
