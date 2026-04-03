import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, signInWithGoogle } from '../lib/firebase';
import { Mail, Lock, LogIn, UserPlus, User, KeyRound } from 'lucide-react';

export default function Login() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuthError = (err: any) => {
    console.error(err);
    switch (err.code) {
      case 'auth/invalid-email':
        setError('이메일 형식이 올바르지 않습니다.');
        break;
      case 'auth/user-not-found':
        setError('가입되지 않은 이메일입니다.');
        break;
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        setError('이메일 또는 비밀번호가 틀렸습니다.');
        break;
      case 'auth/weak-password':
        setError('비밀번호는 6자리 이상이어야 합니다.');
        break;
      case 'auth/email-already-in-use':
        setError('이미 가입된 이메일입니다.');
        break;
      default:
        setError('오류가 발생했습니다. 다시 시도해 주세요.');
    }
  };

  const ensureUserDocument = async (user: any, customDisplayName?: string) => {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: customDisplayName || user.displayName || user.email?.split('@')[0] || 'User',
        role: 'user',
        createdAt: new Date()
      });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    
    if (!email) {
      setError('비밀번호를 재설정할 이메일 주소를 입력해 주세요.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg('비밀번호 재설정 이메일이 발송되었습니다. 이메일함을 확인해 주세요.');
      setTimeout(() => {
        setIsResetMode(false);
        setSuccessMsg('');
      }, 5000);
    } catch (err: any) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    
    if (!isLoginMode) {
      if (!displayName.trim()) {
        setError('게시판에서 활동할 이름을 입력해 주세요.');
        return;
      }
      if (password !== confirmPassword) {
        setError('비밀번호가 일치하지 않습니다.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isLoginMode) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await ensureUserDocument(userCredential.user);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: displayName.trim() });
        await ensureUserDocument(userCredential.user, displayName.trim());
      }
      navigate('/');
    } catch (err: any) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      await signInWithGoogle();
      navigate('/');
    } catch (err: any) {
      setError('구글 로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (isResetMode) {
    return (
      <div className="min-h-[80vh] bg-wood-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-serif font-bold text-wood-900">
            비밀번호 재설정
          </h2>
          <p className="mt-2 text-center text-sm text-wood-600">
            가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-2xl sm:px-10 border border-wood-200">
            <form className="space-y-6" onSubmit={handleResetPassword}>
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              {successMsg && (
                <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-md">
                  <p className="text-sm text-green-700">{successMsg}</p>
                </div>
              )}

              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-wood-700">
                  이메일 주소
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-wood-400" />
                  </div>
                  <input
                    id="reset-email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="focus:ring-gold-500 focus:border-gold-500 block w-full pl-10 sm:text-sm border-wood-300 rounded-md py-2 border"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-wood-900 hover:bg-wood-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-wood-900 transition disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <KeyRound className="w-5 h-5 mr-2" />
                      재설정 이메일 보내기
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsResetMode(false);
                  setError('');
                  setSuccessMsg('');
                }}
                className="text-sm font-medium text-wood-600 hover:text-wood-900 transition"
              >
                로그인 화면으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] bg-wood-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-serif font-bold text-wood-900">
          {isLoginMode ? '로그인' : '회원가입'}
        </h2>
        <p className="mt-2 text-center text-sm text-wood-600">
          함께 지어져가는 교회에 오신 것을 환영합니다
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-2xl sm:px-10 border border-wood-200">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {!isLoginMode && (
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-wood-700">
                  이름 (활동명)
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-wood-400" />
                  </div>
                  <input
                    id="displayName"
                    name="displayName"
                    type="text"
                    required={!isLoginMode}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="focus:ring-gold-500 focus:border-gold-500 block w-full pl-10 sm:text-sm border-wood-300 rounded-md py-2 border"
                    placeholder="게시판에서 사용할 이름을 입력하세요"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-wood-700">
                이메일 주소
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-wood-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus:ring-gold-500 focus:border-gold-500 block w-full pl-10 sm:text-sm border-wood-300 rounded-md py-2 border"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-wood-700">
                  비밀번호
                </label>
                {isLoginMode && (
                  <div className="text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setIsResetMode(true);
                        setError('');
                      }}
                      className="font-medium text-gold-600 hover:text-gold-500"
                    >
                      비밀번호를 잊으셨나요?
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-wood-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isLoginMode ? "current-password" : "new-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-gold-500 focus:border-gold-500 block w-full pl-10 sm:text-sm border-wood-300 rounded-md py-2 border"
                  placeholder={isLoginMode ? "비밀번호를 입력하세요" : "6자리 이상 입력하세요"}
                />
              </div>
            </div>

            {!isLoginMode && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-wood-700">
                  비밀번호 확인
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-wood-400" />
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required={!isLoginMode}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="focus:ring-gold-500 focus:border-gold-500 block w-full pl-10 sm:text-sm border-wood-300 rounded-md py-2 border"
                    placeholder="비밀번호를 다시 한 번 입력하세요"
                  />
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-wood-900 hover:bg-wood-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-wood-900 transition disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : isLoginMode ? (
                  <>
                    <LogIn className="w-5 h-5 mr-2" />
                    로그인
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5 mr-2" />
                    회원가입
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-wood-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-wood-500">또는</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-wood-300 rounded-md shadow-sm bg-white text-sm font-medium text-wood-700 hover:bg-wood-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-wood-900 transition disabled:opacity-50"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                구글 계정으로 {isLoginMode ? '로그인' : '가입하기'}
              </button>
            </div>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setError('');
              }}
              className="text-sm font-medium text-gold-600 hover:text-gold-500 transition"
            >
              {isLoginMode
                ? '아직 계정이 없으신가요? 이메일로 회원가입하기'
                : '이미 계정이 있으신가요? 로그인하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
