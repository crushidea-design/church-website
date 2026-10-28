# 검수완료 문서 자동 등록

## 동작

- 승인 루트는 `1XxgBRwigRQmgGgk_mvXQBVUqen51iARX`(검수완료), 부모는 `1VWRtAD--dJVIsZOh7VNsDSPLO6UQYZMC`로 고정한다. 루트 직접 문서는 사용자 확인값인 2026년을 적용한다. 다음 정확한 하위 폴더 ID의 직접 Google Docs만 추가로 포함한다. 목록/미리보기/게시 전 검사에서 연도 폴더와 문서의 실제 부모 관계를 확인한다. 루트 자체의 parents가 보이면 기대값과 대조하고, 속성이 아예 없을 때만 고정 루트 ID를 기준으로 처리한다. 이름으로 범위를 발견하거나 임의 깊이를 순회하거나 shortcut 대상을 따라가지 않는다. 원본은 변경하지 않는다.
  - 2026: `1RvlAR2viTF6gq8_tvYk2iCX_oFs1v18k`
  - 2027: `1bk7elOmPgB6Yyk6om2VQ4oowQoOP59xt`
  - 2028: `1DkgpaDyIjtZ9Qc_GkQYMwhq4xIKakju_`
- Firebase `mccheyneApprovedSync`가 매일 `0 5 * * *`, `Asia/Seoul`에 실행한다. 관리자 `/admin/mccheyne-sync`의 지금 반영도 같은 서비스를 호출한다. 기본 모드는 `off`다.
- 원래 묵상 날짜를 유지해 과거·오늘·미래 문서를 모두 `published`로 upsert한다. 날짜에 따라 홈페이지가 글을 여는 기존 코드는 변경하지 않는다.
- 기존 `/api/mccheyne/publish` Bearer 인증·요청·응답 계약을 유지하고 저장 서비스를 공유한다. 내부 실행에는 `MCCHEYNE_PUBLISH_KEY`를 전달하거나 HTTP 자기 호출하지 않는다.
- Google Docs 본문 문단만 추출한다. 원래 각주 참조/각주 본문은 제외한다. Viewer가 지원하는 `PREVIEW_WITHOUT_SUGGESTIONS`로 이미 반영된 본문만 읽고 아직 수락하지 않은 수정 제안은 제외한다. 여러 탭, 표/그림 등 정확히 변환하지 못하는 구조는 보류한다.
- 첫 문단은 `2026년 12월 3일 역대하 2장 제목` 또는 `12월 3일 역대하 2장 제목` 형식이다. 연도를 생략하면 소속 폴더 ID에 연결된 고정 연도를 쓴다. 명시된 연도 또는 관리자 승인 날짜가 폴더 연도와 다르면 `YEAR_FOLDER_MISMATCH`로 보류한다. 현재 연도를 추정하지 않고 전역 연도 변경 API/입력창도 제거했다. 관리자 날짜 지정으로 연도 충돌을 우회할 수 없다. 잘못된 날짜와 원문 월·일 불일치도 거절한다.

## 승인 버전과 중복 방지

폴더 안에 있다는 사실만으로 현재 편집본을 승인하지 않는다. 최초 자동 등록은 Drive Activity에서 **가장 최근 이동이 지정된 사용자에 의한 현재의 정확한 승인 폴더(루트 또는 지정 연도 폴더) 이동**이고 문서 수정 시간이 이동보다 엄격히 이전이어야 한다. 정확한 시각/행위자/전체 이동 기록을 확인하지 못하면 `APPROVAL_EVIDENCE_REQUIRED`로 게시를 보류하고 동일 버전당 최대 3번의 실행에서 증거를 다시 확인한다(최소 간격 1분). 계속 불충분한 경우에만 현재 내용의 명시적 승인이 필요하다. 승인 사용자 설정 자체가 없으면 문서별 보류 대신 전역 `APPROVER_NOT_CONFIGURED`로 중단한다. 최초 기존 문서에도 같은 조건을 적용하며 일괄 승인하지 않는다.

