import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const logActivity = async (
  user: { uid: string; email: string | null; displayName?: string | null } | null,
  role: string | null,
  activityType: string,
  pagePath: string
) => {
  // DIGITAL ATTENDANCE DISABLED TO REDUCE FIRESTORE USAGE
  return;

  if (!user) return; // 로그인하지 않은 사용자는 기록하지 않음

  try {
    await addDoc(collection(db, 'activity_logs'), {
      uid: user.uid,
      email: user.email || 'unknown',
      displayName: user.displayName || '',
      role: role || 'user',
      activityType,
      pagePath,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
    // 로깅 실패가 메인 앱의 동작을 방해하지 않도록 에러를 삼킴
  }
};
