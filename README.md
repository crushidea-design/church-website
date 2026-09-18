# 함께 지어져가는 교회

Vite·React·TypeScript 기반 교회 홈페이지, 다음세대 자료실, RAAH 목양 관리입니다. 운영 호스팅과 API는 Netlify, 인증·교회 콘텐츠는 Firebase, 암호화된 RAAH 기록은 Supabase를 사용합니다.

## 로컬 실행

Node.js 22 이상에서 실행합니다. 저장소의 `.nvmrc`는 22를 지정하며, Firebase Admin 14는 Node 18·20을 지원하지 않습니다.

```sh
npm ci
npm run dev
```

기본 주소는 `http://localhost:3000`입니다. 환경변수는 `.env.example`을 참고해 `.env`에 설정합니다. `.env`와 자격증명은 커밋하지 않습니다. 개발 서버는 RAAH·댓글·첨부파일 삭제에 운영과 같은 함수 핸들러를 사용합니다. 서비스 계정이 없으면 관리자 API는 이용할 수 없지만 공개 화면은 확인할 수 있습니다.

- `FIREBASE_SERVICE_ACCOUNT_KEY`: 서버 Firebase 토큰 검증 및 관리자 SDK.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RAAH_ENCRYPTION_SECRET`: RAAH 저장소·암호화. 서비스 역할 키와 암호화 비밀값은 서버에만 둡니다.
- `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_ID`, `APP_URL`: 선택적 캘린더 연동.
- `GEMINI_API_KEY`: 말씀열매 카드 생성에 사용합니다. 목양 메모는 AI API로 전송하지 않습니다.
- `ENABLE_LOCAL_SCHEDULED_NOTIFICATIONS`: 기본 비활성화입니다. 테스트 프로젝트에서만 `true`로 설정합니다. 운영 자격증명으로 로컬 예약 발송을 켜지 않습니다.

## 검증

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

보안 규칙과 트랜잭션 검증은 Firebase CLI 15.25.1, Java 21 이상이 필요합니다.

```sh
npm run test:rules
```

CLI를 설치하지 않은 경우:

```sh
npx --yes --package firebase-tools@15.25.1 firebase emulators:exec --config firebase.emulators.json --project demo-church-review --only firestore,storage "npx vitest run tests/security.rules.test.ts"
```

이 검증은 `demo-church-review` 에뮬레이터만 사용합니다. 운영 프로젝트를 지정하지 않습니다. 일반 `npm test`에서는 에뮬레이터 의존 테스트를 건너뛰고, CI에서 별도로 실행합니다.

## 역할별 로컬 검증

운영 계정 없이 가상 관리자·일반회원·교사·학부모를 생성합니다. 위와 같은 Firebase CLI와 Java가 필요합니다.

```sh
npm run test:roles
# 다른 터미널에서 API 회귀 검증
node --import tsx tests/support/role-smoke.ts
```

브라우저 주소는 `http://localhost:3101`입니다. 이메일은 `test-admin@example.test`, `test-member@example.test`, `test-teacher@example.test`, `test-parent@example.test`, 공통 비밀번호는 `Test-only-2026!`입니다. 이 값은 로컬에서만 생성하는 공개 테스트 계정입니다. 테스트 종료는 Ctrl+C입니다. `test:rules`와 포트를 공유하므로 동시에 실행하지 않습니다.

실제 Firebase 인증·Firestore·Storage 에뮬레이터를 사용하며, RAAH의 Supabase는 메모리 기반 REST 대역입니다. PostgreSQL 제약·RLS·운영 인덱스·실제 OAuth·푸시 전달 검증을 대신하지 않습니다. 테스트 실행기는 `.env`를 읽지 않고 외부 API를 차단합니다. 에뮬레이터 모드는 개발 빌드에서만 활성화되며 프로덕션 빌드에는 적용되지 않습니다.

## 배포와 운영

브랜치·배포 규칙은 [CODEX.md](CODEX.md)를 따릅니다. `main` 직접 push는 금지하며 배포는 명시적 요청 후 PR/병합 절차로 진행합니다.

- 새 댓글 API와 클라이언트를 먼저 배포하고 정상 작동을 확인한 후 Firestore·Storage 규칙을 적용합니다. API 없이 새 규칙만 먼저 적용하면 기존 댓글 등록·파일 업로드가 막힙니다. 이전 화면을 열어 둔 사용자는 새로고침이 필요합니다.
- 소유자 정보 없는 옛 첨부파일은 읽기를 유지합니다. 비관리자가 해당 글을 삭제할 때 파일 자체는 보존될 수 있으므로, 관리자 확인 후 정리합니다. 사용자 작성 게시글의 URL만으로 파일 소유권을 추정하지 않습니다.
- 가정예배 사진·자료의 기존 다운로드 URL 회수, 게시글 비공개/예약/대상자 정책 전환은 별도 데이터 이전과 호환 검증이 필요합니다. 이번 규칙 변경만으로 해결된 것으로 간주하지 않습니다.
- 예약 알림의 `processing`이 오래 유지되거나 `needs_review`이면 수신 결과를 먼저 확인합니다. 자동으로 pending으로 되돌리면 이미 전달된 알림이 중복 발송될 수 있습니다.
- Google 캘린더에는 로컬 메모를 내보내지 않습니다. 성도와 연결된 일정은 `목양 일정`이라는 제목으로 표시합니다. 일반 일정의 제목에는 민감한 내용을 쓰지 않습니다. 이미 외부에 저장된 과거 이벤트는 별도 확인 대상입니다.
- RAAH 암호화 비밀값을 변경하면 기존 기록을 복호화할 수 없습니다. 기존 키와 DB의 암호화된 백업을 별도로 보관하고, 키 교체는 복호화→새 키 재암호화→복원 시험을 포함한 별도 이행으로 진행합니다.

검토 내용과 적용 범위는 [개선 계획](docs/2026-09-16-code-review-plan.md), [수정 인계](docs/2026-09-17-implementation-handoff.md)를 참고합니다.


## 서버 SDK와 외부 연결 점검

Firebase Admin은 모듈별 진입점(`firebase-admin/app`, `/auth`, `/firestore`, `/messaging`, `/storage`)을 사용합니다. 예전 namespace import를 다시 추가하지 않습니다. `gaxios@6.7.1`의 `uuid`만 11.1.1로 고정해 전이 취약점을 제거했습니다. Storage가 수정된 의존성을 제공하면 override를 제거하고 multipart 호환 테스트와 `npm audit`을 다시 확인합니다.

Netlify CLI 로그인 후 아래 명령으로 **운영 읽기 전용 연결**을 점검할 수 있습니다. CI에는 넣지 않습니다. 자격증명은 메모리에서만 처리하며, 점검 결과에는 연결 상태와 안전한 오류 코드만 표시합니다. 실제 자료 저장이나 푸시·캘린더 발송은 하지 않습니다.

```sh
node --import tsx tests/support/external-readiness.ts --read-only-production
```

2026-09-18 기준 Supabase는 일시정지 상태로 확인되었습니다. 프로젝트를 재개한 뒤 위 검사를 다시 실행해야 합니다. Google Calendar 클라이언트 설정도 아직 없어 해당 연동은 검증하지 못했습니다. Netlify의 `NODE_VERSION`·`AWS_LAMBDA_JS_RUNTIME` override는 점검 당시 없었으므로 다음 빌드에서는 `.nvmrc`의 Node 22 설정을 따릅니다. 운영 설정에 별도 override를 추가한다면 Node 22 이상이어야 합니다.