공식 API의 한계: Drive Activity는 이동의 행위자·대상·시각 또는 시간 범위를 제공하지만 이동 당시의 본문 해시/Docs 버전을 서명한 승인 기록은 아니다. `modifiedTime`과 현재 Drive 버전 앞뒤 비교는 이동 뒤 편집 및 읽는 동안 변경을 점검하는 근거이며, 과거 승인 시점의 원문을 원자적으로 증명한다고 주장하지 않는다. 시각이 같거나 범위만 있거나 행위자가 불분명하면 자동 승인하지 않는다. 운영 전에는 전용 Reader가 실제 증거를 받을 수 있는지 비게시 확인을 수행한다. 정상 문서 대부분에서 이 조건이 실패하면 문서별 재승인을 상시 규칙으로 떠넘기지 말고 자동 게시 활성화를 보류해야 한다. 그 경우 최소 대안은 여러 문서의 고정 스냅샷을 한 번에 확인·승인받는 흐름이지만, 현재 구현에는 개별 미리보기 승인만 있고 일괄 승인 화면은 추가하지 않았다.

Docs `revisionId`는 편집 권한에서만 제공되며 유효 기간/사용자 범위 제약도 있다. Viewer 권한을 유지하기 위해 이를 필수로 요구하거나 승인 해시에 쓰지 않는다. `documents.get` 전후 Drive `version`·`modifiedTime`·폴더를 비교한다. `SUGGESTIONS_INLINE`도 제안 보기 권한이 없으면 403이므로 읽기 전용 본문 모드를 명시한다.

대안이자 재승인 경로는 관리자 미리보기다. 표시한 문서 버전 해시와 날짜를 승인하고 승인 요청·실행에서 다시 읽은 값이 일치해야 한다. 해시는 Drive 버전, 정확한 소속 폴더와 연도, 각주를 제외한 본문을 묶는다. 이후 수정은 자동 덮어쓰지 않으며 기존 공개본을 유지한다. 승인 직후 편집되더라도 승인된 스냅샷만 게시할 수 있고 다음 판독에서 재승인이 필요하다. Drive와 Firestore 사이에 분산 원자적 트랜잭션이 있다고 가정하지 않는다.

변경 없는 성공 문서는 메타데이터 버전으로 건너뛰어 본문 재조회/게시를 피한다. `_mccheyne_sync_sources`에 상태·해시·버전·시도 횟수·게시 ID만 저장하며 전체 문서 본문은 저장하지 않는다. `_mccheyne_sync_control/current`의 만료 가능한 잠금과 토큰을 쓰기 트랜잭션마다 확인한다. 게시글/source_id 매핑/성공 기록은 한 트랜잭션으로 저장한다. 응답 유실 후 재시도는 성공 기록을 먼저 확인한다. 일시 실패는 버전당 최대 3회이며, 관리자 재승인으로 다시 시도할 수 있다. 한 문서 오류는 격리하고 전역 인증 오류는 실행을 중단한다.

기존 수동 게시글은 날짜 키, 한국시간 날짜의 createdAt, 동일한 본문/요약 후보를 검사해 보류한다. 날짜가 같으면 보수적으로 같은 날짜의 다른 본문도 보류할 수 있다. 충돌 검사는 게시 트랜잭션 안에서도 반복한다. 수동 글 연결/백필 버튼은 만들지 않았다. 후보 확인과 정확한 기존 글 ID 연결은 별도 관리자 승인 작업이며 자동화가 임의로 처리하지 않는다.

상태 화면은 최근 200건을 표시한다. 한 번에 최대 1,000개 메타데이터 목록을 읽되 문서 처리는 최대 20개와 시간 예산으로 제한한다. ID 정렬 순서의 커서를 각 문서 시작 전 잠금 트랜잭션으로 저장하며, 삭제된 커서/목록 순서 변경/실패 문서가 다음 실행을 독점하지 못한다. 순회의 끝에 도달하면 다음 실행은 처음부터 다시 확인한다. dry_run 커서는 운영 DB에 저장하지 않고 응답/관리자 화면 메모리로만 이어간다. 화면을 다시 열거나 예약 dry_run을 다시 시작하면 영속적인 시험 커서는 없다.

관리자 `자동 등록 끄기`는 publish 모드에서 `_mccheyne_sync_control/current.stopped=true`를 저장한다. 신규 실행과 다음 문서의 시작을 막고 게시 트랜잭션도 정지 상태를 확인한다. 이미 커밋된 글을 되돌리지는 않는다. 정지 latch는 실행 결과 저장이나 잠금 해제로 지워지지 않으며 자동 재개 버튼은 없다. 재개는 별도의 승인된 운영 설정 작업이다. dry_run/off에서는 이 버튼이 운영 쓰기를 만들지 않는다. 외부 메일/푸시는 켜지 않았다. 문서 본문은 인증된 관리자 미리보기 응답에만 포함하며 로그나 상태 요약에는 포함하지 않는다.

