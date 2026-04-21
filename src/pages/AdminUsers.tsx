import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, limit, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/utils';
import { Users, Shield, User as UserIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { UserRole } from '../types';
import AdminLayout from '../components/AdminLayout';

export default function AdminUsers() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showRoleConfirm, setShowRoleConfirm] = useState<{ userId: string, role: UserRole } | null>(null);

  useEffect(() => {
    if (!authLoading && role !== 'admin') {
      navigate('/');
      return;
    }

    const fetchUsers = async () => {
      try {
        const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching users:', error);
        handleFirestoreError(error, OperationType.GET, 'users');
        setLoading(false);
      }
    };

    fetchUsers();
  }, [role, authLoading, navigate]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (updating) return;
    
    setUpdating(userId);
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        updatedAt: new Date() // Using new Date() as rules expect timestamp and JS Date is converted to Firestore Timestamp
      });
      setShowRoleConfirm(null);
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('등급 변경에 실패했습니다.');
    } finally {
      setUpdating(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-wood-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wood-900"></div>
      </div>
    );
  }

  return (
    <AdminLayout
      title="회원 관리"
      description="교회 사용자와 관리자 권한을 한눈에 확인하고 조정합니다."
      backTo="/admin"
      backLabel="관리자 대시보드"
      badge="운영"
      icon={<Users size={14} />}
      maxWidthClassName="max-w-7xl"
    >

        <div className="bg-white rounded-2xl shadow-sm border border-wood-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-wood-50 border-b border-wood-200">
                  <th className="px-6 py-4 text-sm font-bold text-wood-700 uppercase tracking-wider">사용자</th>
                  <th className="px-6 py-4 text-sm font-bold text-wood-700 uppercase tracking-wider">이메일</th>
                  <th className="px-6 py-4 text-sm font-bold text-wood-700 uppercase tracking-wider">가입일</th>
                  <th className="px-6 py-4 text-sm font-bold text-wood-700 uppercase tracking-wider">현재 등급</th>
                  <th className="px-6 py-4 text-sm font-bold text-wood-700 uppercase tracking-wider text-right">등급 변경</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wood-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-wood-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-wood-100 flex items-center justify-center text-wood-600">
                          <UserIcon size={20} />
                        </div>
                        <span className="font-medium text-wood-900">{u.displayName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-wood-600">{u.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-wood-500 text-sm">
                      {u.createdAt ? formatDate(u.createdAt) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                        u.role === 'regular' ? 'bg-gold-100 text-gold-800' :
                        'bg-wood-100 text-wood-800'
                      }`}>
                        {u.role === 'admin' ? '관리자' : u.role === 'regular' ? '정회원' : '일반회원'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        {showRoleConfirm?.userId !== u.id ? (
                          <>
                            <button
                              onClick={() => setShowRoleConfirm({ userId: u.id, role: 'user' })}
                              disabled={updating === u.id || u.role === 'user'}
                              className={`px-3 py-1 rounded text-xs font-medium transition ${
                                u.role === 'user' 
                                  ? 'bg-wood-100 text-wood-400 cursor-not-allowed' 
                                  : 'bg-white border border-wood-200 text-wood-700 hover:bg-wood-50'
                              }`}
                            >
                              일반
                            </button>
                            <button
                              onClick={() => setShowRoleConfirm({ userId: u.id, role: 'regular' })}
                              disabled={updating === u.id || u.role === 'regular'}
                              className={`px-3 py-1 rounded text-xs font-medium transition ${
                                u.role === 'regular' 
                                  ? 'bg-gold-100 text-gold-800 cursor-not-allowed' 
                                  : 'bg-white border border-gold-200 text-gold-700 hover:bg-gold-50'
                              }`}
                            >
                              정회원
                            </button>
                            <button
                              onClick={() => setShowRoleConfirm({ userId: u.id, role: 'admin' })}
                              disabled={updating === u.id || u.role === 'admin'}
                              className={`px-3 py-1 rounded text-xs font-medium transition ${
                                u.role === 'admin' 
                                  ? 'bg-purple-100 text-purple-800 cursor-not-allowed' 
                                  : 'bg-white border border-purple-200 text-purple-700 hover:bg-wood-50'
                              }`}
                            >
                              관리자
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center space-x-2 bg-wood-50 p-1 rounded-lg border border-wood-200">
                            <span className="text-[10px] text-wood-600 font-bold px-1">
                              {showRoleConfirm.role === 'admin' ? '관리자' : showRoleConfirm.role === 'regular' ? '정회원' : '일반'}로 변경?
                            </span>
                            <button
                              onClick={() => handleRoleChange(u.id, showRoleConfirm.role as any)}
                              disabled={updating === u.id}
                              className="text-[10px] bg-wood-900 text-white px-2 py-1 rounded hover:bg-wood-800 disabled:opacity-50 transition"
                            >
                              {updating === u.id ? '...' : '확인'}
                            </button>
                            <button
                              onClick={() => setShowRoleConfirm(null)}
                              disabled={updating === u.id}
                              className="text-[10px] bg-wood-200 text-wood-700 px-2 py-1 rounded hover:bg-wood-300 transition"
                            >
                              취소
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {users.length === 0 && (
            <div className="p-12 text-center">
              <Users className="mx-auto h-12 w-12 text-wood-300 mb-4" />
              <p className="text-wood-500">가입된 회원이 없습니다.</p>
            </div>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-wood-200 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                <Shield size={20} />
              </div>
              <h3 className="font-bold text-wood-900">관리자 (Admin)</h3>
            </div>
            <p className="text-sm text-wood-600 leading-relaxed">
              모든 게시글 작성, 수정, 삭제 권한을 가집니다. 회원 등급을 관리하고 시스템 설정을 변경할 수 있습니다.
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-wood-200 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gold-50 flex items-center justify-center text-gold-600">
                <CheckCircle2 size={20} />
              </div>
              <h3 className="font-bold text-wood-900">정회원 (Regular)</h3>
            </div>
            <p className="text-sm text-wood-600 leading-relaxed">
              말씀 서재의 모든 영상을 시청할 수 있습니다. 소통 게시판에서 자유롭게 활동할 수 있습니다.
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-wood-200 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-wood-50 flex items-center justify-center text-wood-600">
                <AlertCircle size={20} />
              </div>
              <h3 className="font-bold text-wood-900">일반회원 (User)</h3>
            </div>
            <p className="text-sm text-wood-600 leading-relaxed">
              기본적인 게시글 열람과 댓글 작성이 가능하지만, 말씀 서재 등 일부 공간의 접근이 제한됩니다.
            </p>
          </div>
        </div>
    </AdminLayout>
  );
}
