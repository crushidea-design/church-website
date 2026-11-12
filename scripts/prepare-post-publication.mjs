import { pathToFileURL } from 'node:url';

const project = 'gen-lang-client-0036445484';
const database = 'ai-studio-718ae15e-9471-4be1-ad56-c48181aa8613';
const root = `https://firestore.googleapis.com/v1/projects/${project}/databases/${database}/documents`;

// Read only by default. Preserve explicit draft/published values and concurrent edits.
// No post IDs, titles, bodies, authors or credentials are printed or saved.
export async function preparePostPublication(token, { apply = false, request = fetch } = {}) {
  if (!token) throw new Error('GOOGLE_ACCESS_TOKEN is required.');
  async function post(url, body) {
    const response = await request(url, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Publication preparation failed (${response.status}); no automatic retry.`);
    return response.json();
  }
  const counts = { scanned: 0, missing: 0, published: 0, draft: 0, invalid: 0, updated: 0 };
  let cursor;
  for (;;) {
    const results = await post(`${root}:runQuery`, { structuredQuery: {
      from: [{ collectionId: 'posts' }], select: { fields: [{ fieldPath: 'isPublished' }] },
      orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }], limit: 250,
      ...(cursor ? { startAt: { values: [{ referenceValue: cursor }], before: false } } : {}),
    } });
    const docs = results.filter(row => row.document).map(row => row.document);
    const writes = [];
    for (const doc of docs) {
      counts.scanned++;
      const value = doc.fields?.isPublished;
      if (value === undefined) {
        counts.missing++;
        if (!doc.updateTime) throw new Error('Missing document precondition.');
        writes.push({ update: { name: doc.name, fields: { isPublished: { booleanValue: true } } },
          updateMask: { fieldPaths: ['isPublished'] }, currentDocument: { updateTime: doc.updateTime } });
      } else if (value.booleanValue === true) counts.published++;
      else if (value.booleanValue === false) counts.draft++;
      else counts.invalid++;
    }
    if (apply && writes.length) {
      await post(`${root}:commit`, { writes });
      counts.updated += writes.length;
    }
    if (docs.length < 250) return counts;
    cursor = docs.at(-1).name;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--apply')) throw new Error('Only --apply is supported; omit it for a read-only audit.');
  preparePostPublication(process.env.GOOGLE_ACCESS_TOKEN, { apply: args.includes('--apply') })
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
