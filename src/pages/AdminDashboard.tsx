import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Users, Mail, ArrowLeft, Settings, ShieldCheck, Video, FlaskConical, Activity, Bell } from 'lucide-react';
import { motion } from 'motion/react';

export default function AdminDashboard() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  if (role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wood-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-wood-900 mb-4">권한이 없습니다</h2>
          <p className="text-wood-600 mb-4">이 페이지는 관리자(목회자) 전용입니다.</p>
          <button onClick={() => navigate('/')} className="text-wood-600 hover:underline">홈으로 돌아가기</button>
        </div>
      </div>
    );
  }

  const adminItems = [
    {
      title: '디지털 출석부',
      description: '성도들의 홈페이지 방문 및 활동 로그(디지털 심방 자료)를 확인합니다.',
      icon: Activity,
      path: '/admin/activity-logs',
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100'
    },
    {
      title: '교회 정보 관리',
      description: '교회 소개 페이지의 텍스트와 내용을 수정합니다.',
      icon: Settings,
      path: '/admin/church-info',
      color: 'bg-rose-50 text-rose-600 border-rose-100'
    },
    {
      title: '회원 관리',
      description: '가입된 회원의 등급(준회원/정회원)을 관리하고 권한을 부여합니다.',
      icon: Users,
      path: '/admin/users',
      color: 'bg-blue-50 text-blue-600 border-blue-100'
    },
    {
      title: '문의 관리',
      description: '남겨주신 개척 모임 문의와 연락처 정보를 확인하고 관리합니다.',
      icon: Mail,
      path: '/admin/contacts',
      color: 'bg-amber-50 text-amber-600 border-amber-100'
    },
    {
      title: '말씀 서재 카테고리',
      description: '설교 영상들을 묶을 재생목록(강해 시리즈 등)을 관리합니다.',
      icon: Video,
      path: '/admin/sermon-categories',
      color: 'bg-purple-50 text-purple-600 border-purple-100'
    },
    {
      title: '교회 연구실 카테고리',
      description: '연구글들을 묶을 카테고리(예배학, 설교학 등)를 관리합니다.',
      icon: FlaskConical,
      path: '/admin/research-categories',
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100'
    },
    {
      title: '알림 발송',
      description: '성도들에게 모바일 푸시 알림을 보냅니다. (공지사항, 긴급 소식 등)',
      icon: Bell,
      path: '/admin/notifications',
      color: 'bg-orange-50 text-orange-600 border-orange-100'
    }
  ];

  return (
    <div className="bg-wood-100 min-h-screen py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-white rounded-full transition shadow-sm border border-wood-200"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-3xl font-serif font-bold text-wood-900">목사님 전용 관리실</h1>
              <p className="text-wood-600">교회 운영과 성도 관리를 위한 공간입니다.</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-wood-900 text-white px-4 py-2 rounded-full text-sm font-medium shadow-md">
            <ShieldCheck size={18} />
            관리자 모드
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {adminItems.map((item, index) => (
            <motion.div
              key={item.path}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link
                to={item.path}
                className="block bg-white rounded-3xl p-8 border border-wood-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group h-full"
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border ${item.color} group-hover:scale-110 transition-transform`}>
                  <item.icon size={28} />
                </div>
                <h3 className="text-xl font-bold text-wood-900 mb-3 flex items-center justify-between">
                  {item.title}
                  <Settings size={18} className="text-wood-300 group-hover:rotate-90 transition-transform duration-500" />
                </h3>
                <p className="text-wood-600 leading-relaxed">
                  {item.description}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 p-8 bg-white/50 backdrop-blur-sm rounded-3xl border border-wood-200/50 text-center">
          <p className="text-sm text-wood-500">
            "너희는 양 떼를 위하여 삼가라 성령이 그들 가운데 여러분을 감독자로 삼고 하나님이 자기 피로 사신 교회를 보살피게 하셨느니라" (사도행전 20:28)
          </p>
        </div>
      </div>
    </div>
  );
}
