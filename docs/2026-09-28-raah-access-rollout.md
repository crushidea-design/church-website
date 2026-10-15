# RAAH 전용 접근 승인 적용 절차 (R01·PR-3)

작성일: 2026-09-28
관련: [개선 계획](2026-09-27-raah-reformed-pastoral-care-plan.md) 16.1 PR-3, [R00 기준선](2026-09-28-raah-baseline-r00.md)

## 무엇이 바뀌는가

RAAH API(`raah-management`, `raah-notes`, `raah-calendar`)는 이제 `requireRaahAccess`를 거친다.

| `RAAH_ACCESS_ENFORCED` | 통과 조건 |
| --- | --- |
| 미설정 또는 `false` (기본) | 기존과 동일: Firebase 신원 + 홈페이지 관리자 역할(또는 소유자 이메일) |
| `true` | 위 조건 **그리고** `raah_workspace_access`에 활성·미만료·미회수 승인 행 |

승인은 요청마다 다시 읽으므로 회수는 다음 요청부터 적용된다. 승인 조회가 실패하면 503으로 거절한다(열어 주지 않음). 소유자 이메일 계정도 플래그를 켠 뒤에는 승인 행이 필요하다.

`access_role`(`pastor`/`elder`/`clerk`)은 소프트웨어 접근 구분일 뿐 교회정치상의 직분이나 결정 권한이 아니다.

## 운영 적용 순서

코드가 main에 배포된 뒤, 아래를 순서대로 진행한다. 1–3단계까지는 사용자 화면에 변화가 없다.

1. **테이블 생성.** Supabase 대시보드 → SQL Editor에서 `supabase/migrations/20260928000000_raah_workspace_access.sql` 전체를 실행한다. 재실행해도 안전하다.
2. **목양자 UID 확인.** Firebase 콘솔 → Authentication → 사용자 목록에서 목양자 계정의 `사용자 UID`를 복사한다.
3. **승인 등록.**
   ```sql
   insert into public.raah_workspace_access (firebase_uid, access_role, granted_by)
   values ('<목양자 UID>', 'pastor', 'initial-setup');
   select firebase_uid, access_role, active, expires_at from public.raah_workspace_access;
   ```
4. **플래그 켜기.** Netlify → Site configuration → Environment variables에 `RAAH_ACCESS_ENFORCED=true`를 추가하고 재배포한다(환경변수는 다음 배포부터 함수에 반영).
5. **확인.**
   - 목양자 계정으로 RAAH가 평소처럼 열리는지 확인한다.
   - 승인 행이 없는 다른 관리자 계정이 있다면 "라아 목양 접근 권한이 없습니다"가 표시되는지 확인한다.
   - 익명 요청은 여전히 401이어야 한다.

## 회수와 되돌리기

- 한 사람의 접근 회수:
  ```sql
  update public.raah_workspace_access
  set active = false, revoked_at = now(), updated_at = now()
  where firebase_uid = '<UID>';
  ```
- 잠김 등 문제가 생기면 Netlify에서 `RAAH_ACCESS_ENFORCED`를 지우거나 `false`로 바꾸고 재배포한다. 기존 관리자 검사로 즉시 돌아가며 데이터는 바뀌지 않는다.

## 이번 범위에 없는 것

- 승인·회수 화면(당분간 SQL로 관리). 승인·회수의 감사 기록은 감사 테이블을 만드는 PR-5에서 함께 다룬다.
- 기록별·대상별 권한. 현재는 승인된 목양자가 기존 RAAH 기록 전체를 본다. 목양자가 한 명인 P1 전제에서는 기존과 같은 범위다.
- 외부 AI 경로(`/api/raah/ai-assist`)는 410으로 막혀 있어 기존 관리자 검사를 그대로 둔다.

## 검증

- `netlify/functions/_shared/raah-access.test.ts`: 플래그 꺼짐 통과, 승인 없음·비활성·회수·만료 거절, 요청마다 재조회, 조회 실패·설정 누락 시 503.
- `tests/db/raah-workspace-access.test.ts`(`npm run test:db`): 기본값, 사용자당 1행, 역할·회수 제약, 브라우저 키 읽기·쓰기 차단.
