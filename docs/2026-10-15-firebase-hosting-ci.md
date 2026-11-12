# Firebase Hosting 자동 배포 연결

상태: 2026-10-15 20:28 KST Firebase Hosting 자동 배포와 운영 경로 검사까지 완료했다. PR #114·#115를 승인 후 병합했고 WIF 인증, 프로젝트 수준 9개 권한, 두 API 서비스에 한정한 Cloud Run 조회 권한으로 실제 운영 배포에 성공했다.

## 동작

- 기존 `.github/workflows/ci.yml`의 타입 검사·린트·테스트·빌드·Hosting 경로·보안 규칙 검사를 모두 통과한 뒤 `deploy-hosting` job을 실행한다.
- 배포 대상은 이 저장소의 `main` push 또는 main에서 시작한 수동 실행뿐이다. PR과 `codex/work`에서는 배포 job을 건너뛴다.
- 최신 main SHA를 확인해 대기 중 낡아진 실행을 건너뛴다. main 검증·배포는 새 push가 와도 중단하지 않으며, 배포 job은 `firebase-hosting-production` concurrency로 직렬 실행한다. 실행 중 새 main이 들어오면 진행 중 배포가 끝난 뒤 최신 실행이 배포된다.
- 확인한 커밋을 checkout하고 lockfile로 의존성을 설치한다. Firebase CLI는 `15.25.1`로 고정했다. 기존 Hosting predeploy가 같은 커밋의 산출물을 다시 빌드한다.
- 배포 직전에 단기 Google 자격증명을 발급받는다. GitHub에 서비스 계정 JSON 키나 기존 개인 Firebase 토큰을 저장하지 않는다. 생성된 임시 `gha-creds-*.json`은 gitignore에 추가하며 Hosting publish 디렉터리 밖에 생성된다.
- CLI의 함수 목록 조회가 실패하면 잘못된 1세대 rewrite로 진행될 수 있으므로, 먼저 두 세대의 목록 조회 권한과 `siteApi`·`raahApi`의 활성 2세대 상태, 실제 `siteapi`·`raahapi` Cloud Run 구성 조회를 검사한다. 함수 설정·환경 변수·토큰은 출력하지 않는다.
- `--only hosting:church,hosting:raah --config firebase.hosting.json`으로 두 Hosting 사이트만 배포한다. Functions·Firestore·Storage 규칙은 이 작업으로 배포하지 않는다.
- 배포 후 공개 HTTPS 검사 24건으로 정적 진입점, 다음세대, 일반 API 8개, RAAH bootstrap, 기존 콜백 거부 응답 및 www 리디렉션을 검사한다. 운영 인증 없이 가짜 구독 token을 사용하므로 실제 쓰기·발송·AI 실행을 유발하지 않는다.

## 적용한 Google Cloud 인증·권한 명세

기계 판독 원본: `.github/firebase-hosting-identity.json`.

| 항목 | 값 |
| --- | --- |
| 프로젝트 | `gen-lang-client-0036445484` (`638399109645`) |
| WIF pool / provider | `github-hosting` / `church-main` |
| 배포 계정 | `github-hosting-deploy@gen-lang-client-0036445484.iam.gserviceaccount.com` |
| GitHub 환경 | `firebase-production` (허용 브랜치 main만) |
| 저장소 / 소유자 숫자 ID | `1191307411` / `270854433` |
| 허용 워크플로 | `crushidea-design/church-website/.github/workflows/ci.yml@refs/heads/main` |
| 허용 이벤트 | main의 `push`, `workflow_dispatch` |
| OIDC subject | `repo:crushidea-design/church-website:environment:firebase-production` |
| 커스텀 역할 | `projects/gen-lang-client-0036445484/roles/githubHostingPublisher` |

서비스 계정에는 다음 9개 권한만 포함하는 커스텀 역할을 프로젝트 수준에서 연결한다.

- `firebase.projects.get`
- `firebasehosting.sites.get`, `firebasehosting.sites.list`, `firebasehosting.sites.update`
- `resourcemanager.projects.get`
- `cloudfunctions.functions.get`, `cloudfunctions.functions.list`
- `serviceusage.services.get`, `serviceusage.services.use`

