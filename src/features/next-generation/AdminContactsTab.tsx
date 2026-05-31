// Contacts tab body extracted from NextGenerationAdmin.tsx.
import React from 'react';
import { ChevronDown, ChevronUp, Mail, Trash2 } from 'lucide-react';
import { ContactItem, formatAdminDate as formatDate } from './adminHelpers';

export default function AdminContactsTab({
  contacts,
  expandedId,
  onToggleExpand,
  onMarkRead,
  onDelete,
}: {
  contacts: ContactItem[];
  expandedId: string | null;
  onToggleExpand: (id: string | null) => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {contacts.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Mail size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">등록된 문의가 없습니다.</p>
        </div>
      )}
      {contacts.map((item) => {
        const isExpanded = expandedId === item.id;
        return (
          <div
            key={item.id}
            className={`border rounded-lg overflow-hidden ${!item.isRead ? 'border-amber-300' : 'border-gray-200'}`}
          >
            <button
              onClick={() => {
                onToggleExpand(isExpanded ? null : item.id);
                if (!item.isRead) onMarkRead(item.id);
              }}
              className="w-full flex items-start gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  {!item.isRead && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                      새 문의
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {item.name} · {item.email} · {formatDate(item.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 truncate">{item.message}</p>
              </div>
              {isExpanded ? (
                <ChevronUp size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
              ) : (
                <ChevronDown size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
              )}
            </button>

            {isExpanded && (
              <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-2">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">문의 내용</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.message}</p>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <a
                    href={`mailto:${item.email}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm rounded-lg transition-colors"
                  >
                    <Mail size={14} /> 이메일 답장
                  </a>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-lg transition-colors"
                  >
                    <Trash2 size={14} /> 삭제
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
