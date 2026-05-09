# 이번 주 말씀 열매 운영 매뉴얼

이 문서는 유초등부 “이번 주 말씀 열매” 기능을 **다음세대 목사·관리자**가 운영하기 위한 안내서입니다. 일반 학생/학부모/교사를 위한 안내가 아닙니다.

---

## 1. 운영 캘린더 (자동)

| 시각 (KST) | 자동 작업 | 결과 |
|---|---|---|
| 매주 **금 12:00** | 다가오는 주일 강의원고 게시 여부 확인 | 미게시 시 목사에게 인앱 알림 |
| 매주 **토 23:00** | 강의원고 → AI → 다음 주차 fruit 도큐먼트 `draft` 저장 | 목사에게 인앱 알림 (성공/실패 케이스별) |
| 매일 **23:00** | 이번 주 published fruit 도큐먼트의 익명 통계 자동 갱신 | 알림 없음 (조용히 갱신) |

자동 작업이 사람의 수동 수정을 덮어쓰지 않습니다. 자동 초안은 항상 `draft` 상태로 저장되며, **게시는 사람만** 할 수 있습니다.

---

## 2. 매주 운영 흐름

### 토요일까지

1. 유초등부 강의원고를 평소처럼 **이번주 강의자료** 탭에 게시 (`subCategory: elementary_script`, `nextGenerationWeekKey: <다가오는 주일 YYYY-MM-DD>`)
2. 토 23:00 자동 cron이 강의원고를 픽업해 AI 카드 초안을 만들어 둠

### 주일

1. 인앱 알림 “주일 말씀 열매 초안이 준비됐어요”를 받음
2. 다음세대 페이지 → 유초등부 → **이번 주 말씀 열매** 버튼 → **관리** 클릭
3. 자동 생성된 카드 3개를 신학적으로 검토·수정
4. 학생별 **나의 작은 순종**을 입력 (PracticeManager 표)
5. **게시** 버튼 클릭
6. **게시 알림** 버튼 클릭 → 학생/학부모/교사에게 인앱 + FCM 푸시

### 평일

- 학생들이 매일 1회 “오늘 실천했어요” 체크
- 학부모는 자녀 체크 시마다 알림 수신
- 교사는 **관리** 화면 또는 자기 패널에서 담당 반 진행 상황 모니터링

### 다음 토요일

- 자동 cron이 다시 다음 주차 초안을 생성

---

## 3. 첫 운영 셋업 (한 번만)

### 3.1 Firestore 배포

```
firebase deploy --only firestore:rules,firestore:indexes
```

### 3.2 Netlify 환경변수 확인

Netlify 사이트 설정 → Environment variables:

- `FIREBASE_SERVICE_ACCOUNT_KEY` (서비스 계정 JSON, 기존 알림 시스템과 공유)
- `GEMINI_API_KEY` (서버 측만, 클라이언트에 절대 노출 금지)

### 3.3 반(그룹) 만들기

1. **관리** → **반(그룹) 관리** 섹션
2. “새 반 이름” 입력 → **반 추가**
3. 학생별로 반 드롭다운 선택
4. 교사별로 담당 반 체크

> 담당 반이 비어있는 교사는 모든 반을 임시로 볼 수 있습니다(이전 운영 호환). 정식 운영 시작 시 모든 교사의 담당 반을 명시 지정 권장.

### 3.4 학부모-자녀 연결

1. **관리** → **부모-자녀 연결** 섹션
2. 학부모 회원이 가입 후 승인되면 학생 체크박스로 자녀 연결
3. 저장하면 그 학부모만 자녀 진행을 볼 수 있고, 자녀가 체크할 때마다 푸시 수신

### 3.5 그룹 데이터 백필 (그룹 도입 직후 한 번만)

1. **관리** → **데이터 마이그레이션** 섹션
2. **그룹 백필 실행** 클릭
3. 결과 보고서에서 “백필 적용” 숫자 확인

> 멱등 동작이라 여러 번 눌러도 안전합니다. 새로 그룹을 배정한 학생이 있으면 다시 눌러서 동기화하세요.

