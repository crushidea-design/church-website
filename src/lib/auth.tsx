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
    console.log('AuthProvider: Setting up onAuthStateChanged listener');
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('AuthProvider: onAuthStateChanged fired, user:', currentUser?.email);
      setUser(currentUser);
      if (currentUser) {
        try {
          console.log('AuthProvider: Fetching user role for:', currentUser.uid);
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            console.log('AuthProvider: User document found, role:', data.role);
            setRole(currentUser.email === 'crushidea@gmail.com' ? 'admin' : data.role);
          } else {
            console.log('AuthProvider: User document not found, defaulting to user role');
            setRole(currentUser.email === 'crushidea@gmail.com' ? 'admin' : 'user');
          }
        } catch (error) {
          console.error("AuthProvider: Error fetching user role:", error);
          setRole('user');
        }
      } else {
        console.log('AuthProvider: No user logged in');
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
