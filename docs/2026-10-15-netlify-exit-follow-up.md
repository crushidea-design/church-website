# Netlify 이전 후속 작업

## 최초 상태 (2026-10-15, 이후 진행은 아래 기록)

- #107: RAAH HTTP API 5개를 Firebase 도쿄 `raahApi`에서 실행하도록 구현하고 `/api/raah/*` 프록시를 main에 반영.
- #108: 캘린더 연결 만료 시 재연결 안내 반영.
- 운영 `/api/raah/bootstrap`에 인증 없이 GET → 401 확인. 이 응답만으로 배포 버전, 로그인 후 기능, 복호화, 성능을 확인했다고 판단하지 않는다.
- 이번 변경: 기존 Google Calendar 콜백을 같은 Firebase 함수의 라우트로 추가. 기존 URL, 서명 state 검사, 암호화 저장 코드를 재사용한다. Firebase 함수는 사용자 승인 후 배포 완료했다. 프록시 전환은 아직 배포하지 않았다.

## 캘린더 콜백 전환 순서

1. 변경 코드 검토 후 Firebase `raahApi` 배포를 승인받는다. 기존 세 비밀값을 그대로 사용한다. Google OAuth 설정은 기존 DB 설정을 읽는다.
2. `npm --prefix firebase-functions run build` 후 `firebase deploy --only functions:raah:raahApi` 실행. 이 단계에서는 Netlify 콜백이 계속 운영 요청을 처리한다.
3. 배포된 함수의 `/raahApi/.netlify/functions/raah-calendar-callback?code=test&state=invalid.signature`가 HTML 400을 반환하는지 확인한다. 토큰 교환·저장이 발생하면 안 된다. 비밀값이나 OAuth 쿼리 전체를 로그에 남기지 않는다.
4. PR #109에서 기존 Netlify 콜백을 Firebase로 GET 전달하는 얇은 함수로 교체한다. Netlify 미리보기 검사에서 `/.netlify/functions/*`를 `_redirects` 출발점으로 쓰는 것은 금지됨을 확인했으므로 프록시 규칙은 사용하지 않는다.
5. 기존 콜백 구현은 `_shared/raah-calendar-callback.mts`로 옮겨 Firebase에서만 실행한다. 로컬 개발은 공유 구현을 직접 사용한다. 전달 함수는 고정된 Firebase 주소만 호출하고 OAuth 쿼리의 인코딩을 보존하며 요청·오류 내용을 로그에 남기지 않는다.
6. Netlify 배포 후 실제 관리자 화면에서 재연결 → 완료 → RAAH 복귀 → 일정 조회를 확인한다. Google 등록 콜백 주소는 유지한다. Netlify 전달 함수는 호스팅 이전 시 제거할 임시 의존성이다.
7. 실패 시 Netlify 콜백 파일을 기존 구현으로 복구해 배포한다. 현재 PR에는 원본 구현이 공유 파일로 보존되어 있다.

## 이후 전체 이전 순서

| 순서 | 범위 | 완료 조건 |
| --- | --- | --- |
| 1 | RAAH 운영 검증 | 홈·성도·성찬·기록·일정·캘린더, 기존 기록 복호화, Server-Timing 전후 비교 |
| 2 | 일반 HTTP API | 댓글, 첨부 삭제, 알림 구독·발송·상태, 말씀열매 확인·카드 생성·발행 알림을 Firebase 진입점에 연결하고 인증/권한 회귀 검증 |
| 3 | 예약 실행 | 예약 알림(매시), 말씀열매 집계(매일 23시 KST), 자동 초안(토요일 23시 KST), 경고(금요일 12시 KST)를 Scheduler로 이전. 작업별 중복 실행 방지와 실패 재시도를 검증하고 기존 스케줄과 동시 활성화하지 않는다 |
| 4 | Firebase Hosting | 기본·RAAH·다음세대 도메인별 진입점과 SPA 라우팅, 보안 헤더, API rewrite, OAuth 기존 콜백 URL 호환, 프리뷰 검증 및 승인 후 DNS 전환 |
| 5 | 자동 배포·정리 | 승인된 CI 배포 절차, 롤백 확인, 안정 기간 뒤 Netlify 함수/환경 변수 정리 및 해지 |

예약 발송의 실제 실행이나 운영 자료 변경은 검증 목적으로 수행하지 않는다. 각 운영 전환은 코드 구현·검증과 별도로 명시적 배포 승인을 받아 진행한다.

## Firebase 배포 결과 (2026-10-15)

- 사용자 승인 후 `firebase deploy --only functions:raah:raahApi --project gen-lang-client-0036445484 --non-interactive` 성공.
- 배포 소스: `9cdb664` (codex/work). Node.js 22, 2세대, asia-northeast1.
- 배포 시 predeploy 빌드 통과. 함수 URL: `https://raahapi-7ohsabnl2q-an.a.run.app`.
- Cloud Functions 공개 주소에서 잘못된 state 콜백 → 400, `text/html; charset=utf-8`, `Cache-Control: no-store`.
- 같은 함수의 bootstrap 비인증 요청 → 401, `application/json`, `Cache-Control: no-store`.
- 실제 Google 재연결·토큰 교환·기존 기록 복호화는 이번 운영 검증에서 실행하지 않았다. 잘못된 state가 토큰 교환·저장에 도달하지 않는 동작은 앞선 모의 테스트로 확인했다.
- Netlify 콜백 프록시 변경, main 병합, 웹 배포는 수행하지 않았다. 다음 작업은 위 전환 절차 4~5번이다.

