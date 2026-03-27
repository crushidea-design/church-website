import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const config = {
  ...firebaseConfig,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (firebaseConfig.apiKey !== "REDACTED" ? firebaseConfig.apiKey : "")
};

if (!config.apiKey) {
  console.error("Firebase API Key is missing!");
}

console.log('Firebase configuration loaded:', {
  projectId: config.projectId,
  authDomain: config.authDomain,
  databaseId: config.firestoreDatabaseId
});

const app = initializeApp(config);
export const db = getFirestore(app, config.firestoreDatabaseId);

// Use the bucket from config explicitly
export const storage = getStorage(app, `gs://${config.storageBucket}`);
export const auth = getAuth(app);

console.log('Firebase Storage initialized with bucket:', config.storageBucket);

export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  console.log('signInWithGoogle called');
  try {
    console.log('Attempting signInWithPopup...');
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    console.log('SignIn successful, user:', user.email);
    
    // Check if user exists in Firestore, if not create them
    const userRef = doc(db, 'users', user.uid);
    console.log('Fetching user document from Firestore...');
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      console.log('User document does not exist, creating new user...');
      const isAdmin = user.email === 'crushidea@gmail.com';
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'User',
        role: isAdmin ? 'admin' : 'user',
        createdAt: new Date()
      });
      console.log('User document created successfully');
    } else {
      console.log('User document already exists');
    }
  } catch (error: any) {
    console.error("Error signing in with Google:", error);
    let message = '로그인 중 오류가 발생했습니다.';
    if (error.code === 'auth/popup-blocked') {
      message = '팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해 주세요.';
    } else if (error.code === 'auth/unauthorized-domain') {
      message = '허용되지 않은 도메인입니다. 관리자에게 문의해 주세요.';
    } else if (error.message) {
      message += ` (${error.message})`;
    }
    alert(message);
  }
};

export const logout = () => signOut(auth);

// Error Handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo?: any[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
