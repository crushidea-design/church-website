# Netlify 이전 후속 작업

## 현재 상태 (2026-10-15)

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

별도 `siteApi`에 일반 HTTP 핸들러 8개를 연결했다. 운영 프록시·비밀값·IAM·배포는 아직 변경하지 않았다. 구현·검증 및 전환 절차는 `2026-10-15-general-api-firebase-migration.md`를 따른다.
