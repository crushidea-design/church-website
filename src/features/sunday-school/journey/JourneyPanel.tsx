// "이번 주 문답 여정": the child's and parent's weekly journey on /next/school.
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useNextGenerationAuth } from '../../../lib/nextGenerationAuth';
import { toLocalDateKey } from '../../../lib/nextGenerationResources';
import { useSundaySchoolCatalog } from '../api';
import { getWeekCurriculumInfo } from '../classScreen';
import JourneyChildCard from './JourneyChildCard';
import { useJourneyChildren } from './useJourneyChildren';

const FAMILY_COLUMN_LINK = '/next/school?resource=family_column#school-library';
const FAMILY_WORSHIP_LINK = '/next/school?resource=family_worship#school-library';

const STEPS_INTRO = ['배움: 주일 공과 시간', '가정예배: 가정예배지로 드려요', '실천: 아이가 약속한 것을 해요', '암송: 다음 주일에 확인해요'];

function Intro({ message }: { message: string }) {
  return (
    <section className="rounded-2xl border border-emerald-100 bg-white p-5">
      <h2 className="text-lg font-black text-emerald-950">이번 주 문답 여정</h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">
        주일에 배운 하이델베르크 문답 하나를 한 주 동안 가정에서 이어 가는 길입니다.
      </p>
      <ul className="mt-2 grid gap-1 text-sm font-bold text-emerald-900 sm:grid-cols-2">
        {STEPS_INTRO.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-3 text-sm font-bold text-slate-600">{message}</p>
    </section>
  );
}

export default function JourneyPanel({ sundayKey }: { sundayKey: string }) {
  const { user, loading, isMember } = useNextGenerationAuth();
  const catalog = useSundaySchoolCatalog();
  const { children, empty } = useJourneyChildren();
  const todayKey = useMemo(() => toLocalDateKey(new Date()), []);
  const weekLine = useMemo(() => getWeekCurriculumInfo(catalog.curriculum, sundayKey).line, [catalog.curriculum, sundayKey]);

  if (loading) return null;
  if (!user) return <Intro message="화면 위쪽의 로그인 단추로 로그인하면 우리 아이의 여정을 볼 수 있어요." />;
  if (!isMember || empty) {
    return (
      <Intro message="학생 계정이나 자녀가 연결된 학부모 계정에서 여정을 볼 수 있어요. 자녀 등록은 마이페이지에서 할 수 있어요." />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-emerald-900">
        <span>{sundayKey} 주일부터 이어지는 한 주</span>
        <Link to={FAMILY_WORSHIP_LINK} className="underline underline-offset-2 hover:text-emerald-700">
          이번 주 가정예배지 보기
        </Link>
        <Link to={FAMILY_COLUMN_LINK} className="underline underline-offset-2 hover:text-emerald-700">
          예배를 잇는 가정 읽기
        </Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {children.map((child) => (
          <JourneyChildCard
            key={child.uid}
            child={child}
            weekKey={sundayKey}
            todayKey={todayKey}
            uid={user.uid}
            curriculum={catalog.curriculum}
            weekLine={weekLine}
          />
        ))}
      </div>
      <p className="text-xs text-slate-500">우리 가정의 기록만 보입니다. 한 주 동안 함께 걸어 주셔서 감사합니다.</p>
    </div>
  );
}
