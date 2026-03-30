import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { signInWithGoogle, logout, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, getDocs, limit } from 'firebase/firestore';
import { Menu, X, BookOpen, Users, Mail, Home, Info, PlayCircle, Terminal, PenTool, Heart, Bell } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { logActivity } from '../utils/logger';
import Logo from './Logo';
import { Toaster, toast } from 'sonner';
import { onMessageListener } from '../services/notificationService';

export default function Layout() {
  const { user, role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  // Automatic Page Tracking
  useEffect(() => {
    if (user) {
      logActivity(user, role, '페이지 방문', location.pathname);
    }
  }, [location.pathname, user, role]);

  useEffect(() => {
    if (role !== 'admin') {
      setHasUnreadMessages(false);
      return;
    }

    const checkUnread = async () => {
      // Check cache with TTL (5 minutes)
      const CACHE_TTL = 5 * 60 * 1000;
      const cachedUnread = localStorage.getItem('admin_unread_messages');
      if (cachedUnread) {
        try {
          const { hasUnread, timestamp } = JSON.parse(cachedUnread);
          setHasUnreadMessages(hasUnread);
          if (Date.now() - timestamp < CACHE_TTL) {
            return;
          }
        } catch (e) {
          localStorage.removeItem('admin_unread_messages');
        }
      }

      try {
        const q = query(collection(db, 'contacts'), where('read', '==', false), limit(1));
        const snapshot = await getDocs(q);
        const hasUnread = !snapshot.empty;
        setHasUnreadMessages(hasUnread);
        localStorage.setItem('admin_unread_messages', JSON.stringify({
          hasUnread,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.error('Error checking unread messages:', error);
        handleFirestoreError(error, OperationType.GET, 'contacts');
      }
    };

    checkUnread();
  }, [role]);

  useEffect(() => {
    const unsubscribe = onMessageListener((payload: any) => {
      if (payload?.notification) {
        const url = payload.data?.url || payload.fcmOptions?.link || '/';
        
        // Prevent duplicate toasts by checking if one with the same title already exists
        // Sonner handles some of this, but we can be explicit if needed.
        // For now, we just ensure the action is correctly set.
        toast(payload.notification.title, {
          description: payload.notification.body,
          icon: <Bell className="text-gold-500" />,
          duration: 8000,
          action: url !== '/' ? {
            label: '보기',
            onClick: () => navigate(url)
          } : undefined,
        });
      }
    });
    
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [navigate]);

  const navItems = [
    { name: '홈', path: '/', icon: Home },
    { name: '소개', path: '/intro', icon: Info },
    { name: '개척 일지', path: '/journal', icon: PenTool },
    { name: '말씀 아카이브', path: '/archive', icon: BookOpen },
    { name: '소통 게시판', path: '/community', icon: Users },
    { name: '기도자의 방', path: '/prayer-room', icon: Heart },
    { name: '문의', path: '/contact', icon: Mail },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-wood-100 font-sans text-wood-900">
      <Toaster position="top-right" expand={true} richColors />
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-wood-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex items-center">
              <Link to="/" className="flex-shrink-0 flex items-end gap-2 group">
                <Logo className="w-16 h-16 drop-shadow-md transition-transform duration-300 group-hover:scale-105" />
                <div className="flex flex-col justify-center mb-2 min-w-[200px] lg:min-w-[220px]">
                  <div className="flex justify-between font-serif font-bold text-xl lg:text-xl text-wood-900 leading-tight w-full">
                    {Array.from("함께 지어져가는 교회").map((c, i) => (
                      <span key={i} className={c === ' ' ? 'w-1' : ''}>{c}</span>
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] lg:text-[9px] text-gold-700 font-bold uppercase opacity-80 leading-none mt-1.5 w-full">
                    {Array.from("BUILT TOGETHER CHURCH").map((c, i) => (
                      <span key={i} className={c === ' ' ? 'w-1' : ''}>{c}</span>
                    ))}
                  </div>
                </div>
              </Link>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center space-x-3 xl:space-x-6">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "text-xs xl:text-sm font-medium transition-colors hover:text-wood-600 whitespace-nowrap",
                    location.pathname === item.path ? "text-wood-900 font-bold border-b-2 border-gold-500 pb-1" : "text-wood-600"
                  )}
                >
                  {item.name}
                </Link>
              ))}
              
              <div className="ml-3 pl-3 xl:ml-4 xl:pl-4 border-l border-wood-200 flex items-center gap-3 xl:gap-4">
                {user ? (
                  <div className="flex items-center gap-3 xl:gap-4">
                    <span className="text-xs xl:text-sm text-wood-600 whitespace-nowrap flex items-center">
                      <Link to="/profile" className="hover:text-wood-900 hover:underline transition-colors">
                        {user.displayName}님
                      </Link>
                      {role === 'admin' && (
                        <Link 
                          to="/admin" 
                          className="text-[10px] xl:text-xs bg-wood-900 text-white px-2 xl:px-3 py-1 rounded-full ml-2 hover:bg-wood-800 transition-colors shadow-sm font-bold relative"
                        >
                          목사님
                          {hasUnreadMessages && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                          )}
                        </Link>
                      )}
                    </span>
                    <button
                      onClick={logout}
                      className="text-xs xl:text-sm text-wood-500 hover:text-wood-900 transition whitespace-nowrap border-l border-wood-200 pl-3 xl:pl-4"
                    >
                      로그아웃
                    </button>
                  </div>
                ) : (
                  <Link
                    to="/login"
                    className="text-xs xl:text-sm font-medium bg-wood-900 text-white px-4 xl:px-5 py-1.5 xl:py-2 rounded-full hover:bg-wood-800 transition shadow-sm whitespace-nowrap"
                  >
                    로그인
                  </Link>
                )}
              </div>
            </nav>

            {/* Mobile menu button */}
            <div className="flex items-center lg:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-wood-600 hover:text-wood-900 p-2"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-white border-b border-wood-200 overflow-hidden"
            >
              <div className="px-4 pt-2 pb-6 space-y-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "block px-3 py-3 rounded-md text-base font-medium",
                      location.pathname === item.path ? "bg-wood-50 text-wood-900" : "text-wood-700 hover:bg-wood-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon size={18} className={location.pathname === item.path ? "text-wood-900" : "text-wood-600"} />
                      {item.name}
                    </div>
                  </Link>
                ))}
                
                <div className="mt-6 pt-6 border-t border-wood-100">
                  {user ? (
                    <div className="px-3">
                      <div className="text-base font-medium text-wood-800 mb-4 flex items-center">
                        <Link 
                          to="/profile" 
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="hover:text-wood-900 hover:underline transition-colors"
                        >
                          {user.displayName}님
                        </Link>
                        {role === 'admin' && (
                          <Link 
                            to="/admin" 
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="text-xs bg-wood-900 text-white px-2 py-0.5 rounded-full ml-2 font-bold relative inline-flex items-center"
                          >
                            목사님
                            {hasUnreadMessages && (
                              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white animate-pulse" />
                            )}
                          </Link>
                        )}
                      </div>
                      <button
                        onClick={() => { logout(); setIsMobileMenuOpen(false); }}
                        className="w-full text-left text-base font-medium text-red-600 hover:text-red-800 py-2 border-t border-wood-100 mt-2"
                      >
                        로그아웃
                      </button>
                    </div>
                  ) : (
                    <Link
                      to="/login"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="w-full mx-3 flex items-center justify-center px-4 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-wood-900 hover:bg-wood-800"
                    >
                      로그인
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-wood-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex flex-col mb-4">
                <h3 className="font-serif text-xl font-bold text-gold-400 leading-tight">함께 지어져가는 교회</h3>
                <span className="text-[10px] text-gold-600 font-bold tracking-[0.2em] uppercase opacity-80">Built Together Church</span>
              </div>
              <p className="text-wood-200 text-sm leading-relaxed">
                너희도 성령 안에서 하나님이 거하실 처소가 되기 위하여 그리스도 예수 안에서 함께 지어져 가느니라 (에베소서 2:22)
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-wood-100">바로가기</h4>
              <ul className="grid grid-cols-2 gap-y-2 gap-x-6 w-fit text-sm text-wood-300">
                <li><Link to="/intro" className="hover:text-gold-400 transition">교회 소개</Link></li>
                <li><Link to="/journal" className="hover:text-gold-400 transition">개척 일지</Link></li>
                <li><Link to="/archive/today" className="hover:text-gold-400 transition">오늘의 말씀</Link></li>
                <li><Link to="/archive/sermons" className="hover:text-gold-400 transition">말씀 서재</Link></li>
                <li><Link to="/archive/research" className="hover:text-gold-400 transition">교회 연구실</Link></li>
                <li><Link to="/community" className="hover:text-gold-400 transition">소통 게시판</Link></li>
                <li><Link to="/contact" className="hover:text-gold-400 transition">개척 모임 문의</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-wood-100">연락처</h4>
              <ul className="space-y-2 text-sm text-wood-300">
                <li>이메일: crushidea@gmail.com</li>
                <li>예배 장소: (개척 준비 중)</li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-wood-800 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-wood-400">
            <div className="order-2 md:order-1 flex flex-col gap-1">
              <div>&copy; {new Date().getFullYear()} 함께 지어져가는 교회. All rights reserved.</div>
              <div className="text-[10px] tracking-[0.4em] uppercase font-bold text-wood-500">Soli Deo Gloria</div>
            </div>
            <div className="order-1 md:order-2 flex items-center gap-6">
              <Link to="/privacy" className="hover:text-gold-400 transition">개인정보처리방침</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
