import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { isSupported } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';
import { 
  handleFirestoreError as baseHandleFirestoreError, 
  OperationType, 
  testFirestoreConnection 
} from './firestore-errors';

// Configuration with environment variable fallback
const config = {
  ...firebaseConfig,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (firebaseConfig.apiKey !== "REDACTED" ? firebaseConfig.apiKey : "")
};

// Initialize Firebase
const app = initializeApp(config);
export const db = getFirestore(app, config.firestoreDatabaseId);
export const storage = getStorage(app, `gs://${config.storageBucket}`);
export const auth = getAuth(app);

// Re-export OperationType
export { OperationType };

/**
 * Wrapped error handler that automatically passes the auth instance.
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  return baseHandleFirestoreError(error, operationType, path, auth);
}

// Messaging initialization with support check
export let messaging: any = null;

if (typeof window !== 'undefined') {
  isSupported().then(supported => {
    if (supported) {
      // Lazy load messaging to avoid issues in unsupported environments
      import('firebase/messaging').then((messagingModule) => {
        messaging = messagingModule.getMessaging(app);
        (window as any).firebase_messaging = messaging;
        console.log('Firebase Messaging initialized');
      }).catch(err => {
        console.warn('Failed to lazy load Firebase Messaging:', err);
      });
    }
  }).catch(err => {
    console.warn('Error checking messaging support:', err);
  });
}

// Test connection on boot
testFirestoreConnection(db);

export const googleProvider = new GoogleAuthProvider();

/**
 * Ensures a user document exists in Firestore after successful login.
 */
async function ensureUserDocument(user: any) {
  const userRef = doc(db, 'users', user.uid);
  try {
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      const isAdmin = user.email === 'crushidea@gmail.com';
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'User',
        role: isAdmin ? 'admin' : 'user',
        createdAt: new Date()
      });
      console.log('New user document created');
    }
  } catch (error: any) {
    console.error("Error ensuring user document:", error);
    // Don't block login if it's just a quota error or transient issue
    if (!error.message?.includes('Quota limit exceeded')) {
      throw error;
    }
  }
}

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await ensureUserDocument(result.user);
    return result.user;
  } catch (error: any) {
    console.error("Google Sign-In Error:", error);
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