---

## 4. 알림이 나가는 시점

| 트리거 | 받는 사람 | 인앱 | FCM |
|---|---|---|---|
| 목사가 “게시 알림” 버튼 클릭 | 학생 + 학부모 + 교사 | ✅ | ✅ |
| 학생이 체크 성공 | 연결된 학부모만 | ✅ | ✅ |
| 토 23:00 cron 결과 (성공/실패/스킵) | 다음세대 목사만 | ✅ | ❌ |
| 금 12:00 cron - 강의원고 미게시 | 다음세대 목사만 | ✅ | ❌ |
| 매일 23:00 통계 갱신 | (알림 없음) | – | – |

> FCM 푸시는 사용자가 알림 권한을 허용해 토큰이 발급된 경우에만 도착합니다. 토큰이 없는 회원은 인앱 알림만 받습니다.

---

## 5. 권한 요약

| 역할 | weekly fruit 보기 | progress 보기 | 체크 가능 |
|---|---|---|---|
| 비로그인 | published 공통 정보만 | ❌ | – |
| 학생 (`학생`) | published만 | 본인만 | 월~토, 하루 1회 |
| 학부모 (`학부모`) | published만 | `childIds` 자녀만 | – |
| 교사 (`교사`) | published만 | 담당 반(`groupIds`) 학생만 | – |
| 다음세대 목사 (`isNextGenerationAdmin`) | 전체 | 전체 | – |

---

## 6. 자주 발생하는 상황과 대처

### 6.1 “자동 초안이 안 만들어졌어요”

가능한 원인 (순서대로 확인):

1. 강의원고를 **토 23:00 이전**에 게시했는지 — 이후 게시는 다음 주에 픽업됨
2. 강의원고의 `nextGenerationWeekKey`(주일 날짜)가 정확한지
3. 인앱 알림에 “자동 초안 실패: 강의원고를 찾지 못했어요” 메시지가 있는지 확인
4. 그래도 모르면 **관리 → 강의원고로 카드 생성** 버튼으로 직접 만들고 게시

### 6.2 “학부모가 자녀 진행을 못 봐요”

- **부모-자녀 연결** 섹션에서 해당 학부모 카드의 자녀 체크박스가 켜져 있는지 확인
- 학부모가 “학부모” 부서로 가입했고 `member` 상태인지 확인 (관리자 회원 승인)

### 6.3 “교사가 다른 반 학생을 봐요”

- 그 교사의 담당 반(groupIds)이 **비어있으면** 임시로 모두 보입니다 (운영 편의용)
- 정식 운영하려면 모든 교사에게 담당 반을 명시 지정

### 6.4 “학생이 ‘작은 순종이 등록되지 않았어요’ 메시지를 봐요”

- 해당 주차 fruit 도큐먼트에 그 학생의 progress가 아직 없습니다
- **관리 → 아이별 작은 순종** 표에서 그 학생의 실천 입력 후 저장

### 6.5 “자동 cron이 내가 작업한 초안을 덮어썼어요”

- 사람 수정 흔적(`updatedAt > autoDraftedAt + 10초`)이 있으면 **덮어쓰지 않습니다**
- 만약 발생했다면 토 23:00 직전에 사람 수정이 있었지만 cron이 감지 못 한 경우 → Netlify Functions 로그 확인 필요

### 6.6 “공동체 현황 숫자가 이상해요”

- 매일 23:00 자동 갱신
- 즉시 갱신하려면 **관리 → 공동체 현황 게시** 버튼 클릭
- 학생 5명 미만이면 익명성 보호용 placeholder 문구로 자동 처리됨 (목사가 직접 메시지 작성한 경우 그것이 우선)

---

## 7. 보안 원칙

- **AI 키는 서버 측에만** — Netlify 환경변수에 저장, 클라이언트 빌드 미주입
- **체크 +1은 서버 트랜잭션** — 학생이 직접 Firestore에 쓸 수 없음
- **익명 공동체 통계** — 이름·실천·개인 횟수는 절대 공개 필드에 들어가지 않음
- **자동 게시 절대 금지** — AI 결과는 항상 `draft`로만 저장
- **N-anonymity 5명** — 등록 학생이 5명 미만이면 통계 숫자 대신 일반 격려 문구 사용

