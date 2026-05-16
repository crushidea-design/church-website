# Codex Workflow

## Branch Rules

- Do not commit or push directly to `main`.
- `main` is connected to Netlify production deploys, so pushing to `main` can deploy immediately.
- Treat `origin/main` as the latest release baseline.
- Before starting work, check the current branch and compare with `origin/main`.
- Do actual Codex work on `codex/work` unless the user explicitly asks for another branch.
- Before substantial work, bring `codex/work` up to date with the latest `origin/main` by rebasing or merging.
- Push Codex work to `origin/codex/work`, not `origin/main`.

## Coordination

- If another agent is actively working, avoid editing the same files.
- If the user says another agent is working in an area, stay out of that area unless explicitly asked.
- If a task requires shared files such as `src/App.tsx`, `package.json`, `netlify.toml`, `firestore.rules`, route/auth utilities, or global config, mention that risk before editing.
- If no other agent is actively working, it is fine to work broadly from the latest `main` baseline on `codex/work`.

## Deployment

- Do not deploy unless the user explicitly asks.
- Do not push to `main` as a way to deploy.
- When the user is ready to deploy, use a deliberate PR/merge or other user-approved release flow.

## Handoff

- Keep commits focused and descriptive.
- At the end of work, report the current branch, commit hash, verification performed, and whether anything remains untracked.
- If work is ready but not deployed, say that clearly.
