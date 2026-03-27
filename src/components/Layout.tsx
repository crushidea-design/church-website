import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { signInWithGoogle, logout, db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Menu, X, BookOpen, Users, Mail, Home, Info, PlayCircle, Terminal, PenTool } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function Layout() {
  const { user, role } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  useEffect(() => {
    if (role !== 'admin') {
      setHasUnreadMessages(false);
      return;
    }

    const q = query(collection(db, 'contacts'), where('read', '==', false));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHasUnreadMessages(!snapshot.empty);
    }, (error) => {
      console.error('Error listening for unread messages:', error);
    });

    return () => unsubscribe();
  }, [role]);

  const navItems = [
    { name: '홈', path: '/', icon: Home },
    { name: '소개', path: '/intro', icon: Info },
    { name: '개척 일지', path: '/journal', icon: PenTool },
    { name: '말씀 서재', path: '/sermons', icon: PlayCircle },
    { name: '교회 연구실', path: '/research', icon: BookOpen },
    { name: '소통 게시판', path: '/community', icon: Users },
    { name: '문의', path: '/contact', icon: Mail },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-wood-100 font-sans text-wood-900">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-wood-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex items-center">
              <Link to="/" className="flex-shrink-0 flex items-center gap-3 group">
                <svg width="36" height="36" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md transition-transform duration-300 group-hover:scale-105">
                  {/* Bible Foundation - Curved Open Book */}
                  <path d="M 4 56 C 12 56 22 58 32 62 C 42 58 52 56 60 56 L 60 59 C 52 59 42 61 32 65 C 22 61 12 59 4 59 Z" fill="#2d1e16" />
                  <path d="M 6 54 C 14 54 23 56 32 60 C 41 56 50 54 58 54 L 58 57 C 50 57 41 59 32 63 C 23 59 14 57 6 57 Z" fill="#f8f4e8" stroke="#c5a059" strokeWidth="0.5" />
                  <line x1="32" y1="55" x2="32" y2="63" stroke="#c5a059" strokeWidth="0.8" opacity="0.4" />

                  {/* Bricks (Church Building) - Refined Palette */}
                  {/* Row 1 */}
                  <rect x="15" y="46" width="10" height="8" rx="1.5" fill="#d4af37" />
                  <rect x="26" y="46" width="12" height="8" rx="1.5" fill="#436b47" />
                  <rect x="39" y="46" width="10" height="8" rx="1.5" fill="#8b5e3c" />

                  {/* Row 2 */}
                  <rect x="18" y="37" width="14" height="8" rx="1.5" fill="#8b5e3c" />
                  <rect x="33" y="37" width="13" height="8" rx="1.5" fill="#d4af37" />

                  {/* Row 3 */}
                  <rect x="22" y="28" width="10" height="8" rx="1.5" fill="#436b47" />
                  <rect x="33" y="28" width="9" height="8" rx="1.5" fill="#8b5e3c" />

                  {/* Row 4 */}
                  <rect x="26" y="19" width="12" height="8" rx="1.5" fill="#d4af37" />

                  {/* Cross */}
                  <rect x="30.5" y="7" width="3" height="12" rx="1" fill="#d4af37" />
                  <rect x="26" y="10" width="12" height="3" rx="1" fill="#d4af37" />
                </svg>
                <div className="flex flex-col justify-center">
                  <span className="font-serif font-bold text-xl lg:text-2xl text-wood-900 tracking-tight whitespace-nowrap">
                    함께 지어져가는 교회
                  </span>
                </div>
              </Link>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center space-x-4 lg:space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "text-xs lg:text-sm font-medium transition-colors hover:text-wood-600 whitespace-nowrap",
                    location.pathname === item.path ? "text-wood-900 font-bold border-b-2 border-gold-500 pb-1" : "text-wood-600"
                  )}
                >
                  {item.name}
                </Link>
              ))}
              
              <div className="ml-2 pl-2 lg:ml-4 lg:pl-4 border-l border-wood-200 flex items-center gap-2 lg:gap-4">
                {user ? (
                  <div className="flex items-center gap-2 lg:gap-4">
                    <span className="text-xs lg:text-sm text-wood-600 whitespace-nowrap">
                      {user.displayName}님 
                      {role === 'admin' && (
                        <Link 
                          to="/admin" 
                          className="text-[10px] lg:text-xs bg-wood-900 text-white px-2 lg:px-3 py-1 rounded-full ml-2 hover:bg-wood-800 transition-colors shadow-sm font-bold relative"
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
                      className="text-xs lg:text-sm text-wood-500 hover:text-wood-900 transition whitespace-nowrap border-l border-wood-200 pl-2 lg:pl-4"
                    >
                      로그아웃
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      console.log('Login button clicked');
                      signInWithGoogle();
                    }}
                    className="text-xs lg:text-sm font-medium bg-wood-900 text-white px-4 lg:px-5 py-1.5 lg:py-2 rounded-full hover:bg-wood-800 transition shadow-sm whitespace-nowrap"
                  >
                    로그인
                  </button>
                )}
              </div>
            </nav>

            {/* Mobile menu button */}
            <div className="flex items-center md:hidden">
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
              className="md:hidden bg-white border-b border-wood-200 overflow-hidden"
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
                      <div className="text-base font-medium text-wood-800 mb-4">
                        {user.displayName}님 
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
                    <button
                      onClick={() => { signInWithGoogle(); setIsMobileMenuOpen(false); }}
                      className="w-full mx-3 flex items-center justify-center px-4 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-wood-900 hover:bg-wood-800"
                    >
                      구글 로그인
                    </button>
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
              <h3 className="font-serif text-xl font-bold mb-4 text-gold-400">함께 지어져가는 교회</h3>
              <p className="text-wood-200 text-sm leading-relaxed">
                너희도 성령 안에서 하나님이 거하실 처소가 되기 위하여 그리스도 예수 안에서 함께 지어져 가느니라 (에베소서 2:22)
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-wood-100">바로가기</h4>
              <ul className="space-y-2 text-sm text-wood-300">
                <li><Link to="/intro" className="hover:text-gold-400 transition">교회 소개</Link></li>
                <li><Link to="/journal" className="hover:text-gold-400 transition">개척 일지</Link></li>
                <li><Link to="/sermons" className="hover:text-gold-400 transition">말씀 서재</Link></li>
                <li><Link to="/research" className="hover:text-gold-400 transition">교회 연구실</Link></li>
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
            <div className="order-2 md:order-1">
              &copy; {new Date().getFullYear()} 함께 지어져가는 교회. All rights reserved.
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
