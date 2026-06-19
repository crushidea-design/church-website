import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./PdfCanvasViewer.tsx', import.meta.url), 'utf8');

describe('PdfCanvasViewer layout', () => {
  it('lets zoomed pages grow wider than the viewer and scroll horizontally', () => {
    expect(source).toContain('overflow-auto');
    expect(source).toContain('max-w-none');
    expect(source).not.toContain('md:max-w-full');
  });
});
