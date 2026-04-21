import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AdminLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
  backTo?: string | number;
  backLabel?: string;
  badge?: string;
  icon?: React.ReactNode;
  aside?: React.ReactNode;
  maxWidthClassName?: string;
}

export default function AdminLayout({
  title,
  description,
  children,
  backTo = '/admin',
  backLabel = '관리자 대시보드',
  badge = 'ADMIN',
  icon,
  aside,
  maxWidthClassName = 'max-w-6xl',
}: AdminLayoutProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (typeof backTo === 'number') {
      navigate(backTo);
      return;
    }

    navigate(backTo);
  };

  return (
    <div className="min-h-screen bg-wood-100 py-12">
      <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${maxWidthClassName}`}>
        <div className="mb-8 rounded-[2rem] border border-wood-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <button
                onClick={handleBack}
                className="mt-1 rounded-full border border-wood-200 p-2 text-wood-700 transition hover:bg-wood-50"
                aria-label={`${backLabel}로 돌아가기`}
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-wood-900 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-white">
                  {icon}
                  {badge}
                </div>
                <h1 className="mt-4 text-3xl font-serif font-bold text-wood-900">{title}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-wood-600">{description}</p>
              </div>
            </div>

            {aside && (
              <div className="rounded-[1.5rem] border border-wood-200 bg-wood-50 px-5 py-4 text-sm text-wood-600">
                {aside}
              </div>
            )}
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
