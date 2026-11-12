# 맥체인 묵상 가이드 게시 API

외부 자동화(Claude 예약 작업)가 맥체인 묵상 가이드를 홈페이지에 바로 게시한다.
관리자 페이지(`/create-post?type=today_word`)와 같은 Firestore 구조로 저장한다.

- 엔드포인트: `POST https://builttogether.church/api/mccheyne/publish`
- 구현: `netlify/functions/mccheyne-publish.mts`, 변환·검증 `netlify/functions/_shared/mccheyne-publish-core.mts`
- 실행 위치: Firebase Function `siteApi`(asia-northeast1). Hosting의 `/api/**` rewrite로 연결된다.

## 인증

`Authorization: Bearer <MCCHEYNE_PUBLISH_KEY>`. 키는 SHA-256 다이제스트를 `timingSafeEqual`로 비교한다.
헤더가 없거나 틀리거나 서버에 키가 설정되지 않았으면 401을 반환한다.

## 환경변수 설정

| 환경 | 방법 |
|---|---|
| 로컬 | `.env`에 `MCCHEYNE_PUBLISH_KEY=...` (`.env.example` 참고). `.env`는 커밋하지 않는다. |
| Firebase(운영) | `firebase functions:secrets:set MCCHEYNE_PUBLISH_KEY` 실행 후 값 입력 |
| Netlify(복구용) | 사이트 환경변수에 `MCCHEYNE_PUBLISH_KEY` 추가. 설정하지 않으면 그쪽 엔드포인트는 항상 401이다. |

키 생성: `openssl rand -base64 32`. 같은 값을 Claude 예약 작업의 비밀값에도 넣는다.

### 배포 순서 (주의)

`siteApi`가 이제 이 Secret을 참조한다. **Secret을 먼저 만들지 않으면 Functions 배포가 실패한다.**
CI는 Hosting만 배포하므로 Functions는 수동으로 배포한다.

1. `firebase functions:secrets:set MCCHEYNE_PUBLISH_KEY`
2. main 병합 후 `firebase deploy --only functions:raah:siteApi`

## 요청

| 필드 | 필수 | 내용 |
|---|---|---|
| `date` | 필수 | `YYYY-MM-DD`, 실제 날짜여야 함 |
| `passage` | 필수 | 예: `역대하 1장` (100자 이하) |
| `title` | 필수 | 글 제목 (150자 이하). 앞에 `M월 D일 {passage}`를 붙인다. 이미 붙어 있으면 그대로 둔다. 최종 제목은 200자 이하 |
| `content` | 필수 | Markdown (50,000자 이하) |
| `source_id` | 필수 | 구글 드라이브 문서 ID (`[A-Za-z0-9_-]{10,200}`) |
| `status` | 선택 | `published`(기본) 또는 `draft` |

### 본문 변환

사이트 본문은 순수 텍스트이고 `whitespace-pre-wrap`으로 표시된다.

- 각주는 **모두 제거**한다. `[^1]` 참조와 `[^1]: ...` 정의(들여쓴 이어지는 줄 포함)가 대상이다. 각주는 검수용이고 게시하지 않는다.
- 제목·굵게·기울임·링크·코드·인용·구분선·HTML 태그를 벗겨 텍스트만 남긴다.
- 문단은 두 칸 들여쓰고 빈 줄로 구분한다. 목록은 `• 항목` 또는 `1. 항목`으로 바꾼다.

## 응답

- 200 `{ "ok": true, "id": "...", "url": "https://builttogether.church/post/<id>", "action": "created" | "updated" }`
- 400 `{ "ok": false, "error": "VALIDATION_FAILED", "fields": { "<필드>": "<사유>" }, "message": "..." }` (JSON 형식 오류는 `INVALID_JSON`)
- 401 `UNAUTHORIZED`, 405 `METHOD_NOT_ALLOWED`, 500 `NO_TEMPLATE_POST` / `PUBLISH_FAILED`

