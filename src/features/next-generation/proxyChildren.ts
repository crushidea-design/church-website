export interface ProxyChildDraftInput {
  name: string;
  grade?: string;
  usesPhone: 'yes' | 'no' | null;
  groupId?: string;
}

export interface ProxyChildSummary {
  id: string;
  name: string;
  grade?: string;
  usesPhone: false;
  groupId?: string;
}

export interface ProxyChildDocumentData {
  kind: 'proxy';
  displayName: string;
  department: '유치부' | '유초등부';
  groupId: string;
  parentUids: string[];
  linkedUid: null;
  visibility: 'family_and_teachers';
  createdBy: string;
  parentName?: string;
}

export function inferProxyChildDepartment(grade?: string): '유치부' | '유초등부' {
  const label = (grade || '').trim();
  return label.includes('유치') || label.includes('유아') || label.includes('유년 전') ? '유치부' : '유초등부';
}

export function buildProxyChildRecords({
  parentUid,
  parentName,
  now = Date.now(),
  children,
}: {
  parentUid: string;
  parentName?: string;
  now?: number;
  children: ProxyChildDraftInput[];
}) {
  const records = children
    .map((child, originalIndex) => ({ child, originalIndex }))
    .filter(({ child }) => child.usesPhone === 'no' && child.name.trim().length > 0)
    .map(({ child, originalIndex }) => {
      const id = `proxy:${parentUid}:${now}-${originalIndex}`;
      const name = child.name.trim();
      const grade = child.grade?.trim() || undefined;
      const groupId = child.groupId?.trim() || '';
      const summary: ProxyChildSummary = {
        id,
        name,
        usesPhone: false,
        ...(grade ? { grade } : {}),
        ...(groupId ? { groupId } : {}),
      };
      const data: ProxyChildDocumentData = {
        kind: 'proxy',
        displayName: name,
        department: inferProxyChildDepartment(grade),
        groupId,
        parentUids: [parentUid],
        linkedUid: null,
        visibility: 'family_and_teachers',
        createdBy: parentUid,
        ...(parentName ? { parentName } : {}),
      };

      return { summary, childDoc: { id, data } };
    });

  return {
    memberSummaries: records.map((record) => record.summary),
    childDocs: records.map((record) => record.childDoc),
  };
}
