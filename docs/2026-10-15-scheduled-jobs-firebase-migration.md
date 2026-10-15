# 예약 알림·말씀열매 예약 작업의 Firebase 이전

상태: 구현·로컬 검증 완료, 미배포. 기존 Netlify 스케줄이 운영 실행 주체다.

## 실행 주기

| Firebase 함수 | 기존 Netlify 파일 | 한국 시각 | Firebase cron (Asia/Seoul) |
| --- | --- | --- | --- |
| scheduledNotifications | scheduled-notifications.mts | 매시 정각 | `0 * * * *` |
| wordFruitAggregate | word-fruit-aggregate-tick.mts | 매일 23시 | `0 23 * * *` |
| wordFruitFridayWarning | word-fruit-friday-warning.mts | 금요일 12시 | `0 12 * * 5` |
| wordFruitAutoDraft | word-fruit-auto-draft.mts | 토요일 23시 | `0 23 * * 6` |

지역은 asia-northeast1, onSchedule 2세대 함수를 사용한다. 타임아웃은 앞의 세 작업 300초, AI 초안 540초다. 네 함수 모두 retryCount/maxRetrySeconds=0, maxInstances=1, concurrency=1이다. Gemini 비밀값은 자동 초안에만 연결한다. 기존 siteApi/raahApi의 비밀값·인증 구성은 바꾸지 않는다.

