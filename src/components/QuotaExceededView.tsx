import React from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

export default function QuotaExceededView() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-wood-50 p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 text-center border border-wood-200">
        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-8 border border-amber-100">
          <ShieldAlert className="text-amber-600" size={40} />
        </div>
        
        <h2 className="text-2xl font-serif font-bold text-wood-900 mb-4">
          일일 데이터 사용량 초과
        </h2>
        
        <p className="text-wood-600 mb-8 leading-relaxed">
          현재 홈페이지 방문자가 많아 Firestore 무료 할당량(일일 5만 건 조회)을 모두 사용했습니다. 
          <br /><br />
          데이터베이스 할당량은 <strong>매일 오후 4시(한국 표준시)</strong>에 자동으로 초기화됩니다. 
          <br /><br />
          불편을 드려 죄송합니다. 잠시 후 또는 내일 다시 방문해 주시면 감사하겠습니다.
        </p>
        
        <div className="space-y-4">
          <button
            className="w-full py-3 bg-wood-900 text-white rounded-xl hover:bg-wood-800 transition shadow-md font-bold flex items-center justify-center gap-2"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={18} />
            새로고침하여 다시 시도
          </button>
          
          <p className="text-xs text-wood-400">
            관리자라면 관리자 페이지에서 플래그를 초기화할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
