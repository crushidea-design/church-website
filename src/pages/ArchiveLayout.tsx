import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, Book, FileText } from 'lucide-react';
import { cn } from '../lib/utils';

export default function ArchiveLayout() {
  const location = useLocation();

  const tabs = [
    { name: '오늘의 말씀', path: '/archive/today', icon: BookOpen },
    { name: '말씀 서재', path: '/archive/sermons', icon: Book },
    { name: '교회 연구실', path: '/archive/research', icon: FileText },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-serif font-bold text-wood-900 mb-4">말씀 아카이브</h1>
        <p className="text-wood-600">
          하나님의 말씀을 깊이 있게 연구하고 묵상하는 공간입니다.
        </p>
      </div>

      <div className="border-b border-wood-200 mb-8">
        <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = location.pathname.startsWith(tab.path);
            return (
              <Link
                key={tab.name}
                to={tab.path}
                className={cn(
                  isActive
                    ? 'border-gold-500 text-wood-900'
                    : 'border-transparent text-wood-500 hover:text-wood-700 hover:border-wood-300',
                  'group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors'
                )}
              >
                <tab.icon
                  className={cn(
                    isActive ? 'text-gold-500' : 'text-wood-400 group-hover:text-wood-500',
                    '-ml-0.5 mr-2 h-5 w-5 transition-colors'
                  )}
                  aria-hidden="true"
                />
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="min-h-[500px]">
        <Outlet />
      </div>
    </div>
  );
}
