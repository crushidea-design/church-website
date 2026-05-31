// Departments editor extracted from AdminNextGenerationCms.tsx.
import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  NEXT_GEN_BADGE_CLASS_OPTIONS,
  NEXT_GEN_HERO_CLASS_OPTIONS,
  NextGenerationDepartment,
  normalizeCmsSlug,
} from '../../lib/nextGenerationCms';
import { isProtectedDepartmentSlug } from './cmsAdminHelpers';

export default function CmsDepartmentsTab({
  busy,
  departments,
  newDepartmentName,
  newDepartmentSlug,
  newDepartmentDescription,
  newDepartmentImage,
  newDepartmentHeroTitle,
  newDepartmentHeroDescription,
  onNewDepartmentName,
  onNewDepartmentSlug,
  onNewDepartmentDescription,
  onNewDepartmentImage,
  onNewDepartmentHeroTitle,
  onNewDepartmentHeroDescription,
  onAddDepartment,
  onSaveDepartment,
  onDeleteDepartmentWithMove,
}: {
  busy: boolean;
  departments: NextGenerationDepartment[];
  newDepartmentName: string;
  newDepartmentSlug: string;
  newDepartmentDescription: string;
  newDepartmentImage: string;
  newDepartmentHeroTitle: string;
  newDepartmentHeroDescription: string;
  onNewDepartmentName: (value: string) => void;
  onNewDepartmentSlug: (value: string) => void;
  onNewDepartmentDescription: (value: string) => void;
  onNewDepartmentImage: (value: string) => void;
  onNewDepartmentHeroTitle: (value: string) => void;
  onNewDepartmentHeroDescription: (value: string) => void;
  onAddDepartment: () => void;
  onSaveDepartment: (department: NextGenerationDepartment, patch: Partial<NextGenerationDepartment>) => void;
  onDeleteDepartmentWithMove: (department: NextGenerationDepartment) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-wood-200 bg-white p-5">
        <h3 className="text-lg font-bold text-wood-900">부서 추가</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            value={newDepartmentName}
            onChange={(e) => onNewDepartmentName(e.target.value)}
            placeholder="부서명 (필수)"
            className="rounded-lg border border-wood-300 px-3 py-2"
          />
          <input
            value={newDepartmentSlug}
            onChange={(e) => onNewDepartmentSlug(normalizeCmsSlug(e.target.value))}
            placeholder="slug (예: youth-2)"
            className="rounded-lg border border-wood-300 px-3 py-2"
          />
          <input
            value={newDepartmentDescription}
            onChange={(e) => onNewDepartmentDescription(e.target.value)}
            placeholder="카드 설명 (선택)"
            className="rounded-lg border border-wood-300 px-3 py-2 md:col-span-2"
          />
          <input
            value={newDepartmentHeroTitle}
            onChange={(e) => onNewDepartmentHeroTitle(e.target.value)}
            placeholder="자료실 Hero 제목 (선택)"
            className="rounded-lg border border-wood-300 px-3 py-2"
          />
          <input
            value={newDepartmentImage}
            onChange={(e) => onNewDepartmentImage(e.target.value)}
            placeholder="대표 이미지 경로 (선택, 예: /next-generation-2026.png)"
            className="rounded-lg border border-wood-300 px-3 py-2"
          />
          <textarea
            value={newDepartmentHeroDescription}
            onChange={(e) => onNewDepartmentHeroDescription(e.target.value)}
            placeholder="자료실 Hero 설명 (선택)"
            rows={2}
            className="rounded-lg border border-wood-300 px-3 py-2 md:col-span-2"
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onAddDepartment}
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
                onClick={() => onDeleteDepartmentWithMove(department)}
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
                onBlur={(e) => onSaveDepartment(department, { name: e.target.value.trim() || department.name })}
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
                onBlur={(e) => onSaveDepartment(department, { description: e.target.value })}
                className="rounded-lg border border-wood-300 px-3 py-2 md:col-span-2"
                placeholder="카드 설명"
              />
              <input
                defaultValue={department.heroTitle}
                onBlur={(e) => onSaveDepartment(department, { heroTitle: e.target.value })}
                className="rounded-lg border border-wood-300 px-3 py-2 md:col-span-2"
                placeholder="자료실 Hero 제목"
              />
              <textarea
                defaultValue={department.heroDescription}
                onBlur={(e) => onSaveDepartment(department, { heroDescription: e.target.value })}
                className="rounded-lg border border-wood-300 px-3 py-2 md:col-span-2"
                rows={2}
                placeholder="자료실 Hero 설명"
              />
              <input
                defaultValue={department.image}
                onBlur={(e) => onSaveDepartment(department, { image: e.target.value })}
                className="rounded-lg border border-wood-300 px-3 py-2 md:col-span-2"
                placeholder="대표 이미지 경로"
              />
              <label className="text-xs font-bold text-wood-700">
                Hero 배경 색상
                <select
                  defaultValue={department.heroClassName || 'bg-white'}
                  onChange={(e) => onSaveDepartment(department, { heroClassName: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-wood-300 px-3 py-2 text-sm font-normal"
                >
                  {NEXT_GEN_HERO_CLASS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-wood-700">
                배지 색상
                <select
                  defaultValue={department.badgeClassName || 'bg-sky-100 text-emerald-950'}
                  onChange={(e) => onSaveDepartment(department, { badgeClassName: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-wood-300 px-3 py-2 text-sm font-normal"
                >
                  {NEXT_GEN_BADGE_CLASS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-wood-700">
                비로그인 노출 글 수 (guestPostLimit)
                <input
                  type="number"
                  min={0}
                  defaultValue={department.guestPostLimit ?? 0}
                  onBlur={(e) =>
                    onSaveDepartment(department, { guestPostLimit: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="mt-1 w-full rounded-lg border border-wood-300 px-3 py-2 text-sm font-normal"
                />
              </label>
              <label className="text-xs font-bold text-wood-700">
                순서 (order)
                <input
                  type="number"
                  min={1}
                  defaultValue={department.order}
                  onBlur={(e) =>
                    onSaveDepartment(department, {
                      order: Math.max(1, Number(e.target.value) || department.order),
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-wood-300 px-3 py-2 text-sm font-normal"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onSaveDepartment(department, { isVisible: !department.isVisible })}
                className="rounded-lg border border-wood-200 px-3 py-1.5 text-sm font-bold text-wood-700"
              >
                {department.isVisible ? '노출 중' : '숨김 중'}
              </button>
              <button
                type="button"
                onClick={() =>
                  onSaveDepartment(department, { order: Math.max(1, department.order - 1) })
                }
                className="rounded-lg border border-wood-200 px-3 py-1.5 text-sm font-bold text-wood-700"
              >
                ↑ 순서 올리기
              </button>
              <button
                type="button"
                onClick={() => onSaveDepartment(department, { order: department.order + 1 })}
                className="rounded-lg border border-wood-200 px-3 py-1.5 text-sm font-bold text-wood-700"
              >
                ↓ 순서 내리기
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
