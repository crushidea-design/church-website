import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, memoryLocalCache, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { ensureUserProfile } from './userProfile';
import { getInAppBrowserLoginMessage, isInAppBrowser } from './inAppBrowser';
import { 
  handleFirestoreError as baseHandleFirestoreError, 
  OperationType
} from './firestore-errors';

// Configuration with environment variable fallback
export const usesFirebaseEmulators = import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATORS === 'true';
const config = usesFirebaseEmulators ? {
  apiKey: 'demo-only-key', projectId: 'demo-church-review', authDomain: 'localhost',
  storageBucket: 'demo-church-review.appspot.com', appId: 'demo-only-app', firestoreDatabaseId: '(default)',
} : {
  ...firebaseConfig,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (firebaseConfig.apiKey !== "REDACTED" ? firebaseConfig.apiKey : "")
};

// Initialize Firebase
const app = initializeApp(config);

export const db = initializeFirestore(app, {
  localCache: usesFirebaseEmulators ? memoryLocalCache() : persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, config.firestoreDatabaseId);

export const storage = getStorage(app, `gs://${config.storageBucket}`);
export const auth = getAuth(app);

if (usesFirebaseEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8180);
  connectStorageEmulator(storage, '127.0.0.1', 9299);
}

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
let messagingInitPromise: Promise<any | null> | null = null;

export const getFirebaseMessaging = async () => {
  if (usesFirebaseEmulators) return null;
  if (typeof window === 'undefined') return null;
  if (messaging) return messaging;

  if (!messagingInitPromise) {
    messagingInitPromise = import('firebase/messaging').then(async (messagingModule) => {
      const supported = await messagingModule.isSupported();
      if (!supported) return null;

      messaging = messagingModule.getMessaging(app);
      (window as any).firebase_messaging = messaging;
      console.info('Firebase Messaging initialized');
      return messaging;
    }).catch(err => {
      console.warn('Failed to initialize Firebase Messaging:', err);
      return null;
    }).finally(() => {
      messagingInitPromise = null;
    });
  }

  return messagingInitPromise;
};

if (typeof window !== 'undefined') {
  void getFirebaseMessaging().catch(err => {
    console.warn('Error checking messaging support:', err);
  });
}

export const googleProvider = new GoogleAuthProvider();

/**
 * Ensures a user document exists in Firestore after successful login.
 */
async function ensureUserDocument(user: any) {
  try {
    await ensureUserProfile(db, user);
  } catch (error: any) {
    console.error("Error ensuring user document:", error);
    // Don't block login if it's just a quota error or transient issue
    if (!error.message?.includes('Quota limit exceeded')) {
      throw error;
    }
  }
}

export const signInWithGoogle = async () => {
  if (typeof window !== 'undefined' && isInAppBrowser()) {
    const error = new Error(getInAppBrowserLoginMessage()) as Error & { code?: string };
    error.code = 'auth/in-app-browser-not-supported';
    throw error;
  }

  let result;
  try {
    result = await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    let message = '로그인 중 오류가 발생했습니다.';
    if (error.code === 'auth/popup-blocked') {
      message = '팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해 주세요.';
    } else if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      // User-initiated; show nothing and let caller handle silently.
      throw error;
    } else if (error.code === 'auth/unauthorized-domain') {
      message = '허용되지 않은 도메인입니다. 관리자에게 문의해 주세요. (Firebase 콘솔의 Authentication → Settings → Authorized domains에 현재 도메인을 추가해 주세요.)';
    } else if (error.code === 'auth/operation-not-allowed') {
      message = 'Google 로그인이 비활성화되어 있습니다. 관리자에게 문의해 주세요.';
    } else {
      message += ` (코드: ${error.code || 'unknown'}${error.message ? ' / ' + error.message : ''})`;
    }
    alert(message);
    throw error;
  }

  // Main-site user document is best-effort. If creating users/{uid} fails
  // (e.g., the row violates isValidUser, or quota is exhausted) we still
  // want next-generation sign-up to proceed — those flows write a separate
  // next_generation_members/{uid} document and don't depend on this one.
  try {
    await ensureUserDocument(result.user);
  } catch (e: any) {
    console.warn('ensureUserDocument failed (non-fatal for next-gen sign-up):', e?.code, e?.message);
  }
  return result.user;
};

export const logout = () => signOut(auth);
