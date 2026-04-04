import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserRole } from '../types';

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

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const isAdminEmail = currentUser.email === ADMIN_EMAIL;
          
          // Check session storage first to save read units
          const cachedRole = sessionStorage.getItem(`user_role_${currentUser.uid}`);
          if (cachedRole) {
            setRole(isAdminEmail ? 'admin' : cachedRole as UserRole);
            setLoading(false);
            return;
          }

          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          let finalRole: UserRole = 'user';
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            finalRole = isAdminEmail ? 'admin' : (data.role as UserRole || 'user');
          } else if (isAdminEmail) {
            finalRole = 'admin';
          }
          
          setRole(finalRole);
          sessionStorage.setItem(`user_role_${currentUser.uid}`, finalRole);
        } catch (error: any) {
          console.error("AuthProvider: Error fetching user role:", error);
          const isAdminEmail = currentUser.email === ADMIN_EMAIL;
          setRole(isAdminEmail ? 'admin' : 'user');
        }
      } else {
        setRole(null);
        // We don't necessarily need to clear session storage here as it's per-user
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const authValue = React.useMemo(() => ({ user, role, loading }), [user, role, loading]);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