## 저장 매핑

| 요청 | Firestore |
|---|---|
| `date` | `posts.dateKey`. 새 글이면 `posts.createdAt`(해당 날짜 00:00 KST) |
| `passage` + `title` | `posts.title` (`12월 2일 역대하 1장 …`), `posts.sortOrder` = `generateSortOrder(title)` |
| `content` | 변환한 텍스트. 1,400바이트를 넘으면 `posts.content`에 앞 400자를 두고 `isLongContent`, `fullContentLength`를 설정한다. 전체 본문은 `post_contents/{id}_{i}`에 10,000자씩 나눠 저장 |
| `status` | `posts.isPublished` (draft → `false`. 관리자에게만 보인다) |
| `source_id` | `mccheyne_publish_sources/{source_id}` → `{ postId, dateKey, passage, title }`. upsert 키로 쓴다 |
| (고정) | `category: 'today_word'`, `subCategory: 'general'`, `commentCount: 0`, `viewCount: 0` |
| (복사) | `authorId`, `authorName`: 가장 최근 `today_word` 글에서 가져온다 |

`posts`에는 필드를 추가하지 않는다. `firestore.rules`의 `hasOnly` 때문에 필드가 늘어나면 관리자 수정 화면에서 저장이 막힌다.
그래서 `source_id` 매핑은 별도 컬렉션에 둔다. 이 컬렉션은 클라이언트 규칙이 없어 기본 거부되고, Admin SDK로만 접근한다.
게시(published) 시 내부 요약 `settings/latest_posts_summary.today_word`도 갱신한다. 이 요약 문서는 관리자만 읽을 수 있다. 공개 홈은 `isPublished == true` 조건으로 원본 게시글을 조회한다. 게시된 글을 draft로 바꾸면 해당 글을 가리키는 요약도 같은 트랜잭션에서 제거한다.

같은 `source_id`로 다시 보내면 같은 글을 갱신한다(트랜잭션). 작성자·작성일·조회수·댓글 수는 유지된다.
관리자가 같은 날짜에 따로 쓴 글이 있으면 `/archive/today`는 가장 최근에 수정된 글을 보여 준다.

## 호출 예시

```bash
curl -X POST https://builttogether.church/api/mccheyne/publish \
  -H 'Authorization: Bearer <KEY>' \
  -H 'Content-Type: application/json' \
  -d '{"date":"2026-12-02","passage":"역대하 1장","title":"지혜를 구한 왕","content":"역대하 1장은 …[^1]\n\n[^1]: 대상 16:39 참조.","source_id":"1AbCdEfGhIjKlMnOpQrStUvWxYz","status":"published"}'
```


## PR #116 검토 후 접근 제어·각주 수정

- 비관리자는 명시적인 `isPublished: true`인 게시글만 읽는다. 관리자만 초안을 읽으며, `posts`, `post_contents`, `post_pdfs`에 같은 부모 게시글 조건을 적용한다. 설교의 기존 정회원/작성자 조건은 유지한다.
- 일반 상세 화면과 다음세대 상세 화면도 본문 조각을 읽기 전에 게시 상태를 확인한다. 공개 목록·이전/다음 글·내 글 목록은 게시된 글로 조회 범위를 제한한다. 맥체인 날짜 화면은 관리자의 초안 검수 접근을 유지한다.
- 홈은 게시글을 다시 조회하며 과거 localStorage 요약 캐시를 제거한다. 이미 이용자에게 전달된 내용을 소급 회수하는 기능은 아니다.
- 각주 정의의 선행 공백·탭과 이어지는 줄·빈 줄 뒤 추가 각주 문단을 함께 제거한다. 원래 본문 문단은 보존한다.
- 운영 적용 절차는 `2026-10-27-post-draft-access-rollout.md`를 따른다. 코드 수정만으로 운영 규칙·Functions가 배포된 것은 아니다.
