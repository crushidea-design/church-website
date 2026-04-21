import React, { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getCountFromServer, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminCategoryManager, { AdminCategoryItem } from '../components/AdminCategoryManager';
import { useAuth } from '../lib/auth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

interface SermonCategory extends AdminCategoryItem {
  createdAt: any;
}

export default function AdminSermonCategories() {
  const { role, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<SermonCategory[]>([]);
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

    const fetchCategories = async () => {
      try {
        const categoryQuery = query(collection(db, 'sermon_categories'), orderBy('order', 'asc'), limit(100));
        const snapshot = await getDocs(categoryQuery);
        const data = snapshot.docs.map((categoryDoc) => ({
          id: categoryDoc.id,
          ...categoryDoc.data(),
        })) as SermonCategory[];
        setCategories(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching categories:', error);
        handleFirestoreError(error, OperationType.GET, 'sermon_categories');
        setLoading(false);
      }
    };

    fetchCategories();
  }, [role, authLoading, navigate]);

  const handleAddCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newCategoryName.trim()) return;

    setIsAdding(true);
    try {
      const nextOrder = categories.length > 0 ? Math.max(...categories.map((category) => category.order)) + 1 : 0;
      const createdDoc = await addDoc(collection(db, 'sermon_categories'), {
        name: newCategoryName.trim(),
        order: nextOrder,
        createdAt: serverTimestamp(),
      });

      setCategories((prev) => [
        ...prev,
        {
          id: createdDoc.id,
          name: newCategoryName.trim(),
          order: nextOrder,
          createdAt: new Date(),
        },
      ]);
      setNewCategoryName('');
    } catch (error) {
      console.error('Error adding category:', error);
      alert('카테고리를 추가하는 중 오류가 발생했습니다.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateCategory = async (id: string, name: string) => {
    if (!name.trim()) return;

    try {
      await updateDoc(doc(db, 'sermon_categories', id), {
        name: name.trim(),
      });
      setCategories((prev) =>
        prev.map((category) => (category.id === id ? { ...category, name: name.trim() } : category))
      );
    } catch (error) {
      console.error('Error updating category:', error);
      alert('카테고리 이름을 수정하는 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    const postQuery = query(collection(db, 'posts'), where('sermonCategoryId', '==', id), limit(1));
    const snapshot = await getCountFromServer(postQuery);
    const count = snapshot.data().count;

    if (count > 0) {
      alert(`'${name}' 카테고리를 사용하는 게시물이 있어 먼저 이동 또는 정리가 필요합니다.`);
      return false;
    }

    setPendingDeleteId(id);
    return true;
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;

    try {
      await deleteDoc(doc(db, 'sermon_categories', pendingDeleteId));
      setCategories((prev) => prev.filter((category) => category.id !== pendingDeleteId));
      setPendingDeleteId(null);
    } catch (error) {
      console.error('Error deleting category:', error);
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
      batch.update(doc(db, 'sermon_categories', category.id), { order: category.order });
    });

    try {
      await batch.commit();
      setCategories(normalized);
    } catch (error) {
      console.error('Error reordering categories:', error);
      alert('카테고리 순서를 변경하는 중 오류가 발생했습니다.');
    }
  };

  return (
    <AdminCategoryManager
      title="말씀서재 카테고리"
      description="설교와 말씀 콘텐츠를 묶는 분류를 정리하고, 관리자 화면에서 순서를 빠르게 맞출 수 있도록 구성했습니다."
      badge="콘텐츠"
      icon={<Video size={14} />}
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
      addPlaceholder="예: 주일예배, 성경공부, 특별집회"
      listTitle="카테고리 목록"
      emptyMessage="등록된 말씀서재 카테고리가 없습니다."
      deleteTitle="카테고리 삭제"
      deleteDescription="삭제 후에는 되돌리기 어렵습니다. 연결된 게시물이 없는지 먼저 확인해 주세요."
      helperText="콘텐츠가 늘어나기 전이라면 분류 수를 너무 많이 늘리기보다, 실제로 반복해서 쓰는 이름 위주로 유지하는 편이 관리하기 쉽습니다."
    />
  );
}
