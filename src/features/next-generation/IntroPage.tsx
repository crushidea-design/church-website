// Landing/intro page for next-generation. Renders department cards
// and CMS-managed intro sections.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Sparkles, Users, X } from 'lucide-react';
import { NextGenerationIntroSection } from '../../lib/nextGenerationCms';
import {
  DepartmentCardItem,
  introImage,
  sectionTabs,
  youngAdultsIntroImage,
} from './sharedConstants';

export default function IntroPage({
  sections,
  departments,
}: {
  sections?: NextGenerationIntroSection[];
  departments?: DepartmentCardItem[];
}) {
  const departmentCards = (departments && departments.length > 0) ? departments : (sectionTabs as any);
  const cmsIntroSections = (sections || [])
    .filter((section) => section.isVisible)
    .sort((a, b) => a.order - b.order);
  const introPillars = [
    {
      title: '예배 중심 교육',
      paragraphs: [
        '다음세대 교육의 중심은 전세대가 함께 드리는 언약 공동체의 예배입니다. 주일 오전 10시에 모여 11시 공예배로 자연스럽게 이어지도록 구성하며, 이 시간은 단순한 사전 모임이 아니라 예배를 준비하고 연결하는 교육의 자리입니다. 모임 가운데서는 예배에서 부를 시편 찬송을 미리 배우고, 말씀을 들을 마음을 준비하며 예배자로 서는 훈련을 합니다.',
        '아이들은 공예배 설교를 듣고 설교노트를 작성하며, 교역자의 확인과 코멘트를 통해 말씀을 더 정확히 이해하도록 돕습니다. 유치부는 본문을 반영한 색칠 도안을 활용하고, “말씀 중 특정 단어가 나오면 표시하기”, “정해진 시간 집중해서 듣기”와 같은 예배 미션을 통해 예배에 능동적으로 참여합니다. 이를 통해 아이들은 예배를 단순히 버티는 시간이 아니라, 하나님 앞에 서는 예배자로 훈련받는 시간으로 경험하게 됩니다.',
      ],
      gallery: [
        { src: '/next-generation/pillars/worship/worship-note-kindergarten-1.jpg', alt: '유치부 설교노트 예시 1' },
        { src: '/next-generation/pillars/worship/worship-note-kindergarten-2.jpg', alt: '유치부 설교노트 예시 2' },
        { src: '/next-generation/pillars/worship/worship-note-kindergarten-3.jpg', alt: '유치부 설교노트 예시 3' },
        { src: '/next-generation/pillars/worship/worship-note-elementary-1.jpg', alt: '초등부 설교노트 예시 1' },
        { src: '/next-generation/pillars/worship/worship-note-elementary-2.jpg', alt: '초등부 설교노트 예시 2' },
      ],
    },
    {
      title: '가정과 동행',
      paragraphs: [
        '교회는 가정을 대신하지 않고, 부모와 함께 다음세대의 신앙을 세워가는 동역자로 서고자 합니다. 주일에 배우는 말씀은 교회에서 끝나지 않고 가정으로 이어지도록 구성되어, 부모와 자녀가 한 주간 동일한 말씀 안에서 대화하고 실천할 수 있도록 돕습니다.',
        '이를 위해 매주 ‘예배를 잇는 가정’ 자료를 제공하여, 강의의 핵심을 가정에서 다시 나누고 적용할 수 있도록 안내합니다. 부모가 자녀에게 말씀을 설명하고 함께 기도할 수 있도록 돕는 질문과 실천 과제가 포함되며, 추후 가정예배가 자연스럽게 이루어지도록 돕습니다.',
        '우리는 부모가 신앙교육의 첫 번째 책임자라는 성경적 원리를 따라, 교회 교육이 가정을 지원하고 세워가는 구조를 지향합니다. 이를 통해 아이들은 교회와 가정이 분리되지 않고 하나의 흐름 안에서 하나님을 배우며 자라가게 됩니다.',
      ],
      gallery: [
        { src: '/next-generation/pillars/family/family-worship-guide-1-1.jpg', alt: '예배를 잇는 가정 1호 예시 1' },
        { src: '/next-generation/pillars/family/family-worship-guide-1-2.jpg', alt: '예배를 잇는 가정 1호 예시 2' },
        { src: '/next-generation/pillars/family/family-worship-guide-2-1.jpg', alt: '예배를 잇는 가정 2호 예시 1' },
        { src: '/next-generation/pillars/family/family-worship-guide-2-2.jpg', alt: '예배를 잇는 가정 2호 예시 2' },
      ],
    },
    {
      title: '성경과 교리',
      paragraphs: [
        '성경은 하나님께서 주신 말씀으로, 우리를 가르치고 바르게 하며 하나님 앞에서 살아가도록 이끕니다. 한우리교회 다음세대는 이 말씀 위에 굳게 서도록 돕고, 그 내용을 체계적으로 정리한 교리 교육을 통해 무엇을 믿어야 하는지 분명히 배우게 합니다. 단편적인 성경 지식이 아니라, 말씀 전체를 바르게 이해하고 삶에 적용할 수 있는 신앙의 틀을 세우는 것이 목표입니다.',
        '이를 위해 성경과 교리를 함께 배우는 커리큘럼을 구성하여, 아이들이 자연스럽게 신앙의 내용을 쌓아가도록 합니다.',
        '이 과정을 통해 아이들은 성경 위에 서고, 교리를 통해 정리하며, 삶으로 이어지는 신앙을 갖게 됩니다.',
        '지금은 2025년 여름부터 예배에 대한 주제를 살피는 가운데 사도신경을 지나 십계명을 공부하고 있습니다.',
      ],
      highlights: [
        '성경: 성경 전체의 흐름을 따라 주요 본문을 배우며, 하나님의 구속사를 이해합니다.',
        '교리: 웨스트민스터 소요리문답을 중심으로, 믿어야 할 내용을 체계적으로 익힙니다.',
        '예배 이해: 공예배의 순서와 의미를 배우며, 하나님 중심의 예배를 익힙니다.',
        '삶의 적용: 배운 말씀과 교리를 실제 삶 속에서 어떻게 살아낼지 구체적으로 나눕니다.',
      ],
      gallery: [
        { src: '/next-generation/pillars/curriculum/curriculum-benefit-of-scripture-1.jpg', alt: '공과 성경의 유익 예시 1' },
        { src: '/next-generation/pillars/curriculum/curriculum-benefit-of-scripture-2.jpg', alt: '공과 성경의 유익 예시 2' },
        { src: '/next-generation/pillars/curriculum/curriculum-before-god-1.jpg', alt: '공과 하나님 앞에서 예시 1' },
        { src: '/next-generation/pillars/curriculum/curriculum-before-god-2.jpg', alt: '공과 하나님 앞에서 예시 2' },
        { src: '/next-generation/pillars/curriculum/curriculum-power-of-scripture-1.jpg', alt: '공과 성경의 능력 예시 1' },
        { src: '/next-generation/pillars/curriculum/curriculum-power-of-scripture-2.jpg', alt: '공과 성경의 능력 예시 2' },
      ],
    },
  ];
  const [activePillar, setActivePillar] = useState<string | null>(null);
  const selectedPillar = introPillars.find((pillar) => pillar.title === activePillar);
  const youngAdultIntroPillars = [
    {
      title: '교리 교육',
      paragraphs: [
        '청년 1부는 천로역정을 중심으로 교리 교육을 진행합니다.',
        '주인공의 여정을 따라가며 성도의 삶에서 마주하는 죄, 유혹, 고난, 그리고 은혜를 배우고, 교리를 단순한 지식이 아니라 삶 속에서 적용되는 진리로 익혀 갑니다.',
      ],
      gallery: [
        { src: '/next-generation/young-adults/doctrine/doctrine-1.jpg', alt: '교리 교육 자료 예시 1' },
        { src: '/next-generation/young-adults/doctrine/doctrine-2.jpg', alt: '교리 교육 자료 예시 2' },
        { src: '/next-generation/young-adults/doctrine/doctrine-3.png', alt: '교리 교육 자료 예시 3' },
        { src: '/next-generation/young-adults/doctrine/doctrine-4.png', alt: '교리 교육 자료 예시 4' },
      ],
    },
    {
      title: '삶의 적용',
      paragraphs: [
        '청년 1부는 주일 말씀을 한 번 듣고 끝내지 않습니다.',
        '주중에 제공되는 복습 팟캐스트를 통해 설교 내용을 다시 정리하고, 삶에 어떻게 적용할지를 구체적으로 고민합니다.',
        '또한 매달 첫째 주일에는 천로역정 공부를 잠시 내려놓고 말씀 나눔의 시간을 가집니다.',
        '오전 예배에서 선포되는 말씀과 오후 예배에서 베풀어지는 교리 강설을 중심으로, 준비된 나눔지를 통해 함께 복습하고 적용을 나눕니다.',
        '이 과정을 통해 말씀을 삶으로 잇는 실제적인 훈련을 지속해 나가고 있습니다.',
      ],
      gallery: [
        { src: '/next-generation/young-adults/application/application-1.jpg', alt: '삶의 적용 자료 예시 1' },
        { src: '/next-generation/young-adults/application/application-2.png', alt: '삶의 적용 자료 예시 2' },
        { src: '/next-generation/young-adults/application/application-3.jpg', alt: '삶의 적용 자료 예시 3' },
        { src: '/next-generation/young-adults/application/application-4.jpg', alt: '삶의 적용 자료 예시 4' },
      ],
    },
    {
      title: '말씀생활',
      paragraphs: [
        '청년 1부는 맥체인 성경읽기표를 따라 매일 성경을 읽고, QT를 통해 말씀을 묵상합니다.',
        '하루의 시작과 마무리를 말씀으로 채우며, 말씀이 삶의 중심이 되도록 훈련합니다.',
        '같은 말씀을 함께 읽고 나누며, 개인의 경건을 넘어 공동체 전체가 말씀 위에 세워져 가고 있습니다.',
      ],
      gallery: [
        { src: '/next-generation/young-adults/word-life/word-life-1.jpg', alt: '말씀생활 자료 예시 1' },
        { src: '/next-generation/young-adults/word-life/word-life-2.jpg', alt: '말씀생활 자료 예시 2' },
        { src: '/next-generation/young-adults/word-life/word-life-3.jpg', alt: '말씀생활 자료 예시 3' },
      ],
    },
  ];
  const [activeYoungAdultPillar, setActiveYoungAdultPillar] = useState<string | null>(null);
  const selectedYoungAdultPillar = youngAdultIntroPillars.find((pillar) => pillar.title === activeYoungAdultPillar);

  const [lightboxGallery, setLightboxGallery] = useState<{ src: string; alt: string }[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (gallery: { src: string; alt: string }[], index: number) => {
    setLightboxGallery(gallery);
    setLightboxIndex(index);
  };

  const closeLightbox = () => setLightboxGallery(null);

  useEffect(() => {
    if (!selectedPillar && !selectedYoungAdultPillar) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActivePillar(null);
        setActiveYoungAdultPillar(null);
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [selectedPillar]);

  useEffect(() => {
    if (!lightboxGallery) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowLeft') setLightboxIndex((i) => (i - 1 + lightboxGallery.length) % lightboxGallery.length);
      if (event.key === 'ArrowRight') setLightboxIndex((i) => (i + 1) % lightboxGallery.length);
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [lightboxGallery]);

  return (
    <div>
      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-16">
          <div>
            <span className="mb-5 inline-flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm font-black text-emerald-950">
              <Sparkles size={18} />
              언약 안에서 예배하는 유초등부
            </span>
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-normal text-emerald-950 sm:text-5xl">
              예배하는 유초등부
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
              한우리교회 유초등부는 언약 안에서 자라가는 아이들이 말씀과 예배 가운데 하나님을 바르게 배우도록 돕는 공동체입니다.
              우리는 예배 중심의 신앙교육을 지향하며, 교회 교육이 가정과 이어지도록 힘씁니다.
              성경과 교리 위에 다음세대를 세워, 하나님을 알고 사랑하며 순종하는 삶으로 자라가게 하는 것이 우리의 목표입니다.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {introPillars.map((pillar) => (
                <button
                  key={pillar.title}
                  type="button"
                  onClick={() => setActivePillar(pillar.title)}
                  aria-expanded={activePillar === pillar.title}
                  className={`rounded-lg border p-4 text-center text-base font-black transition sm:text-lg ${
                    activePillar === pillar.title
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                      : 'border-emerald-100 bg-emerald-50 text-emerald-950 hover:border-emerald-300 hover:bg-emerald-100'
                  }`}
                >
                  {pillar.title}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-sky-100 shadow-sm">
            <img
              src={introImage}
              alt="밝은 교실에서 함께 배우는 아이들"
              className="h-[220px] w-full object-cover sm:h-[340px] md:h-[420px]"
            />
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-2 pb-12 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8 lg:pb-16">
          <div className="order-2 overflow-hidden rounded-lg border border-sky-100 shadow-sm lg:order-1">
            <img
              src={youngAdultsIntroImage}
              alt="청년부 자료실에 사용되는 천로역정 이미지"
              className="h-[220px] w-full object-cover sm:h-[340px] md:h-[420px]"
            />
          </div>

          <div className="order-1 lg:order-2">
            <span className="mb-5 inline-flex items-center gap-2 rounded-lg bg-sky-100 px-3 py-2 text-sm font-black text-emerald-950">
              <Users size={18} />
              언약 안에 살아가는 청년 1부
            </span>
            <h2 className="max-w-3xl text-4xl font-black leading-tight tracking-normal text-emerald-950 sm:text-5xl">
              살아내는 청년 1부
            </h2>
            <div className="mt-6 max-w-2xl space-y-4 text-lg leading-8 text-slate-700">
              <p>청년 1부는 말씀을 배우는 데서 멈추지 않고, 삶으로 살아내는 공동체입니다.</p>
              <p>
                주일에 선포되는 말씀과 교리의 강설을 중심으로, 진리를 바르게 이해하고 실제 삶 속에서 적용하는
                것을 목표로 합니다.
              </p>
              <p>
                특별히 고전 신앙서인 천로역정을 통해 성도의 삶의 여정을 배우며, 교리를 지식이 아닌 실제적인
                믿음의 길로 익혀 갑니다. 또한 주중에는 말씀을 반복하고 적용하도록 돕는 다양한 나눔과 자료를
                통해, 신앙이 일상 속에 뿌리내리도록 돕고 있습니다.
              </p>
              <p>
                청년 1부는 &ldquo;듣고 끝나는 신앙&rdquo;이 아니라, &ldquo;삶으로 이어지는 신앙&rdquo;을 함께
                세워가는 공동체입니다.
              </p>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {youngAdultIntroPillars.map((pillar) => (
                <button
                  key={pillar.title}
                  type="button"
                  onClick={() => setActiveYoungAdultPillar(pillar.title)}
                  aria-expanded={activeYoungAdultPillar === pillar.title}
                  className={`rounded-lg border p-4 text-center text-base font-black transition sm:text-lg ${
                    activeYoungAdultPillar === pillar.title
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                      : 'border-sky-100 bg-sky-50 text-emerald-950 hover:border-sky-300 hover:bg-sky-100'
                  }`}
                >
                  {pillar.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {selectedPillar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="next-generation-pillar-title"
          onClick={() => setActivePillar(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto overscroll-contain rounded-lg border border-emerald-100 bg-white p-6 shadow-xl sm:max-h-[85vh] sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-5 flex items-start justify-between gap-4 border-b border-emerald-100 bg-white px-6 py-4 sm:-mx-8 sm:-mt-8 sm:px-8">
              <h2 id="next-generation-pillar-title" className="text-2xl font-black tracking-normal text-emerald-950">
                {selectedPillar.title}
              </h2>
              <button
                type="button"
                onClick={() => setActivePillar(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-950 transition hover:bg-emerald-100"
                aria-label="설명 닫기"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4 text-base leading-8 text-slate-700">
              {selectedPillar.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            {selectedPillar.highlights && (
              <div className="mt-6 rounded-lg bg-emerald-50 p-5">
                <h3 className="text-lg font-black text-emerald-950">교육 커리큘럼</h3>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-700 sm:text-base">
                  {selectedPillar.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-6">
              <h3 className="text-lg font-black text-emerald-950">교육 자료 미리보기</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {selectedPillar.gallery.map((image, idx) => (
                  <button
                    key={image.src}
                    type="button"
                    onClick={() => openLightbox(selectedPillar.gallery, idx)}
                    className="overflow-hidden rounded-lg border border-emerald-100 bg-slate-50 text-left transition hover:border-emerald-300"
                  >
                    <img src={image.src} alt={image.alt} className="aspect-[4/3] w-full object-cover" />
                    <div className="border-t border-emerald-100 bg-white px-3 py-2 text-sm font-bold text-emerald-950">
                      {image.alt}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedYoungAdultPillar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="young-adult-pillar-title"
          onClick={() => setActiveYoungAdultPillar(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto overscroll-contain rounded-lg border border-sky-100 bg-white p-6 shadow-xl sm:max-h-[85vh] sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-5 flex items-start justify-between gap-4 border-b border-sky-100 bg-white px-6 py-4 sm:-mx-8 sm:-mt-8 sm:px-8">
              <h2 id="young-adult-pillar-title" className="text-2xl font-black tracking-normal text-emerald-950">
                {selectedYoungAdultPillar.title}
              </h2>
              <button
                type="button"
                onClick={() => setActiveYoungAdultPillar(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-emerald-950 transition hover:bg-sky-100"
                aria-label="설명 닫기"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4 text-base leading-8 text-slate-700">
              {selectedYoungAdultPillar.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            {selectedYoungAdultPillar.gallery && (
              <div className="mt-6">
                <h3 className="text-lg font-black text-emerald-950">교육 자료 미리보기</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedYoungAdultPillar.gallery.map((image, idx) => (
                    <button
                      key={image.src}
                      type="button"
                      onClick={() => openLightbox(selectedYoungAdultPillar.gallery, idx)}
                      className="overflow-hidden rounded-lg border border-sky-100 bg-slate-50 text-left transition hover:border-sky-300"
                    >
                      <img src={image.src} alt={image.alt} className="aspect-[4/3] w-full object-cover" />
                      <div className="border-t border-sky-100 bg-white px-3 py-2 text-sm font-bold text-emerald-950">
                        {image.alt}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {lightboxGallery && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 px-4 py-8"
          onClick={closeLightbox}
        >
          <div className="relative flex w-full max-w-4xl flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute -top-10 right-0 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/25"
              aria-label="닫기"
            >
              <X size={20} />
            </button>

            <div className="relative flex h-[70vh] w-full items-center justify-center">
              <img
                key={lightboxGallery[lightboxIndex].src}
                src={lightboxGallery[lightboxIndex].src}
                alt={lightboxGallery[lightboxIndex].alt}
                className="h-full w-full rounded-lg object-contain shadow-2xl"
              />

              {lightboxGallery.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setLightboxIndex((i) => (i - 1 + lightboxGallery.length) % lightboxGallery.length)}
                    className="absolute left-0 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg bg-black/40 text-white transition hover:bg-black/60"
                    aria-label="이전 사진"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxIndex((i) => (i + 1) % lightboxGallery.length)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg bg-black/40 text-white transition hover:bg-black/60"
                    aria-label="다음 사진"
                  >
                    <ChevronRight size={24} />
                  </button>
                </>
              )}
            </div>

            <div className="mt-4 text-center">
              <p className="text-sm font-bold text-white/90">{lightboxGallery[lightboxIndex].alt}</p>
              <p className="mt-1 text-xs text-white/50">{lightboxIndex + 1} / {lightboxGallery.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* eslint-disable-next-line no-constant-binary-expression */}
      {false && cmsIntroSections.length > 0 && (
        <section className="bg-white py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 md:grid-cols-2">
              {cmsIntroSections.map((section) => (
                <article key={section.id} className="rounded-lg border border-sky-100 bg-sky-50 p-6 shadow-sm">
                  <h3 className="text-xl font-black text-emerald-950">{section.title}</h3>
                  <div className="mt-3 space-y-3">
                    {section.paragraphs.map((paragraph, idx) => (
                      <p key={`${section.id}-p-${idx}`} className="text-sm leading-7 text-slate-700">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                  {section.highlights.length > 0 && (
                    <ul className="mt-4 space-y-1 rounded-lg border border-sky-100 bg-white p-4">
                      {section.highlights.map((item, idx) => (
                        <li key={`${section.id}-h-${idx}`} className="text-xs font-bold text-emerald-900">
                          · {item}
                        </li>
                      ))}
                    </ul>
                  )}
                  {section.gallery.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {section.gallery.map((image, idx) => (
                        <img key={`${section.id}-g-${idx}`} src={image.src} alt={image.alt} className="h-24 w-full rounded-lg object-cover" />
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-sky-50 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-normal text-emerald-950">부서별 자료실</h2>
              <p className="mt-3 text-base leading-7 text-slate-700">
                교사와 리더가 함께 준비하고 나누는 다음세대 교육 자료를 모읍니다.
              </p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {departmentCards.map((section) => (
              <Link
                key={section.id}
                to={section.path}
                className="group overflow-hidden rounded-lg border border-white bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <img src={section.image} alt={`${section.name} 자료실`} className="h-52 w-full object-cover" />
                <div className="p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-coral-100 text-coral-800">
                      <section.icon size={24} />
                    </span>
                    <h3 className="text-2xl font-black tracking-normal text-emerald-950">{section.name}</h3>
                  </div>
                  <p className="text-base leading-7 text-slate-700">{section.copy}</p>
                  <span className="mt-6 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition group-hover:bg-emerald-700">
                    자료실 열기
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
