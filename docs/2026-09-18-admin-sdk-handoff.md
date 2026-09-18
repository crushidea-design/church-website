# 서버 SDK·외부 연결 검증 인계 — 2026-09-18

브랜치 `codex/work`, 마지막 커밋 `db343f6`. 기존 미커밋 작업을 보존했다. 이번 변경도 커밋·push·배포하지 않았다.

## 완료한 변경

- Firebase Admin 13.10 → 14.4로 변경. 공통 인증, 알림, 말씀열매, 예약 작업, 첨부 삭제, 개발 서버, 이전 스크립트 및 테스트 실행기를 모듈별 API로 이관했다. Firebase 토큰 회수 확인과 현재 관리자 역할 검증은 유지한다.
- `package.json`에 Node >=22 조건, `.nvmrc`에 Node 22를 명시했다. 점검 당시 운영 Netlify에는 별도의 `NODE_VERSION`·`AWS_LAMBDA_JS_RUNTIME` override가 없었다. 기존 배포의 런타임을 바꾼 것은 아니며 다음 빌드에 적용될 설정이다.
- Storage 8.1.0이 사용하는 `gaxios@6.7.1`의 `uuid`에만 11.1.1 override를 적용했다. 해당 호출은 인자 없는 UUID v4 생성이며, CommonJS 로딩 및 multipart 경계·본문 호환 테스트를 추가했다. Storage 상위 패키지가 수정 버전을 제공하면 override 제거 여부를 검토한다.
- `tests/support/external-readiness.ts`에 명시적 실행 옵션이 필요한 운영 읽기 전용 연결 점검을 추가했다. 서비스 자격증명은 메모리에서만 사용하고 내용·기록·비밀값을 출력하지 않는다. CI 자동 실행 대상이 아니다.

## 검증 결과

| 검증 | 결과 |
|---|---|
| `npm audit` | 취약점 0건. 최초 27건 → 이전 단계 8건 → 현재 0건 |
| `npm run typecheck` | 통과 |
| `npm run lint` | 오류 0, 경고 424 |
| `npm test` | 137개 통과, 에뮬레이터 의존 7개는 별도 실행 |
| `npm run test:rules` | 7개 통과. 동시 실행권 테스트는 SDK 초기화·트랜잭션 재시도를 고려해 15초 제한 사용 |
| `role-smoke.ts` | 네 역할 인증·인가, 기존 로그인 프로필 보존, 댓글 중복/집계, 첨부 소유자 삭제, 목양 노트 CRUD 통과 |
| `npm run build` | 통과. Firebase 청크 크기 경고는 기존 후속 항목 |
| `netlify functions:build` | 17개 함수 로컬 패키징 성공, 출력은 `/tmp/church-admin14-functions` |
| `git diff --check` | 통과 |

목양 API의 로컬 CRUD는 Supabase REST 대역을 사용했다. 운영 Supabase의 저장·조회 성공을 의미하지 않는다. 새 SDK의 운영 Firebase 연결은 아래 읽기 전용 방식으로 별도 확인했다.

## 운영 외부 연결

### 후속 확인 및 정정

사용자가 Supabase 프로젝트를 재개한 뒤 운영 RAAH 화면에서 기존 기록 본문이 모두 표시됨을 확인했다. 조회와 복호화는 정상이다. 이후 CLI 점검에서 나온 HTTP 401은 Netlify가 마스킹해 반환한 키를 사용한 잘못된 검사였으므로 운영 장애의 증거가 아니다. 점검 스크립트는 마스킹된 키로 요청하지 않도록 보완했다.

Google Calendar는 환경변수 외에 Supabase OAuth 설정을 사용한다. 운영 화면의 ‘연결됨’ 표시가 확인되었으며 재연결 필요성은 확인되지 않았다. 동기화 성공 여부는 결과 알림 수정 배포 후 확인해야 한다. 아래 표는 재개 전 점검 기록이다.

| 서비스 | 확인한 범위와 결과 |
|---|---|
| Firebase Auth | 존재하지 않는 점검용 UID 조회에 정상 user-not-found 응답: 연결 확인 |
| Firestore | 기존 named database의 점검용 문서 읽기: 연결 확인. 목양/회원 자료는 조회하지 않음 |
| Cloud Storage | 버킷 메타데이터 읽기: 연결 확인. 파일 내용·목록은 조회하지 않음 |
| Supabase | 설정된 주소의 DNS 조회 ENOTFOUND. 사용자 확인: **프로젝트 일시정지 상태** |
| Google Calendar | 운영 환경에서 client ID·secret 미설정. OAuth와 일정 연동은 검증하지 못함 |
| 푸시 | SDK 초기화·함수 빌드·로컬 예약 실행권만 확인. 실제 발송/수신은 수행하지 않음 |

Supabase 프로젝트를 재개한 뒤 다음 명령을 다시 실행한다. 주소나 비밀 키를 추측해 바꾸지 않았다.

```sh
node --import tsx tests/support/external-readiness.ts --read-only-production
```

그 후 별도 테스트 환경에서 실제 Supabase 제약·RLS 및 저장/조회 검증, 필요한 경우 Calendar OAuth 설정·연동 검증을 진행한다. 전체 개선 계획의 사진 읽기 권한, 게시글 공개 정책 이전, RAAH 기간 조회/페이지네이션은 여전히 별도 후속 작업이다.

## 변경·배포 상태

코드·잠금 파일·테스트·문서·`.nvmrc`는 미커밋 상태이며 신규 미추적 파일이 있다. 기존 `.claude/settings.local.json`, `AGENTS.md`, `CLAUDE.md` 변경 상태는 보존했다. 운영 데이터 저장, 메시지 발송, Calendar 수정, Supabase 재개, Netlify/Firebase 배포는 하지 않았다.

## 참조

- [Firebase Admin 릴리스 노트](https://firebase.google.com/support/release-notes/admin/node): 14의 namespace 제거 및 Node 22 이상 요구, 14.4 저장소 의존성 갱신.
- [uuid 11 문서](https://github.com/uuidjs/uuid/blob/v11.1.0/README.md): CommonJS와 v4 API 지원.
- [Netlify 함수 런타임](https://docs.netlify.com/build/functions/configuration/): 기본 런타임은 빌드 Node 버전과 연동하며 별도 환경변수 override 확인 필요.
