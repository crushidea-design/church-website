// Intro sections tab body extracted from AdminNextGenerationCms.tsx.
import React from 'react';
import { Plus } from 'lucide-react';
import {
  NextGenerationDepartment,
  NextGenerationIntroSection,
} from '../../lib/nextGenerationCms';

export default function CmsIntroTab({
  departments,
  introSections,
  newIntroDepartmentSlug,
  newIntroType,
  newIntroTitle,
  newIntroParagraphs,
  newIntroHighlights,
  newIntroGallery,
  onNewDepartmentSlug,
  onNewType,
  onNewTitle,
  onNewParagraphs,
  onNewHighlights,
  onNewGallery,
  onAddSection,
  onSaveSection,
  onDeleteSection,
  parseLines,
  parseGalleryLines,
}: {
  departments: NextGenerationDepartment[];
  introSections: NextGenerationIntroSection[];
  newIntroDepartmentSlug: string;
  newIntroType: NextGenerationIntroSection['sectionType'];
  newIntroTitle: string;
  newIntroParagraphs: string;
  newIntroHighlights: string;
  newIntroGallery: string;
  onNewDepartmentSlug: (value: string) => void;
  onNewType: (value: NextGenerationIntroSection['sectionType']) => void;
  onNewTitle: (value: string) => void;
  onNewParagraphs: (value: string) => void;
  onNewHighlights: (value: string) => void;
  onNewGallery: (value: string) => void;
  onAddSection: () => void;
  onSaveSection: (section: NextGenerationIntroSection, patch: Partial<NextGenerationIntroSection>) => void;
  onDeleteSection: (sectionId: string) => void;
  parseLines: (value: string) => string[];
  parseGalleryLines: (value: string) => { src: string; alt: string }[];
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-wood-200 bg-white p-5">
        <h3 className="text-lg font-bold text-wood-900">소개 섹션 추가</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <select
            value={newIntroDepartmentSlug}
            onChange={(e) => onNewDepartmentSlug(e.target.value)}
            className="rounded-lg border border-wood-300 px-3 py-2"
          >
            {departments.map((department) => (
              <option key={department.slug} value={department.slug}>
                {department.name}
              </option>
            ))}
          </select>
          <select
            value={newIntroType}
            onChange={(e) => onNewType(e.target.value as NextGenerationIntroSection['sectionType'])}
            className="rounded-lg border border-wood-300 px-3 py-2"
          >
            <option value="text">text</option>
            <option value="highlights">highlights</option>
            <option value="gallery">gallery</option>
          </select>
          <input
            value={newIntroTitle}
            onChange={(e) => onNewTitle(e.target.value)}
            placeholder="섹션 제목"
            className="rounded-lg border border-wood-300 px-3 py-2 md:col-span-2"
          />
          <textarea
            value={newIntroParagraphs}
            onChange={(e) => onNewParagraphs(e.target.value)}
            rows={4}
            placeholder="문단(줄바꿈으로 구분)"
            className="rounded-lg border border-wood-300 px-3 py-2"
          />
          <textarea
            value={newIntroHighlights}
            onChange={(e) => onNewHighlights(e.target.value)}
            rows={4}
            placeholder="하이라이트(줄바꿈으로 구분)"
            className="rounded-lg border border-wood-300 px-3 py-2"
          />
          <textarea
            value={newIntroGallery}
            onChange={(e) => onNewGallery(e.target.value)}
            rows={4}
            placeholder="갤러리: 이미지경로|설명 (줄바꿈)"
            className="rounded-lg border border-wood-300 px-3 py-2 md:col-span-2"
          />
          <button
            type="button"
            onClick={onAddSection}
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
                      onBlur={(e) => onSaveSection(section, { title: e.target.value })}
                      className="rounded-lg border border-wood-300 px-3 py-2"
                      placeholder="섹션 제목"
                    />
                    <select
                      defaultValue={section.sectionType}
                      onChange={(e) =>
                        onSaveSection(section, {
                          sectionType: e.target.value as NextGenerationIntroSection['sectionType'],
                        })
                      }
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
                      onBlur={(e) =>
                        onSaveSection(section, {
                          order: Math.max(1, Number(e.target.value) || section.order),
                        })
                      }
                      className="rounded-lg border border-wood-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <textarea
                    defaultValue={section.paragraphs.join('\n')}
                    onBlur={(e) => onSaveSection(section, { paragraphs: parseLines(e.target.value) })}
                    className="w-full rounded-lg border border-wood-300 px-3 py-2"
                    rows={3}
                    placeholder="문단 (줄바꿈으로 구분)"
                  />
                  <textarea
                    defaultValue={section.highlights.join('\n')}
                    onBlur={(e) => onSaveSection(section, { highlights: parseLines(e.target.value) })}
                    className="w-full rounded-lg border border-wood-300 px-3 py-2"
                    rows={2}
                    placeholder="하이라이트 (줄바꿈으로 구분)"
                  />
                  <textarea
                    defaultValue={section.gallery.map((item) => `${item.src}|${item.alt}`).join('\n')}
                    onBlur={(e) => onSaveSection(section, { gallery: parseGalleryLines(e.target.value) })}
                    className="w-full rounded-lg border border-wood-300 px-3 py-2"
                    rows={2}
                    placeholder="갤러리: 이미지경로|설명 (줄바꿈)"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onSaveSection(section, { isVisible: !section.isVisible })}
                      className="rounded-lg border border-wood-200 px-2.5 py-1 text-xs font-bold text-wood-700"
                    >
                      {section.isVisible ? '노출' : '숨김'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSaveSection(section, { order: Math.max(1, section.order - 1) })}
                      className="rounded-lg border border-wood-200 px-2.5 py-1 text-xs font-bold text-wood-700"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => onSaveSection(section, { order: section.order + 1 })}
                      className="rounded-lg border border-wood-200 px-2.5 py-1 text-xs font-bold text-wood-700"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSection(section.id)}
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
  );
}
