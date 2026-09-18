import type { User } from 'firebase/auth';
import { doc, runTransaction, type Firestore } from 'firebase/firestore';

/** Login must preserve server-assigned roles and the original creation date. */
export async function ensureUserProfile(db: Firestore, user: Pick<User, 'uid' | 'email' | 'displayName'>, displayName?: string) {
  const ref = doc(db, 'users', user.uid);
  await runTransaction(db, async (transaction) => {
    if ((await transaction.get(ref)).exists()) return;
    transaction.set(ref, {
      uid: user.uid,
      email: user.email,
      displayName: displayName || user.displayName || user.email?.split('@')[0] || 'User',
      role: 'user',
      createdAt: new Date(),
    });
  });
}
