import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: ''
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let displayMessage = this.state.errorMessage;
      let isQuotaError = false;

      try {
        const parsedError = JSON.parse(this.state.errorMessage);
        if (parsedError.error && parsedError.error.includes('Quota limit exceeded')) {
          isQuotaError = true;
          displayMessage = 'Firestore 무료 할당량을 모두 사용했습니다. 내일 다시 초기화됩니다. (Free daily read units exceeded)';
        } else if (parsedError.error) {
          displayMessage = parsedError.error;
        }
      } catch (e) {
        // Not a JSON error string
        if (this.state.errorMessage.includes('Quota limit exceeded')) {
          isQuotaError = true;
          displayMessage = 'Firestore 무료 할당량을 모두 사용했습니다. 내일 다시 초기화됩니다.';
        }
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-wood-50 p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border border-wood-200">
            <h2 className={`text-2xl font-bold ${isQuotaError ? 'text-wood-900' : 'text-red-600'} mb-4 font-serif`}>
              {isQuotaError ? '알림' : '오류가 발생했습니다'}
            </h2>
            <p className="text-wood-600 mb-6">
              {isQuotaError 
                ? '현재 접속자가 많아 일일 무료 데이터 조회 한도를 초과했습니다. 서비스 이용에 불편을 드려 죄송합니다.'
                : '요청하신 작업을 처리하는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'}
            </p>
            <div className="bg-wood-100 p-4 rounded text-left text-sm text-wood-800 overflow-auto max-h-40 border border-wood-200">
              <code>{displayMessage}</code>
            </div>
            <button
              className="mt-6 px-4 py-2 bg-wood-900 text-white rounded-full hover:bg-wood-800 transition shadow-md"
              onClick={() => window.location.reload()}
            >
              새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
