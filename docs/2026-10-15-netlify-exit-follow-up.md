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
4. 그 뒤 별도 PR에서 `public/_redirects`의 SPA 규칙보다 위에 아래 한 줄을 추가한다. Firebase 배포와 400 응답 확인을 마친 뒤 이 줄을 추가했다. PR 병합·Netlify 배포 전까지 운영 요청 경로는 바뀌지 않는다.

```text
/.netlify/functions/raah-calendar-callback  https://asia-northeast1-gen-lang-client-0036445484.cloudfunctions.net/raahApi/.netlify/functions/raah-calendar-callback  200!
```

5. Netlify 배포 후 실제 관리자 화면에서 재연결 → 완료 → RAAH 복귀 → 일정 조회를 확인한다. Google에 등록된 콜백 주소는 바꾸지 않는다. Google token 교환에도 기존 공개 도메인 주소를 사용한다.
6. 실패하면 위 프록시 한 줄을 제거해 Netlify 콜백으로 복귀한다. 기존 Netlify 함수와 비밀값은 안정 확인 전 삭제하지 않는다.

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

Firebase 배포 후 `public/_redirects` 맨 위에 기존 콜백 URL의 강제 프록시를 추가했다. Google 등록 주소는 유지하며 서명 state와 code 쿼리를 Firebase 핸들러에 전달한다. 기존 Netlify 핸들러는 롤백용으로 유지한다. 운영 전환과 실제 Google 재연결 확인은 PR 병합·배포 뒤 진행한다.
