# Firebase Hosting 이전 준비

## 범위와 현재 상태

2026-10-15: 일반 API·RAAH API·예약 작업의 Firebase 이전 다음 단계로 정적 호스팅 설정과 로컬 검증을 준비했다. 이후 사용자 승인으로 두 Hosting 미리보기 배포와 실제 Google 로그인·API 연결 검증을 완료했다. DNS와 운영 트래픽은 전환하지 않았다.

- 교회 및 다음세대: `church` target. 기존 교회 도메인과 `/next` 경로를 유지한다.
- RAAH: `raah` target. 기존 `raah.builttogether.church`를 유지한다.
- 프로젝트: `gen-lang-client-0036445484`.
- 교회 target은 기존 기본 사이트 `gen-lang-client-0036445484`, RAAH target은 새로 생성한 `builttogether-raah`에 연결했다. 기본 사이트에는 기존 release·custom domain이 없음을 먼저 확인했다.
- `.firebaserc`에 두 실제 사이트의 Hosting target 연결을 기록했다.
- 예약 네 작업의 자연 실행 확인은 별도 `2026-10-15-scheduled-jobs-firebase-migration.md`를 따른다. 검증 목적으로 알림·AI 작업을 수동 실행하지 않는다.

## 빌드와 라우팅

`npm run build:hosting`은 기존 Vite 빌드를 수행한 뒤 `dist/hosting/church`, `dist/hosting/raah`를 만든다. 기존 Netlify 빌드인 `npm run build`에는 후처리가 들어가지 않는다. Hosting 설정은 Functions 배포 설정과 분리한 `firebase.hosting.json`을 명시적으로 사용한다. 각 target의 predeploy도 새 빌드를 준비하므로 오래된 결과물을 배포하지 않는다.

RAAH 산출물의 HTML 루트에만 `data-app-surface="raah"`를 넣는다. React 라우팅과 초기 아이콘·제목이 이 값을 인식하므로 임의의 Firebase 미리보기 호스트에서도 RAAH 첫 화면이 열린다. 이는 화면 선택값이며 인증이나 관리자 권한을 부여하지 않는다. 기존 운영 도메인 판별도 유지한다. RAAH 빌드에서는 `next.html`을 제외해 모든 페이지가 RAAH 진입점을 사용한다. RAAH PWA의 id/start_url/scope는 해당 산출물에서만 `/`로 바꿔 미리보기 설치가 운영 주소로 튀지 않게 한다. 운영 도메인에서는 기존 절대 URL과 같은 주소로 해석된다.

두 사이트의 rewrite 순서:

1. `/.netlify/functions/raah-calendar-callback` → 도쿄 `raahApi`.
2. `/api/raah/**` → 도쿄 `raahApi`.
3. `/api/**` → 도쿄 `siteApi`. 실제 실행 가능 경로는 기존 8개 핸들러 allowlist가 결정하고 나머지는 404를 반환한다.
4. 교회 사이트의 `/next`, `/next/**`, `/next-generation/**` → `next.html`.
5. 나머지 페이지 → `index.html`.

Firebase는 원래 요청 경로와 쿼리를 함수에 전달하므로 기존 콜백 주소를 유지할 수 있다. 예약 함수는 HTTP rewrite에 연결하지 않는다. `pinTag`도 사용하지 않아 Hosting 배포가 Functions 배포를 동반하지 않는다. `/.netlify/functions/`의 다른 주소는 지원 API가 아니다.

Firebase에서는 redirect가 정적 파일보다 먼저 적용된다. `/next-generation/*` 전체를 redirect하면 그 아래 실제 이미지가 깨지므로 `/next-generation`만 301로 옮기고 하위 옛 페이지 주소는 기존 React `RedirectNextGeneration`이 경로·쿼리·해시를 보존해 전환한다. 실제 이미지 파일은 정적 파일 우선순위로 제공된다.

모든 정적 응답은 기본 `no-cache`, Vite의 해시가 붙은 `/assets/**`는 1년 immutable 캐시다. HTML, 서비스 워커, manifest, 버전 없는 이미지가 오래 남지 않게 한다. API와 콜백은 `no-store`이며 함수 응답에도 기존 설정이 있다. `nosniff`와 `strict-origin-when-cross-origin`을 추가한다. Google 로그인 팝업을 막을 수 있는 COOP 설정은 추가하지 않는다.

## 로컬 검증

```sh
npm run typecheck
npm run lint
npm test
npm run build:hosting
npm run test:hosting
```

