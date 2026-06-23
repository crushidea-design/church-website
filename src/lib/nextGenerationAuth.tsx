import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  fetchSignInMethodsForEmail,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { auth, db, googleProvider, signInWithGoogle as firebaseSignInWithGoogle } from './firebase';
import { buildMemberRoleFields } from './nextGenerationRoles';

const ADMIN_EMAIL = 'crushidea@gmail.com';

export type MemberRole = 'pending' | 'member' | 'rejected';
export const NEXT_GENERATION_DEPARTMENTS = ['청년', '교사', '학부모', '학생'] as const;
export type Department = typeof NEXT_GENERATION_DEPARTMENTS[number];
export interface NextGenerationRoleProfiles {
  teacher?: { groupIds: string[] };
  parent?: { childIds: string[] };
  youngAdult?: { enabled: boolean };
  student?: { groupId?: string };
}

/** Department members that can only access the workbook (공과) tab. */
export const RESTRICTED_DEPARTMENTS: Department[] = ['학생'];

/** Tab slugs accessible to RESTRICTED_DEPARTMENTS members. */
export const STUDENT_ACCESSIBLE_TAB_SLUGS = ['elementary_workbook'] as const;

export const isRestrictedDepartment = (department: Department | undefined | null) =>
  !!department && (RESTRICTED_DEPARTMENTS as Department[]).includes(department);

export interface NextGenerationMember {
  uid: string;
  email: string;
  displayName: string;
  role: MemberRole;
  department: Department;
  departments?: Department[];
  primaryDepartment?: Department;
  roleProfiles?: NextGenerationRoleProfiles;
  church: string;
  intro: string;
  provider: 'email' | 'google';
  createdAt: Timestamp;
  approvedAt?: Timestamp;
  rejectedAt?: Timestamp;
  rejectionReason?: string;
  isNextGenerationAdmin?: boolean;
  /** Child member uids linked to a parent account ('학부모' department). */
  childIds?: string[];
  /** Display names for linked children, cached on the parent document. */
  childNames?: string[];
  /** Student's word-fruit group (single). */
  groupId?: string;
  /** Groups a teacher is responsible for. */
  groupIds?: string[];
  /** True once the parent has completed the onboarding modal. */
  parentOnboardingCompleted?: boolean;
  /** Children that don't use a phone — managed entirely by the parent. */
  proxyChildren?: Array<{ id: string; name: string; grade?: string; usesPhone: boolean; groupId?: string }>;
  /** On a student doc: parent's email entered at signup, used to auto-link on approval. */
  parentEmail?: string;
}

export interface NextGenerationNotification {
  id: string;
  uid: string;
  type: 'approved' | 'rejected' | 'answered' | 'announcement';
  message: string;
  rejectionReason?: string;
  createdAt: Timestamp;
  isRead: boolean;
}

export interface SignUpData {
  displayName: string;
  department: Department;
  departments?: Department[];
  church: string;
  intro: string;
  /** Only set when department === '학생' — used to auto-link the parent on approval. */
  parentEmail?: string;
}

export interface EmailSignUpData extends SignUpData {
  email: string;
  password: string;
}

interface NextGenerationAuthContextType {
  user: User | null;
  member: NextGenerationMember | null;
  loading: boolean;
  isPastor: boolean;
  isMember: boolean;
  isPending: boolean;
  isRejected: boolean;
  hasAccess: boolean;
  needsSignUp: boolean;
  notifications: NextGenerationNotification[];
  unreadCount: number;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (data: EmailSignUpData) => Promise<void>;
  signInWithGoogle: () => Promise<{ needsSignUp: boolean }>;
  completeGoogleSignUp: (data: SignUpData) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  checkEmailExists: (email: string) => Promise<boolean>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const NextGenerationAuthContext = createContext<NextGenerationAuthContextType>({
  user: null,
  member: null,
  loading: true,
  isPastor: false,
  isMember: false,
  isPending: false,
  isRejected: false,
  hasAccess: false,
  needsSignUp: false,
  notifications: [],
  unreadCount: 0,
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  signInWithGoogle: async () => ({ needsSignUp: false }),
  completeGoogleSignUp: async () => {},
  sendPasswordReset: async () => {},
  checkEmailExists: async () => false,
  markNotificationRead: async () => {},
  signOut: async () => {},
});

export const NextGenerationAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<NextGenerationMember | null>(null);
  const [loading, setLoading] = useState(true);
  // Prevents false-positive "no member doc" detection during email sign-up
  const signingUp = useRef(false);
  const [needsSignUp, setNeedsSignUp] = useState(false);
  const [notifications, setNotifications] = useState<NextGenerationNotification[]>([]);

