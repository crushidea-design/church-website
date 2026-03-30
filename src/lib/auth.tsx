import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, isQuotaExceeded } from './firebase';

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
    console.log('AuthProvider: Setting up onAuthStateChanged listener');
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('AuthProvider: onAuthStateChanged fired, user:', currentUser?.email);
      setUser(currentUser);
      if (currentUser) {
        try {
          // Quota Guard
          if (isQuotaExceeded()) {
            console.warn('AuthProvider: Quota exceeded, skipping role fetch');
            const lastKnownRole = sessionStorage.getItem(`user_role_${currentUser.uid}`);
            setRole((lastKnownRole as any) || 'user');
            setLoading(false);
            return;
          }

          // Check session storage first to save read units
          const cachedRole = sessionStorage.getItem(`user_role_${currentUser.uid}`);
          if (cachedRole) {
            console.log('AuthProvider: Using cached role:', cachedRole);
            setRole(cachedRole as any);
            setLoading(false);
            return;
          }

          console.log('AuthProvider: Fetching user role for:', currentUser.uid);
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          let finalRole: 'admin' | 'regular' | 'user' = 'user';
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            console.log('AuthProvider: User document found, role:', data.role);
            finalRole = currentUser.email === 'crushidea@gmail.com' ? 'admin' : data.role;
          } else {
            console.log('AuthProvider: User document not found, defaulting to user role');
            finalRole = currentUser.email === 'crushidea@gmail.com' ? 'admin' : 'user';
          }
          
          setRole(finalRole);
          sessionStorage.setItem(`user_role_${currentUser.uid}`, finalRole);
        } catch (error: any) {
          console.error("AuthProvider: Error fetching user role:", error);
          // If it's a quota error, try to use the last known role or default to 'user'
          if (error.message?.includes('Quota limit exceeded')) {
            const lastKnownRole = sessionStorage.getItem(`user_role_${currentUser.uid}`);
            setRole((lastKnownRole as any) || 'user');
          } else {
            setRole('user');
          }
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
