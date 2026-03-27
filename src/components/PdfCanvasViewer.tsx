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
      <div className="flex flex-col items-center justify-center h-96 bg-white rounded-2xl border border-wood-200">
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
    <div className="flex flex-col bg-white rounded-2xl border border-wood-200 overflow-hidden shadow-inner relative">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-wood-200">
        <div className="text-sm font-bold text-wood-900 bg-wood-100 px-4 py-1.5 rounded-full">
          {pageNum} / {numPages}
        </div>
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

      {/* Canvas Area with Navigation Overlays */}
      <div className="relative flex-1 bg-white min-h-[500px] flex flex-col">
        <div className="flex-1 overflow-auto p-0 flex justify-center">
          <canvas ref={canvasRef} className="max-w-full h-auto" />
        </div>

        {/* Left Navigation Overlay */}
        {pageNum > 1 && (
          <div 
            onClick={goToPrevPage}
            className="absolute left-0 top-0 bottom-0 w-1/3 md:w-1/4 cursor-pointer flex items-center justify-start px-4 md:px-8 opacity-0 hover:opacity-100 transition-opacity group"
          >
            <div className="bg-black/30 text-white rounded-full p-3 backdrop-blur-sm shadow-lg transform scale-90 group-hover:scale-100 transition-all">
              <ChevronLeft size={36} />
            </div>
          </div>
        )}

        {/* Right Navigation Overlay */}
        {pageNum < numPages && (
          <div 
            onClick={goToNextPage}
            className="absolute right-0 top-0 bottom-0 w-1/3 md:w-1/4 cursor-pointer flex items-center justify-end px-4 md:px-8 opacity-0 hover:opacity-100 transition-opacity group"
          >
            <div className="bg-black/30 text-white rounded-full p-3 backdrop-blur-sm shadow-lg transform scale-90 group-hover:scale-100 transition-all">
              <ChevronRight size={36} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
