import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Language } from './types/fieldshift';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}

export function mapFirebaseAuthError(err: unknown, lang: Language): string {
  const isAr = lang === 'ar';
  const code = (err as { code?: string })?.code || '';
  const msg = err instanceof Error ? err.message : String(err || '');

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return isAr
        ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
        : 'Invalid email address or password.';
    case 'auth/email-already-in-use':
      return isAr
        ? 'هذا البريد الإلكتروني مسجل بالفعل. حاول تسجيل الدخول بدلاً من ذلك.'
        : 'An account already exists with this email address. Try signing in instead.';
    case 'auth/weak-password':
      return isAr
        ? 'كلمة المرور ضعيفة؛ يجب أن تحتوي على 8 أحرف على الأقل.'
        : 'Password is too weak. Use at least 8 characters.';
    case 'auth/invalid-email':
      return isAr ? 'صيغة البريد الإلكتروني غير صالحة.' : 'The email address format is invalid.';
    case 'auth/operation-not-allowed':
      return isAr
        ? 'تسجيل الدخول بالبريد وكلمة المرور غير مفعّل حالياً في إعدادات المشروع. يمكنك استخدام حساب جوجل أو المتابعة لاستكشاف المزرعة.'
        : 'Email/password sign-in is not yet enabled in Firebase Console. Use Sign in with Google, or enable Email/Password under Authentication providers.';
    case 'auth/popup-closed-by-user':
      return isAr
        ? 'تم إغلاق نافذة تسجيل دخول جوجل قبل إتمام العملية.'
        : 'Google sign-in popup was closed before completing authentication.';
    case 'auth/popup-blocked':
      return isAr
        ? 'حظر المتصفح النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.'
        : 'Sign-in popup was blocked by your browser. Allow popups and try again.';
    case 'auth/network-request-failed':
      return isAr
        ? 'فشل الاتصال بالشبكة أثناء التحقق من الحساب.'
        : 'Network error while reaching authentication servers. Check your connection.';
    case 'auth/too-many-requests':
      return isAr
        ? 'تم إجراء محاولات متكررة كثيرة؛ يرجى الانتظار قليلاً ثم إعادة المحاولة.'
        : 'Too many authentication attempts. Please wait a moment and try again.';
    default:
      return msg || (isAr ? 'تعذر إتمام المصادقة.' : 'Authentication failed.');
  }
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function signUpWithEmail(
  firstName: string,
  lastName: string,
  email: string,
  password: string
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  if (fullName) {
    await updateProfile(cred.user, { displayName: fullName }).catch(() => {});
  }
  await sendEmailVerification(cred.user).catch(() => {});
  return cred.user;
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function resendVerificationEmail(): Promise<void> {
  if (auth.currentUser && !auth.currentUser.emailVerified) {
    await sendEmailVerification(auth.currentUser);
  }
}

export async function signOutUser(): Promise<void> {
  await fbSignOut(auth);
}

export {
  doc,
  collection,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
};
