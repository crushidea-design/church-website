import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

interface AuthContextType {
  user: User | null;
  role: 'admin' | 'regular' | 'user' | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, role: null, loading: true });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'regular' | 'user' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth || !db) {
      console.error('AuthProvider: Firebase instances not initialized');
      setLoading(false);
      return;
    }

    console.log('AuthProvider: Setting up onAuthStateChanged listener');
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('AuthProvider: onAuthStateChanged fired, user:', currentUser?.email);
      setUser(currentUser);
      if (currentUser) {
        try {
          // Hardcoded Admin Check
          const isAdminEmail = currentUser.email === 'crushidea@gmail.com';
          
          // Check session storage first to save read units
          const cachedRole = sessionStorage.getItem(`user_role_${currentUser.uid}`);
          if (cachedRole) {
            console.log('AuthProvider: Using cached role:', cachedRole);
            setRole(isAdminEmail ? 'admin' : cachedRole as any);
            setLoading(false);
            return;
          }

          console.log('AuthProvider: Fetching user role for:', currentUser.uid);
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          let finalRole: 'admin' | 'regular' | 'user' = 'user';
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            console.log('AuthProvider: User document found, role:', data.role);
            finalRole = isAdminEmail ? 'admin' : data.role;
          } else {
            console.log('AuthProvider: User document not found, defaulting to user role');
            finalRole = isAdminEmail ? 'admin' : 'user';
          }
          
          setRole(finalRole);
          sessionStorage.setItem(`user_role_${currentUser.uid}`, finalRole);
        } catch (error: any) {
          console.error("AuthProvider: Error fetching user role:", error);
          const isAdminEmail = currentUser.email === 'crushidea@gmail.com';
          setRole(isAdminEmail ? 'admin' : 'user');
        }
      } else {
        console.log('AuthProvider: No user logged in');
        setRole(null);
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
