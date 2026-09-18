import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

/** Claim once before sending. An ambiguous delivery is never automatically resent. */
export async function claimNotification(db: Firestore, ref: DocumentReference, now = new Date()) {
  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const data = snapshot.data();
    if (!data || data.status !== 'pending' || !data.scheduledAt?.toDate || data.scheduledAt.toDate() > now) return null;
    tx.update(ref, { status: 'processing', processingAt: FieldValue.serverTimestamp() });
    return data;
  });
}
