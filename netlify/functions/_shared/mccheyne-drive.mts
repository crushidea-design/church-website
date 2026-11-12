import { GoogleAuth, Impersonated } from 'google-auth-library';
import { APPROVED_FOLDER, APPROVED_FOLDER_YEARS, SOURCE_FOLDER, SyncError, approvedLocation, assertApprovedFile, extractSnapshot, type FileMeta, type SourceReader } from './mccheyne-sync-core.mjs';
import { evaluateApprovalMoves, type ApprovalDiagnostics } from './mccheyne-move-evidence.mjs';

const FIELDS = 'id,name,mimeType,parents,version,modifiedTime,trashed';
const READ_SCOPES = ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/documents.readonly', 'https://www.googleapis.com/auth/drive.activity.readonly'];
export type ReadRequest = (url: string, body?: unknown) => Promise<any>;

/** Uses runtime identity to impersonate a dedicated, folder-only reader. No private key or publish key. */
export function googleReadRequest(): ReadRequest {
  let client: Promise<Impersonated> | undefined;
  return async (url, body) => {
    const target = process.env.MCCHEYNE_DRIVE_SERVICE_ACCOUNT ?? '';
    if (!/^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(target)) throw new SyncError('DRIVE_NOT_CONFIGURED', false, true);
    client ??= (async () => new Impersonated({
      sourceClient: await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient(),
      targetPrincipal: target, targetScopes: READ_SCOPES, lifetime: 600,
    }))();
    try {
      const response = await (await client).request({ url, method: body ? 'POST' : 'GET', ...(body ? { data: body } : {}), timeout: 15_000, retry: false });
      return response.data;
    } catch (error) {
      // Never propagate gaxios errors: they may contain authorization headers and document bodies.
      const status = Number((error as { response?: { status?: number } }).response?.status);
      if ([401, 403].includes(status)) throw new SyncError('DRIVE_AUTH_REQUIRED', false, true);
      if (status === 404) throw new SyncError('SOURCE_UNAVAILABLE');
      throw new SyncError('DRIVE_TEMPORARY_ERROR', !status || status === 429 || status >= 500);
    }
  };
}

export function createDriveReader(request: ReadRequest = googleReadRequest(), diagnoseApproval?: (report: ApprovalDiagnostics) => void): SourceReader {
  const metadata = async (id: string): Promise<FileMeta> => {
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(id)) throw new SyncError('INVALID_ID');
    return request(`https://www.googleapis.com/drive/v3/files/${id}?fields=${FIELDS}`);
  };
  const checkFolder = async (id: string, parent: string) => {
    const folder = await metadata(id);
    if (!folder || typeof folder !== 'object' || Array.isArray(folder) || folder.id !== id ||
      folder.mimeType !== 'application/vnd.google-apps.folder' ||
      (Object.hasOwn(folder, 'trashed') && folder.trashed !== false)) throw new SyncError('APPROVAL_FOLDER_CHANGED', false, true);
    // The explicitly approved root ID is the trust boundary. A folder-only Reader
    // may receive no parents field for this root; that does not authorize reading
    // its outer parent. Only a genuinely absent field gets this exception.
    if (id === APPROVED_FOLDER && parent === SOURCE_FOLDER && !Object.hasOwn(folder, 'parents')) return;
    // Visible parent information remains binding. Year folders never get the exception.
    if (!Array.isArray(folder.parents) || folder.parents.length !== 1 || folder.parents[0] !== parent) throw new SyncError('APPROVAL_FOLDER_CHANGED', false, true);
  };
  const checkScope = async (meta: FileMeta) => {
    assertApprovedFile(meta);
    await checkFolder(APPROVED_FOLDER, SOURCE_FOLDER);
    const { folderId } = approvedLocation(meta);
    if (folderId !== APPROVED_FOLDER) await checkFolder(folderId, APPROVED_FOLDER);
  };
  return {
    async list() {
      await checkFolder(APPROVED_FOLDER, SOURCE_FOLDER);
      const files: FileMeta[] = [];
      for (const folderId of Object.keys(APPROVED_FOLDER_YEARS)) {
        if (folderId !== APPROVED_FOLDER) await checkFolder(folderId, APPROVED_FOLDER);
        let token = '';
        do {
          const params = new URLSearchParams({ q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`, pageSize: '100', fields: `nextPageToken,incompleteSearch,files(${FIELDS})`, orderBy: 'name', ...(token ? { pageToken: token } : {}) });
          const page = await request(`https://www.googleapis.com/drive/v3/files?${params}`);
          if (page.incompleteSearch) throw new SyncError('INCOMPLETE_DRIVE_LIST', false, true);
          // Do not recurse into folders or follow shortcut targets.
          for (const file of page.files || []) {
            if (file.mimeType === 'application/vnd.google-apps.folder') continue;
            if (!Array.isArray(file.parents) || file.parents.length !== 1 || file.parents[0] !== folderId) throw new SyncError('APPROVAL_FOLDER_CHANGED', false, true);
            files.push(file);
          }
          token = page.nextPageToken || '';
          if (files.length > 1000) throw new SyncError('FOLDER_LIMIT_REQUIRES_REVIEW', false, true);
        } while (token);
      }
      return files;
    },
    async snapshot(id) {
      const before = await metadata(id); await checkScope(before);
      const document = await request(`https://docs.googleapis.com/v1/documents/${id}?includeTabsContent=true&suggestionsViewMode=PREVIEW_WITHOUT_SUGGESTIONS`);
      const after = await metadata(id); await checkScope(after);
      if (before.version !== after.version || before.modifiedTime !== after.modifiedTime || approvedLocation(before).folderId !== approvedLocation(after).folderId) throw new SyncError('SOURCE_CHANGED');
      return extractSnapshot(after, document);
    },
    async unchanged(meta) {
      const current = await metadata(meta.id); await checkScope(current);
      return current.version === meta.version && current.modifiedTime === meta.modifiedTime && approvedLocation(current).folderId === approvedLocation(meta).folderId;
    },
    async approvedMove(meta) {
      // An observed folder membership is NOT evidence of the content version approved by a human.
      // Require a precise move by the configured approver and no later content edit; otherwise admin snapshot approval.
      const { folderId } = approvedLocation(meta);
      const approver = process.env.MCCHEYNE_APPROVER_PERSON;
      if (!approver || !/^people\/[A-Za-z0-9_-]+$/.test(approver)) throw new SyncError('APPROVER_NOT_CONFIGURED', false, true);
      let token = '';
      const pages: unknown[] = [];
      const finish = (complete: boolean) => {
        const report = evaluateApprovalMoves(pages, { documentId: meta.id, folderId, approver, modifiedTime: meta.modifiedTime, complete });
        // Diagnostics are optional and must never affect authorization or expose raw responses.
        try { diagnoseApproval?.({ ...report }); } catch { /* Preserve the evidence decision. */ }
        return report.approved;
      };
      for (let page = 0; page < 5; page++) {
        const activity = await request('https://driveactivity.googleapis.com/v2/activity:query', {
          itemName: `items/${meta.id}`, pageSize: 100, consolidationStrategy: { none: {} },
          filter: 'detail.action_detail_case:MOVE', ...(token ? { pageToken: token } : {}),
        });
        pages.push(activity);
        if (!activity || typeof activity !== 'object' || Array.isArray(activity) ||
          (Object.hasOwn(activity, 'nextPageToken') && typeof activity.nextPageToken !== 'string')) return finish(false);
        token = activity.nextPageToken || '';
        if (!token) return finish(true);
      }
      return finish(false); // incomplete evidence never approves
    },
  };
}