  const isRootNextGenerationAdmin = user?.email === ADMIN_EMAIL;
  const isPastor = isRootNextGenerationAdmin || !!member?.isNextGenerationAdmin;
  const isMember = !isPastor && member?.role === 'member';
  const isPending = !isPastor && member?.role === 'pending';
  const isRejected = !isPastor && member?.role === 'rejected';
  const hasAccess = isPastor || isMember;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Fetch member doc and subscribe to changes
  useEffect(() => {
    if (!user || isRootNextGenerationAdmin) {
      setMember(null);
      setNeedsSignUp(false);
      return;
    }

    const memberRef = doc(db, 'next_generation_members', user.uid);
    const unsubscribe = onSnapshot(memberRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as NextGenerationMember;
        setMember(data);
        setNeedsSignUp(false);
      } else {
        setMember(null);
        if (user.providerData.some(p => p.providerId === 'google.com')) {
          // Google user with no member doc → needs to complete sign-up
          setNeedsSignUp(true);
        } else if (!signingUp.current) {
          // Email user with no member doc → admin deleted their account.
          // Delete the Auth account (succeeds since they just signed in)
          // and fall back to sign-out if re-authentication is required.
          user.delete().catch(() => auth.signOut());
        }
      }
      setLoading(false);
    }, () => {
      setMember(null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, isRootNextGenerationAdmin]);

  // Subscribe to notifications
  useEffect(() => {
    if (!user || isRootNextGenerationAdmin) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'next_generation_notifications'),
      where('uid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const items: NextGenerationNotification[] = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      } as NextGenerationNotification));
      items.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setNotifications(items);
    }, () => {
      setNotifications([]);
    });

    return () => unsubscribe();
  }, [user, isRootNextGenerationAdmin]);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setMember(null);
        setNeedsSignUp(false);
        setLoading(false);
      } else if (currentUser.email === ADMIN_EMAIL) {
        setMember(null);
        setNeedsSignUp(false);
        setLoading(false);
      }
      // Member loading is handled by the member useEffect above
    });
    return () => unsubscribe();
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signUpWithEmail = useCallback(async (data: EmailSignUpData) => {
    const credential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    signingUp.current = true;
    try {
      await updateProfile(credential.user, { displayName: data.displayName });
      const memberRef = doc(db, 'next_generation_members', credential.user.uid);
      const roleFields = buildMemberRoleFields(data.departments || [data.department]);
      const payload: Record<string, unknown> = {
        uid: credential.user.uid,
        email: data.email,
        displayName: data.displayName,
        role: 'pending',
        ...roleFields,
        church: data.church,
        intro: data.intro,
        provider: 'email',
        createdAt: serverTimestamp(),
      };
      if (roleFields.departments.includes('학생') && data.parentEmail && data.parentEmail.trim()) {
        payload.parentEmail = data.parentEmail.trim().toLowerCase();
      }
      await setDoc(memberRef, payload);
    } catch (err) {
      // Roll back the Auth account if Firestore write fails
      await credential.user.delete().catch(() => {});
      throw err;
    } finally {
      signingUp.current = false;
    }
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<{ needsSignUp: boolean }> => {
    const googleUser = await firebaseSignInWithGoogle();
    // Check if member doc exists
    const memberRef = doc(db, 'next_generation_members', googleUser.uid);
    const snap = await getDoc(memberRef);
    if (!snap.exists()) {
      setNeedsSignUp(true);
      return { needsSignUp: true };
    }
    return { needsSignUp: false };
  }, []);

  const completeGoogleSignUp = useCallback(async (data: SignUpData) => {
    if (!user) throw new Error('로그인 상태가 아닙니다.');
    const memberRef = doc(db, 'next_generation_members', user.uid);
    const roleFields = buildMemberRoleFields(data.departments || [data.department]);
    const payload: Record<string, unknown> = {
      uid: user.uid,
      email: user.email,
      displayName: data.displayName,
      role: 'pending',
      ...roleFields,
      church: data.church,
      intro: data.intro,
      provider: 'google',
      createdAt: serverTimestamp(),
    };
    if (roleFields.departments.includes('학생') && data.parentEmail && data.parentEmail.trim()) {
      payload.parentEmail = data.parentEmail.trim().toLowerCase();
    }
    await setDoc(memberRef, payload);
    setNeedsSignUp(false);
  }, [user]);

  const sendPasswordReset = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  const checkEmailExists = useCallback(async (email: string): Promise<boolean> => {
    const methods = await fetchSignInMethodsForEmail(auth, email);
    return methods.length > 0;
  }, []);

  const markNotificationRead = useCallback(async (notificationId: string) => {
    const ref = doc(db, 'next_generation_notifications', notificationId);
    await updateDoc(ref, { isRead: true });
  }, []);

  const signOut = useCallback(async () => {
    setMember(null);
    setNeedsSignUp(false);
    setNotifications([]);
    await auth.signOut();
  }, []);

  const value = React.useMemo(() => ({
    user,
    member,
    loading,
    isPastor,
    isMember,
    isPending,
    isRejected,
    hasAccess,
    needsSignUp,
    notifications,
    unreadCount,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    completeGoogleSignUp,
    sendPasswordReset,
    checkEmailExists,
    markNotificationRead,
    signOut,
  }), [
    user, member, loading, isPastor, isMember, isPending, isRejected,
    hasAccess, needsSignUp, notifications, unreadCount,
    signInWithEmail, signUpWithEmail, signInWithGoogle, completeGoogleSignUp,
    sendPasswordReset, checkEmailExists, markNotificationRead, signOut,
  ]);

  return (
    <NextGenerationAuthContext.Provider value={value}>
      {children}
    </NextGenerationAuthContext.Provider>
  );
};

export const useNextGenerationAuth = () => useContext(NextGenerationAuthContext);
