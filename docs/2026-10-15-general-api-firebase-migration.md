# 일반 HTTP API를 Firebase 도쿄로 이전

상태: siteApi 배포 및 PR #110·#111 병합, 운영 일반 API 8개 경로 전환 완료. Netlify는 요청을 Firebase 도쿄로 전달한다.

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

## 배포 결과 (2026-10-15)

- 배포 소스 `5c2cfa4`, 명령 `firebase deploy --only functions:raah:siteApi --project gen-lang-client-0036445484 --non-interactive` 성공. `raahApi`는 이번에 배포하지 않았다.
- Node.js 22, asia-northeast1, 상태 ACTIVE. 실행 계정 `638399109645-compute@developer.gserviceaccount.com` 확인.
- Netlify 키는 CLI에서 마스킹되어 자동 복사하지 못했다. 사용자가 Secret Manager에 직접 등록한 `GEMINI_API_KEY` 활성 버전 1을 연결했다. 실제 키 값은 조회·출력하지 않았다. 배포 CLI가 이 비밀값에 한해 실행 계정에 Secret Accessor를 연결했다.
- Netlify의 유효한 모델 override가 없어 기존 코드 기본값 `gemini-3.8-flash`를 gitignored 함수 dotenv에 지정했고, 배포된 모델 설정도 확인했다.
- Auth·Firestore·FCM 권한은 기존 Editor 역할에서 확인했다. Storage 객체 조회는 빠져 있어 사용자 별도 승인 후 `projects/gen-lang-client-0036445484/roles/churchSiteAttachmentRead` 역할을 만들었다(`storage.objects.get` 하나).
- 버킷에 직접 조건부 권한을 넣으려면 uniform bucket-level access가 필요해 해당 방식은 적용하지 않았다. 사용자가 프로젝트 IAM 방식을 별도로 승인한 뒤, 프로젝트 정책에 같은 실행 계정·같은 단일 역할을 연결했다. 조건은 아래 세 접두 경로의 OR이며 다른 버킷/경로에 권한을 추가하지 않는다. 버킷 ACL은 변경하지 않았다.

```text
projects/_/buckets/gen-lang-client-0036445484.firebasestorage.app/objects/pdfs/
projects/_/buckets/gen-lang-client-0036445484.firebasestorage.app/objects/materials/
projects/_/buckets/gen-lang-client-0036445484.firebasestorage.app/objects/sermons/
```

- Cloud Functions 공개 주소에서 8개 API 비인증 요청 → 모두 401, 잘못된 메서드 8건 → 모두 405, 미등록 RAAH/예약/레거시 경로 3건 → 모두 404. 19건 모두 no-store 확인.
- 실제 로그인·Storage 파일 조회/삭제·알림 발송·Gemini 생성 요청은 이번 배포 검증에서 실행하지 않았다. 따라서 이 기능들의 운영 성공을 입증한 것은 아니다. IAM 정책과 함수 설정은 메타데이터로 검증했다.
- 다음 작업은 PR #110 병합과 별도 API 프록시 전환 PR이다. 현재 웹 클라이언트는 계속 Netlify 일반 API를 호출한다.

## 일반 API 요청 전환

사용자가 PR #110 병합과 일반 API 경로 전환까지 승인했다. #110의 CI·미리보기 검사 통과를 확인해 병합했다. 후속 전환에서는 `public/_redirects` 맨 위에 위 8개 정확한 경로의 Firebase 강제 프록시를 추가한다. 기존 RAAH API·SPA 규칙은 유지한다. 기존 Netlify 함수는 안정 확인과 롤백을 위해 유지한다.

전환 PR의 미리보기에서 8개 비인증 요청과 8개 잘못된 메서드 요청의 상태·no-store를 확인한 후 병합한다. 운영 배포 후 같은 검증을 기본 도메인에서 반복하고, RAAH 도메인의 일반 API도 확인한다. 실제 로그인 후 기능과 Gemini 생성·발송·파일 삭제는 이 거부 응답 검사만으로 검증되지 않는다.

## 운영 전환 완료 (2026-10-15 15:11 KST)

- PR #110 병합 커밋: `159d974815b2392ef23ae625b38957a885c7787c`.
- 전환 PR #111 병합 커밋: `b71e4ab09fa78dc215a517ada96171167ee3ee44`.
- Netlify production 배포 `6ad06e596f0259266ae746f2`가 해당 커밋으로 ready 상태, 15:11 KST 게시됨을 확인했다.
- 로컬 필수 검사 통과: typecheck, lint(오류 0·기존 경고 417), 테스트 324개 통과·128개 생략, 웹 build. 빌드 결과의 `_redirects` 일치를 확인했다.
- 전환 PR의 GitHub CI 2건과 Netlify 리다이렉트·미리보기 검사 통과.
- 미리보기: 8개 API 비인증 요청 → 401, 잘못된 메서드 8건 → 405, 16건 모두 no-store.
- 운영 `https://builttogether.church`와 `https://raah.builttogether.church` 각각 같은 16건(총 32건) 통과. 이제 기존 클라이언트 `/api/*` 요청은 Firebase로 전달된다.
- RAAH 회귀 확인: 운영 bootstrap 비인증 요청 401, 잘못된 state 캘린더 콜백 400, 모두 no-store.
- 로그인 후 실제 발송·첨부 조회/삭제·Gemini 생성 성공은 검증하지 않았다. 위 요청은 모두 비인증 상태로 수행했으며 운영 자료를 변경하지 않았다.
- 롤백: `public/_redirects`의 일반 API용 8개 정확한 경로 규칙만 제거해 PR/배포한다. 기존 Netlify 함수는 유지했다.
- 다음 이전 범위: 예약 알림과 말씀열매 예약 작업. Netlify 웹 호스팅·예약 함수·캘린더 전달 함수는 아직 남아 있다.