---

## 8. 코드 구조 요약

```
src/features/word-fruit/
├── types.ts              # 타입 정의
├── logic.ts              # 순수 로직 (Firebase 의존 없음, 테스트 대상)
├── logic.test.ts         # Vitest 단위 테스트
├── api.ts                # Firestore CRUD + 서버 호출
├── WordFruitPanel.tsx    # 사용자 패널 (학생/학부모/교사/비로그인)
├── WordFruitAdmin.tsx    # 관리 화면 (목사 전용)
├── WordFruitTree.tsx     # SVG 나무 시각화
└── WordFruitPrintView.tsx # 가정용 인쇄 페이지

netlify/functions/
├── word-fruit-check.mts            # 학생 체크 (트랜잭션) + 부모 알림
├── word-fruit-generate-cards.mts   # AI 카드 생성 (목사 전용)
├── word-fruit-notify-publish.mts   # 게시 알림 멀티캐스트
├── word-fruit-auto-draft.mts       # 토 23:00 cron
├── word-fruit-friday-warning.mts   # 금 12:00 cron
└── word-fruit-aggregate-tick.mts   # 매일 23:00 통계 갱신
```

테스트 실행:

```
npm test           # 단발 실행
npm run test:watch # 워치 모드
```

---

## 9. 데이터 모델 빠른 참조

### `next_generation_word_fruits/{weekId}` (예: `2026-W19`)

```ts
{
  weekId: "2026-W19",
  title: "부모님은 소중해요",
  passage: "에베소서 6:1-2",
  memoryVerse: "네 부모를 공경하라",
  fruitName: "공경의 열매",
  startDate: "2026-05-11",  // Mon
  endDate: "2026-05-16",    // Sat
  status: "draft" | "published",
  topMessage: "...",
  guideMessage: "...",
  recommendedPractices: ["..."],
  cards: [
    { order: 1, title: "말씀을 기억해요", summary, question, prayer },
    { order: 2, title: "마음을 돌아보아요", ... },
    { order: 3, title: "하나님께 감사해요", ... },
  ],
  // 익명 공동체 통계
  aggregateTotal, aggregateCompleted, aggregateGrowing, aggregateMessage,
  // 자동 cron 흔적
  autoDraftSourcePostId, autoDraftedAt,
}
```

### `next_generation_word_fruit_progress/{weekId}__{userId}`

```ts
{
  weekId: "2026-W19",
  userId: "child uid",
  childName: "김민준",
  practice: "부모님 말씀을 끝까지 듣기",
  groupId: "group doc id",  // 교사 권한 분리 기준
  checkCount: 0..N,
  checkedDates: ["2026-05-12", ...],
  fruitStage: 0 | 1 | 2 | 3,
  completed: boolean,
}
```

### `next_generation_word_fruit_groups/{groupId}`

```ts
{
  name: "1반",
  description?: string,
}
```

### `next_generation_members/{uid}` (확장 필드)

```ts
{
  // ... 기존 필드 ...
  childIds?: string[],   // 학부모용
  groupId?: string,      // 학생용
  groupIds?: string[],   // 교사용
}
```

---

## 10. 비상시 직접 조작 가이드

### Firestore 콘솔에서 fruit를 강제로 비공개

`next_generation_word_fruits/{weekId}` → `status` 필드를 `draft`로 변경

### 학생의 잘못된 체크 되돌리기

`next_generation_word_fruit_progress/{weekId}__{userId}`:
- `checkedDates` 배열에서 잘못된 날짜 제거
- `checkCount`를 `checkedDates.length`로 맞춤
- `fruitStage`를 0/1/2/3으로 맞춤
- `completed`를 `checkCount >= 3`로 맞춤

> ⚠️ 보안 규칙이 `checkCount === checkedDates.length`를 강제하므로 두 값이 어긋나면 어떤 사용자도 그 도큐먼트를 더 이상 업데이트할 수 없습니다.
