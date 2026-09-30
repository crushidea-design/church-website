# RAAH 서버 기능을 Firebase(도쿄)로 옮기는 1단계 계획

작성: 2026-09-30 · 상태: 사용자 승인 전 초안 · 브랜치: `claude/work`

## 1. 왜 옮기나

운영 측정(Server-Timing, 2026-09-29~30) 결과 RAAH 요청 하나가 1~2.6초 걸린다. 서버 함수는 Netlify(미국 버지니아 IAD)에서, DB는 Supabase(도쿄 ap-northeast-1)에서 돌아 Supabase 호출 한 번에 0.23초(연결 재사용)~0.8초(새 연결)가 든다. 요청마다 "접근 승인 확인 → 실제 조회"로 최소 두 번 차례로 부른다. 암호화·복호화는 원인이 아니다.

Netlify에서 함수 지역을 바꾸려면 Pro($20/월)가 필요하고, 지금은 Personal($9/월, 배포마다 15크레딧)이다. Firebase는 이미 Blaze 요금제이고 함수마다 지역을 고를 수 있으며 배포 횟수에 요금이 없다. 장기적으로 호스팅·서버 기능을 모두 Firebase로 옮기고 Netlify를 해지하는 방향이며(4단계), 이 문서는 그 첫 단계인 **RAAH 서버 기능만 도쿄로** 옮기는 계획이다.

## 2. 무엇이 바뀌고 무엇이 그대로인가

| 구분 | 바뀜 | 그대로 |
| --- | --- | --- |
| 서버 기능 실행 위치 | Netlify(버지니아) → Firebase Cloud Functions 2세대 **asia-northeast1(도쿄)** | 기능 내용(로그인·관리자 확인, 접근 승인, AES-GCM 암호화·복호화, Supabase RPC) |
| 비밀값 보관 | Netlify 환경 변수 → Google Secret Manager | 값 자체(같은 `RAAH_ENCRYPTION_SECRET` → 기존 기록 그대로 열림) |
| 요청 경로 | Netlify가 `/api/raah/*`를 도쿄 함수로 전달 | 화면 주소 `raah.builttogether.church`, 화면 코드, API 주소 |
| 자료 | — | Supabase 자료는 한 건도 옮기지 않음 |
| 로그인 | — | Firebase Auth 그대로 |

옮기는 파일: `netlify/functions/raah-management.mts`, `raah-communion.mts`, `raah-care-tasks.mts`, `raah-calendar.mts`, `raah-ai-assist.mts`와 이들이 쓰는 `_shared/*`.

## 3. 방식: 코드를 다시 쓰지 않고 "입구"만 하나 더 만든다

RAAH 함수는 표준 웹 형식 `(Request, context) => Response`로 짜여 있다. Netlify에 묶인 곳은 세 군데뿐이다.

1. 설정값 읽기 `getEnv()`: 이미 `Netlify.env`가 없으면 `process.env`를 읽는다. Cloud Functions에서는 Secret Manager 값을 환경 변수로 주입하면 그대로 동작한다.
2. 주소 연결 `export const config = { path: [...] }`: Netlify 전용. 새 입구가 같은 경로 표를 읽어 라우팅한다.
3. 주소 속 id `context.params.id`: 새 입구가 경로에서 꺼내 같은 모양으로 넘긴다.

새로 만드는 것:

- `firebase-functions/` (새 폴더): 함수 하나 `raahApi`(onRequest, 도쿄). Express 요청을 표준 `Request`로 바꾸고, 기존 5개 핸들러의 `config.path`로 경로를 맞춰 호출한 뒤 `Response`를 돌려준다. 기존 핸들러 파일은 **수정 없이 그대로 가져다 쓴다**(한 코드로 Netlify·Firebase 양쪽에서 동작 → 되돌리기 쉬움).
- 빌드: esbuild로 `firebase-functions/lib/index.js` 한 파일로 묶는다.
- Firebase Admin 초기화: Cloud Functions 안에서는 서비스 계정 키 대신 기본 자격 증명을 쓸 수 있게 `_shared/firebase-admin.mts`에 "키가 없으면 기본 자격 증명" 경로를 추가한다(Netlify 동작은 그대로).
- 테스트: 입구 어댑터의 경로 매칭·id 추출·헤더·상태 코드·본문 전달 단위 테스트. 기존 RAAH 테스트는 그대로 통과해야 한다.

