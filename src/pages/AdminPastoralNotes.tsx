import React from 'react';
import { ArrowLeft, BookHeart, CalendarDays, ChevronRight, FileText, Plus, Search, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { createPastoralNote, subscribePastoralNotes } from '../features/pastoral-notes/firestore';
import { PASTORAL_MEETING_TYPES, PastoralNote, PastoralNoteInput } from '../features/pastoral-notes/types';
import { createEmptyPastoralNoteInput, formatDisplayDate, normalizeMemberName, sortNotesByDate } from '../features/pastoral-notes/utils';
import { useAuth } from '../lib/auth';
import { handleFirestoreError, OperationType } from '../lib/firebase';

const QUOTE = '목양은 기억이 아니라 기록을 통해 더 정교해집니다.';

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl border border-wood-200 bg-wood-50/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-wood-500">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-wood-800">{value?.trim() ? value : '-'}</p>
    </div>
  );
}

export default function AdminPastoralNotes() {
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = React.useState<PastoralNote[]>([]);
  const [selectedMember, setSelectedMember] = React.useState('all');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedNoteId, setSelectedNoteId] = React.useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [form, setForm] = React.useState<PastoralNoteInput>(createEmptyPastoralNoteInput);

  React.useEffect(() => {
    if (role !== 'admin') return;

    const unsubscribe = subscribePastoralNotes(
      (nextNotes) => {
        const sortedNotes = sortNotesByDate(nextNotes);
        setNotes(sortedNotes);
        setIsLoading(false);

        setSelectedNoteId((currentId) => {
          if (currentId && sortedNotes.some((note) => note.id === currentId)) {
            return currentId;
          }

          return sortedNotes[0]?.id ?? null;
        });
      },
      (error) => {
        console.error('Error loading pastoral notes:', error);
        handleFirestoreError(error, OperationType.GET, 'pastoral_notes');
        toast.error('목양노트를 불러오지 못했습니다.');
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, [role]);

  if (role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wood-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-wood-900 mb-4">접근 권한이 없습니다</h2>
          <p className="text-wood-600 mb-4">목양노트는 관리자 전용 비공개 기능입니다.</p>
          <button onClick={() => navigate('/')} className="text-wood-600 hover:underline">홈으로 돌아가기</button>
        </div>
      </div>
    );
  }

  const normalizedSearch = normalizeMemberName(searchTerm);
  const memberGroups = Array.from(
    notes.reduce((map, note) => {
      const existing = map.get(note.memberSearchName);
      if (existing) {
        existing.count += 1;
        if (note.date > existing.latestDate) {
          existing.latestDate = note.date;
        }
      } else {
        map.set(note.memberSearchName, {
          key: note.memberSearchName,
          memberName: note.memberName,
          count: 1,
          latestDate: note.date,
        });
      }

      return map;
    }, new Map<string, { key: string; memberName: string; count: number; latestDate: string }>())
      .values()
  )
    .filter((member) => !normalizedSearch || member.key.includes(normalizedSearch))
    .sort((a, b) => {
      const dateCompare = b.latestDate.localeCompare(a.latestDate);
      return dateCompare !== 0 ? dateCompare : a.memberName.localeCompare(b.memberName, 'ko-KR');
    });

  const filteredNotes = notes.filter((note) => {
    const matchesMember = selectedMember === 'all' || note.memberSearchName === selectedMember;
    const matchesSearch = !normalizedSearch || note.memberSearchName.includes(normalizedSearch);
    return matchesMember && matchesSearch;
  });

  const selectedNote =
    filteredNotes.find((note) => note.id === selectedNoteId) ??
    notes.find((note) => note.id === selectedNoteId) ??
    filteredNotes[0] ??
    null;

  const memberNameSuggestions = Array.from(new Set(notes.map((note) => note.memberName))).sort((a, b) => a.localeCompare(b, 'ko-KR'));

  const resetForm = React.useCallback(() => {
    setForm(createEmptyPastoralNoteInput());
  }, []);

  const openNewForm = React.useCallback(() => {
    resetForm();
    if (selectedMember !== 'all') {
      const currentMember = memberGroups.find((member) => member.key === selectedMember);
      if (currentMember) {
        setForm((prev) => ({ ...prev, memberName: currentMember.memberName }));
      }
    }
    setIsFormOpen(true);
  }, [memberGroups, resetForm, selectedMember]);

  const handleChange = (field: keyof PastoralNoteInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || isSaving) return;

    const memberName = form.memberName.trim();
    if (!memberName || !form.date || !form.currentSituation.trim() || !form.encouragement.trim() || !form.prayerTopics.trim()) {
      toast.error('성도 이름, 날짜, 현재 상황, 권면 내용, 기도 제목은 꼭 입력해 주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const created = await createPastoralNote(form, user);
      toast.success('목양노트를 저장했습니다.');
      setSelectedNoteId(created.id);
      setSelectedMember(normalizeMemberName(memberName));
      setSearchTerm(memberName);
      setIsFormOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error creating pastoral note:', error);
      handleFirestoreError(error, OperationType.CREATE, 'pastoral_notes');
      toast.error('저장 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-wood-100 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 rounded-[2rem] border border-wood-200 bg-white p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between lg:p-8">
          <div className="flex items-start gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="mt-1 rounded-full border border-wood-200 p-2 text-wood-700 transition hover:bg-wood-50"
              aria-label="관리자 대시보드로 돌아가기"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-wood-900 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-white">
                <BookHeart size={14} />
                RAAH
              </div>
              <h1 className="mt-4 text-3xl font-serif font-bold text-wood-900">목양노트</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-wood-600">
                성도별 만남과 후속 확인을 차분하게 기록하는 관리자 전용 공간입니다.
              </p>
              <p className="mt-4 rounded-2xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm leading-6 text-wood-700">
                {QUOTE}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-wood-200 bg-wood-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-wood-500">전체 노트</p>
              <p className="mt-2 text-2xl font-bold text-wood-900">{notes.length}</p>
            </div>
            <div className="rounded-2xl border border-wood-200 bg-wood-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-wood-500">성도 수</p>
              <p className="mt-2 text-2xl font-bold text-wood-900">{memberGroups.length}</p>
            </div>
            <div className="rounded-2xl border border-wood-200 bg-wood-50 px-4 py-4 col-span-2 sm:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-wood-500">선택 필터</p>
              <p className="mt-2 text-sm font-semibold text-wood-800">{selectedMember === 'all' ? '전체 성도' : memberGroups.find((member) => member.key === selectedMember)?.memberName || '선택 없음'}</p>
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-3 rounded-[1.75rem] border border-wood-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 lg:flex-row">
            <label className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-wood-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="성도 이름으로 찾기"
                className="w-full rounded-2xl border border-wood-200 bg-wood-50 py-3 pl-11 pr-4 text-sm text-wood-900 outline-none transition focus:border-wood-400 focus:bg-white"
              />
            </label>

            <select
              value={selectedMember}
              onChange={(event) => setSelectedMember(event.target.value)}
              className="rounded-2xl border border-wood-200 bg-wood-50 px-4 py-3 text-sm text-wood-900 outline-none transition focus:border-wood-400 focus:bg-white lg:w-64"
            >
              <option value="all">전체 성도</option>
              {memberGroups.map((member) => (
                <option key={member.key} value={member.key}>
                  {member.memberName} ({member.count})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={openNewForm}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-wood-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-wood-800"
          >
            <Plus size={16} />
            새 목양노트
          </button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[260px,minmax(0,1fr),minmax(0,1fr)]">
          <section className="rounded-[1.75rem] border border-wood-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-wood-900">성도별 보기</h2>
              <span className="text-xs text-wood-500">{memberGroups.length}명</span>
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => setSelectedMember('all')}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                  selectedMember === 'all' ? 'border-wood-900 bg-wood-900 text-white' : 'border-wood-200 bg-wood-50 text-wood-800 hover:bg-white'
                }`}
              >
                <span className="font-medium">전체 성도</span>
                <span className={`text-xs ${selectedMember === 'all' ? 'text-white/80' : 'text-wood-500'}`}>{notes.length}</span>
              </button>

              {memberGroups.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-wood-200 bg-wood-50 px-4 py-6 text-sm text-wood-500">
                  아직 기록된 성도가 없습니다.
                </div>
              ) : (
                memberGroups.map((member) => (
                  <button
                    key={member.key}
                    type="button"
                    onClick={() => setSelectedMember(member.key)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      selectedMember === member.key ? 'border-gold-400 bg-gold-50' : 'border-wood-200 bg-wood-50 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-wood-900">{member.memberName}</p>
                        <p className="mt-1 text-xs text-wood-500">최근 기록 {formatDisplayDate(member.latestDate)}</p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-wood-600">{member.count}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-wood-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-wood-900">기록 목록</h2>
              <span className="text-xs text-wood-500">{filteredNotes.length}건</span>
            </div>

            <div className="mt-4 space-y-3">
              {isLoading ? (
                <div className="rounded-2xl border border-dashed border-wood-200 bg-wood-50 px-4 py-10 text-center text-sm text-wood-500">
                  목양노트를 불러오는 중입니다.
                </div>
              ) : filteredNotes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-wood-200 bg-wood-50 px-4 py-10 text-center text-sm text-wood-500">
                  조건에 맞는 기록이 없습니다. 새 노트를 작성해 보세요.
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const isActive = selectedNote?.id === note.id;

                  return (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => {
                        setSelectedNoteId(note.id);
                        setIsFormOpen(false);
                      }}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                        isActive ? 'border-wood-900 bg-wood-900 text-white shadow-md' : 'border-wood-200 bg-wood-50 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <UserRound size={15} className={isActive ? 'text-white/80' : 'text-wood-500'} />
                            <p className="truncate text-sm font-semibold">{note.memberName}</p>
                          </div>
                          <div className={`mt-2 flex items-center gap-2 text-xs ${isActive ? 'text-white/80' : 'text-wood-500'}`}>
                            <CalendarDays size={14} />
                            {formatDisplayDate(note.date)}
                            <span className="inline-flex rounded-full border px-2 py-0.5">
                              {note.meetingType}
                            </span>
                          </div>
                          <p className={`mt-3 line-clamp-3 text-sm leading-6 ${isActive ? 'text-white/90' : 'text-wood-700'}`}>
                            {note.currentSituation}
                          </p>
                        </div>
                        <ChevronRight size={16} className={isActive ? 'text-white/80' : 'text-wood-400'} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-wood-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-wood-900">{isFormOpen ? '새 목양노트 작성' : '기록 상세'}</h2>
              {!isFormOpen && (
                <button
                  type="button"
                  onClick={openNewForm}
                  className="text-sm font-medium text-wood-600 transition hover:text-wood-900"
                >
                  새 기록
                </button>
              )}
            </div>

            {isFormOpen ? (
              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-wood-700">성도 이름</label>
                  <input
                    list="pastoral-note-members"
                    value={form.memberName}
                    onChange={(event) => handleChange('memberName', event.target.value)}
                    className="w-full rounded-2xl border border-wood-200 bg-wood-50 px-4 py-3 text-sm outline-none transition focus:border-wood-400 focus:bg-white"
                    placeholder="예: 김OO"
                  />
                  <datalist id="pastoral-note-members">
                    {memberNameSuggestions.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-wood-700">날짜</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(event) => handleChange('date', event.target.value)}
                      className="w-full rounded-2xl border border-wood-200 bg-wood-50 px-4 py-3 text-sm outline-none transition focus:border-wood-400 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-wood-700">만남 유형</label>
                    <select
                      value={form.meetingType}
                      onChange={(event) => handleChange('meetingType', event.target.value)}
                      className="w-full rounded-2xl border border-wood-200 bg-wood-50 px-4 py-3 text-sm outline-none transition focus:border-wood-400 focus:bg-white"
                    >
                      {PASTORAL_MEETING_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-wood-700">현재 상황</label>
                  <textarea
                    value={form.currentSituation}
                    onChange={(event) => handleChange('currentSituation', event.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-wood-200 bg-wood-50 px-4 py-3 text-sm leading-6 outline-none transition focus:border-wood-400 focus:bg-white"
                    placeholder="현재 형편, 최근 나눈 이야기, 살펴볼 배경을 간단히 적어주세요."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-wood-700">권면 내용</label>
                  <textarea
                    value={form.encouragement}
                    onChange={(event) => handleChange('encouragement', event.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-wood-200 bg-wood-50 px-4 py-3 text-sm leading-6 outline-none transition focus:border-wood-400 focus:bg-white"
                    placeholder="함께 나눈 말씀, 권면, 확인한 방향을 적어주세요."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-wood-700">기도 제목</label>
                  <textarea
                    value={form.prayerTopics}
                    onChange={(event) => handleChange('prayerTopics', event.target.value)}
                    rows={3}
                    className="w-full rounded-2xl border border-wood-200 bg-wood-50 px-4 py-3 text-sm leading-6 outline-none transition focus:border-wood-400 focus:bg-white"
                    placeholder="함께 기억할 기도 제목을 적어주세요."
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-wood-700">다음 확인 날짜</label>
                    <input
                      type="date"
                      value={form.nextFollowUpDate || ''}
                      onChange={(event) => handleChange('nextFollowUpDate', event.target.value)}
                      className="w-full rounded-2xl border border-wood-200 bg-wood-50 px-4 py-3 text-sm outline-none transition focus:border-wood-400 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-wood-700">비고</label>
                    <input
                      value={form.remarks || ''}
                      onChange={(event) => handleChange('remarks', event.target.value)}
                      className="w-full rounded-2xl border border-wood-200 bg-wood-50 px-4 py-3 text-sm outline-none transition focus:border-wood-400 focus:bg-white"
                      placeholder="간단한 메모"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-wood-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-wood-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FileText size={16} />
                    {isSaving ? '저장 중...' : '목양노트 저장'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormOpen(false);
                      resetForm();
                    }}
                    className="rounded-2xl border border-wood-200 px-5 py-3 text-sm font-medium text-wood-700 transition hover:bg-wood-50"
                  >
                    취소
                  </button>
                </div>
              </form>
            ) : selectedNote ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-[1.5rem] border border-wood-200 bg-wood-50/70 p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-wood-500">
                    <span className="rounded-full border border-wood-200 bg-white px-2.5 py-1">{selectedNote.meetingType}</span>
                    <span>{formatDisplayDate(selectedNote.date)}</span>
                    {selectedNote.nextFollowUpDate && (
                      <span className="rounded-full border border-gold-200 bg-gold-50 px-2.5 py-1 text-wood-700">
                        다음 확인 {formatDisplayDate(selectedNote.nextFollowUpDate)}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-4 text-2xl font-serif font-bold text-wood-900">{selectedNote.memberName}</h3>
                  <p className="mt-2 text-sm text-wood-500">기록자 {selectedNote.createdByName}</p>
                </div>

                <DetailRow label="현재 상황" value={selectedNote.currentSituation} />
                <DetailRow label="권면 내용" value={selectedNote.encouragement} />
                <DetailRow label="기도 제목" value={selectedNote.prayerTopics} />
                <DetailRow label="비고" value={selectedNote.remarks} />
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-wood-200 bg-wood-50 px-4 py-10 text-center text-sm text-wood-500">
                선택된 기록이 없습니다. 왼쪽 목록에서 노트를 고르거나 새 기록을 작성해 주세요.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