## 내 글, 수동 수정·삭제와 재승인

새 API/자동 등록 글은 확인된 관리자 UID `0BjZJ0BZ4FQhxkpgp7BwDMOPfBV2`를 작성자로 사용한다. 서버는 해당 프로필의 UID·이메일·관리자 역할·displayName을 확인하고 현재 이름을 사용한다. 최신 다른 글의 작성자를 복사하지 않으며 요청 body의 authorId/authorName은 신뢰하지 않는다. 기존 글의 작성자를 일괄 변경하거나 운영 데이터를 백필하지 않았다. 현재 프로필의 기존 '최근 20개 내 글' 조회와 상세 수정/삭제 링크를 그대로 사용한다.

기존 EditPost/PostDetail에서 맥체인 글을 수정·삭제하기 전에 관리자 API로 해당 source 매핑을 수동 보류한다. 보류 설정이 실패하면 글 쓰기를 시작하지 않는다. 일반 수동 글처럼 매핑이 없는 글은 no-op이다. 기존 클라이언트 수정/삭제 및 긴 본문 조각 정리 경로는 유지한다. 외부/이전 클라이언트가 보류 API를 우회해도 제목·본문·날짜·공개 상태·작성자/분류의 게시 fingerprint가 다르거나 매핑된 글이 없으면 자동 덮어쓰기/재생성을 차단한다. 직접 변경 감지는 다음 동기화/게시 시점이며 일반 앱의 모든 필드 변경을 실시간 감시하는 기능은 아니다.

삭제 후 source 매핑은 tombstone 역할로 남는다. 같은 Drive 버전의 성공 상태도 홈페이지 변경을 먼저 검사한다. 관리자 미리보기는 홈페이지 수정본 교체/삭제 글 재게시임을 알리고 현재 siteVersion과 Drive sourceHash를 함께 승인받는다. 게시 트랜잭션은 두 상태와 잠금을 다시 검증한다. 기존 외부 Bearer API는 요청/성공 응답 형식을 유지하되 수동 변경/삭제 매핑을 409로 보류하며 이 재승인을 우회할 수 없다. 기존 매핑에 fingerprint가 없는 경우도 임의 기준값을 백필하지 않고 재승인으로 보류한다.

## Drive Activity 응답 판독

공식 Activity 계약에서 action의 actor/target/time이 상위 Activity와 같으면 생략될 수 있다. 기존 파서는 timestamp만 상속하고 actor/target을 상속하지 않았다. 별도 오프라인 fixture로 정상 compact 응답의 승인 실패뿐 아니라 최신 이동의 target 생략 때문에 오래된 승인을 채택하는 경우까지 재현했다. 현재 `mccheyne-move-evidence.mts`에서 아래 규칙으로 정규화한다.

- 명시된 action 필드가 우선이다. 속성 자체가 없을 때만 상위의 유일한 actor/target을 상속한다. 복수 후보를 임의로 조합하지 않으며 null·잘못된 명시 값은 상위 값으로 덮어쓰지 않는다.
- actor/target/목적지의 승인 여부를 적용하기 **전에** 전체 페이지에서 최신 이동을 선택한다. 최신 이동이 비승인자·불명확한 대상·현재와 다른 목적지이면 보류한다. 시간 자체가 불명확한 이동은 과거라고 단정할 수 없어 전체 자동 승인을 보류한다.
- action의 timeRange는 상위 timestamp로 대체하지 않는다. 정확한 timestamp, 동시각 보류, modifiedTime < 이동시각, 완결된 페이지 조건을 유지한다. JavaScript의 밀리초 비교로 그보다 작은 시간 차이를 구별하지 못하는 경우도 보수적으로 보류한다.
- `isCurrentUser`는 요청자 Reader를 뜻하며 승인 근거로 사용하지 않는다. 실제 검수자의 `people/...`와 일치해야 한다. 관리자/작성자 Firebase UID와 혼동하지 않는다.
- 정확한 root·연도 폴더, 문서 부모, 수정 후 재승인, 관리자 인증, 중복, 사이트 수정·삭제 보호는 그대로다. 승인 루트 parents 부재 예외를 확대하지 않았다.

선택적 진단에는 고정 사유 코드·숫자·불리언만 포함한다. 원시 활동, 본문, 사용자 식별자, 토큰과 헤더를 로그에 남기지 않는다. 진단 callback의 실패나 반환값은 승인 판정에 영향을 주지 않는다.