Firebase 예약 함수는 반복·동시 호출될 수 있으므로 실행 인스턴스 제한만으로 중복을 방지하지 않는다. 생성되는 HTTP 엔드포인트도 공개 API에 등록하지 않는다. [Firebase 예약 함수 문서](https://firebase.google.com/docs/functions/schedule-functions).

## 두 공급자 간 실행 제어

서버 전용 named Firestore DB의 `_scheduler_control/jobs` 문서에 다음 필드를 사용한다.

```json
{
  "owners": {
    "scheduledNotifications": "netlify",
    "wordFruitAggregate": "netlify",
    "wordFruitFridayWarning": "netlify",
    "wordFruitAutoDraft": "netlify"
  }
}
```

- 문서/작업별 필드가 없으면 기존 Netlify가 실행한다. Firebase는 비활성 응답만 하고 실제 집계·발송·AI 작업을 호출하지 않는다.
- 작업별 값은 `netlify`, `firebase`, `paused`다. paused 또는 잘못된 값은 양쪽 모두 실행하지 않는다. 클라이언트의 읽기·쓰기는 기존 Firestore 규칙의 기본 거부 대상이다.
- 양쪽 진입점이 같은 Firestore 트랜잭션에서 owners와 `_scheduled_job_runs/{job}__{UTC-slot}`를 확인한다. 실행 기록을 먼저 만든 한 요청만 업무를 시작한다. 공급자가 바뀌거나 중복 이벤트가 와도 같은 회차 기록이 있으면 건너뛴다.
- 실행 기록에는 job/slot/provider/상태/시각만 저장한다. 알림 본문·토큰·성도 정보·원고·AI 응답·원래 오류는 기록하지 않는다.
- 기록 상태는 processing, completed, skipped, needs_review다. 처리 결과가 불확실하면 needs_review로 남기며, processing도 자동 만료/재실행하지 않는다. 이는 정확히 한 번 성공을 보장하는 방식이 아니라 중복 부작용을 피하는 at-most-once 방식이다. 중단된 작업은 누락될 수 있으므로 별도 검토가 필요하다.
- Firebase는 event.scheduleTime으로 같은 회차를 계산하고 30분을 넘긴 오래된 이벤트나 미래/잘못된 시각을 거부한다. Netlify는 실행 시각을 해당 스케줄의 최신 회차로 정규화한다.
- 이미 발송 여부가 불확실한 예약 알림은 기존 claimNotification의 processing/needs_review 경로를 유지한다. 새 회차가 실행돼도 이 알림들을 자동 재발송하지 않는다.
- 업무 핸들러가 HTTP 200으로 ok:false를 반환하더라도 실패를 실행 기록에 반영한다. 이미 게시/사람 수정/원고 없음으로 생략한 자동 초안은 terminal skipped로 남긴다. 예약 알림의 개별 전달 실패는 해당 scheduled_notifications 문서의 needs_review로 확인한다.

## 자동 초안 보호

기존 게시·수동 작성 보호를 유지한다. AI 호출 동안 목회자가 주차 문서를 새로 만들거나 수정·게시할 수 있으므로 저장 직전 트랜잭션에서 최초 snapshot의 존재 여부와 updateTime을 다시 비교한다. 바뀌었으면 덮어쓰지 않는다. 초안은 계속 draft로만 저장하고 자동 게시하지 않는다.

## 검증

- 필수 typecheck/lint/test/build, Firebase 함수 build와 별도 함수 소스 typecheck 통과.
- 로컬 테스트 346개 통과·130개 생략, 린트 오류 0·경고 416. 새 단위 테스트에서 서울 시간표·UTC 회차 경계·비활성 공급자·동시 중복·공급자 전환·불확실한 실행의 재시도 차단·오래된 이벤트·초안 생성 중 사람의 변경 보존을 검증했다.
- 에뮬레이터 전용 테스트를 추가했다: 일반/관리자 클라이언트의 제어·실행 기록 접근 거부, 실제 Firestore 동시 트랜잭션과 공급자 전환 시 한 번만 실행. 로컬 일반 npm test에서는 에뮬레이터가 없어 생략되며 PR CI의 에뮬레이터 단계에서 실행한다.
- 빌드된 함수의 manifest에서 네 스케줄·지역·타임존·재시도 0과 자동 초안만 Gemini 비밀값을 사용하는지 확인했다. 업무를 실제 실행하지 않았다.

## 운영 전환 절차 (별도 명시적 승인 후)

1. **먼저 이 PR을 병합해 Netlify 운영에 공용 guard를 배포한다.** 해당 production 배포의 함수 번들에 guard가 포함된 것을 확인한다. 구버전 Netlify 핸들러가 남아 있을 때 owners를 바꾸면 중복 방지가 성립하지 않는다.
2. 위 제어 문서가 없거나 모든 작업의 owner가 netlify인지 확인한다. 잘못된 설정/기존 실행 기록이 있으면 멈추고 검토한다. 이 단계에서는 Firebase 업무 실행이 비활성이다.
3. 사용자 승인 후 아래 네 함수만 배포한다. 실제 발송을 유발하는 수동 Run now는 하지 않는다. Cloud Scheduler API 활성화, Scheduler→함수 호출 권한, Gemini 키 연결과 기존 실행 계정의 named DB/FCM 권한을 확인한다.

```bash
firebase deploy --only functions:raah:scheduledNotifications,functions:raah:wordFruitAggregate,functions:raah:wordFruitFridayWarning,functions:raah:wordFruitAutoDraft --project gen-lang-client-0036445484 --non-interactive
```

4. Scheduler manifest·주기·Asia/Seoul·인증 호출·재시도 0·함수 상태와 비밀값 연결 메타데이터를 확인한다. 공개 비인증 호출이 업무에 진입하면 안 된다. 기본 owner가 netlify이므로 배포 자체로 자동 발송·AI 생성을 새로 시작하지 않는다.
5. 스케줄 시각과 겹치지 않는 때에 owners를 **원자적으로** firebase로 바꾼다. 이 변경은 운영 자동 실행 주체를 바꾸는 작업이며 명시적 승인을 받고 수행한다. Netlify는 다음 실행부터 guard에서 건너뛰고 Firebase만 업무를 수행한다. 전환 도중 이미 시작한 같은 회차는 공유 기록으로 새 공급자가 다시 실행하지 않는다.
6. 이후 자연 실행 시각마다 `_scheduled_job_runs`의 provider·상태·회차를 확인한다. failed/processing 건을 단순히 지우거나 같은 회차를 수동 재실행하지 않는다. 알림 수신·게시 준비·집계 결과는 업무별 확인을 거친다. 사전 메타데이터 확인만으로 실제 발송·AI 성공을 주장하지 않는다.
7. 안정 기간 후 별도 PR로 Netlify의 네 스케줄/진입점을 제거한다. 먼저 owners 전환을 적용하고, 이후 기존 스케줄 제거를 진행한다. 공유 업무 코드는 Firebase에서 계속 사용하므로 실수로 지우지 않는다.

## 되돌리기·실패 검토

- 실행 주체 롤백: guard가 있는 Netlify 운영 버전을 유지한 상태에서 owners를 netlify로 바꾼다. 같은 회차가 이미 실행된 기록은 그대로 유지한다.
- 긴급 정지: 해당 owner를 paused로 바꾼다. 이미 실행 중인 작업을 취소하는 기능은 아니며 이후 진입을 막는다.
- needs_review 또는 오래된 processing이 있으면 발송·AI 저장·알림 생성의 실제 결과를 확인한다. 필요한 개별 업무만 검토 후 처리한다. 자동 lease 복구/무조건 재발송은 구현하지 않는다.
- 토요일/금요일 작업을 검증하기 위해 실제 운영 원고·알림을 수동 생성하지 않는다. 시험은 모의 SDK 또는 격리된 에뮬레이터에서 수행한다.
- ledger 보존 정책/자동 TTL 정리는 아직 추가하지 않았다. 정리할 때도 실행 중이거나 같은 회차가 다시 전달될 가능성이 있는 기록은 지우지 않는다.
