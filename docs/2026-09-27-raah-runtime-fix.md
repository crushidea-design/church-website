# RAAH 운영 502 복구

## 원인과 수정

2026-09-27 운영 RAAH API가 시작 단계에서 HTTP 502를 반환했다.
Firebase Admin 14가 사용하는 `jwks-rsa@4.1.0`이 ESM인 `jose`를
동기 `require()`로 읽으면서 `ERR_REQUIRE_ESM`이 발생했다.
Node 22의 `--no-experimental-require-module` 옵션으로 같은 장애를 재현했다.

`postinstall`에서 `scripts/patch-jwks-rsa.cjs`를 실행해 이 모듈의
`retrieveSigningKeys`와 Passport의 `secretProvider` 안에서 `await import('jose')`로 읽도록 한다.
Passport 콜백 계약과 기존 오류 처리는 유지한다.
라이브러리 버전과 서명 검증·키 필터·관리자 검사·AES-GCM 암호화 로직은 유지한다.
패치는 반복 실행해도 안전하며, 예상 소스 구조가 달라지면 설치를 실패시켜 검토를 요구한다.
상위 라이브러리에서 수정되면 패치와 postinstall을 제거하고 아래 검증을 다시 실행한다.

## 검증

`tests/raah-runtime.test.ts`는 Lambda와 같이 `require(esm)`을 끈 별도 Node 프로세스에서
실제 Firebase Admin 의존성을 읽는다. 이 검사는 tsx 없이 순수 Node로 실행해
TypeScript 로더가 ESM 호환 문제를 가리지 못하게 한다. Passport의 정상/잘못된 토큰 콜백도 확인한다.
별도 테스트에서 RAAH 관리·목양노트·캘린더 함수를 읽는다.
인증 없는 요청에 JSON 401을 반환하고, 로컬 RSA 공개키를 변환해 정상 서명은 통과시키며
변조된 메시지와 없는 키 ID는 거부하는지 확인한다.
외부 네트워크·운영 자격증명·목양 데이터를 사용하지 않는다.

배포 후 `/api/raah/bootstrap`, `/api/raah/notes`, `/api/raah/calendar/status`의
인증 없는 요청이 JSON 401을 반환하는지 확인한다.
이는 서버 시작과 인증 보호 검증이며 로그인 후 Supabase 조회·복호화 검증과 구분한다.

## 실행 옵션만으로는 복구되지 않음

최초에는 `NODE_OPTIONS=--experimental-require-module`을 운영·미리보기에 저장하고
기존 운영 커밋 `e912e434ce16f6c888d50348dc2be17f823466c3`을 재배포했다.
요금제에서 Functions 전용 범위를 허용하지 않아 기본 전체 범위로 저장했다.
CLI 재조회로 두 컨텍스트의 값이 저장된 것을 확인했지만,
배포 `6ab9182bd74a198e1e6f9e09`가 2026-09-27 22:22 KST 게시된 뒤에도
API 3곳 모두 같은 502 오류를 반환했다. 이 방법은 운영에서 효과가 확인되지 않았다.

최종 호환 패치는 해당 실행 옵션 없이 동작한다. 이번에 추가한 NODE_OPTIONS는 제거한다.
이전 인계 문서의 '실행 옵션만 설정하면 해결된다'는 설명은 위 운영 결과로 정정한다.

## 배포 범위

사용자가 수정 및 운영 재배포를 승인했다. 작업은 `codex/work`에서 수행한다.
기존 다음세대·말씀열매 등 미커밋 변경은 복구 커밋과 배포에서 제외한다.
복구 커밋은 package.json, package-lock.json, 설치 패치, 회귀 테스트, 이 문서만 포함한다.

## 참조

- [동일한 Netlify 장애에 대한 상위 라이브러리 이슈](https://github.com/auth0/node-jwks-rsa/issues/507)
- [AWS Lambda Node.js 실험 기능](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html#nodejs-experimental)
