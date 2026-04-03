import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { getDocFromServer, doc } from 'firebase/firestore';

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

/**
 * Centralized Firestore error handler.
 * Formats errors into a JSON string for the ErrorBoundary to consume.
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, auth: Auth) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
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

  // Log the structured error for debugging
  console.error(`[Firestore Error] ${operationType.toUpperCase()} at ${path || 'unknown'}:`, errInfo);
  
  // Set a flag in localStorage if quota is exceeded
  if (errorMessage.includes('Quota limit exceeded')) {
    localStorage.setItem('firestore_quota_exceeded', 'true');
  }
  
  // Throw a JSON string that the ErrorBoundary can parse
  let errorString = '';
  try {
    errorString = JSON.stringify(errInfo);
  } catch (e) {
    console.error('Failed to stringify error info:', e);
    errorString = JSON.stringify({ error: errorMessage, operationType, path });
  }
  
  throw new Error(errorString);
}

/**
 * Validates connection to Firestore on app boot.
 */
export async function testFirestoreConnection(db: Firestore) {
  try {
    // Attempt to fetch a non-existent document just to test connectivity
    await getDocFromServer(doc(db, '_internal_', 'connection_test'));
    console.log('Firestore connection verified');
    
    // Clear quota flag if it was set
    if (localStorage.getItem('firestore_quota_exceeded')) {
      localStorage.removeItem('firestore_quota_exceeded');
    }
  } catch (error: any) {
    if (error.message?.includes('the client is offline')) {
      console.error("CRITICAL: Firestore is offline. Check your Firebase configuration and network.");
    } else if (error.message?.includes('Quota limit exceeded')) {
      console.warn("Firestore Quota limit exceeded on initial connection test.");
      localStorage.setItem('firestore_quota_exceeded', 'true');
    }
    // We don't throw here to avoid crashing the app immediately if it's just a transient issue
  }
}
