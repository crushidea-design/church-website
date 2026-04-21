import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useNextGenerationAuth, Department, EmailSignUpData, SignUpData } from '../lib/nextGenerationAuth';

type ModalView = 'login' | 'signup' | 'complete_google' | 'forgot_password' | 'pending' | 'rejected';

interface Props {
  onClose: () => void;
  initialView?: ModalView;
  rejectionReason?: string;
}

const DEPARTMENTS: Department[] = ['청년', '교사', '학부모'];

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function NextGenerationLoginModal({ onClose, initialView = 'login', rejectionReason }: Props) {
  const {
    signInWithEmail, signUpWithEmail, signInWithGoogle, completeGoogleSignUp,
    sendPasswordReset, checkEmailExists, member, isPending, isRejected,
  } = useNextGenerationAuth();

  const [view, setView] = useState<ModalView>(
    isRejected ? 'rejected' : isPending ? 'pending' : initialView
  );

  // Sync view when auth state changes while modal is open (e.g., pastor approves while modal is visible)
  useEffect(() => {
    if (isRejected) setView('rejected');
    else if (isPending) setView('pending');
  }, [isRejected, isPending]);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPassword2, setSignupPassword2] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupDept, setSignupDept] = useState<Department>('청년');
  const [signupChurch, setSignupChurch] = useState('');
  const [signupIntro, setSignupIntro] = useState('');

  // Complete Google signup form
  const [googleName, setGoogleName] = useState('');
  const [googleDept, setGoogleDept] = useState<Department>('청년');
  const [googleChurch, setGoogleChurch] = useState('');
  const [googleIntro, setGoogleIntro] = useState('');

  // Forgot password
  const [resetEmail, setResetEmail] = useState('');

  const handleError = (err: any) => {
    const code = err?.code || '';
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.');
    } else if (code === 'auth/email-already-in-use') {
      setError('이미 사용 중인 이메일입니다.');
    } else if (code === 'auth/weak-password') {
      setError('비밀번호는 6자 이상이어야 합니다.');
    } else if (code === 'auth/invalid-email') {
      setError('올바른 이메일 형식이 아닙니다.');
    } else if (code === 'auth/popup-closed-by-user') {
      setError('');
    } else {
      setError(err?.message || '오류가 발생했습니다. 다시 시도해 주세요.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signInWithEmail(loginEmail.trim(), loginPassword);
      onClose();
    } catch (err: any) {
      handleError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setSubmitting(true);
    try {
      const result = await signInWithGoogle();
      if (result.needsSignUp) {
        setView('complete_google');
      } else {
        onClose();
      }
    } catch (err: any) {
      handleError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (signupPassword !== signupPassword2) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (signupPassword.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (!signupName.trim()) {
      setError('이름을 입력해 주세요.');
      return;
    }
    if (!signupChurch.trim()) {
      setError('소속 교회를 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const data: EmailSignUpData = {
        email: signupEmail.trim(),
        password: signupPassword,
        displayName: signupName.trim(),
        department: signupDept,
        church: signupChurch.trim(),
        intro: signupIntro.trim(),
      };
      await signUpWithEmail(data);
      setView('pending');
    } catch (err: any) {
      handleError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteGoogle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!googleName.trim()) {
      setError('이름을 입력해 주세요.');
      return;
    }
    if (!googleChurch.trim()) {
      setError('소속 교회를 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const data: SignUpData = {
        displayName: googleName.trim(),
        department: googleDept,
        church: googleChurch.trim(),
        intro: googleIntro.trim(),
      };
      await completeGoogleSignUp(data);
      setView('pending');
    } catch (err: any) {
      handleError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!resetEmail.trim()) {
      setError('이메일을 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      await sendPasswordReset(resetEmail.trim());
      setSuccess('비밀번호 재설정 링크를 이메일로 전송했습니다.');
    } catch (err: any) {
      if (err?.code === 'auth/user-not-found') {
        setError('등록되지 않은 이메일입니다.');
      } else {
        handleError(err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-100 transition-colors z-10"
          aria-label="닫기"
        >
          <X size={20} />
        </button>

        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">✝</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {view === 'login' && '다음세대 로그인'}
              {view === 'signup' && '다음세대 가입 신청'}
              {view === 'complete_google' && '추가 정보 입력'}
              {view === 'forgot_password' && '비밀번호 재설정'}
              {view === 'pending' && '가입 신청 완료'}
              {view === 'rejected' && '가입 신청 결과'}
            </h2>
            {view === 'login' && (
              <p className="text-sm text-gray-500 mt-1">회원 전용 공간입니다</p>
            )}
          </div>

          {/* Error / Success */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-sm text-green-700">
              <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* LOGIN VIEW */}
          {view === 'login' && (
            <>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                    placeholder="example@email.com"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      required
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                      placeholder="비밀번호"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  로그인
                </button>
              </form>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs text-gray-400">
                  <span className="bg-white px-2">또는</span>
                </div>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={submitting}
                className="w-full py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-sm font-medium text-gray-700 disabled:opacity-60"
              >
                <GoogleIcon />
                Google로 계속하기
              </button>

              <div className="flex justify-between mt-4 text-sm">
                <button
                  onClick={() => { setError(''); setView('forgot_password'); }}
                  className="text-amber-600 hover:underline"
                >
                  비밀번호 찾기
                </button>
                <button
                  onClick={() => { setError(''); setView('signup'); }}
                  className="text-amber-600 hover:underline"
                >
                  가입 신청
                </button>
              </div>
            </>
          )}

          {/* SIGNUP VIEW */}
          {view === 'signup' && (
            <>
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이름 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={signupName}
                    onChange={e => setSignupName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                    placeholder="실명을 입력해 주세요"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이메일 <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={signupEmail}
                    onChange={e => setSignupEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                    placeholder="example@email.com"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={signupPassword}
                      onChange={e => setSignupPassword(e.target.value)}
                      required
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                      placeholder="6자 이상"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인 <span className="text-red-500">*</span></label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={signupPassword2}
                    onChange={e => setSignupPassword2(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                    placeholder="비밀번호 재입력"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">소속 <span className="text-red-500">*</span></label>
                  <div className="flex gap-2">
                    {DEPARTMENTS.map(dept => (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => setSignupDept(dept)}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          signupDept === dept
                            ? 'bg-amber-500 border-amber-500 text-white'
                            : 'border-gray-300 text-gray-600 hover:border-amber-300'
                        }`}
                      >
                        {dept}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">소속 교회 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={signupChurch}
                    onChange={e => setSignupChurch(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                    placeholder="예: 한우리교회"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">자기소개</label>
                  <textarea
                    value={signupIntro}
                    onChange={e => setSignupIntro(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm resize-none"
                    placeholder="간단한 소개 (선택)"
                    maxLength={500}
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  가입 신청하기
                </button>
              </form>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs text-gray-400">
                  <span className="bg-white px-2">또는</span>
                </div>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={submitting}
                className="w-full py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-sm font-medium text-gray-700 disabled:opacity-60"
              >
                <GoogleIcon />
                Google로 가입하기
              </button>

              <div className="text-center mt-4">
                <button
                  onClick={() => { setError(''); setView('login'); }}
                  className="text-sm text-amber-600 hover:underline"
                >
                  이미 계정이 있으신가요? 로그인
                </button>
              </div>
            </>
          )}

          {/* COMPLETE GOOGLE SIGNUP */}
          {view === 'complete_google' && (
            <form onSubmit={handleCompleteGoogle} className="space-y-4">
              <p className="text-sm text-gray-500 -mt-2 mb-2">
                Google 계정으로 처음 가입하셨습니다. 추가 정보를 입력해 주세요.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={googleName}
                  onChange={e => setGoogleName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                  placeholder="실명을 입력해 주세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">소속 <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  {DEPARTMENTS.map(dept => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => setGoogleDept(dept)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        googleDept === dept
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'border-gray-300 text-gray-600 hover:border-amber-300'
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">소속 교회 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={googleChurch}
                  onChange={e => setGoogleChurch(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                  placeholder="예: 한우리교회"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">자기소개</label>
                <textarea
                  value={googleIntro}
                  onChange={e => setGoogleIntro(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm resize-none"
                  placeholder="간단한 소개 (선택)"
                  maxLength={500}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                가입 신청하기
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD */}
          {view === 'forgot_password' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-sm text-gray-500 -mt-2 mb-2">
                가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                  placeholder="example@email.com"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                재설정 링크 전송
              </button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setError(''); setSuccess(''); setView('login'); }}
                  className="text-sm text-amber-600 hover:underline"
                >
                  로그인으로 돌아가기
                </button>
              </div>
            </form>
          )}

          {/* PENDING VIEW */}
          {view === 'pending' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={32} className="text-amber-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">가입 신청이 완료되었습니다!</p>
                <p className="text-sm text-gray-500 mt-2">
                  준회원으로 자료 열람과 질문 확인 등 대부분의 기능을 바로 이용할 수 있습니다.<br />
                  승인 여부는 알림(벨 아이콘)으로 안내해 드립니다.
                </p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-left">
                <p className="text-xs font-semibold text-gray-500 mb-2">승인 후 추가 이용 가능</p>
                <ul className="space-y-1 text-xs text-gray-500">
                  <li>· 자료 파일 다운로드</li>
                  <li>· 질문 등록</li>
                </ul>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 text-left">
                <p className="font-medium mb-1">안내</p>
                <ul className="space-y-1 list-disc list-inside text-xs">
                  <li>가입 신청은 30일 이내에 승인이 필요합니다.</li>
                  <li>미승인 시 계정이 자동으로 삭제됩니다.</li>
                </ul>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors"
              >
                확인
              </button>
            </div>
          )}

          {/* REJECTED VIEW */}
          {view === 'rejected' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle size={32} className="text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">가입 신청이 반려되었습니다.</p>
                {(rejectionReason || member?.rejectionReason) && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3 text-sm text-red-700 text-left">
                    <p className="font-medium mb-1">반려 사유</p>
                    <p className="text-xs">{rejectionReason || member?.rejectionReason}</p>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                준회원으로 자료 열람과 질문 확인 등 대부분의 기능을 이용할 수 있습니다.
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-left">
                <p className="text-xs font-semibold text-gray-500 mb-2">승인 후 추가 이용 가능</p>
                <ul className="space-y-1 text-xs text-gray-500">
                  <li>· 자료 파일 다운로드</li>
                  <li>· 질문 등록</li>
                </ul>
              </div>
              <p className="text-xs text-gray-500">
                반려 사유에 대해 문의하시려면{' '}
                <a href="/next/contact" onClick={onClose} className="text-amber-600 underline">문의하기</a>를 이용해 주세요.
              </p>
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
              >
                닫기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