## 콜백 전환 PR 준비

PR #109: Firebase 배포 후 기존 Netlify 콜백을 전달 함수로 교체한다. Firebase OAuth 구현과 서명 state·암호화 저장 처리는 그대로 유지한다. 최초 시도한 `_redirects` 규칙은 Netlify 검사에서 예약 경로 제한으로 거부되어 제거했다. 실제 Google 재연결 확인은 PR 병합·배포 뒤 진행한다.

## 운영 전환 완료 (2026-10-15 14:41 KST)

- 사용자 승인 후 PR #109 squash 병합: `301fa8c9587a6a9be00cef953d32fe1d7b40ed43`.
- Netlify production 배포 `6ad06735dc7d30f39af6597f`, state `ready`, 게시 시각 2026-10-15 14:41 KST 확인.
- 운영 `raah.builttogether.church`의 기존 콜백 주소에 잘못된 state 요청 → 400, HTML, no-store 확인.
- 운영 bootstrap 비인증 요청 → 401, JSON, no-store 확인.
- PR CI 2건과 Netlify 리다이렉트 검사·미리보기 배포 통과. 로컬 필수 검사 통과, 테스트 297개 통과·128개 생략, 린트 오류 0·기존 경고 417.
- 실제 Google 동의 화면의 재연결 및 로그인 후 일정 조회는 계정 소유자의 확인이 남아 있다. 이번 검증은 실제 OAuth 토큰 교환·저장을 수행하지 않았다.
- Netlify에는 기존 URL을 유지하는 전달 함수만 남아 있다. 다음 구현 범위는 일반 HTTP API 이전이다.

## 일반 API 구현 진행

별도 `siteApi`에 일반 HTTP 핸들러 8개를 연결했다. 운영 프록시는 아직 변경하지 않았다. 사용자 승인 후 Gemini 비밀값 등록·조건부 Storage 조회 권한 연결·siteApi 배포와 직접 거부 응답 19건 검증을 마쳤다. 구현·검증 및 전환 절차는 `2026-10-15-general-api-firebase-migration.md`를 따른다.

## 일반 API 운영 전환 완료

2026-10-15 15:11 KST: PR #110·#111을 승인된 절차로 병합하고 일반 API 8개를 Firebase 도쿄로 전환했다. 운영 두 도메인에서 거부 응답 32건과 RAAH 회귀 2건을 확인했다. 다음 단계는 예약 작업 이전이다. 상세 배포·검증·롤백 기록은 `2026-10-15-general-api-firebase-migration.md`를 따른다.

## 예약 작업 이전 구현

네 예약 작업을 Firebase onSchedule로 연결하고, Netlify와 Firebase가 공유하는 실행 주체·회차별 트랜잭션 guard를 추가했다. 2026-10-15 사용자 승인 후 PR #112 병합·Netlify 실행 제어 배포·Firebase 예약 함수 배포와 실행 주체 전환을 완료했다. 네 owner는 firebase이며 자연 실행 결과는 아직 확인 전이다. `2026-10-15-scheduled-jobs-firebase-migration.md`의 단계별 전환·롤백 절차를 따른다.

다음 단계는 예약 작업의 자연 실행 확인과 안정 기간 뒤 Netlify 예약 진입점 정리, 이후 Firebase Hosting·도메인 전환이다.

## Hosting 이전 준비

교회·다음세대를 위한 `church`와 RAAH 전용 `raah` Hosting target을 준비했다. 설정은 `firebase.hosting.json`, 빌드는 `npm run build:hosting`을 사용한다. 미리보기에서도 RAAH 진입점과 PWA가 올바르게 동작하도록 화면 판별을 보완하고 API·기존 콜백 rewrite를 연결했다. 사이트 생성·미리보기 업로드·Auth 도메인·DNS는 아직 변경하지 않았다. 자세한 검증·배포·롤백 절차는 `2026-10-15-firebase-hosting-migration.md`를 따른다.


## Firebase Hosting 미리보기 검증 완료

2026-10-15 사용자 승인으로 교회·RAAH의 `migration-review` 채널을 7일 만료로 배포했다. 두 미리보기의 실제 Google 로그인을 확인했고, RAAH 조회 API의 인증 후 HTTP 200과 양쪽 정적·API 거부 응답 검사 총 54건을 확인했다. `.firebaserc`에 실제 target 매핑을 기록했다. 운영 도메인·DNS·live Hosting release는 아직 전환하지 않았으며 PR #113은 초안 상태다. URL·버전·검증 한계는 `2026-10-15-firebase-hosting-migration.md`의 완료 기록을 따른다.

## Hosting 운영 배포 및 도메인 인증 진행

2026-10-15 15:57 KST 사용자 승인으로 PR #113을 병합(main `759e307`)하고 교회·RAAH의 Firebase Hosting live 채널을 배포했다. 기본 live URL의 정적 페이지·API 거부 응답 검사를 통과했다. Namecheap에 소유권·인증서 TXT를 게시하고 A 레코드 TTL을 1분으로 낮췄다. 인증서 활성화와 TLS 사전 검사 뒤 운영 A를 Firebase 주소로 전환한다. 기존 Netlify 배포·인증서는 복구용으로 유지한다. 상세 진행은 `2026-10-15-firebase-hosting-migration.md`에 기록한다.

예약 알림은 16:00 KST 회차의 provider=firebase, status=completed를 확인했다. 나머지 세 작업의 자연 실행 및 실제 푸시 수신은 별도 확인 대상이다.
