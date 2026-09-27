# 함께 지어져가는 교회 — 프로젝트 지침

> `CLAUDE.md`(Claude용)와 `AGENTS.md`(Codex용)는 동일 내용의 미러다. 한쪽을 수정하면 다른 쪽도 함께 수정할 것.
> 브랜치·배포 규칙의 원본은 루트의 `CODEX.md`이며, 충돌 시 `CODEX.md`가 우선한다.

## 프로젝트

- 교회 웹사이트(개척교회). 성도용 콘텐츠 + 다음세대 + RAAH 목양 관리(심방/출석/일정).
- 스택: Vite + React 19 + TypeScript, react-router 7, zustand, Tailwind 4, Netlify(호스팅 + Functions), Firebase Auth/Firestore, Supabase(목양노트 저장), Google GenAI.

## 브랜치·배포 규칙 (CODEX.md 요약)

- **`main` 직접 커밋/push 금지.** main은 Netlify 프로덕션 자동배포에 연결되어 있어 push 즉시 배포된다.
- Codex는 `codex/work`, Claude는 `claude/work` 브랜치에서 작업한다. 본격 작업 전 최신 `origin/main`과 동기화한다.
- 배포는 사용자가 명시적으로 요청할 때만, PR/병합 등 승인된 절차로 진행한다.
- 다른 에이전트가 작업 중이면 같은 파일을 수정하지 않는다. 공유 파일(`src/App.tsx`, `package.json`, `netlify.toml`, `firestore.rules`, 라우팅/인증 유틸, 전역 설정)을 수정해야 하면 먼저 그 위험을 알린다.

## 검증 — 변경 후 반드시 실행

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

> 개발 환경은 macOS(zsh)다. 이전 Windows 환경의 `npm.cmd` / PowerShell 명령을 쓰지 않는다.

## 민감 데이터

- 목양노트(RAAH)는 민감 정보다. Netlify Function에서 Firebase ID 토큰 검증 + 관리자 확인을 거쳐 Supabase에 AES-GCM 암호화로 저장하는 구조를 절대 깨뜨리지 않는다.
- 목양·심방 데이터를 로그·이메일·외부 API에 노출하지 않는다.
- `.env`는 커밋하지 않는다. `.env.example`만 추적한다.

## 인계 보고 (작업 종료 시)

한국어로 다음을 보고한다: 브랜치와 마지막 커밋 해시, 변경 파일 요약, 실행한 검증과 결과, 커밋·배포하지 않은 것, 다음 작업 제안.