`test:hosting`은 Firebase CLI가 필요하다. CI는 firebase-tools 15.25.1을 사용한다. 검사 중에는 demo 프로젝트와 가상 사이트를 사용하는 Hosting 에뮬레이터만 구동한다. 운영 API·데이터에 요청하지 않는다.

- 단위 테스트: RAAH/교회 진입 판별과 초기 메타데이터, 빌드 반복 실행·기존 결과물 보존, 상대 PWA 주소, API rewrite 경계.
- Hosting 에뮬레이터: 교회·RAAH 루트/깊은 경로, 다음세대 페이지와 옛 주소, 실제 이미지, JS 캐시, 서비스 워커 MIME·캐시, RAAH manifest.
- 이 검사만으로 운영 API 연결, 실제 로그인, Google Calendar 연결, 푸시 알림 설치가 검증된 것은 아니다. 아래 미리보기 검증이 남는다.

### 준비 단계 검증 결과 (2026-10-15)

- typecheck 통과. lint 오류 0, 기존 경고 416.
- 전체 테스트 354개 통과, 운영 DB·규칙 에뮬레이터용 등 130개 생략.
- Vite 빌드와 두 Hosting 산출물 생성 통과. 기존 큰 청크 경고는 남아 있다.
- Firebase CLI 15.25.1 Hosting 에뮬레이터에서 위 정적 경로·헤더 검증 통과.
- CI에도 Hosting 산출물 준비와 에뮬레이터 smoke 검사를 추가했다.

## 승인 후 미리보기 배포 절차

1. PR 검토 후 **Hosting 미리보기 배포** 승인을 받는다. DNS 전환은 별도 단계다.
2. 기본 사이트의 현재 release·도메인 연결을 다시 조회해 사용 가능 여부를 확인한다. RAAH 사이트 ID 가용성을 확인하고 사이트를 생성한다.
3. 실제 ID를 target에 연결한다. 아래 `RAAH_SITE_ID`는 생성 결과로 바꿔야 하는 자리표시자다.

   ```sh
   firebase target:apply hosting church gen-lang-client-0036445484 --project gen-lang-client-0036445484
   firebase target:apply hosting raah RAAH_SITE_ID --project gen-lang-client-0036445484
   firebase hosting:channel:deploy migration-review --only church,raah --expires 7d --config firebase.hosting.json --project gen-lang-client-0036445484
   ```

4. 두 미리보기 URL에서 루트·깊은 링크·새로고침·다음세대·PWA 리소스를 확인한다. RAAH URL에서는 로그인 전용 화면과 관리자 제한을 확인한다.
5. 인증 없는 API 요청은 401, 잘못된 메서드는 405, 알 수 없는 API는 JSON 404와 no-store인지 확인한다. 기존 콜백에는 잘못된 state만 보내 HTML 400을 확인한다. 실제 알림·삭제·AI 생성은 smoke test에서 실행하지 않는다.
6. 로그인 검증이 필요하면 정확한 미리보기 호스트에 한정해 Firebase Auth 허용 도메인을 확인·설정한다. 미리보기는 운영 Firebase/Supabase를 공유하므로 실제 데이터 수정은 별도로 의도한 검증만 수행한다.
7. Google Calendar OAuth는 등록된 운영 콜백 주소를 사용한다. 미리보기에서 재연결을 하면 운영으로 돌아갈 수 있으므로 단순 경로 검사와 실제 재연결 검증을 구분한다. 운영 도메인 전환 후 실제 재연결→일정 조회를 확인한다.

## 승인 후 운영 전환과 롤백

1. 예약 작업의 자연 실행 기록과 로그인 후 핵심 기능 검증을 확인하고 운영 이전 일정을 잡는다.
2. 현재 DNS 레코드와 TTL, Netlify의 마지막 정상 배포 ID, Firebase release ID를 기록한다. DNS는 공급자의 실제 현재 값으로 복구해야 하므로 문서에 IP를 추측해 고정하지 않는다.
3. Firebase 콘솔의 도메인 이전 절차로 소유권·TLS 준비를 완료하고 안내된 레코드를 검토한다. 교회와 RAAH 도메인을 각각 해당 site에 연결한다.
4. 승인된 커밋을 `firebase deploy --only hosting:church,hosting:raah --config firebase.hosting.json --project gen-lang-client-0036445484`로 배포한 뒤 도메인별 DNS를 전환한다. 전체 `firebase deploy`는 사용하지 않는다.
5. 두 운영 도메인의 HTTPS, 깊은 링크, 관리자 로그인, 읽기, 댓글, 첨부 처리, 다음세대, 콜백, 서비스 워커와 알림 구독을 확인한다. 쓰기·발송 검증은 승인된 테스트 데이터로 진행한다.
6. 문제 발생 시 기록해 둔 기존 Netlify DNS로 복구한다. Firebase 정적 파일만의 문제라면 해당 사이트의 이전 Hosting release로 롤백한다. API와 예약 실행 주체는 별도 이전 작업이므로 호스팅 롤백 때문에 바꾸지 않는다.
7. 안정 기간이 지난 뒤에만 Netlify 빌드·함수·비밀값을 정리한다. 특히 현행 OAuth 콜백 전달 함수와 예약 guard는 DNS 복구 가능 기간 동안 유지한다.

