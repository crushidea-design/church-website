import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Extract every page's text from a PDF File and concatenate it.
 * Returns plain text suitable for sending to the AI card generator.
 *
 * Works only with text-layer PDFs (Word/Docs export, etc.). Scanned-image
 * PDFs without OCR will return empty/short text — caller should warn.
 */
export async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pageTexts.push(pageText);
  }
  return pageTexts.join('\n\n').trim();
}
