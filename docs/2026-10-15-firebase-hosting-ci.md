# Firebase Hosting 자동 배포 연결

상태: 구현·권한 명세 및 로컬 검증 완료. Google Cloud WIF·IAM 적용은 자동 승인 검토에서 구체적인 사용자 승인이 필요하다는 사유로 거부되어 아직 실행하지 않았다. 운영 Hosting은 기존 DNS 전환 완료 버전 그대로다.

## 동작

- 기존 `.github/workflows/ci.yml`의 타입 검사·린트·테스트·빌드·Hosting 경로·보안 규칙 검사를 모두 통과한 뒤 `deploy-hosting` job을 실행한다.
- 배포 대상은 이 저장소의 `main` push 또는 main에서 시작한 수동 실행뿐이다. PR과 `codex/work`에서는 배포 job을 건너뛴다.
- 최신 main SHA를 확인해 대기 중 낡아진 실행을 건너뛴다. main 검증·배포는 새 push가 와도 중단하지 않으며, 배포 job은 `firebase-hosting-production` concurrency로 직렬 실행한다. 실행 중 새 main이 들어오면 진행 중 배포가 끝난 뒤 최신 실행이 배포된다.
- 확인한 커밋을 checkout하고 lockfile로 의존성을 설치한다. Firebase CLI는 `15.25.1`로 고정했다. 기존 Hosting predeploy가 같은 커밋의 산출물을 다시 빌드한다.
- 배포 직전에 단기 Google 자격증명을 발급받는다. GitHub에 서비스 계정 JSON 키나 기존 개인 Firebase 토큰을 저장하지 않는다. 생성된 임시 `gha-creds-*.json`은 gitignore에 추가하며 Hosting publish 디렉터리 밖에 생성된다.
- CLI의 함수 목록 조회가 실패하면 잘못된 1세대 rewrite로 진행될 수 있으므로, 먼저 두 세대의 목록 조회 권한과 `siteApi`·`raahApi`의 활성 2세대 상태를 검사한다. 함수 설정·환경 변수·토큰은 출력하지 않는다.
- `--only hosting:church,hosting:raah --config firebase.hosting.json`으로 두 Hosting 사이트만 배포한다. Functions·Firestore·Storage 규칙은 이 작업으로 배포하지 않는다.
- 배포 후 공개 HTTPS 검사 24건으로 정적 진입점, 다음세대, 일반 API 8개, RAAH bootstrap, 기존 콜백 거부 응답 및 www 리디렉션을 검사한다. 운영 인증 없이 가짜 구독 token을 사용하므로 실제 쓰기·발송·AI 실행을 유발하지 않는다.

## 적용할 Google Cloud 인증·권한 명세

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
- WIF·서비스 계정·커스텀 역할·IAM 바인딩·GitHub 환경·첫 자동 배포는 승인 전이므로 아직 적용하거나 성공했다고 주장하지 않는다.