## 4. 순서

각 단계는 실패하면 다음으로 넘어가지 않는다. 운영에 영향을 주는 단계(6, 8)는 사용자가 직접 하거나 명시적으로 승인한다.

1. **예산 알림**(사용자): Google Cloud 결제 → 예산 알림 월 $5, 50%·90%·100% 알림.
2. **코드**(Claude/Sonnet): 3절의 입구·빌드·테스트. PR로 올림. 이 PR만으로는 운영 동작이 바뀌지 않는다(Netlify 함수 그대로).
3. **비밀값 등록**(사용자, 터미널에서 직접 입력 — 값은 대화에 붙이지 않음): `firebase functions:secrets:set` 으로 `RAAH_ENCRYPTION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_ID`. 플래그(`RAAH_ACCESS_ENFORCED`, `RAAH_COMMUNION_ENABLED`)는 비밀이 아니므로 함수 설정값으로 둔다.
4. **함수 배포**(사용자 승인 후 Claude가 CLI로, 또는 사용자): `firebase deploy --only functions:raahApi`. 아직 아무도 이 주소로 요청하지 않으므로 운영 영향 없음.
5. **직접 확인**: 도쿄 함수 주소로 로그인 없는 요청 → 401, Server-Timing 확인. 브라우저에서 로그인한 상태로 함수 주소에 `bootstrap`을 호출해 기존 기록이 복호화되는지 숫자로만 확인.
6. **전환**(PR 병합 → Netlify 배포): `public/_redirects` 맨 위에 `/api/raah/*  https://asia-northeast1-<프로젝트>.cloudfunctions.net/raahApi/api/raah/:splat  200!` 한 줄. Netlify RAAH 함수는 지우지 않고 둔다.
7. **측정**: 병합 전후 Server-Timing 비교, 목사님 화면 확인(홈·성도·성찬·기록·일정·캘린더 연결).
8. **되돌리기**(필요 시): `_redirects`의 그 한 줄을 지우고 배포하면 즉시 Netlify 함수로 돌아간다. 자료·비밀값 변경 없음.
9. 안정되면(1~2주) Netlify 쪽 RAAH 함수와 Netlify 환경 변수의 RAAH 비밀값을 정리한다(별도 PR).

## 5. 확인이 필요한 기술 사항 (구현 중 검증)

- Netlify `_redirects`의 강제(`!`) 프록시 규칙이 같은 경로를 가진 Netlify 함수보다 먼저 적용되는지. 안 되면 해당 Netlify 함수의 `config.path`를 비활성 경로로 옮겨 우회한다.
- 프록시를 거쳐도 `Authorization` 헤더와 요청 본문, `Idempotency-Key` 헤더가 그대로 전달되는지.
- Google 캘린더 OAuth 콜백 주소가 바뀌지 않는지(화면 주소를 쓰므로 그대로일 것으로 예상, 확인 필요).
- 콜드 스타트: 최소 인스턴스 0이면 한동안 안 쓰다 처음 열 때 느릴 수 있다. 최소 인스턴스 1은 월 몇 달러가 든다 → 측정 후 결정.
- 비용: 함수 호출 월 200만 번·빌드 하루 120분 무료. 함수 이미지 저장은 자동 삭제 정책을 둬 500MB 무료 범위 안에 둔다.

## 6. 보안 점검 항목

- 암호화 키는 Secret Manager에만 두고, 로그·오류·응답·Server-Timing에 절대 나오지 않는다(기존 규칙 유지).
- 함수는 공개 호출 가능(브라우저가 부르므로)하되, 인증·승인 경계는 기존 코드 그대로다. 입구 어댑터는 인증을 우회하는 경로를 만들지 않는다.
- CORS: 같은 도메인을 거쳐 프록시로 부르므로 새 CORS 허용을 추가하지 않는다. 함수 주소를 직접 부르는 것은 5단계 확인용으로만.
- 배포 권한: 자동 배포(GitHub Actions)는 1단계에서 만들지 않는다. 안정된 뒤 2단계에서 결정한다.

## 7. 사용자 결정 사항

- 이 계획대로 진행할지.
- 4단계 함수 배포를 Claude가 CLI로 해도 되는지(사용자 로그인 필요: `firebase login`), 아니면 사용자가 직접 할지.
- 최소 인스턴스(콜드 스타트 대책)는 측정 후 결정.
