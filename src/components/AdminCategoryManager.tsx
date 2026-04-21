import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ChevronUp, Edit2, Plus, Save, Trash2, X } from 'lucide-react';
import AdminLayout from './AdminLayout';

export interface AdminCategoryItem {
  id: string;
  name: string;
  order: number;
}

interface AdminCategoryManagerProps {
  title: string;
  description: string;
  badge: string;
  icon: React.ReactNode;
  categories: AdminCategoryItem[];
  loading: boolean;
  newCategoryName: string;
  onNewCategoryNameChange: (value: string) => void;
  onAddCategory: (event: React.FormEvent) => void | Promise<void>;
  onUpdateCategory: (id: string, name: string) => void | Promise<void>;
  onDeleteCategory: (id: string, name: string) => boolean | Promise<boolean>;
  onConfirmDelete: () => void | Promise<void>;
  onMoveCategory: (index: number, direction: 'up' | 'down') => void | Promise<void>;
  isAdding?: boolean;
  addPlaceholder: string;
  addTitle: string;
  listTitle: string;
  emptyMessage: string;
  deleteTitle: string;
  deleteDescription: string;
  helperText?: string;
  maxWidthClassName?: string;
}

export default function AdminCategoryManager({
  title,
  description,
  badge,
  icon,
  categories,
  loading,
  newCategoryName,
  onNewCategoryNameChange,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onConfirmDelete,
  onMoveCategory,
  isAdding = false,
  addPlaceholder,
  addTitle,
  listTitle,
  emptyMessage,
  deleteTitle,
  deleteDescription,
  helperText,
  maxWidthClassName = 'max-w-4xl',
}: AdminCategoryManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState('');

  const categoryCount = categories.length;
  const lastCategoryName = useMemo(
    () => (categories.length > 0 ? categories[categories.length - 1].name : '-'),
    [categories]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wood-50">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-wood-900" />
      </div>
    );
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      backTo="/admin"
      backLabel="관리자 대시보드"
      badge={badge}
      icon={icon}
      maxWidthClassName={maxWidthClassName}
      aside={
        <div className="grid min-w-[220px] gap-3">
          <div className="flex items-center justify-between gap-4">
            <span className="text-wood-500">카테고리 수</span>
            <strong className="text-wood-900">{categoryCount}</strong>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-wood-500">마지막 항목</span>
            <strong className="max-w-[130px] truncate text-wood-900">{lastCategoryName}</strong>
          </div>
        </div>
      }
    >
      <div className="space-y-8">
        <div className="rounded-[2rem] border border-wood-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-xl font-bold text-wood-900">{addTitle}</h2>
          <form onSubmit={onAddCategory} className="flex flex-col gap-4 sm:flex-row">
            <input
              type="text"
              value={newCategoryName}
              onChange={(event) => onNewCategoryNameChange(event.target.value)}
              placeholder={addPlaceholder}
              className="flex-grow rounded-xl border border-wood-300 bg-wood-50 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-wood-500 focus:ring-2 focus:ring-wood-500"
              required
            />
            <button
              type="submit"
              disabled={isAdding || !newCategoryName.trim()}
              className="inline-flex items-center justify-center rounded-xl bg-wood-900 px-6 py-3 font-medium text-white shadow-sm transition hover:bg-wood-800 disabled:opacity-50"
            >
              <Plus size={20} className="mr-2" />
              {isAdding ? '추가 중' : '추가하기'}
            </button>
          </form>
          {helperText && <p className="mt-4 text-sm leading-6 text-wood-500">{helperText}</p>}
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-wood-200 bg-white shadow-sm">
          <div className="border-b border-wood-100 bg-wood-50/60 p-6">
            <h2 className="font-bold text-wood-900">
              {listTitle} <span className="text-wood-500">({categoryCount})</span>
            </h2>
          </div>

          <div className="divide-y divide-wood-100">
            {categories.length === 0 ? (
              <div className="p-12 text-center text-wood-500">{emptyMessage}</div>
            ) : (
              categories.map((category, index) => (
                <div
                  key={category.id}
                  className="flex flex-col gap-4 p-6 transition hover:bg-wood-50/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => onMoveCategory(index, 'up')}
                        disabled={index === 0}
                        className="rounded-md p-1 text-wood-300 transition hover:text-wood-600 disabled:opacity-30"
                        aria-label="위로 이동"
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveCategory(index, 'down')}
                        disabled={index === categories.length - 1}
                        className="rounded-md p-1 text-wood-300 transition hover:text-wood-600 disabled:opacity-30"
                        aria-label="아래로 이동"
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>

                    {editingId === category.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        className="w-full rounded-lg border border-wood-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-wood-500 focus:ring-2 focus:ring-wood-500"
                        autoFocus
                      />
                    ) : (
                      <div className="min-w-0">
                        <p className="truncate text-lg font-medium text-wood-900">{category.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-wider text-wood-400">정렬 순서 {index + 1}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {editingId === category.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            void onUpdateCategory(category.id, editName);
                            setEditingId(null);
                            setEditName('');
                          }}
                          className="rounded-lg p-2 text-green-600 transition hover:bg-green-50"
                          title="저장"
                        >
                          <Save size={20} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditName('');
                          }}
                          className="rounded-lg p-2 text-wood-400 transition hover:bg-wood-100"
                          title="취소"
                        >
                          <X size={20} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(category.id);
                            setEditName(category.name);
                          }}
                          className="rounded-lg p-2 text-wood-400 transition hover:bg-wood-100 hover:text-wood-900"
                          title="이름 수정"
                        >
                          <Edit2 size={20} />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const canDelete = await onDeleteCategory(category.id, category.name);
                            if (!canDelete) return;
                            setDeletingId(category.id);
                            setDeletingName(category.name);
                          }}
                          className="rounded-full border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                        >
                          삭제
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <AnimatePresence>
          {deletingId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-red-100 bg-white p-10 shadow-2xl"
              >
                <div className="absolute left-0 top-0 h-2 w-full bg-red-500" />
                <div className="mb-6 flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
                    <Trash2 size={32} />
                  </div>
                </div>
                <h3 className="mb-4 text-center text-2xl font-serif font-bold text-wood-900">{deleteTitle}</h3>
                <p className="mb-8 text-center leading-relaxed text-wood-600">
                  <span className="font-bold text-red-600">{deletingName}</span> 카테고리를 정말 삭제하시겠습니까?
                  <br />
                  <span className="mt-2 block text-sm font-medium text-red-500">{deleteDescription}</span>
                </p>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setDeletingId(null);
                      setDeletingName('');
                    }}
                    className="flex-1 rounded-2xl border border-wood-200 px-6 py-4 font-bold text-wood-600 transition hover:bg-wood-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await onConfirmDelete();
                      setDeletingId(null);
                      setDeletingName('');
                    }}
                    className="flex-1 rounded-2xl bg-red-600 px-6 py-4 font-bold text-white shadow-lg shadow-red-200 transition hover:bg-red-700"
                  >
                    삭제 확정
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayout>
  );
}
