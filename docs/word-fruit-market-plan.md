# 열매 장터 (Fruit Market) — 사전 기획서

> 상태: **기획만, 아직 구현 안 함**
> 작성일: 사이클 종료 시점, 매주 운영 안정화 후 본격 착수 권장

---

## 1. 의도

학생이 한 주 동안 작은 순종을 실천해 “익은 열매” 한 알이 생기면, 그 열매가 단순 수치로 사라지지 않고 **모이고 → 나중에 장터에서 활용**되도록 하는 기능.

핵심 질문: “어떻게 하면 열매를 **상품권/포인트**가 아니라 **함께 나누는 풍성함**으로 느끼게 할 수 있는가?”

---

## 2. 신학적 가드레일 (가장 먼저 결정)

장터 도입 시 가장 큰 위험은 **공로주의 / 도덕주의로 미끄러지는 것**. 다음 원칙을 어기면 기능을 만들지 않는 편이 낫다.

| 위험 | 대응 |
|---|---|
| “많이 모은 아이가 더 좋은 아이” 인식 | 랭킹·순위·비교 표시 절대 금지 |
| 거래 언어 (구매, 결제, 가격) | UI 텍스트는 **“교환해요”·“받아요”·“함께 나눠요”** |
| 비싼/소비주의적 보상 | 품목은 학용품·작은 책·과자류 위주, 가격 균등 |
| 부모/교사가 “열매 모으면 사 줄게” 식으로 사용 | 운영 안내문에 “장터는 보상이 아니라 함께 기뻐하는 자리” 명시 |
| 장터 자체가 *목적*이 되어 신앙 훈련을 가림 | 장터는 분기/학기에 **드물게** 열기 (월 1회 이하 권장) |

이 원칙을 실제 UI 문구·관리자 안내·교사 매뉴얼에 박아 두는 것이 핵심.

---

## 3. 사용자 시나리오

```
[학생]
  매주 → 작은 순종 3회 → 한 주 열매 익음 → "내 바구니" +1
  분기마다 장터가 열리면 → 바구니의 열매로 마음에 드는 품목 신청
  교회에서 픽업 → 받음

[부모]
  자녀 바구니 잔액·이력 확인
  장터 신청 시 알림 (선택)

[교사]
  담당 반 학생들의 잔액·신청 현황 확인 (랭킹 X)
  장터 운영 시 픽업 확인 보조

[관리자/목사]
  장터 열기/닫기
  품목 등록 (이름, 사진, 열매 가격, 재고)
  신청 → 픽업 → 종료 흐름 관리
```

---

## 4. 데이터 모델 (Firestore)

### 4.1 신규 컬렉션

#### `next_generation_word_fruit_wallet/{userId}`
학생별 누적·잔액. **지금까지 progress 문서에서 계산만 해 왔으나, 장터 도입 시점부터는 별도 도큐먼트가 필요** (지출 추적).

```ts
{
  userId: string,
  childName: string,        // 캐싱
  balance: number,          // 현재 사용 가능한 열매 수
  lifetimeEarned: number,   // 누적 획득
  lifetimeSpent: number,    // 누적 사용
  lastCreditedWeekId: string, // 중복 적립 방지용
  createdAt, updatedAt,
}
```

#### `next_generation_market_seasons/{seasonId}`
장터 “회차” — 분기 또는 학기별로 열고 닫음.

```ts
{
  name: '2026 봄 열매 장터',
  status: 'draft' | 'open' | 'closed',
  opensAt, closesAt,
  message: string,  // 학생용 안내 문구
}
```

#### `next_generation_market_items/{itemId}`
장터 품목 카탈로그.

```ts
{
  seasonId: string,
  name: string,
  description?: string,
  imageUrl?: string,
  fruitCost: number,
  stock: number,
  reserved: number,         // 신청 중인 수량
  isAvailable: boolean,
  createdAt, updatedAt,
}
```

#### `next_generation_market_orders/{orderId}`
신청 이력. 학생이 “받기” 누른 모든 건.

```ts
{
  userId: string,
  childName: string,
  seasonId: string,
  itemId: string,
  itemName: string,         // 캐싱 (품목 변경 영향 차단)
  fruitCost: number,        // 캐싱
  status: 'pending' | 'fulfilled' | 'canceled',
  createdAt,
  fulfilledAt?, fulfilledBy?,
  canceledAt?, canceledReason?,
}
```

