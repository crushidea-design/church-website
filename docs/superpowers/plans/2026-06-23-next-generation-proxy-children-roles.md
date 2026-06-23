# Next Generation Proxy Children Roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-pass support for multi-role next-generation members and parent-managed proxy children for young children without their own login.

**Architecture:** Keep existing `department`, `childIds`, and `proxyChildren` fields for compatibility, and add helpers plus new fields beside them. Parent-created proxy children are written to both the legacy member summary and the new `next_generation_children` collection so existing word-fruit and family-worship flows keep working while the new model becomes available.

**Tech Stack:** React 19, TypeScript, Firebase Auth, Firestore, Firestore Rules, Vitest.

---

### Task 1: Role Helpers

**Files:**
- Create: `src/lib/nextGenerationRoles.ts`
- Test: `src/lib/nextGenerationRoles.test.ts`
- Modify: `src/lib/nextGenerationAuth.tsx`

- [ ] **Step 1: Write failing tests** for deriving departments, primary department, and role checks from legacy and new member shapes.
- [ ] **Step 2: Run** `npm.cmd test -- src/lib/nextGenerationRoles.test.ts` and verify helper imports fail.
- [ ] **Step 3: Implement helpers** `getMemberDepartments`, `hasDepartment`, `getPrimaryDepartment`, `getDefaultPrimaryDepartment`, and `buildMemberRoleFields`.
- [ ] **Step 4: Extend member/signup types** with `departments`, `primaryDepartment`, and `roleProfiles`.
- [ ] **Step 5: Run helper tests** and verify they pass.

### Task 2: Signup Multi-Role Fields

**Files:**
- Modify: `src/pages/NextGenerationLoginModal.tsx`
- Modify: `src/lib/nextGenerationAuth.tsx`
- Test: `src/lib/nextGenerationRoles.test.ts`

- [ ] **Step 1: Add tests** for `buildMemberRoleFields(['교사', '학부모'])` returning `department: '교사'`, `departments: ['교사', '학부모']`, and a role profile with teacher and parent branches.
- [ ] **Step 2: Update signup state** to store selected departments as an array with at least one value.
- [ ] **Step 3: Change role buttons** to checkbox-style toggles and keep student parent email visible when `학생` is selected.
- [ ] **Step 4: Save role fields** in email and Google signup payloads.

### Task 3: Proxy Child API

**Files:**
- Create: `src/features/next-generation/proxyChildren.ts`
- Test: `src/features/next-generation/proxyChildren.test.ts`
- Modify: `src/features/word-fruit/ParentOnboardingModal.tsx`

- [ ] **Step 1: Write tests** for normalizing proxy child drafts into IDs, member summaries, and child collection documents.
- [ ] **Step 2: Implement `buildProxyChildRecords`** with deterministic inputs for tests and generated IDs for runtime.
- [ ] **Step 3: Update parent onboarding** to write child docs to `next_generation_children` and mirror compact summaries to `next_generation_members/{uid}.proxyChildren`.

### Task 4: Role-Based Profile Display

**Files:**
- Modify: `src/features/next-generation/NextGenerationMyPage.tsx`
- Modify: `src/features/word-fruit/parentOnboarding.ts`
- Modify: `src/features/word-fruit/WordFruitPanel.tsx`
- Modify: `src/features/word-fruit/MyPageRoleCards.tsx`

- [ ] **Step 1: Use role helpers** so teacher-parent users see teacher surfaces and parent cards.
- [ ] **Step 2: Keep teacher as default prominent role** by using `getPrimaryDepartment`.
- [ ] **Step 3: Show parent onboarding** whenever a member has the parent role and has no linked or proxy children.
- [ ] **Step 4: Update word fruit checks** to use `hasDepartment` for parent, teacher, and student.

### Task 5: Admin And Security

**Files:**
- Modify: `src/features/next-generation/AdminMembersTab.tsx`
- Modify: `src/pages/NextGenerationAdmin.tsx`
- Modify: `firestore.rules`

- [ ] **Step 1: Display all role chips** in admin member rows, with primary role first.
- [ ] **Step 2: Update notification targeting** to include members whose `departments` contains the chosen audience role.
- [ ] **Step 3: Update Firestore rules** to allow the new member fields, recognize multi-role teacher/parent checks, and protect `next_generation_children`.

### Task 6: Verification

**Files:**
- All modified files

- [ ] **Step 1: Run focused tests** `npm.cmd test -- src/lib/nextGenerationRoles.test.ts src/features/next-generation/proxyChildren.test.ts src/features/word-fruit/parentOnboarding.test.ts`
- [ ] **Step 2: Run demo content test** `npm.cmd test -- src/features/next-generation/demoContent.test.ts` because existing unstaged demo work is still present.
- [ ] **Step 3: Run typecheck** `npm.cmd run typecheck`.
- [ ] **Step 4: Run production build** `npm.cmd run build`.
