import { FirebaseStorage, getDownloadURL, ref, uploadBytes } from 'firebase/storage';

export type MaterialAttachmentType = 'pdf' | 'presentation';

export interface MaterialAttachment {
  name: string;
  url: string;
  type: MaterialAttachmentType;
  contentType?: string;
  size?: number;
  storagePath?: string;
}

export const MATERIAL_FILE_ACCEPT =
  '.pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation';

export const MAX_MATERIAL_FILE_COUNT = 10;
export const MAX_MATERIAL_FILE_SIZE = 20 * 1024 * 1024;

const allowedExtensions = new Set(['pdf', 'ppt', 'pptx']);
const allowedContentTypes = new Set([
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const getExtension = (name = '') => {
  const lastPart = name.split('.').pop();
  return lastPart ? lastPart.toLowerCase() : '';
};

const getSafeStorageName = (name: string) => {
  return name.replace(/[\\/#?[\]@]/g, '_');
};

export const formatFileSize = (size?: number) => {
  if (!size) return '';
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
};

export const getMaterialAttachmentType = (name?: string, contentType?: string): MaterialAttachmentType => {
  const extension = getExtension(name);
  if (extension === 'ppt' || extension === 'pptx' || contentType?.includes('presentation')) {
    return 'presentation';
  }

  return 'pdf';
};

export const getMaterialAttachmentLabel = (attachment: Pick<MaterialAttachment, 'type'>) => {
  return attachment.type === 'presentation' ? 'PPT' : 'PDF';
};

export const validateMaterialFiles = (files: File[], existingCount = 0) => {
  if (files.length === 0) return null;

  if (existingCount + files.length > MAX_MATERIAL_FILE_COUNT) {
    return `자료 파일은 최대 ${MAX_MATERIAL_FILE_COUNT}개까지 올릴 수 있습니다.`;
  }

  const invalidFile = files.find((file) => {
    const extension = getExtension(file.name);
    return !allowedExtensions.has(extension) && !allowedContentTypes.has(file.type);
  });

  if (invalidFile) {
    return 'PDF, PPT, PPTX 파일만 업로드 가능합니다.';
  }

  const oversizedFile = files.find((file) => file.size > MAX_MATERIAL_FILE_SIZE);
  if (oversizedFile) {
    return `파일 크기는 개당 ${formatFileSize(MAX_MATERIAL_FILE_SIZE)}를 초과할 수 없습니다.`;
  }

  return null;
};

export const uploadMaterialFiles = async (
  storage: FirebaseStorage,
  files: File[],
  onProgress?: (progress: number) => void
) => {
  const attachments: MaterialAttachment[] = [];
  const total = files.length;

  for (let index = 0; index < total; index += 1) {
    const file = files[index];
    const progressBase = total > 0 ? (index / total) * 80 : 0;
    onProgress?.(Math.round(10 + progressBase));

    const storagePath = `materials/${Date.now()}_${index}_${getSafeStorageName(file.name)}`;
    const fileRef = ref(storage, storagePath);
    await uploadBytes(fileRef, file, { contentType: file.type || undefined });
    const url = await getDownloadURL(fileRef);

    attachments.push({
      name: file.name,
      url,
      type: getMaterialAttachmentType(file.name, file.type),
      contentType: file.type,
      size: file.size,
      storagePath,
    });

    onProgress?.(Math.round(10 + ((index + 1) / total) * 80));
  }

  return attachments;
};

export const getPostAttachments = (post: any): MaterialAttachment[] => {
  if (!post) return [];

  if (Array.isArray(post.attachments)) {
    return post.attachments
      .filter((attachment: any) => attachment?.url && attachment?.name)
      .map((attachment: any) => ({
        name: attachment.name,
        url: attachment.url,
        type: attachment.type === 'presentation' || attachment.type === 'ppt'
          ? 'presentation'
          : getMaterialAttachmentType(attachment.name, attachment.contentType),
        contentType: attachment.contentType,
        size: attachment.size,
        storagePath: attachment.storagePath,
      }));
  }

  if (post.pdfUrl) {
    return [
      {
        name: post.pdfName || 'document.pdf',
        url: post.pdfUrl,
        type: 'pdf',
        contentType: 'application/pdf',
      },
    ];
  }

  return [];
};

export const getFirstPdfAttachment = (attachments: MaterialAttachment[]) => {
  return attachments.find((attachment) => attachment.type === 'pdf');
};
