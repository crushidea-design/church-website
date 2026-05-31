// Materials tab body extracted from AdminNextGenerationCms.tsx.
import React from 'react';
import { Archive, ArchiveRestore, Loader2, Save } from 'lucide-react';
import {
  NextGenerationDepartment,
  NextGenerationResourceTab,
} from '../../lib/nextGenerationCms';
import { NextGenerationPostSummary, formatPostDate } from './cmsAdminHelpers';

export default function CmsMaterialsTab({
  departments,
  tabs,
  tabsByDepartmentSlug,
  filteredMaterials,
  materialsLoading,
  selectedPostIds,
  search,
  filterDepartment,
  filterTab,
  archivedFilter,
  moveDepartmentSlug,
  moveTabSlug,
  targetMoveTabs,
  onSearchChange,
  onFilterDepartment,
  onFilterTab,
  onArchivedFilter,
  onMoveDepartmentSlug,
  onMoveTabSlug,
  onMoveSelected,
  onSetSelectedPostIds,
  onSetMaterialPlacement,
  onArchivePost,
}: {
  departments: NextGenerationDepartment[];
  tabs: NextGenerationResourceTab[];
  tabsByDepartmentSlug: Record<string, NextGenerationResourceTab[]>;
  filteredMaterials: NextGenerationPostSummary[];
  materialsLoading: boolean;
  selectedPostIds: string[];
  search: string;
  filterDepartment: string;
  filterTab: string;
  archivedFilter: 'all' | 'active' | 'archived';
  moveDepartmentSlug: string;
  moveTabSlug: string;
  targetMoveTabs: NextGenerationResourceTab[];
  onSearchChange: (value: string) => void;
  onFilterDepartment: (value: string) => void;
  onFilterTab: (value: string) => void;
  onArchivedFilter: (value: 'all' | 'active' | 'archived') => void;
  onMoveDepartmentSlug: (value: string) => void;
  onMoveTabSlug: (value: string) => void;
  onMoveSelected: () => void;
  onSetSelectedPostIds: React.Dispatch<React.SetStateAction<string[]>>;
  onSetMaterialPlacement: (post: NextGenerationPostSummary, departmentSlug: string, tabSlug: string) => void;
  onArchivePost: (postId: string, archived: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-wood-200 bg-white p-5 space-y-3">
        <h3 className="text-lg font-bold text-wood-900">자료 필터/일괄 이동</h3>
        <div className="grid gap-3 md:grid-cols-5">
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="제목 검색"
            className="rounded-lg border border-wood-300 px-3 py-2"
          />
          <select
            value={filterDepartment}
            onChange={(e) => onFilterDepartment(e.target.value)}
            className="rounded-lg border border-wood-300 px-3 py-2"
          >
            <option value="">전체 부서</option>
            {departments.map((department) => (
              <option key={department.slug} value={department.slug}>
                {department.name}
              </option>
            ))}
          </select>
          <select
            value={filterTab}
            onChange={(e) => onFilterTab(e.target.value)}
            className="rounded-lg border border-wood-300 px-3 py-2"
          >
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
          <select
            value={archivedFilter}
            onChange={(e) => onArchivedFilter(e.target.value as 'all' | 'active' | 'archived')}
            className="rounded-lg border border-wood-300 px-3 py-2"
          >
            <option value="all">전체 상태</option>
            <option value="active">노출</option>
            <option value="archived">휴지통</option>
          </select>
          <div className="text-sm text-wood-600 flex items-center">
            총 {filteredMaterials.length}건 · 선택 {selectedPostIds.length}건
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <select
            value={moveDepartmentSlug}
            onChange={(e) => onMoveDepartmentSlug(e.target.value)}
            className="rounded-lg border border-wood-300 px-3 py-2"
          >
            {departments.map((department) => (
              <option key={department.slug} value={department.slug}>
                이동 부서: {department.name}
              </option>
            ))}
          </select>
          <select
            value={moveTabSlug}
            onChange={(e) => onMoveTabSlug(e.target.value)}
            className="rounded-lg border border-wood-300 px-3 py-2"
          >
            {targetMoveTabs.map((tab) => (
              <option key={tab.slug} value={tab.slug}>
                이동 탭: {tab.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={selectedPostIds.length === 0 || !moveTabSlug}
            onClick={onMoveSelected}
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
                          onSetSelectedPostIds((current) =>
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
                            onSetMaterialPlacement(post, nextDept, firstTab.slug);
                          } else if (nextDept) {
                            onSetMaterialPlacement(post, nextDept, tabSlug);
                          }
                        }}
                        className="rounded-lg border border-wood-300 px-2 py-1"
                      >
                        <option value="">(부서 미지정)</option>
                        {departments.map((department) => (
                          <option key={department.slug} value={department.slug}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={tabSlug}
                        onChange={(e) =>
                          onSetMaterialPlacement(post, departmentSlug || departments[0]?.slug || '', e.target.value)
                        }
                        className="rounded-lg border border-wood-300 px-2 py-1"
                      >
                        <option value="">(탭 미지정)</option>
                        {inlineTabs.map((tab) => (
                          <option key={tab.slug} value={tab.slug}>
                            {tab.name}
                          </option>
                        ))}
                      </select>
                      {post.isArchived ? (
                        <button
                          type="button"
                          onClick={() => onArchivePost(post.id, false)}
                          className="inline-flex items-center rounded-lg border border-emerald-200 px-3 py-1 font-bold text-emerald-700"
                        >
                          <ArchiveRestore size={12} className="mr-1" />
                          복구
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onArchivePost(post.id, true)}
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
  );
}
