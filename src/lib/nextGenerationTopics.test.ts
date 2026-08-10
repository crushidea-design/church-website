import { describe, expect, it } from 'vitest';
import {
  NEXT_GENERATION_UNASSIGNED_TOPIC_ID,
  NextGenerationTopicOption,
  getDepartmentTopics,
  getNextGenerationTopicLabel,
  getNextGenerationTopicFolderOptions,
  inferNextGenerationTopicId,
  reconcileNextGenerationTopicId,
  resolveNextGenerationDepartmentSlug,
} from './nextGenerationTopics';

const catalog: NextGenerationTopicOption[] = [
  { id: 'lords-prayer', name: '주기도문', keywords: ['주기도문'], departmentSlug: 'elementary', order: 2 },
  { id: 'ten-commandments', name: '십계명', keywords: ['십계명'], departmentSlug: 'elementary', order: 1 },
  { id: 'retreat', name: '수련회', keywords: ['수련회'], departmentSlug: 'young-adults', order: 1 },
  { id: 'hidden', name: '숨긴 주제', keywords: [], departmentSlug: 'elementary', order: 3, isVisible: false },
  { id: 'shared', name: '공통 주제', keywords: ['공통'], order: 9 },
];

describe('next generation topic catalog', () => {
  it('keeps a department to its own topics plus the shared ones, in order', () => {
    expect(getDepartmentTopics(catalog, 'elementary').map((topic) => topic.id)).toEqual([
      'ten-commandments',
      'lords-prayer',
      'shared',
    ]);
    expect(getDepartmentTopics(catalog, 'young-adults').map((topic) => topic.id)).toEqual([
      'retreat',
      'shared',
    ]);
  });

  it('hides topics that are turned off in the CMS', () => {
    expect(getDepartmentTopics(catalog, 'elementary').map((topic) => topic.id)).not.toContain('hidden');
  });

  it('keeps a topic that the post was filed under', () => {
    expect(
      inferNextGenerationTopicId({ nextGenerationTopicId: 'lords-prayer' }, catalog)
    ).toBe('lords-prayer');
  });

  it('falls back to 기타 when the stored topic is no longer in the catalog', () => {
    expect(
      inferNextGenerationTopicId({ nextGenerationTopicId: 'deleted-topic' }, catalog)
    ).toBe(NEXT_GENERATION_UNASSIGNED_TOPIC_ID);
  });

  it('infers the topic from the title when none was chosen', () => {
    expect(
      inferNextGenerationTopicId({ title: '주기도문 첫 번째 간구', content: '' }, catalog)
    ).toBe('lords-prayer');
  });

  it('labels topics from the catalog it is given', () => {
    expect(getNextGenerationTopicLabel('retreat', catalog)).toBe('수련회');
    expect(getNextGenerationTopicLabel(NEXT_GENERATION_UNASSIGNED_TOPIC_ID, catalog)).toBe('기타');
    expect(getNextGenerationTopicLabel('deleted-topic', catalog)).toBe('기타');
  });

  it('shows the 기타 folder when every post is unassigned', () => {
    expect(
      getNextGenerationTopicFolderOptions(
        [NEXT_GENERATION_UNASSIGNED_TOPIC_ID, NEXT_GENERATION_UNASSIGNED_TOPIC_ID],
        getDepartmentTopics(catalog, 'elementary')
      ).map((topic) => topic.id)
    ).toEqual([NEXT_GENERATION_UNASSIGNED_TOPIC_ID]);
  });

  it('keeps the department catalog as the empty-post fallback', () => {
    expect(
      getNextGenerationTopicFolderOptions([], getDepartmentTopics(catalog, 'elementary')).map((topic) => topic.id)
    ).toEqual(['ten-commandments', 'lords-prayer', 'shared']);
  });

  it('keeps a stored custom topic while the live catalog is loading', () => {
    expect(
      reconcileNextGenerationTopicId(
        'custom-topic',
        { title: '사도신경', content: '' },
        getDepartmentTopics(catalog, 'elementary'),
        true
      )
    ).toBe('custom-topic');
  });

  it('resolves a legacy post department from its CMS tab', () => {
    expect(
      resolveNextGenerationDepartmentSlug('', 'retreat_materials', [
        { slug: 'elementary_script', departmentSlug: 'elementary' },
        { slug: 'retreat_materials', departmentSlug: 'young-adults' },
      ])
    ).toBe('young-adults');
  });
});