### 4.2 기존 컬렉션 영향

`next_generation_word_fruit_progress/{weekId}__{userId}` 의 변경사항: 학생이 한 주 완료(`completed: true`로 처음 전이) 시 wallet의 `balance` +1, `lifetimeEarned` +1, `lastCreditedWeekId` 기록.

**Idempotency 중요**: 학생이 4회·5회 더 체크해도 **이미 그 weekId로 적립한 적 있으면 스킵**.

---

## 5. 권한 (Firestore Rules)

| 컬렉션 | 학생 | 학부모 | 교사 | 목사 |
|---|---|---|---|---|
| wallet 본인 | read | read (childIds) | read (groupIds) | read all / write |
| wallet 다른 학생 | ❌ | ❌ | ❌ | – |
| market_seasons | read (open만) | read (open만) | read | full |
| market_items | read (오픈된 시즌만) | 동일 | 동일 | full |
| market_orders 본인 | read + 신규 신청만 | read (childIds) | read (groupIds) | full |
| market_orders 상태 변경 | ❌ (서버 endpoint만) | ❌ | ❌ | full |

**핵심**: balance 증감과 주문 상태 변경은 **서버 트랜잭션만 수행** — 클라이언트가 직접 wallet/order를 쓰지 못하게 막아야 부정 사용 차단.

---

## 6. 서버 엔드포인트

### 6.1 `POST /api/word-fruit/credit-week`
체크 endpoint([word-fruit-check.mts](../netlify/functions/word-fruit-check.mts)) 안에 **흡수**. 트랜잭션 내에서:

```
if (newCount === 3 && !alreadyCredited(weekId)) {
  wallet.balance += 1
  wallet.lifetimeEarned += 1
  wallet.lastCreditedWeekId = weekId
}
```

별도 endpoint 불필요. 기존 트랜잭션 확장.

### 6.2 `POST /api/word-fruit/market/order`
학생이 “받기” 클릭 시.

```
verify auth
verify season is 'open'
verify item.isAvailable && stock - reserved > 0
verify wallet.balance >= item.fruitCost
transaction:
  wallet.balance -= cost
  wallet.lifetimeSpent += cost
  item.reserved += 1
  create order { status: 'pending' }
notify pastor (선택)
```

### 6.3 `POST /api/word-fruit/market/fulfill`
목사/교사가 픽업 확인 시.

```
verify auth (pastor or teacher)
verify order exists, status === 'pending'
transaction:
  order.status = 'fulfilled'
  item.stock -= 1
  item.reserved -= 1
notify student/parent (선택)
```

### 6.4 `POST /api/word-fruit/market/cancel`
신청 취소.

```
verify auth (owner or pastor)
transaction:
  order.status = 'canceled'
  wallet.balance += cost (환불)
  wallet.lifetimeSpent -= cost
  item.reserved -= 1
```

---

## 7. UI 변경

### 7.1 학생 패널 (기존 [WordFruitPanel](../src/features/word-fruit/WordFruitPanel.tsx))

상단에 **“내 열매 바구니” 배지** 추가 — 작은 카드 형태:

```
┌────────────────────────────────┐
│ 🧺 내 열매 바구니                │
│ 12개  지금까지 23개 모음          │
│ [장터 보기 →] (시즌 열렸을 때만) │
└────────────────────────────────┘
```

stage UI는 그대로. 바구니 카드는 stage 위 또는 옆.

### 7.2 신규 페이지: 장터 (`/next/elementary/market`)

```
┌─────────────────────────────────┐
│ 🌳 2026 봄 열매 장터               │
│ 내 바구니: 12 열매                 │
├─────────────────────────────────┤
│ [품목 카드]  [품목 카드]            │
│  사진         사진                 │
│  이름         이름                 │
│  3 열매       5 열매                │
│  [받기]       [받기]                │
└─────────────────────────────────┘
```

### 7.3 학부모/교사 화면

기존 ParentView·TeacherView에 **잔액 칼럼 추가**. 신청 이력은 별도 탭으로.

### 7.4 관리 (NextGenerationAdmin → 말씀 열매 탭)

