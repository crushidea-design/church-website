import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchUnpublishedPreparationPosts } from '../api';
import type { PreparationPostSummary } from '../api';
import { useNextGenerationCms } from '../../../lib/nextGenerationCms';
import { getNextGenerationTopicLabel } from '../../../lib/nextGenerationTopics';
import { cardClass, subtleButtonClass } from './ui';

export default function SundaySchoolPrivatePostsSection() {
  const { tabs, topics } = useNextGenerationCms();
  const [posts, setPosts] = useState<PreparationPostSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPosts(await fetchUnpublishedPreparationPosts());
    } catch (err) {
      console.error('Failed to load unpublished posts', err);
      setError('비공개 자료를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tabName = (slug: string) => tabs.find((tab) => (tab.slug || tab.id) === slug)?.name ?? slug;

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-wood-900">비공개 준비 자료</h3>
        <button type="button" className={subtleButtonClass} disabled={loading} onClick={() => void load()}>
          {loading ? '불러오는 중...' : '새로고침'}
        </button>
      </div>
      <p className="mt-1 text-xs font-bold text-wood-500">공개 전으로 올려 둔 다음세대 자료입니다. 최근 100건까지 보여 줍니다. 일괄 공개는 아래 "전환 준비"에서 합니다.</p>
      {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="text-xs text-wood-500">
              <th className="p-1.5">제목</th>
              <th className="p-1.5">탭</th>
              <th className="p-1.5">주일</th>
              <th className="p-1.5">주제</th>
            </tr>
          </thead>
          <tbody>
            {posts && posts.length === 0 && (
              <tr><td colSpan={4} className="p-3 text-center text-xs text-wood-500">비공개 자료가 없습니다.</td></tr>
            )}
            {(posts ?? []).map((post) => (
              <tr key={post.id} className="border-t border-wood-100">
                <td className="p-1.5 font-bold">
                  <Link to={`/next/post/${post.id}`} className="text-wood-900 underline">{post.title || '(제목 없음)'}</Link>
                </td>
                <td className="p-1.5">{tabName(post.tabSlug)}</td>
                <td className="p-1.5">{post.weekKey}</td>
                <td className="p-1.5">{post.topicId ? getNextGenerationTopicLabel(post.topicId, topics) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
