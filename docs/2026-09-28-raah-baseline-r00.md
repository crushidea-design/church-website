# RAAH 기준선 기록 (R00·R00b)

작성일: 2026-09-28
브랜치: `claude/work` (기준 `main` `20d7a9a`)
관련 계획: [RAAH 개혁주의 목양 작업대 개선 계획](2026-09-27-raah-reformed-pastoral-care-plan.md) 16.1의 PR-1

이 문서는 성찬 목양 작업을 시작하기 전의 코드·DB·검증 상태를 고정해 둔다. 이후 PR은 이 기준선과 비교해 회귀 여부를 판단한다.

## 1. 검증 구분

| 구분 | 상태 | 비고 |
| --- | --- | --- |
| 정적 검증(typecheck·lint·test·build) | 통과 | 아래 3절 |
| 로컬 DB에 기존 스키마 재현 | 통과 | 빈 DB에 마이그레이션 4개 적용, 4절 |
| 로컬 DB 권한 스모크(anon 차단) | 통과 | `npm run test:db` 16건 |
| 운영 API 익명 요청 거절(401) | **미확인** | 운영 사이트 주소 확인 후 기록 |
| 운영에서 로그인 후 조회·복호화 | **미확인** | 목양자 본인 계정으로만 확인 가능, 결과만 기록 |

익명 401 확인은 인증 계층이 살아 있다는 뜻일 뿐, DB 연결·복호화가 정상이라는 뜻이 아니다. 두 항목을 섞어 기록하지 않는다.

## 2. 코드 기준선

- 인증: RAAH 함수 4개(`raah-management`, `raah-notes`, `raah-calendar`, `raah-ai-assist`)가 `_shared/raah-auth.mts`의 `requireRaahAdmin`을 사용한다. 목양 전용 접근 승인은 아직 없다.
- 외부 AI: `/api/raah/ai-assist`는 410(`RAAH_EXTERNAL_AI_DISABLED`)으로 차단되어 있다.
- 홈 집계: `AdminPastoralNotes.tsx`의 `absentCount = 활성 인원 - 출석 인원`. 성도 상세에는 `미기록` 표시가 있으나 홈 집계에는 없다.
- 저장소 전환: Supabase 조회가 404·503 또는 `RAAH_SUPABASE_NOT_CONFIGURED`이면 Firestore 호환 모드로 전환하고, 이 모드에서는 Firestore에 저장한다.
- Supabase 호출: 서버가 `/rest/v1/<table>`을 단건 호출하며 트랜잭션·RPC 사용처는 없다.

## 3. 정적 검증 결과

```text
npm run typecheck   통과
npm run lint        오류 0, 경고 418 (기존 경고, 이번 변경과 무관)
npm test            31 파일 통과, 2 파일 건너뜀(에뮬레이터·DB 전용), 144 테스트 통과
npm run build       통과 (청크 크기 경고만)
npm run test:db     16 테스트 통과 (로컬 Supabase)
```

## 4. 로컬 DB 테스트 환경 (R00b)

구성: OrbStack(Docker) + Supabase CLI 2.118.0, `supabase/config.toml`. 필요 없는 서비스(studio, storage, realtime, edge runtime, analytics, local smtp)는 꺼 두었다.

```bash
supabase start      # 최초 1회 이미지 다운로드
npm run test:db     # 로컬 DB 초기화 → 전체 마이그레이션 재적용 → tests/db 실행
supabase stop       # 사용 후 종료
```

`scripts/test-db.mjs`는 `supabase status`에서 주소를 읽고, 호스트가 `127.0.0.1`/`localhost`가 아니면 실행을 거부한다. 일반 `npm test`에서는 `tests/db`가 환경변수 부재로 건너뛰어진다.

### 스키마 파일 정리

Supabase CLI가 순서대로 적용할 수 있도록 기존 SQL을 `supabase/migrations/`로 옮겼다. 내용은 아래 인코딩 수정 외에 바뀌지 않았다.

| 이전 경로 | 새 경로 |
| --- | --- |
| `supabase/raah_notes.sql` | `migrations/20260505000000_raah_notes.sql` |
| `supabase/raah_management.sql` | `migrations/20260505000100_raah_management.sql` |
| `supabase/raah_attendance.sql` | `migrations/20260505000200_raah_attendance.sql` |
| `migrations/20260529_raah_schedule_end_date.sql` | `migrations/20260529000000_raah_schedule_end_date.sql` |

운영 DB는 Supabase CLI 마이그레이션 이력으로 관리되지 않았다(SQL 편집기 적용으로 추정). 모든 파일이 `if not exists`/`drop policy if exists` 형태라 재적용해도 안전하지만, 운영에 `supabase db push`를 쓰는 전환은 별도 승인 과제로 둔다.

### 발견 사항: SQL 인코딩 손상

`raah_management.sql`과 `raah_attendance.sql`의 `raah_attendance_events.service_type` 기본값 `'주일예배'`에서 `예` 글자의 첫 바이트가 `?`로 바뀌어 파일이 UTF-8로 유효하지 않았다. Postgres는 이 파일을 적용하지 못한다. 이번에 `'주일예배'`로 복구했고 `test:db`에 회귀 테스트를 추가했다.

운영 영향: 서버는 `serviceType`이 비어 있으면 `'주일예배'`를 직접 넣으므로 앱 경로에서는 기본값이 쓰이지 않는다. 운영 DB의 실제 기본값은 확인하지 않았다(필요하면 SQL 편집기에서 `select column_default from information_schema.columns where table_name = 'raah_attendance_events' and column_name = 'service_type';`).

### 발견 사항: 기존 RLS 정책

기존 정책은 Supabase JWT의 이메일·`app_metadata.role`을 기준으로 한다. 현재 서버는 `service_role`로 접근하므로 이 정책은 브라우저 직접 접근 차단 역할만 한다. 로컬 테스트에서 anon 키로 읽기 시 빈 결과, 쓰기 시 거절됨을 확인했다. 목양자별 격리는 계획서 14.2대로 서버와 RPC 함수에서 구현한다.

## 5. 다음 작업

- PR-2(R02): 홈 `absentCount`를 미조회·미기록·결석으로 분리.
- PR-3(R01): `raah_workspace_access` 마이그레이션, `raah-access.mts`, 거절 테스트를 `test:db`에 추가.
