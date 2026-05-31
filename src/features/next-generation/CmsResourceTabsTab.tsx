// Resource tabs editor extracted from AdminNextGenerationCms.tsx.
import React from 'react';
import { Plus } from 'lucide-react';
import {
  NextGenerationDepartment,
  NextGenerationIconName,
  NextGenerationResourceTab,
  normalizeCmsSlug,
} from '../../lib/nextGenerationCms';
import { ICON_OPTIONS, isProtectedTabSlug } from './cmsAdminHelpers';

export default function CmsResourceTabsTab({
  busy,
  departments,
  tabsByDepartment,
  newTabName,
  newTabSlug,
  newTabDepartmentSlug,
  newTabIcon,
  newTabGuestOpen,
  newTabWeeklyGroup,
  newTabUseWeekKey,
  newTabUseTopic,
  onNewTabName,
  onNewTabSlug,
  onNewTabDepartmentSlug,
  onNewTabIcon,
  onNewTabGuestOpen,
  onNewTabWeeklyGroup,
  onNewTabUseWeekKey,
  onNewTabUseTopic,
  onAddTab,
  onSaveTab,
  onDeleteTabWithMove,
}: {
  busy: boolean;
  departments: NextGenerationDepartment[];
  tabsByDepartment: { department: NextGenerationDepartment; tabs: NextGenerationResourceTab[] }[];
  newTabName: string;
  newTabSlug: string;
  newTabDepartmentSlug: string;
  newTabIcon: NextGenerationIconName;
  newTabGuestOpen: boolean;
  newTabWeeklyGroup: boolean;
  newTabUseWeekKey: boolean;
  newTabUseTopic: boolean;
  onNewTabName: (value: string) => void;
  onNewTabSlug: (value: string) => void;
  onNewTabDepartmentSlug: (value: string) => void;
  onNewTabIcon: (value: NextGenerationIconName) => void;
  onNewTabGuestOpen: (value: boolean) => void;
  onNewTabWeeklyGroup: (value: boolean) => void;
  onNewTabUseWeekKey: (value: boolean) => void;
  onNewTabUseTopic: (value: boolean) => void;
  onAddTab: () => void;
  onSaveTab: (tab: NextGenerationResourceTab, patch: Partial<NextGenerationResourceTab>) => void;
  onDeleteTabWithMove: (tab: NextGenerationResourceTab) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-wood-200 bg-white p-5">
        <h3 className="text-lg font-bold text-wood-900">탭 추가</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input
            value={newTabName}
            onChange={(e) => onNewTabName(e.target.value)}
            placeholder="탭명"
            className="rounded-lg border border-wood-300 px-3 py-2"
          />
          <input
            value={newTabSlug}
            onChange={(e) => onNewTabSlug(normalizeCmsSlug(e.target.value))}
            placeholder="tab slug"
            className="rounded-lg border border-wood-300 px-3 py-2"
          />
          <select
            value={newTabDepartmentSlug}
            onChange={(e) => onNewTabDepartmentSlug(e.target.value)}
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
            onChange={(e) => onNewTabIcon(e.target.value as NextGenerationIconName)}
            className="rounded-lg border border-wood-300 px-3 py-2"
          >
            {ICON_OPTIONS.map((icon) => (
              <option key={icon} value={icon}>
                {icon}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm font-medium text-wood-700">
            <input type="checkbox" checked={newTabGuestOpen} onChange={(e) => onNewTabGuestOpen(e.target.checked)} />
            비로그인 공개 탭
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-wood-700">
            <input type="checkbox" checked={newTabWeeklyGroup} onChange={(e) => onNewTabWeeklyGroup(e.target.checked)} />
            주간 묶음 탭
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-wood-700">
            <input type="checkbox" checked={newTabUseWeekKey} onChange={(e) => onNewTabUseWeekKey(e.target.checked)} />
            주차 키 사용
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-wood-700">
            <input type="checkbox" checked={newTabUseTopic} onChange={(e) => onNewTabUseTopic(e.target.checked)} />
            주제 폴더 사용
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={onAddTab}
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
                      onBlur={(e) => onSaveTab(tab, { name: e.target.value.trim() || tab.name })}
                      className="rounded-lg border border-wood-300 px-3 py-2"
                    />
                    <input
                      defaultValue={tab.slug}
                      readOnly
                      className="rounded-lg border border-wood-200 bg-wood-50 px-3 py-2"
                    />
                    <textarea
                      defaultValue={tab.description}
                      onBlur={(e) => onSaveTab(tab, { description: e.target.value })}
                      className="rounded-lg border border-wood-300 px-3 py-2 md:col-span-2"
                      rows={2}
                      placeholder="탭 설명"
                    />
                    <label className="text-xs font-bold text-wood-700">
                      아이콘
                      <select
                        defaultValue={tab.iconName}
                        onChange={(e) =>
                          onSaveTab(tab, { iconName: e.target.value as NextGenerationIconName })
                        }
                        className="mt-1 w-full rounded-lg border border-wood-300 px-3 py-2 text-sm font-normal"
                      >
                        {ICON_OPTIONS.map((icon) => (
                          <option key={icon} value={icon}>
                            {icon}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-bold text-wood-700">
                      순서 (order)
                      <input
                        type="number"
                        min={1}
                        defaultValue={tab.order}
                        onBlur={(e) =>
                          onSaveTab(tab, { order: Math.max(1, Number(e.target.value) || tab.order) })
                        }
                        className="mt-1 w-full rounded-lg border border-wood-300 px-3 py-2 text-sm font-normal"
                      />
                    </label>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onSaveTab(tab, { isVisible: !tab.isVisible })}
                      className="rounded-lg border border-wood-200 px-2.5 py-1 text-xs font-bold text-wood-700"
                    >
                      {tab.isVisible ? '노출' : '숨김'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSaveTab(tab, { isGuestOpen: !tab.isGuestOpen })}
                      className="rounded-lg border border-wood-200 px-2.5 py-1 text-xs font-bold text-wood-700"
                    >
                      비로그인 {tab.isGuestOpen ? '공개' : '잠금'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSaveTab(tab, { isWeeklyGroup: !tab.isWeeklyGroup })}
                      className="rounded-lg border border-wood-200 px-2.5 py-1 text-xs font-bold text-wood-700"
                    >
                      주간묶음 {tab.isWeeklyGroup ? 'ON' : 'OFF'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSaveTab(tab, { useWeekKey: !tab.useWeekKey })}
                      className="rounded-lg border border-wood-200 px-2.5 py-1 text-xs font-bold text-wood-700"
                    >
                      주차키 {tab.useWeekKey ? 'ON' : 'OFF'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSaveTab(tab, { useTopic: !tab.useTopic })}
                      className="rounded-lg border border-wood-200 px-2.5 py-1 text-xs font-bold text-wood-700"
                    >
                      주제 {tab.useTopic ? 'ON' : 'OFF'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSaveTab(tab, { order: Math.max(1, tab.order - 1) })}
                      className="rounded-lg border border-wood-200 px-2.5 py-1 text-xs font-bold text-wood-700"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => onSaveTab(tab, { order: tab.order + 1 })}
                      className="rounded-lg border border-wood-200 px-2.5 py-1 text-xs font-bold text-wood-700"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTabWithMove(tab)}
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
  );
}