## 설정과 운영 절차

- `MCCHEYNE_SYNC_MODE`: `off`(기본), `dry_run`, `publish`. `off`는 Reader/저장소 초기화 전 종료한다. `dry_run`은 승인·잠금·처리 기록을 포함한 운영 쓰기를 차단하며 메모리 커서만 사용한다.
- `MCCHEYNE_SYNC_RUNTIME_ACCOUNT`: 예약 함수 실행 계정. 기본값 없이 명시적으로 지정한다. Firestore 권한은 승인된 데이터베이스에 조건을 건다.
- `MCCHEYNE_DRIVE_SERVICE_ACCOUNT`: 검수완료 폴더의 Viewer 전용 계정. 상위 초안 폴더 공유와 Firestore 쓰기 권한은 필요하지 않다. 예약 실행 계정과 기존 siteApi 실행 계정에 이 Reader의 TokenCreator 권한이 필요하다. 장기 키를 사용하지 않는다.
- `MCCHEYNE_APPROVER_PERSON`: 실제 검수자의 Drive Activity `people/...` 식별자. Firebase UID, 이메일, 요청자 Reader의 `isCurrentUser`로 대체하지 않는다.
- 읽기 토큰은 Drive/Docs/Activity 읽기 범위만 사용한다. 기존 외부 게시 API의 Secret 참조는 유지한다.
- 관리자는 현재 작성자 프로필의 UID·이메일·관리자 역할·표시 이름을 확인해야 한다. 게시자가 바뀌는 경우 기존 글을 일괄 변경하지 않는다.
- 중복 확인은 날짜 키, 한국시간 createdAt 범위, 본문/요약 쿼리에 의존한다. 기존 인덱스를 실제 비게시 조회로 확인한다. 새 인덱스나 보안 규칙 배포를 이 기능에 묶지 않는다. 내부 상태 컬렉션은 기존 기본 거부 규칙으로 클라이언트 접근을 차단한다.

배포 대상은 `functions:raah:siteApi`, `functions:raah:mccheyneApprovedSync`, `hosting:church`, `hosting:raah`다. main CI는 Hosting만 배포하므로 함수 설정 변경은 별도로 확인한다. 새 예약 함수의 호출 권한은 지정 런타임에만 주며 공개 호출을 허용하지 않는다.

최초 운영 전환은 OFF 배포 → 비활성 및 Scheduler 일시정지 확인 → 승인된 비게시 전체 후보 확인 → PR 검사 및 main 반영 → 예약을 일시정지한 채 최초 게시 → 날짜·작성자·중복·렌더링 확인 → 매일 05:00 Asia/Seoul 예약 활성화 순서다. 단계마다 해당 작업의 사용자 승인이 필요하며 실행 기록·자격 증명·문서 본문은 저장소에 커밋하지 않는다.

예약 함수는 480초 예산, 관리자 실행은 기본 40초 예산으로 한 번에 최대 20문서를 처리한다. 끝내지 못하면 영속 커서로 다음 실행에서 이어간다. 인증 오류와 보류 사유를 숨기지 않으며, 실패했다고 무조건 전체를 재게시하지 않는다. 최초 게시 후 성공 영수증과 현재 상태를 먼저 확인한다.

중단은 예약 일시정지와 모드 OFF 또는 관리자 중단 latch로 수행한다. 이미 커밋된 글은 자동으로 되돌리지 않는다. 관리자 수동 수정·삭제 검증은 로컬 fixture/에뮬레이터로 수행하고 실제 글을 시험삼아 수정하거나 삭제하지 않는다.

## 검증

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm --prefix firebase-functions run build
```

로컬 Firestore 에뮬레이터에서는 `tests/mccheyne-sync-store.test.ts`로 잠금·fencing·원자적 게시·수동 충돌·클라이언트 접근 거부를 검사한다. 실제 운영의 승인 기록 가시성, IAM, Scheduler 호출, 최초 게시 결과는 로컬 테스트로 대신 확인할 수 없다.

공식 계약: [Activity 상위 필드 상속](https://developers.google.com/workspace/drive/activity/v2/datamodel), [KnownUser](https://developers.google.com/workspace/drive/activity/v2/reference/rest/v2/activity/user), [Activity query](https://developers.google.com/workspace/drive/activity/v2/reference/rest/v2/activity/query), [Docs 조회](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/get), [예약 함수](https://firebase.google.com/docs/functions/schedule-functions).
