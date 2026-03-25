import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut } from 'lucide-react';

// Set worker source from CDN for better compatibility
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfCanvasViewerProps {
  url: string;
  onDownload?: () => void;
}

export default function PdfCanvasViewer({ url, onDownload }: PdfCanvasViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdfDoc = await loadingTask.promise;
        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);
        setPageNum(1);
      } catch (err: any) {
        console.error('Error loading PDF:', err);
        setError('PDF를 불러오는 중 오류가 발생했습니다. 브라우저 보안 설정이나 파일 형식을 확인해 주세요.');
      } finally {
        setLoading(false);
      }
    };

    if (url) {
      loadPdf();
    }
  }, [url]);

  useEffect(() => {
    let renderTask: any = null;

    const renderPage = async () => {
      if (!pdf || !canvasRef.current) return;

      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        // Cancel previous render task if it exists
        if (renderTask) {
          renderTask.cancel();
        }

        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (err: any) {
        if (err.name === 'RenderingCancelledException') {
          // Ignore cancellation errors
          return;
        }
        console.error('Error rendering page:', err);
      }
    };

    renderPage();

    return () => {
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdf, pageNum, scale]);

  const goToPrevPage = () => setPageNum(prev => Math.max(prev - 1, 1));
  const goToNextPage = () => setPageNum(prev => Math.min(prev + 1, numPages));
  const zoomIn = () => setScale(prev => Math.min(prev + 0.5, 3));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.5, 0.5));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-wood-50 rounded-2xl border border-wood-200">
        <Loader2 className="animate-spin text-wood-900 mb-4" size={32} />
        <p className="text-wood-600">문서를 렌더링하는 중입니다...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-red-50 rounded-2xl border border-red-200 p-8 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button 
          onClick={onDownload}
          className="px-4 py-2 bg-red-600 text-white rounded-full text-sm font-medium hover:bg-red-700 transition"
        >
          파일 직접 다운로드하기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-wood-50 rounded-2xl border border-wood-200 overflow-hidden shadow-inner">
      {/* Top Toolbar - Zoom only */}
      <div className="flex items-center justify-end p-4 bg-white border-b border-wood-200">
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            className="p-2 hover:bg-wood-100 rounded-full transition"
            title="축소"
          >
            <ZoomOut size={20} />
          </button>
          <button
            onClick={zoomIn}
            className="p-2 hover:bg-wood-100 rounded-full transition"
            title="확대"
          >
            <ZoomIn size={20} />
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-auto p-8 flex justify-center bg-wood-200/30 min-h-[500px]">
        <canvas ref={canvasRef} className="shadow-2xl bg-white max-w-full h-auto" />
      </div>

      {/* Bottom Toolbar - Navigation */}
      <div className="flex items-center justify-center p-4 bg-white border-t border-wood-200 gap-6">
        <button
          onClick={goToPrevPage}
          disabled={pageNum <= 1}
          className="flex items-center gap-2 px-4 py-2 bg-wood-50 hover:bg-wood-100 text-wood-900 rounded-full disabled:opacity-30 transition border border-wood-200 font-medium"
        >
          <ChevronLeft size={20} />
          이전 페이지
        </button>
        
        <span className="text-sm font-bold text-wood-900 bg-wood-100 px-4 py-2 rounded-full">
          {pageNum} / {numPages}
        </span>
        
        <button
          onClick={goToNextPage}
          disabled={pageNum >= numPages}
          className="flex items-center gap-2 px-4 py-2 bg-wood-900 hover:bg-wood-800 text-white rounded-full disabled:opacity-30 transition font-medium"
        >
          다음 페이지
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
