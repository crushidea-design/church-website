import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

const config = {
  ...firebaseConfig,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (firebaseConfig.apiKey !== "REDACTED" ? firebaseConfig.apiKey : "")
};

if (!config.apiKey || config.apiKey === "") {
  console.error("Firebase API Key is missing or invalid! Please set VITE_FIREBASE_API_KEY in your environment variables.");
}

console.log('Firebase configuration loaded:', {
  projectId: config.projectId,
  authDomain: config.authDomain,
  databaseId: config.firestoreDatabaseId,
  hasApiKey: !!config.apiKey,
  apiKeyPrefix: config.apiKey ? config.apiKey.substring(0, 5) + '...' : 'none'
});

const app = initializeApp(config);
export const db = getFirestore(app, config.firestoreDatabaseId);

// Use the bucket from config explicitly
export const storage = getStorage(app, `gs://${config.storageBucket}`);
export const auth = getAuth(app);

// Messaging initialization with support check
export let messaging: any = null;

// Initialize messaging asynchronously to avoid blocking and handle unsupported browsers
if (typeof window !== 'undefined') {
  isSupported().then(supported => {
    if (supported) {
      messaging = getMessaging(app);
      console.log('Firebase Messaging initialized');
    } else {
      console.warn('Firebase Messaging is not supported in this browser');
    }
  }).catch(err => {
    console.error('Error checking messaging support:', err);
  });
}

console.log('Firebase Storage initialized with bucket:', config.storageBucket);

export const googleProvider = new GoogleAuthProvider();

// Quota Guard: Prevents Firestore calls if quota is known to be exceeded
const QUOTA_EXCEEDED_KEY = 'firestore_quota_exceeded';

export function isQuotaExceeded(): boolean {
  if (typeof window === 'undefined') return false;
  const timestamp = localStorage.getItem(QUOTA_EXCEEDED_KEY);
  if (!timestamp) return false;
  
  // Quota resets daily, so we clear the flag after 24 hours
  const now = Date.now();
  if (now - parseInt(timestamp) > 24 * 60 * 60 * 1000) {
    localStorage.removeItem(QUOTA_EXCEEDED_KEY);
    return false;
  }
  return true;
}

function setQuotaExceeded() {
  if (typeof window !== 'undefined') {
    localStorage.setItem(QUOTA_EXCEEDED_KEY, Date.now().toString());
  }
}

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
    throw error;
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
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  if (errorMessage.includes('Quota limit exceeded')) {
    setQuotaExceeded();
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
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