기존 “말씀 열매” 탭 안에 새 섹션 추가:
- **장터 시즌 관리** (열기/닫기, 안내 문구)
- **품목 관리** (CRUD, 사진 업로드, 재고)
- **신청 현황** (pending → fulfilled 처리)

---

## 8. 자동화 / cron

추가할 cron 후보:

| 시각 | 작업 |
|---|---|
| 매주 일 00:30 KST | 지난주 미완료 학생에게 wallet credit이 정상이었는지 점검 (멱등) |
| 매월 첫째 주 | 학부모에게 “이번 달 자녀 바구니 요약” 알림 (선택) |

---

## 9. 단계적 도입 (Phasing)

### Phase 1 — Wallet 기반 깔기 (선행 작업)
- wallet 컬렉션 + 규칙 + 인덱스
- 체크 endpoint에서 적립 로직 추가
- 패널에 바구니 배지 표시
- **장터 자체는 아직 없음** — 단지 “내가 모은 열매가 보이고 사라지지 않는다”는 경험만
- **마이그레이션**: 기존 progress의 completed 도큐먼트들을 모두 훑어 wallet 초기 잔액 채워주는 1회용 백필 스크립트

### Phase 2 — 장터 카탈로그 (목사 단독 작업)
- `market_seasons`/`market_items` 컬렉션
- 관리 UI에서 시즌 만들고 품목 등록
- 사용자에겐 아직 노출 X

### Phase 3 — 학생 신청
- 장터 페이지 학생 노출
- 주문 endpoint, balance 차감, reserved 처리

### Phase 4 — 픽업 처리
- 목사/교사 픽업 확인 UI
- 주문 상태 전이
- 픽업 알림

### Phase 5 — 운영 정착 후 보완
- 부모용 잔액·이력 보기
- 신청 후 변심 취소
- 사진 업로드 워크플로우

---

## 10. 결정 보류 — 사용자(스탱)와 같이 정해야 할 것

각 항목은 운영자의 가치관·교회 문화에 따라 다르다. 구현 직전에 최소한 이 6개는 명확한 답이 필요.

1. **열매 인플레이션 통제**: 한 학기 동안 한 학생이 평균 몇 개 모으게 할 것인가? 그에 맞춘 품목 가격은? (예: 학기당 ~12주 → 12 열매 → 평균 3~5 열매 가격 품목 다수 + 10 열매 고가 품목 1~2)
2. **장터 빈도**: 학기마다? 분기마다? 부활절·추수감사절 등 절기 연계?
3. **품목 종류 가이드라인**: 학용품·책·간식 중 우선순위? 외부 상품 vs 교회 자체 제작?
4. **부모 동의 흐름**: 학생이 신청하면 부모에게 사전 알림이 가는가? 아니면 픽업 시점에만?
5. **취소 정책**: 신청 후 변심하면 자유롭게 취소 가능? 한 번만?
6. **열매 양도/선물 가능성**: 형제자매끼리 열매 합치기? (도입 시 신학적 톤이 더 복잡해짐 — 보류 권장)

---

## 11. 측정·평가 (도입 후 6개월)

- 장터로 인해 *체크 동기*가 늘었는가, 줄었는가? (수치는 나오지만 “질”의 변화는 정성)
- 부모·교사 피드백: 자녀들이 “장터를 위해” 체크하지는 않는가?
- 신학적 톤 유지: 카드 모달의 “하나님께서 자라게 하신다” 메시지가 무뎌지지 않는가?

문제 신호가 보이면 **장터를 일시적으로 닫고** 패널의 텍스트와 운영을 재조정하는 안전장치를 미리 마련.

---

## 12. 지금 당장 해야 할 일은 없음

이 문서는 **현재 운영을 정착시킨 뒤** 검토할 자료. 매주 자동 cron이 안정적으로 돌고, 학생들이 자연스럽게 체크하는 습관이 만들어진 뒤(권장: 첫 운영 1개 학기 이후) 다시 펴 보면 된다.

지금 코드에 미리 박아두면 좋은 작은 작업 1개:
- progress 도큐먼트가 `completed: true`로 처음 전이될 때 **타임스탬프(`completedAt`)** 를 함께 저장하면, 나중에 wallet 초기 백필이 훨씬 쉬워진다. 작은 변경이니 다음 사이클에 슬쩍 추가 권장.
