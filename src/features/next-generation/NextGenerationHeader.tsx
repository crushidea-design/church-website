// Sticky header for the next-generation app: nav links, notifications,
// auth menu, admin/tutorial entry points.
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, HelpCircle, LogIn, LogOut, Settings, X } from 'lucide-react';
import { useNextGenerationAuth } from '../../lib/nextGenerationAuth';
import {
  NEXT_GENERATION_PATH,
} from '../../lib/nextGenerationResources';
import {
  NEXT_GENERATION_NOTIFICATION_TOPIC,
  requestNotificationPermission,
} from '../../services/notificationService';
import {
  markNextGenerationTutorialSeen,
  shouldAutoOpenNextGenerationTutorial,
} from '../../lib/nextGenerationTutorial';
import { shouldShowParentOnboarding } from '../word-fruit/parentOnboarding';
import NextGenerationLoginModal from '../../pages/NextGenerationLoginModal';
import NextGenerationAdmin from '../../pages/NextGenerationAdmin';
import ParentOnboardingModal from '../word-fruit/ParentOnboardingModal';
import NextGenerationTutorialModal from './NextGenerationTutorialModal';
import { getRejectedNoticeVersion } from './sharedConstants';

export default function NextGenerationHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user, member, loading: authLoading, isPastor, isMember, isPending, isRejected,
    hasAccess, needsSignUp, notifications, unreadCount, markNotificationRead, signOut,
  } = useNextGenerationAuth();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default');
  const [enablingNotifications, setEnablingNotifications] = useState(false);

  // 종 버튼: 최초 1회 권한 요청, 이후에는 알림함 토글
  // 토픽 구독은 정식 회원(hasAccess)일 때만, 반려/대기는 토큰만 등록
  const handleBellClick = async () => {
    if (!user) return;

    if (notificationPermission === 'default') {
      setEnablingNotifications(true);
      try {
        const token = await requestNotificationPermission(
          user.uid,
          hasAccess ? { topic: NEXT_GENERATION_NOTIFICATION_TOPIC } : undefined
        );
        const currentPermission =
          typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
        setNotificationPermission(currentPermission as 'default' | 'granted' | 'denied' | 'unsupported');
        if (!token && currentPermission === 'denied') {
          window.alert('브라우저 설정에서 알림 권한을 허용해 주세요.');
        }
      } finally {
        setEnablingNotifications(false);
      }
      return;
    }

    setShowNotifications(v => !v);
    notifications.filter(n => !n.isRead).forEach(n => markNotificationRead(n.id));
  };

  const navItems = [
    { name: '다음세대 소개', path: NEXT_GENERATION_PATH },
    { name: '유초등부', path: `${NEXT_GENERATION_PATH}/elementary` },
    { name: '청년부', path: `${NEXT_GENERATION_PATH}/young-adults` },
    { name: '문의하기', path: `${NEXT_GENERATION_PATH}/contact` },
  ];

  const openTutorial = () => setShowTutorial(true);
  const closeTutorial = () => {
    try {
      markNextGenerationTutorialSeen(typeof window !== 'undefined' ? window.localStorage : null);
    } catch (error) {
      console.warn('Unable to persist next-generation tutorial state:', error);
    }
    setShowTutorial(false);
  };

  // Show login modal when needsSignUp triggers (Google sign-in new user)
  useEffect(() => {
    if (needsSignUp) setShowLoginModal(true);
  }, [needsSignUp]);

  useEffect(() => {
    if (needsSignUp || isRejected) {
      return;
    }

    try {
      if (shouldAutoOpenNextGenerationTutorial(typeof window !== 'undefined' ? window.localStorage : null)) {
        setShowTutorial(true);
      }
    } catch (error) {
      console.warn('Unable to read next-generation tutorial state:', error);
    }
  }, [isRejected, needsSignUp]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }

    setNotificationPermission(Notification.permission);
  }, [user]);

  useEffect(() => {
    if (!isRejected || !user) {
      return;
    }

    const rejectedVersion = getRejectedNoticeVersion(member);
    const storageKey = `next_generation_rejected_notice_seen_${user.uid}`;

    try {
      const alreadySeenVersion = localStorage.getItem(storageKey);
      if (alreadySeenVersion === rejectedVersion) {
        return;
      }

      localStorage.setItem(storageKey, rejectedVersion);
      setShowLoginModal(true);
    } catch (error) {
      console.warn('Unable to persist rejected notice state:', error);
      setShowLoginModal(true);
    }
  }, [isRejected, member, user]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-emerald-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:px-6 sm:gap-3 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-4">
          <div className="flex items-center justify-between gap-4">
            <Link to={NEXT_GENERATION_PATH} className="flex items-center gap-3" data-next-tour="app-home">
              <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-amber-100 shadow-sm">
                <img src="/next-generation-favicon.svg" alt="" className="h-12 w-12" />
              </span>
              <span className="flex w-[160px] flex-col sm:w-[198px]">
                <span className="flex justify-between text-lg font-black leading-tight tracking-normal text-emerald-950">
                  {Array.from('한우리교회 다음세대').map((char, index) => (
                    <span key={`${char}-${index}`} className={char === ' ' ? 'w-2' : ''}>
                      {char}
                    </span>
                  ))}
                </span>
                <span className="mt-1 flex justify-between text-[10px] font-bold uppercase leading-none text-coral-700 sm:hidden">
                  <span>GROWING</span>
                  <span>IN</span>
                  <span>THE</span>
                  <span>COVENANT</span>
                </span>
                <span className="mt-1 hidden justify-between text-xs font-bold uppercase leading-none tracking-normal text-coral-700 sm:flex">
                  {Array.from('GROWING IN THE COVENANT').map((char, index) => (
                    <span key={`${char}-${index}`} className={char === ' ' ? 'w-1.5' : ''}>
                      {char}
                    </span>
                  ))}
                </span>
              </span>
            </Link>

            {/* Auth controls (mobile: inline with logo) */}
            <div className="flex items-center gap-2 lg:hidden">
              {!authLoading && !user && (
                <button
                  onClick={() => setShowLoginModal(true)}
                  data-next-tour="profile-entry"
                  className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-bold text-white hover:bg-amber-600 transition"
                >
                  <LogIn size={15} /> 로그인
                </button>
              )}
              {!authLoading && isPastor && (
                <>
                  <button
                    onClick={() => setShowAdminModal(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-bold text-amber-800 hover:bg-amber-200 transition"
                  >
                    <Settings size={14} />
                  </button>
                  <button
                    onClick={() => signOut()}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 transition"
                  >
                    <LogOut size={14} />
                  </button>
                </>
              )}
              {!authLoading && user && !isPastor && (
                <>
                  <button
                    onClick={() => navigate(`${NEXT_GENERATION_PATH}/me`)}
                    data-next-tour="profile-entry"
                    className="relative flex h-9 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-xs font-black text-emerald-900 hover:bg-emerald-100 transition"
                  >
                    <span>{member?.department || '내 역할'}</span>
                    <Bell size={14} />
                    {unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => signOut()}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 transition"
                  >
                    <LogOut size={14} />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3" data-next-tour="guide-actions">
            <nav className="flex gap-2 overflow-x-auto pb-1 lg:pb-0" aria-label="다음세대">
              <button
                type="button"
                onClick={openTutorial}
                className="order-last inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-2 text-sm font-bold text-amber-900 transition hover:bg-amber-200"
              >
                <HelpCircle size={15} />
                이용 안내
              </button>
              {navItems.map((item) => {
                const isActive =
                  item.path === NEXT_GENERATION_PATH
                    ? location.pathname === item.path
                    : location.pathname.startsWith(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold transition ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Auth controls (desktop) */}
            <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
              {!authLoading && !user && (
                <button
                  onClick={() => setShowLoginModal(true)}
                  data-next-tour="profile-entry"
                  className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-white hover:bg-amber-600 transition"
                >
                  <LogIn size={15} /> 로그인
                </button>
              )}
              {!authLoading && isPastor && (
                <>
                  <button
                    onClick={() => setShowAdminModal(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-2 text-sm font-bold text-amber-800 hover:bg-amber-200 transition"
                  >
                    <Settings size={14} /> 관리
                  </button>
                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 transition"
                  >
                    <LogOut size={14} />
                  </button>
                </>
              )}
              {!authLoading && user && !isPastor && (
                <>
                  <button
                    onClick={() => navigate(`${NEXT_GENERATION_PATH}/me`)}
                    data-next-tour="profile-entry"
                    className="relative flex h-9 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-sm font-black text-emerald-900 hover:bg-emerald-100 transition"
                  >
                    <span>{member?.department || '내 역할'}</span>
                    <Bell size={15} />
                    {unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  {member && (
                    <span className="text-xs font-bold text-gray-600 max-w-[80px] truncate">
                      {member.displayName}
                      {isPending && <span className="ml-1 text-amber-500">(대기)</span>}
                    </span>
                  )}
                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 transition"
                  >
                    <LogOut size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Shared notification dropdown — rendered outside breakpoint blocks so it works on mobile too */}
      {showNotifications && user && !isPastor && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setShowNotifications(false)}
        >
          <div
            className="absolute right-4 top-20 z-40 w-72 rounded-xl border border-gray-200 bg-white shadow-xl sm:right-6 lg:right-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <p className="text-sm font-bold text-gray-900">알림</p>
              <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">알림이 없습니다.</p>
            ) : (
              <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                {notifications.map(n => (
                  <li
                    key={n.id}
                    onClick={() => markNotificationRead(n.id)}
                    className={`cursor-pointer px-4 py-3 text-sm transition hover:bg-gray-50 ${!n.isRead ? 'bg-amber-50' : ''}`}
                  >
                    <p className={`font-medium ${
                      n.type === 'approved' ? 'text-emerald-700'
                      : n.type === 'answered' ? 'text-amber-600'
                      : n.type === 'announcement' ? 'text-blue-700'
                      : 'text-red-600'
                    }`}>
                      {n.type === 'approved' && '✓ 가입 승인됨'}
                      {n.type === 'rejected' && '✗ 가입 반려됨'}
                      {n.type === 'answered' && '💬 질문 답변 도착'}
                      {n.type === 'announcement' && '📢 공지'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                    {n.rejectionReason && (
                      <p className="text-xs text-red-500 mt-0.5">사유: {n.rejectionReason}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {showTutorial && <NextGenerationTutorialModal onClose={closeTutorial} />}
      {showLoginModal && (
        <NextGenerationLoginModal
          onClose={() => setShowLoginModal(false)}
          initialView={isRejected ? 'rejected' : isPending ? 'pending' : needsSignUp ? 'complete_google' : 'login'}
        />
      )}
      {showAdminModal && <NextGenerationAdmin onClose={() => setShowAdminModal(false)} />}
      {shouldShowParentOnboarding(member, hasAccess) && (
        <ParentOnboardingModal />
      )}
    </>
  );
}
