import React, { useState, useEffect, useRef } from 'react';
import { Terminal, X, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';

interface LogEntry {
  id: number;
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: string;
}

export default function DebugConsole() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    const addLog = (type: LogEntry['type'], ...args: any[]) => {
      const message = args
        .map(arg => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg, null, 2);
            } catch (e) {
              return String(arg);
            }
          }
          return String(arg);
        })
        .join(' ');

      setLogs(prev => [
        ...prev.slice(-49), // Keep last 50 logs
        {
          id: Date.now() + Math.random(),
          type,
          message,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    };

    console.log = (...args) => {
      originalLog(...args);
      addLog('log', ...args);
    };
    console.error = (...args) => {
      originalError(...args);
      addLog('error', ...args);
    };
    console.warn = (...args) => {
      originalWarn(...args);
      addLog('warn', ...args);
    };
    console.info = (...args) => {
      originalInfo(...args);
      addLog('info', ...args);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.info = originalInfo;
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current && !isMinimized) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isMinimized]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-wood-900 text-white p-3 rounded-full shadow-lg z-[9999] hover:bg-wood-800 transition"
        title="디버그 콘솔 열기"
      >
        <Terminal size={20} />
      </button>
    );
  }

  return (
    <div 
      className={`fixed bottom-0 right-0 left-0 md:left-auto md:right-4 md:bottom-4 md:w-96 bg-black/90 text-white shadow-2xl z-[9999] transition-all duration-300 rounded-t-xl md:rounded-xl overflow-hidden border border-white/10 ${
        isMinimized ? 'h-12' : 'h-80'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-2">
          <Terminal size={16} className="text-gold-400" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider">Debug Console</span>
          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px]">{logs.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setLogs([])}
            className="p-1.5 hover:bg-white/10 rounded transition text-white/60 hover:text-white"
            title="로그 지우기"
          >
            <Trash2 size={14} />
          </button>
          <button 
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-white/10 rounded transition text-white/60 hover:text-white"
          >
            {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-white/10 rounded transition text-white/60 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Log Content */}
      {!isMinimized && (
        <div 
          ref={scrollRef}
          className="p-4 h-[calc(100%-48px)] overflow-y-auto font-mono text-[11px] space-y-2 scrollbar-thin scrollbar-thumb-white/20"
        >
          {logs.length === 0 ? (
            <div className="text-white/30 italic text-center py-8">No logs yet...</div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="border-b border-white/5 pb-1 last:border-0">
                <div className="flex gap-2 items-start">
                  <span className="text-white/40 shrink-0">[{log.timestamp}]</span>
                  <span className={`shrink-0 font-bold ${
                    log.type === 'error' ? 'text-red-400' : 
                    log.type === 'warn' ? 'text-yellow-400' : 
                    log.type === 'info' ? 'text-blue-400' : 'text-green-400'
                  }`}>
                    {log.type.toUpperCase()}:
                  </span>
                  <pre className="whitespace-pre-wrap break-all flex-1 text-white/90">
                    {log.message}
                  </pre>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
