import { describe, expect, it } from 'vitest';
import { buildProxyChildRecords } from './proxyChildren';

describe('proxy child records', () => {
  it('builds member summaries and child documents for children without phones', () => {
    const result = buildProxyChildRecords({
      parentUid: 'parent-1',
      parentName: '부모',
      now: 123,
      children: [
        { name: '하준', grade: '유치부', usesPhone: 'no', groupId: 'love' },
        { name: '서윤', grade: '초1', usesPhone: 'yes', groupId: 'joy' },
      ],
    });

    expect(result.memberSummaries).toEqual([
      {
        id: 'proxy:parent-1:123-0',
        name: '하준',
        grade: '유치부',
        usesPhone: false,
        groupId: 'love',
      },
    ]);
    expect(result.childDocs).toEqual([
      {
        id: 'proxy:parent-1:123-0',
        data: {
          kind: 'proxy',
          displayName: '하준',
          department: '유치부',
          groupId: 'love',
          parentUids: ['parent-1'],
          linkedUid: null,
          visibility: 'family_and_teachers',
          createdBy: 'parent-1',
          parentName: '부모',
        },
      },
    ]);
  });

  it('trims names and skips blank proxy children', () => {
    const result = buildProxyChildRecords({
      parentUid: 'parent-1',
      now: 555,
      children: [
        { name: '  ', grade: '', usesPhone: 'no' },
        { name: ' 민준 ', grade: '', usesPhone: 'no' },
      ],
    });

    expect(result.memberSummaries.map((child) => child.name)).toEqual(['민준']);
    expect(result.childDocs[0].data.department).toBe('유초등부');
  });
});
