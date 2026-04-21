import React, { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getCountFromServer, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { FlaskConical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminCategoryManager, { AdminCategoryItem } from '../components/AdminCategoryManager';
import { useAuth } from '../lib/auth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useStore } from '../store/useStore';

interface ResearchCategory extends AdminCategoryItem {
  createdAt: any;
}

export default function AdminResearchCategories() {
  const { role, loading: authLoading } = useAuth();
  const setStoreCategories = useStore((state) => state.setCategories);
  const invalidateCache = useStore((state) => state.invalidateCache);
  const [categories, setCategories] = useState<ResearchCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (role !== 'admin') {
      navigate('/');
      return;
    }

    const categoryQuery = query(collection(db, 'research_categories'), orderBy('order', 'asc'), limit(100));
    const unsubscribe = onSnapshot(
      categoryQuery,
      (snapshot) => {
        const data = snapshot.docs.map((categoryDoc) => ({
          id: categoryDoc.id,
          ...categoryDoc.data(),
        })) as ResearchCategory[];
        setCategories(data);
        setStoreCategories('researchCategories', data);
        invalidateCache('research');
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching research categories:', error);
        handleFirestoreError(error, OperationType.GET, 'research_categories');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [role, authLoading, navigate, invalidateCache, setStoreCategories]);

  const handleAddCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newCategoryName.trim()) return;

    setIsAdding(true);
    try {
      const nextOrder = categories.length > 0 ? Math.max(...categories.map((category) => category.order)) + 1 : 0;
      await addDoc(collection(db, 'research_categories'), {
        name: newCategoryName.trim(),
        order: nextOrder,
        createdAt: serverTimestamp(),
      });
      setNewCategoryName('');
    } catch (error) {
      console.error('Error adding research category:', error);
      alert('카테고리를 추가하는 중 오류가 발생했습니다.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateCategory = async (id: string, name: string) => {
    if (!name.trim()) return;

    try {
      await updateDoc(doc(db, 'research_categories', id), {
        name: name.trim(),
      });
    } catch (error) {
      console.error('Error updating research category:', error);
      alert('카테고리 이름을 수정하는 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    const postQuery = query(collection(db, 'posts'), where('researchCategoryId', '==', id), limit(1));
    const snapshot = await getCountFromServer(postQuery);
    const count = snapshot.data().count;

    if (count > 0) {
      alert(`'${name}' 카테고리를 사용하는 연구 글이 있어 먼저 이동 또는 정리가 필요합니다.`);
      return false;
    }

    setPendingDeleteId(id);
    return true;
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;

    try {
      await deleteDoc(doc(db, 'research_categories', pendingDeleteId));
      setPendingDeleteId(null);
    } catch (error) {
      console.error('Error deleting research category:', error);
      alert('카테고리를 삭제하는 중 오류가 발생했습니다.');
    }
  };

  const moveCategory = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === categories.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...categories];
    const current = reordered[index];
    reordered[index] = reordered[newIndex];
    reordered[newIndex] = current;

    const normalized = reordered.map((category, currentIndex) => ({
      ...category,
      order: currentIndex,
    }));

    const batch = writeBatch(db);
    normalized.forEach((category) => {
      batch.update(doc(db, 'research_categories', category.id), { order: category.order });
    });

    try {
      await batch.commit();
    } catch (error) {
      console.error('Error reordering research categories:', error);
      alert('카테고리 순서를 변경하는 중 오류가 발생했습니다.');
    }
  };

  return (
    <AdminCategoryManager
      title="교회연구실 카테고리"
      description="연구 글을 분류하는 이름과 순서를 정리해서, 글 작성 화면과 공개 페이지 흐름이 더 단정하게 이어지도록 맞췄습니다."
      badge="콘텐츠"
      icon={<FlaskConical size={14} />}
      categories={categories}
      loading={authLoading || loading}
      newCategoryName={newCategoryName}
      onNewCategoryNameChange={setNewCategoryName}
      onAddCategory={handleAddCategory}
      onUpdateCategory={handleUpdateCategory}
      onDeleteCategory={handleDeleteCategory}
      onConfirmDelete={confirmDelete}
      onMoveCategory={moveCategory}
      isAdding={isAdding}
      addTitle="새 카테고리 추가"
      addPlaceholder="예: 교리, 교회론, 공동체, 목양"
      listTitle="카테고리 목록"
      emptyMessage="등록된 교회연구실 카테고리가 없습니다."
      deleteTitle="카테고리 삭제"
      deleteDescription="삭제 후에는 연결 구조가 비어 보일 수 있으니, 공개 글 정리 여부를 먼저 확인해 주세요."
      helperText="연구실 카테고리는 너무 세분화하기보다, 실제 독자가 탐색할 때 헷갈리지 않을 정도의 큰 주제로 유지하는 편이 좋습니다."
    />
  );
}
