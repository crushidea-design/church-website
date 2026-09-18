import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserRole } from '../types';
import { useStore } from '../store/useStore';

const ADMIN_EMAIL = 'crushidea@gmail.com';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, role: null, loading: true });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth || !db) {
      console.error('AuthProvider: Firebase instances not initialized');
      setLoading(false);
      return;
    }

    let roleUnsubscribe: (() => void) | undefined;
    let generation = 0;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      const currentGeneration = ++generation;
      roleUnsubscribe?.();
      roleUnsubscribe = undefined;
      useStore.getState().clearCache();
      // Remove roles cached by earlier app versions. Roles now follow the server document.
      for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
        const key = sessionStorage.key(i);
        if (key?.startsWith('user_role_')) sessionStorage.removeItem(key);
      }
      setUser(currentUser);
      setRole(null);
      setLoading(Boolean(currentUser));
      if (!currentUser) return;

      const owner = currentUser.email === ADMIN_EMAIL && currentUser.emailVerified;
      roleUnsubscribe = onSnapshot(doc(db, 'users', currentUser.uid), (snapshot) => {
        if (generation !== currentGeneration) return;
        const value = snapshot.data()?.role;
        const role: UserRole = ['admin', 'regular', 'student', 'user'].includes(value) ? value : 'user';
        setRole(owner ? 'admin' : role);
        setLoading(false);
      }, () => {
        if (generation !== currentGeneration) return;
        setRole(owner ? 'admin' : 'user');
        setLoading(false);
      });
    });

    return () => {
      generation += 1;
      unsubscribe();
      roleUnsubscribe?.();
    };
  }, []);

  const authValue = React.useMemo(() => ({ user, role, loading }), [user, role, loading]);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