## 참고

- [Firebase Hosting 구성과 우선순위](https://firebase.google.com/docs/hosting/full-config)
- [여러 사이트와 deploy target](https://firebase.google.com/docs/hosting/multisites)
- [Hosting과 Functions 연결](https://firebase.google.com/docs/hosting/functions)
- [미리보기 배포](https://firebase.google.com/docs/hosting/test-preview-deploy)


## 미리보기 배포·로그인 확인 완료 (2026-10-15)

사용자의 “Firebase 미리보기 배포하고 로그인과 API 연결 확인” 승인에 따라 실행했다. 배포한 앱 소스는 `aec6bb9`이며, target 매핑은 이번 배포에서 연결했다.

| 항목 | 교회·다음세대 | RAAH |
| --- | --- | --- |
| site ID | `gen-lang-client-0036445484` | `builttogether-raah` |
| channel | `migration-review` | `migration-review` |
| version | `6716c5d70aba50e3` | `857c7fc017a0ede3` |
| URL | https://gen-lang-client-0036445484--migration-review-x6189374.web.app | https://builttogether-raah--migration-review-kl4o4ser.web.app |
| 만료 | 2026-10-22 15:48 KST | 2026-10-22 15:48 KST |

- Firebase CLI가 위 두 미리보기 호스트를 Auth authorizedDomains에 추가한 것을 API로 다시 확인했다. 기존 허용 도메인은 유지했다. 검토 종료 후 채널 삭제와 함께 해당 호스트의 허용 목록 잔존 여부를 확인한다.
- 두 사이트 모두 live 채널에는 release version이 없다. 운영 배포·도메인 연결·DNS 변경·Functions 재배포·PR 병합은 수행하지 않았다.
- Chrome에서 교회 미리보기의 Google 로그인 완료 후 사용자·관리자 메뉴가 표시되는 것을 확인했다.
- RAAH 미리보기는 로그인 전 관리자 전용 안내가 나타났고, Google 로그인 뒤 관리 화면과 ‘암호화 저장’ 상태를 확인했다. 이는 bootstrap 데이터 조회와 Calendar 상태 조회 이후 표시되는 상태다.
- 15:50 KST 서버 요청 기록에서 RAAH 미리보기 referer를 가진 `/api/raah/bootstrap`, `/api/raah/calendar/status`, `/api/raah/care-tasks`, `/api/raah/communion/periods`의 HTTP 200을 확인했다. 요청·응답 본문이나 인증 토큰·목양 데이터는 기록하지 않았다.
- 두 사이트에서 각 27건, 총 54건의 HTTP 검사를 통과했다: 일반 API 8개와 RAAH bootstrap의 비인증 거부, 메서드 거부, 미등록 API JSON 404, 잘못된 OAuth state HTML 400, 루트·깊은 경로·다음세대·서비스 워커·실제 이미지. API/콜백 no-store 및 정적 응답 no-cache를 확인했다.
- 알림 구독 API는 token 필드가 없으면 인증보다 먼저 400을 반환하므로 가짜 token 필드를 넣고 인증 헤더 없이 401을 확인했다. RAAH는 인증을 메서드보다 먼저 검사하므로 비인증 PATCH도 401이다. 일반 API의 PATCH는 405다. 이는 기존 핸들러 처리 순서이며 동작 변경은 없었다.
- 배포 predeploy의 Vite/Hosting 빌드 통과. typecheck, lint(오류 0·기존 경고 416), 전체 테스트(354 통과·130 생략)를 재확인했다.

남은 운영 검증은 실제 Google Calendar 재연결, 푸시 구독·발송, 첨부 삭제, AI 생성 등 쓰기 기능이다. 이번 연결 검사에서는 운영 데이터를 변경하는 테스트나 목양 기록 복호화를 따로 실행하지 않았다. 다음 단계는 예약 작업의 자연 실행 결과를 확인하면서 PR 검토와 운영 도메인·DNS 전환을 준비하는 것이다.
