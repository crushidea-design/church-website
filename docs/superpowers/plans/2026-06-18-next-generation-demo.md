# Next Generation Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/next/demo` field-demo page that combines real sign-up and curriculum navigation with safe local-only demo scenes.

**Architecture:** Add a focused demo data module and a focused demo page under `src/features/next-generation`. Route `/next/demo` from `NextGeneration.tsx`. Let the page open the existing login modal through a small browser event listened to by `NextGenerationHeader`.

**Tech Stack:** React 19, React Router, TypeScript, Vitest, lucide-react, existing Tailwind utility styles.

---

### Task 1: Demo Data

**Files:**
- Create: `src/features/next-generation/demoContent.ts`
- Test: `src/features/next-generation/demoContent.test.ts`

- [ ] Write tests for ordered demo step ids, curriculum path, demo URL fallback, and local-only scenes.
- [ ] Run `npm test -- src/features/next-generation/demoContent.test.ts` and confirm the tests fail because the module does not exist.
- [ ] Implement the demo content constants and helper functions.
- [ ] Re-run the test and confirm it passes.

### Task 2: Demo Page

**Files:**
- Create: `src/features/next-generation/NextGenerationDemoPage.tsx`
- Modify: `src/pages/NextGeneration.tsx`

- [ ] Render the six-step presenter page at `/next/demo`.
- [ ] Include QR/URL, sign-up modal trigger, Bible reading demo, real curriculum link, Word Fruit growth demo, question demo, and family worship strip.
- [ ] Keep non-real scenes in local React state only.

### Task 3: Sign-Up Modal Bridge

**Files:**
- Modify: `src/features/next-generation/NextGenerationHeader.tsx`

- [ ] Listen for a `next-generation-open-login` window event.
- [ ] Open the existing `NextGenerationLoginModal` when the demo page dispatches it.

### Task 4: Verification

**Files:**
- Verify only.

- [ ] Run the focused demo content test.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
