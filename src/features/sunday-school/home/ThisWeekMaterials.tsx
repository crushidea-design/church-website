import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';
import { NEXT_GENERATION_PATH } from '../../../lib/nextGenerationResources';
import type { NextGenerationPost } from '../../next-generation/sharedConstants';
import type { WeeklyMaterialGroup } from './weeklyMaterials';

export function UnpublishedBadge() {
  return (
    <span className="inline-flex rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-black text-rose-800">비공개</span>
  );
}

export default function ThisWeekMaterials({
  groups,
  loading,
  guestNotice,
}: {
  groups: Array<WeeklyMaterialGroup<NextGenerationPost>>;
  loading: boolean;
  guestNotice?: string | null;
}) {
  const location = useLocation();
  const listPath = `${location.pathname}${location.search}`;
  const total = groups.reduce((sum, group) => sum + group.posts.length, 0);

  return (
    <section className="bg-white py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-black tracking-normal text-emerald-950">이번 주 자료</h2>
        {loading ? (
          <div className="flex min-h-32 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
          </div>
        ) : total === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-sky-200 bg-sky-50 p-6 text-center text-sm font-bold text-slate-600">
            이번 주 자료가 준비되면 이곳에 올라옵니다.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {groups
              .filter((group) => group.posts.length > 0)
              .map((group) => (
                <div key={group.tabId} className="rounded-lg border border-sky-100 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-black text-emerald-800">{group.name}</h3>
                  <ul className="mt-3 space-y-2">
                    {group.posts.map((post) => (
                      <li key={post.id}>
                        <Link
                          to={`${NEXT_GENERATION_PATH}/post/${post.id}`}
                          state={{ nextGenerationBackPath: listPath }}
                          className="flex flex-wrap items-center gap-2 text-base font-black leading-7 text-emerald-950 hover:text-emerald-700"
                        >
                          <span className="line-clamp-2">{post.title}</span>
                          {post.isPublished === false && <UnpublishedBadge />}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        )}
        {guestNotice && (
          <p className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-500">
            <Lock size={14} /> {guestNotice}
          </p>
        )}
      </div>
    </section>
  );
}