Hosting 게시 권한은 `sites.update`로 제공되며 해당 프로젝트의 기존 사이트에 적용된다. 사이트 생성·삭제 권한은 제외한다. 함수 조회에는 구성 메타데이터 조회가 포함된다. Firestore/Storage 데이터, Secret Manager 비밀값 접근, IAM 변경, Functions 수정 권한은 없다.

배포 계정 자체의 IAM에는 위 pool의 `attribute.repository_id/1191307411` principalSet에만 `roles/iam.workloadIdentityUser`를 연결한다. provider 조건은 저장소·소유자 숫자 ID, main ref, 정확한 workflow ref, 환경 subject, 이벤트를 모두 검사한다. 장기 키를 만들지 않는다. 필요하면 IAM Credentials / STS API를 활성화한다.

## 승인 후 적용과 첫 실행

1. 위 명세대로 pool/provider, 키 없는 서비스 계정, 역할과 IAM 바인딩을 생성하고 다시 조회해 일치 여부를 확인한다. 기존 프로젝트 IAM은 etag를 보존해 새 바인딩만 추가한다.
2. GitHub `firebase-production` 환경을 만들고 허용 브랜치를 main으로 제한한다.
3. PR 검증 통과 후 사용자에게 승인된 PR 병합 절차로 활성화한다. 첫 main CI가 통과하면 Hosting 자동 배포와 운영 검사가 이어진다.
4. 첫 실행에서는 OIDC 인증, 사전 backend 검사, 두 사이트 release 버전과 커밋 메시지, 운영 HTTP 검사를 확인한다. 로컬 테스트만으로 실제 WIF 연동 성공을 주장하지 않는다.

## 실패·복구

- 인증 또는 사전 검사 실패는 Hosting 게시 전에 중단된다. 배포 후 smoke 실패는 workflow 실패로 표시하며 임의 데이터 변경이나 자동 롤백을 하지 않는다.
- 두 사이트의 release는 원자적이지 않다. 중간 실패 시 각 사이트의 live version을 확인하고 같은 main 커밋으로 수동 workflow를 재실행한다. 이전 커밋 재실행은 최신 main 검사에서 건너뛴다.
- 코드 롤백은 이전 상태를 복구하는 PR을 main에 병합해 새 main을 배포한다. 긴급한 경우 기존 Firebase release를 수동 복구하고 최신 자동 배포 실행과 충돌하지 않게 조정한다.
- Netlify 계정·사이트는 사용자 요청대로 무료 등급으로 유지한다. Netlify 삭제, 예약 발송 수동 실행, 비밀값 정리는 이 PR 범위에 포함하지 않는다.

## 참고

- https://github.com/google-github-actions/auth
- https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines
- https://firebase.google.com/docs/hosting/github-integration

## 검증 결과

- 타입 검사·린트·전체 테스트·빌드 통과. 린트 오류 0, 기존 경고 416. 테스트 358 통과·130 생략.
- actionlint 1.7.12 구문 검사 통과. 공식 배포 아카이브 체크섬 확인 후 사용했다.
- 현재 운영 주소에서 새 공개 검증 스크립트 24건 통과. 현재 사용자 인증으로 새 backend 사전 검사도 통과했다. 이는 새 CI 서비스 계정의 권한 검증을 대신하지 않는다.
- 새 테스트 4건은 backend 조회 거부·비정상 함수 상태·API의 SPA 오배선·RAAH의 잘못된 HTML 진입점을 거부하는지 확인한다.
- WIF·전용 서비스 계정·9개 권한 역할·IAM 바인딩·GitHub 환경은 승인 후 적용 완료했다. 사용자 관리 키는 0개이며 실제 GitHub 단기 인증도 성공했다. 첫 자동 게시 성공 여부는 아래 실행 기록을 따른다.

## 첫 실행과 추가 권한 수정안 (2026-10-15 20:14 KST)

