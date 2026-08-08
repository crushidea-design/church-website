// Topic catalog editor for the next-generation CMS. Topics group materials
// inside a tab that has "주제 폴더 사용" turned on.
import React from 'react';
import { Plus } from 'lucide-react';
import {
  NextGenerationDepartment,
  NextGenerationTopic,
  normalizeCmsSlug,
} from '../../lib/nextGenerationCms';

export const SHARED_TOPIC_DEPARTMENT_VALUE = '';

export default function CmsTopicsTab({
  busy,
  departments,
  topicGroups,
  newTopicName,
  newTopicSlug,
  newTopicDepartmentSlug,
  newTopicKeywords,
  onNewTopicName,
  onNewTopicSlug,
  onNewTopicDepartmentSlug,
  onNewTopicKeywords,
  onAddTopic,
  onSaveTopic,
  onDeleteTopic,
}: {
  busy: boolean;
  departments: NextGenerationDepartment[];
  topicGroups: { key: string; label: string; topics: NextGenerationTopic[] }[];
  newTopicName: string;
  newTopicSlug: string;
  newTopicDepartmentSlug: string;
  newTopicKeywords: string;
  onNewTopicName: (value: string) => void;
  onNewTopicSlug: (value: string) => void;
  onNewTopicDepartmentSlug: (value: string) => void;
  onNewTopicKeywords: (value: string) => void;
  onAddTopic: () => void;
  onSaveTopic: (topic: NextGenerationTopic, patch: Partial<NextGenerationTopic>) => void;
  onDeleteTopic: (topic: NextGenerationTopic) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-wood-200 bg-white p-5">
        <h3 className="text-lg font-bold text-wood-900">주제 추가</h3>
        <p className="mt-1 text-xs font-bold text-wood-500">
          주제는 '주제 폴더 사용'이 켜진 탭 안에서 자료를 묶는 폴더입니다. 글이 한 건도 없는 주제는 자료실 화면에 나타나지 않습니다.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            value={newTopicName}
            onChange={(e) => onNewTopicName(e.target.value)}
            placeholder="주제명 (예: 주기도문)"
            className="rounded-lg border border-wood-300 px-3 py-2"
          />
          <input
            value={newTopicSlug}
            onChange={(e) => onNewTopicSlug(normalizeCmsSlug(e.target.value))}
            placeholder="topic slug (예: lords-prayer)"
            className="rounded-lg border border-wood-300 px-3 py-2"
          />
          <select
            value={newTopicDepartmentSlug}
            onChange={(e) => onNewTopicDepartmentSlug(e.target.value)}
            className="rounded-lg border border-wood-300 px-3 py-2"
          >
            <option value={SHARED_TOPIC_DEPARTMENT_VALUE}>모든 부서 공통</option>
            {departments.map((department) => (
              <option key={department.slug} value={department.slug}>
                {department.name}
              </option>
            ))}
          </select>
          <input
            value={newTopicKeywords}
            onChange={(e) => onNewTopicKeywords(e.target.value)}
            placeholder="자동 분류 키워드 (쉼표로 구분)"
            className="rounded-lg border border-wood-300 px-3 py-2"
          />
          <button
            type="button"
            disabled={busy}
            onClick={onAddTopic}
            className="inline-flex items-center justify-center rounded-lg bg-wood-900 px-3 py-2 text-sm font-bold text-white md:col-span-2"
          >
            <Plus size={14} className="mr-1" />
            추가
          </button>
        </div>
      </div>

      {topicGroups.map((group) => (
        <div key={group.key} className="rounded-2xl border border-wood-200 bg-white p-5">
          <h4 className="font-bold text-wood-900">{group.label}</h4>
          {group.topics.length === 0 ? (
            <p className="mt-3 text-sm font-bold text-wood-500">등록된 주제가 없습니다.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {group.topics.map((topic) => (
                <div key={topic.slug} className="rounded-xl border border-wood-100 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <strong className="text-sm text-wood-900">{topic.name}</strong>
                    <span className="rounded-full bg-wood-100 px-2 py-0.5 text-[10px] font-bold text-wood-600">
                      {topic.slug}
                    </span>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="text-xs font-bold text-wood-700">
                      주제명
                      <input
                        defaultValue={topic.name}
                        onBlur={(e) => onSaveTopic(topic, { name: e.target.value.trim() || topic.name })}
                        className="mt-1 w-full rounded-lg border border-wood-300 px-3 py-2 text-sm font-normal"
                      />
                    </label>
                    <label className="text-xs font-bold text-wood-700">
                      소속 부서
                      <select
                        defaultValue={topic.departmentSlug}
                        onChange={(e) => onSaveTopic(topic, { departmentSlug: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-wood-300 px-3 py-2 text-sm font-normal"
                      >
                        <option value={SHARED_TOPIC_DEPARTMENT_VALUE}>모든 부서 공통</option>
                        {departments.map((department) => (
                          <option key={department.slug} value={department.slug}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-bold text-wood-700 md:col-span-2">
                      자동 분류 키워드 (쉼표로 구분)
                      <input
                        defaultValue={topic.keywords.join(', ')}
                        onBlur={(e) =>
                          onSaveTopic(topic, {
                            keywords: e.target.value
                              .split(',')
                              .map((keyword) => keyword.trim())
                              .filter(Boolean),
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-wood-300 px-3 py-2 text-sm font-normal"
                        placeholder="주제가 지정되지 않은 글은 이 낱말이 제목·본문에 있으면 이 주제로 분류됩니다"
                      />
                    </label>
                    <label className="text-xs font-bold text-wood-700">
                      순서 (order)
                      <input
                        type="number"
                        min={1}
                        defaultValue={topic.order}
                        onBlur={(e) =>
                          onSaveTopic(topic, { order: Math.max(1, Number(e.target.value) || topic.order) })
                        }
                        className="mt-1 w-full rounded-lg border border-wood-300 px-3 py-2 text-sm font-normal"
                      />
                    </label>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onSaveTopic(topic, { isVisible: !topic.isVisible })}
                      className="rounded-lg border border-wood-200 px-2.5 py-1 text-xs font-bold text-wood-700"
                    >
                      {topic.isVisible ? '노출' : '숨김'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSaveTopic(topic, { order: Math.max(1, topic.order - 1) })}
                      className="rounded-lg border border-wood-200 px-2.5 py-1 text-xs font-bold text-wood-700"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => onSaveTopic(topic, { order: topic.order + 1 })}
                      className="rounded-lg border border-wood-200 px-2.5 py-1 text-xs font-bold text-wood-700"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTopic(topic)}
                      className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-bold text-red-600"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
