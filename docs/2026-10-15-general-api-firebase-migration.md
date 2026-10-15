# 일반 HTTP API를 Firebase 도쿄로 이전

상태: 구현·로컬 검증 완료, 미배포. 운영 경로는 계속 기존 Netlify 함수로 연결된다.

## 구현

기존 `firebase-functions` 코드베이스(`raah`)에 별도 HTTP 함수 `siteApi`를 추가했다. 실행 지역은 RAAH와 같은 asia-northeast1이다. HTTP 어댑터만 공유하며, `raahApi`의 핸들러·권한·비밀값 구성은 그대로 유지한다.

| 경로 | 메서드 | 기존 권한 경계 |
| --- | --- | --- |
| `/api/post-comments` | POST, DELETE | 로그인, 게시글 접근, 댓글 작성자/관리자, 트랜잭션·중복 요청 보호 |
| `/api/attachments` | DELETE | 로그인, 파일 metadata의 소유자 또는 관리자 |
| `/api/notifications/subscribe` | POST | 로그인, 허용된 토픽·구독 동작 |
| `/api/notifications/send` | POST | 관리자 |
| `/api/notifications/health` | GET | 관리자 |
| `/api/word-fruit/check` | POST | 로그인, 본인 기록·날짜·중복 체크 트랜잭션 |
| `/api/word-fruit/generate-cards` | POST | 다음세대 목회자 권한 또는 이메일 인증된 지정 관리자 |
| `/api/word-fruit/notify-publish` | POST | 위와 같은 권한, 게시 완료된 주차 |

- 기존 핸들러를 그대로 연결한다. 예약 함수, RAAH, `/.netlify/functions/*` 경로는 이 함수에 등록하지 않는다.
- 사용자 토큰은 기존 `verifyIdToken(token, true)`로 검증하며 관리자·역할·파일 소유권 검사를 유지한다.
- Firebase의 기본 애플리케이션 자격 증명을 사용한다. 기존 named Firestore DB와 기존 Storage bucket을 유지한다.
- 함수에 연결할 비밀값은 `GEMINI_API_KEY` 하나다. RAAH 암호화 키·Supabase 서비스 키는 연결하지 않는다. 비밀이 아닌 `GEMINI_MODEL`은 기존 기본 모델을 사용하며 파라미터로 변경할 수 있다.
- 기존 웹 클라이언트의 상대 `/api/*` 주소를 유지할 예정이므로 CORS는 비활성화한다. 응답은 성공·실패 모두 `Cache-Control: no-store`로 보낸다.
- 말씀열매 체크는 트랜잭션 이후 부모 알림 작업을 기다리고 응답한다. 응답 후 실행이 중단되는 상황을 피하면서, 알림 실패가 이미 저장한 체크를 실패로 돌리지 않도록 기존 best-effort 처리를 유지한다.

## 검증

로컬에서 typecheck, lint, test, build 및 Firebase 함수 빌드·함수 소스 typecheck 통과. 테스트 324개 통과·128개 생략, 린트 오류 0·기존 경고 417개.

새 테스트는 SDK를 모의 처리하고 실제 API 핸들러와 어댑터를 실행한다. 8개 경로의 비인증 거부, 토큰 폐기 검사, 관리자·목회자 권한, 인증 안 된 관리자 이메일 거부, 첨부 소유권·버킷, 댓글 트랜잭션·중복 요청·타인 삭제 거부, named DB, 토픽 요청, 카드 생성, 부모 알림 완료 대기·실패 시 체크 성공 유지를 확인한다. 기존 RAAH 어댑터·콜백 테스트도 그대로 통과한다. 실제 알림 전송·파일 삭제·운영 DB 변경·AI 요청은 실행하지 않았다.

## 배포와 전환 순서

1. 별도 배포 승인 후 Secret Manager의 `GEMINI_API_KEY`를 준비한다. Netlify 운영 키와 같은 계정/프로젝트의 키를 사용하며 값을 대화나 로그에 출력하지 않는다. `GEMINI_MODEL`을 운영과 맞춘다.
2. 실행 서비스 계정의 Auth 토큰 폐기 조회, named Firestore 읽기/쓰기, 기존 Storage 파일 metadata 조회/삭제, FCM 발송 권한을 확인한다. 로컬 모의 테스트는 운영 IAM 권한을 증명하지 않는다. 이 PR에서 IAM이나 운영 비밀값은 변경하지 않았다.
3. `npm --prefix firebase-functions run build` 후 `firebase deploy --only functions:raah:siteApi --project gen-lang-client-0036445484 --non-interactive`로 **siteApi만** 배포한다. 예약 작업은 생성하지 않는다.
4. 직접 함수 주소의 `/siteApi/api/...`에서 비인증 요청과 잘못된 메서드의 거부를 확인한다. 실제 발송·삭제를 smoke test로 실행하지 않는다. 관리자 health는 실제 로그인 상태에서 확인한다.
5. 직접 확인 후 별도 PR에서 아래 8개 규칙을 `public/_redirects`의 도메인/SPA 규칙보다 앞에 추가한다. 기존 `/api/raah/*` 규칙은 유지한다. 배포 전에 이 규칙을 추가하지 않는다.

```text
/api/post-comments  https://asia-northeast1-gen-lang-client-0036445484.cloudfunctions.net/siteApi/api/post-comments  200!
/api/attachments  https://asia-northeast1-gen-lang-client-0036445484.cloudfunctions.net/siteApi/api/attachments  200!
/api/notifications/subscribe  https://asia-northeast1-gen-lang-client-0036445484.cloudfunctions.net/siteApi/api/notifications/subscribe  200!
/api/notifications/send  https://asia-northeast1-gen-lang-client-0036445484.cloudfunctions.net/siteApi/api/notifications/send  200!
/api/notifications/health  https://asia-northeast1-gen-lang-client-0036445484.cloudfunctions.net/siteApi/api/notifications/health  200!
/api/word-fruit/check  https://asia-northeast1-gen-lang-client-0036445484.cloudfunctions.net/siteApi/api/word-fruit/check  200!
/api/word-fruit/generate-cards  https://asia-northeast1-gen-lang-client-0036445484.cloudfunctions.net/siteApi/api/word-fruit/generate-cards  200!
/api/word-fruit/notify-publish  https://asia-northeast1-gen-lang-client-0036445484.cloudfunctions.net/siteApi/api/word-fruit/notify-publish  200!
```

6. Netlify 미리보기에서 검사 통과와 거부 응답을 확인하고, 승인된 PR 병합으로 운영을 전환한다. 실제 로그인 후 기능은 지정된 시험 자료·수신자·파일로 확인한다. 일반 알림 발송·말씀열매 발행 알림은 실제 수신자에게 전달되므로 무작정 호출하지 않는다.
7. 문제가 있으면 추가한 프록시 규칙을 제거해 기존 Netlify 핸들러로 돌아간다. 기존 함수와 키는 안정 확인 전 지우지 않는다. 자료 이동은 없다.

Netlify 프록시 시간 제한과 별개로 Firebase 함수 timeout은 60초다. 특히 AI 카드 생성과 부모 알림까지 기다리는 체크의 실제 응답 시간은 전환 전에 확인해야 한다. 스케줄 이전과 Firebase Hosting/DNS 전환은 다음 단계다.