- PR #114 병합 커밋: `8b6ac80a592f3b12f51691c1d630f91a0224477d`.
- 실행: https://github.com/crushidea-design/church-website/actions/runs/38725640679
- main 필수 검사 전체, WIF 단기 인증, 두 세대 Functions 목록 및 API 함수 조회에 성공했다.
- 두 사이트 파일 업로드 후 버전 finalize에서 `run.services.get` 403이 발생했다. 기존 함수 조회 권한과 별도로 Hosting이 Cloud Run 서비스를 확인하는 권한이 필요하다. 최초 사전 검사에서 이 조건을 확인하지 못했으므로 Cloud Run GET 검사와 회귀 테스트를 추가했다.
- release 재조회 결과 교회 `25df15c32ee35379`, RAAH `6eb73d5c6dfeb2f2`로 기존 운영 버전이 유지된다. 업로드만 된 버전은 운영에 게시되지 않았다.

### 추가 승인 범위 — 20:25 KST 적용 완료

`.github/firebase-hosting-identity.json`의 `backendReader`가 명세다. `githubHostingBackendReader` 커스텀 역할에 `run.services.get` 하나만 넣고, 기존 배포 계정 `github-hosting-deploy@gen-lang-client-0036445484.iam.gserviceaccount.com`에 다음 두 **서비스 리소스의 IAM**으로 연결한다. 프로젝트 전체에는 이 역할을 연결하지 않는다.

- `projects/gen-lang-client-0036445484/locations/asia-northeast1/services/siteapi`
- `projects/gen-lang-client-0036445484/locations/asia-northeast1/services/raahapi`

서비스 구성 조회만 추가한다. 서비스 실행·수정·배포·IAM 변경 권한은 배포 계정에 추가하지 않는다. 기존 각 서비스의 호출자 등 IAM 바인딩과 etag를 보존한다. 사용자 승인 후 역할과 두 바인딩을 적용·재조회했다. PR #115를 병합한 다음 실행에서 Hosting 배포·운영 검사를 모두 통과했다.

Cloud Run 권한 정의: https://docs.cloud.google.com/run/docs/reference/iam/permissions

## 자동 배포 완료 (2026-10-15 20:28 KST)

- PR #115: https://github.com/crushidea-design/church-website/pull/115
- 운영 커밋: `3ad4d9f765a0a9fcd5aa505e00cacaa927c99e31` (20:25:09 KST 병합).
- 성공 실행: https://github.com/crushidea-design/church-website/actions/runs/38727194181
- main 타입 검사·린트·테스트·빌드·Hosting 경로·보안 규칙 검사, WIF 단기 인증, Functions 및 Cloud Run 조회, 두 Hosting 게시, 운영 HTTPS 24건 검사가 모두 통과했다. 수정안 로컬 검사도 모두 통과했으며 테스트 359 통과·130 생략, 린트 오류 0·기존 경고 416이다.
- 두 서비스의 IAM을 재조회해 `githubHostingBackendReader` 연결을 확인했다. 프로젝트 IAM의 배포 계정 바인딩은 기존 9개 권한인 `githubHostingPublisher` 하나이며, 추가 Run 조회 역할은 두 서비스에서만 연결했다.
- 20:28:10 KST 교회 버전 `3fa14bacc373653c`, RAAH 버전 `44b02512d4798d1c`를 게시했다. Hosting releases API에서 두 release의 메시지가 위 커밋과 실행 번호를 포함하며, 배포 주체가 `github-hosting-deploy@gen-lang-client-0036445484.iam.gserviceaccount.com`임을 확인했다.
- Functions·보안 규칙·예약 실행 주체는 이번 Hosting 배포에서 변경하지 않았다. 실제 데이터 수정·푸시·AI 생성·새 OAuth 동의는 수행하지 않았다.
- 이후 사용자 승인 PR을 main에 병합하면 검증 성공 후 두 Hosting 사이트가 자동 갱신된다. Netlify 계정·사이트는 무료 상태로 유지한다. 다음 확인 대상은 나머지 예약 작업의 자연 실행이다.
