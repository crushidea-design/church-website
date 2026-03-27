import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, getDocs, where, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { FlaskConical, Plus, Trash2, ChevronUp, ChevronDown, Edit2, Save, X, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ResearchCategory {
  id: string;
  name: string;
  order: number;
  createdAt: any;
}

export default function AdminResearchCategories() {
  const { role, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<ResearchCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (role !== 'admin') {
      navigate('/');
      return;
    }

    const q = query(collection(db, 'research_categories'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ResearchCategory[];
      setCategories(data);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching research categories:', error);
      handleFirestoreError(error, OperationType.GET, 'research_categories');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [role, authLoading, navigate]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setIsAdding(true);
    try {
      const nextOrder = categories.length > 0 
        ? Math.max(...categories.map(c => c.order)) + 1 
        : 0;

      await addDoc(collection(db, 'research_categories'), {
        name: newCategoryName.trim(),
        order: nextOrder,
        createdAt: serverTimestamp()
      });
      setNewCategoryName('');
    } catch (error) {
      console.error('Error adding research category:', error);
      alert('카테고리 추가 중 오류가 발생했습니다.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateCategory = async (id: string) => {
    if (!editName.trim()) return;

    try {
      await updateDoc(doc(db, 'research_categories', id), {
        name: editName.trim()
      });
      setEditingId(null);
    } catch (error) {
      console.error('Error updating research category:', error);
      alert('카테고리 수정 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    // Check if there are posts using this category
    const q = query(collection(db, 'posts'), where('researchCategoryId', '==', id));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      alert(`'${name}' 카테고리를 사용하는 연구글이 ${snapshot.size}개 있습니다. 먼저 연구글들의 카테고리를 변경하거나 삭제해주세요.`);
      return;
    }

    setDeletingId(id);
    setDeletingName(name);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;

    try {
      await deleteDoc(doc(db, 'research_categories', deletingId));
      setDeletingId(null);
      setDeletingName('');
    } catch (error) {
      console.error('Error deleting research category:', error);
      alert('카테고리 삭제 중 오류가 발생했습니다.');
    }
  };

  const moveCategory = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === categories.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newCategories = [...categories];
    const temp = newCategories[index];
    newCategories[index] = newCategories[newIndex];
    newCategories[newIndex] = temp;

    const batch = writeBatch(db);
    newCategories.forEach((cat, idx) => {
      batch.update(doc(db, 'research_categories', cat.id), { order: idx });
    });

    try {
      await batch.commit();
    } catch (error) {
      console.error('Error reordering research categories:', error);
      alert('순서 변경 중 오류가 발생했습니다.');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wood-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wood-900"></div>
      </div>
    );
  }

  return (
    <div className="bg-wood-100 min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/admin')}
            className="p-2 hover:bg-white rounded-full transition shadow-sm border border-wood-200"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="p-3 bg-white rounded-2xl shadow-sm border border-wood-200">
            <FlaskConical className="text-wood-900" size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-wood-900">교회 연구실 카테고리 관리</h1>
            <p className="text-wood-600">연구글들을 묶을 카테고리를 관리합니다.</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-wood-200 p-8 mb-8">
          <h2 className="text-xl font-bold text-wood-900 mb-6">새 카테고리 추가</h2>
          <form onSubmit={handleAddCategory} className="flex gap-4">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="예: 예배학, 설교학, 조직신학"
              className="flex-grow rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50"
              required
            />
            <button
              type="submit"
              disabled={isAdding || !newCategoryName.trim()}
              className="inline-flex items-center px-6 py-3 bg-wood-900 text-white rounded-xl hover:bg-wood-800 transition shadow-sm font-medium disabled:opacity-50"
            >
              <Plus size={20} className="mr-2" />
              추가하기
            </button>
          </form>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-wood-200 overflow-hidden">
          <div className="p-6 border-b border-wood-100 bg-wood-50/50">
            <h2 className="font-bold text-wood-900">카테고리 목록 ({categories.length})</h2>
          </div>
          <div className="divide-y divide-wood-100">
            {categories.length === 0 ? (
              <div className="p-12 text-center text-wood-500">
                등록된 카테고리가 없습니다.
              </div>
            ) : (
              categories.map((category, index) => (
                <div key={category.id} className="p-6 flex items-center justify-between hover:bg-wood-50/30 transition">
                  <div className="flex items-center gap-4 flex-grow">
                    <div className="flex flex-col gap-1">
                      <button 
                        onClick={() => moveCategory(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-wood-300 hover:text-wood-600 disabled:opacity-30"
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button 
                        onClick={() => moveCategory(index, 'down')}
                        disabled={index === categories.length - 1}
                        className="p-1 text-wood-300 hover:text-wood-600 disabled:opacity-30"
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                    {editingId === category.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-grow rounded-lg border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-2 bg-white"
                        autoFocus
                      />
                    ) : (
                      <span className="text-lg font-medium text-wood-900">{category.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {editingId === category.id ? (
                      <>
                        <button
                          onClick={() => handleUpdateCategory(category.id)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                          title="저장"
                        >
                          <Save size={20} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-2 text-wood-400 hover:bg-wood-100 rounded-lg transition"
                          title="취소"
                        >
                          <X size={20} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(category.id);
                            setEditName(category.name);
                          }}
                          className="p-2 text-wood-400 hover:text-wood-900 hover:bg-wood-100 rounded-lg transition"
                          title="수정"
                        >
                          <Edit2 size={20} />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category.id, category.name)}
                          className="p-2 text-wood-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="삭제"
                        >
                          <Trash2 size={20} />
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
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-wood-200"
              >
                <h3 className="text-xl font-bold text-wood-900 mb-4">카테고리 삭제</h3>
                <p className="text-wood-600 mb-8">
                   정말로 '<span className="font-bold text-wood-900">{deletingName}</span>' 카테고리를 삭제하시겠습니까?
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setDeletingId(null);
                      setDeletingName('');
                    }}
                    className="flex-1 px-6 py-3 border border-wood-200 rounded-xl text-wood-600 hover:bg-wood-50 transition font-medium"
                  >
                    취소
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition font-medium shadow-sm"
                  >
                    삭제
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
