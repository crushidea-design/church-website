import { describe, expect, it } from 'vitest';
import {
  getFirstPdfAttachment,
  getMaterialAttachmentLabel,
  getMaterialAttachmentType,
  getPostAttachments,
  serializeMaterialAttachments,
  validateMaterialFiles,
} from './attachments';

describe('material attachment compatibility', () => {
  it('round-trips multiple material attachments through the legacy pdfBase64 field', () => {
    const attachments = [
      { name: 'guide.pdf', url: 'https://example.com/guide.pdf', type: 'pdf' as const, contentType: 'application/pdf', size: 2048 },
      {
        name: 'slides.pptx',
        url: 'https://example.com/slides.pptx',
        type: 'presentation' as const,
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        size: 4096,
      },
    ];

    const restored = getPostAttachments({ pdfBase64: serializeMaterialAttachments(attachments) });

    expect(restored).toEqual(attachments);
    expect(getFirstPdfAttachment(restored)?.name).toBe('guide.pdf');
  });

  it('normalizes direct attachments and legacy single-pdf posts', () => {
    expect(getPostAttachments({ attachments: [{ name: 'deck.ppt', url: '/deck.ppt', type: 'ppt' }] })).toEqual([
      { name: 'deck.ppt', url: '/deck.ppt', type: 'presentation', contentType: undefined, size: undefined, storagePath: undefined },
    ]);

    expect(getPostAttachments({ pdfUrl: '/legacy.pdf', pdfName: 'legacy.pdf' })).toEqual([
      { name: 'legacy.pdf', url: '/legacy.pdf', type: 'pdf', contentType: 'application/pdf' },
    ]);
  });

  it('rejects unsupported file types and labels supported types', () => {
    const invalid = new File(['x'], 'notes.txt', { type: 'text/plain' });

    expect(validateMaterialFiles([invalid])).toContain('PDF');
    expect(getMaterialAttachmentType('slides.pptx')).toBe('presentation');
    expect(getMaterialAttachmentLabel({ type: 'presentation' })).toBe('PPT');
  });
});
