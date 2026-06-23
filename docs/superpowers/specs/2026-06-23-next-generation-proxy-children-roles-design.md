# Next Generation Proxy Children And Multi-Role Design

## Goal

Support families where young children cannot reasonably own or operate their own login, while also supporting adults who hold more than one next-generation role, such as teacher plus parent or young adult plus parent.

The system should keep child identity exposure limited. A proxy child profile is visible to the parent, the same class teachers, and next-generation pastors/admins. The child name may also appear inside explicitly public activity records such as word fruit or family worship, according to that activity's public setting.

## Current Context

The app already has a next-generation member document at `next_generation_members/{uid}`. Current logic relies heavily on a single `department` value such as `청년`, `교사`, `학부모`, or `학생`. Parent-related features already use `childIds`, `childNames`, `parentOnboardingCompleted`, and `proxyChildren`. Word fruit and family worship already understand some proxy child IDs.

Because many components and Firestore rules still depend on `department`, this design keeps it as a compatibility field while adding multi-role fields beside it.

## Data Model

### Member Roles

Extend `next_generation_members/{uid}` with:

```ts
departments: Array<'청년' | '교사' | '학부모' | '학생'>;
primaryDepartment: '청년' | '교사' | '학부모' | '학생';
roleProfiles: {
  teacher?: {
    groupIds: string[];
  };
  parent?: {
    childIds: string[];
  };
  youngAdult?: {
    enabled: boolean;
  };
  student?: {
    groupId?: string;
  };
};
```

Keep the existing `department` field as the user's primary role during migration. New reads should use helper functions such as `hasDepartment(member, '교사')`, but old code can continue reading `department` until each surface is migrated.

### Proxy Children

Add a first-class collection:

```ts
next_generation_children/{childId}
kind: 'proxy' | 'linked';
displayName: string;
department: '유치부' | '유초등부' | '학생';
groupId?: string;
parentUids: string[];
linkedUid?: string | null;
visibility: 'family_and_teachers';
createdBy: string;
createdAt: Timestamp;
updatedAt: Timestamp;
```

`kind: 'proxy'` means the child has no login. `linkedUid` is reserved for a future account connection when the child later gets a real account.

For backward compatibility, parent member documents can continue carrying `proxyChildren` during the transition. New code should treat `next_generation_children` as the source of truth and mirror a compact summary only where needed for older components.

## Visibility And Permissions

Proxy child profiles are readable by:

- The child's parent, if the current user's uid is in `parentUids`.
- A teacher whose assigned `groupIds` includes the child's `groupId`.
- Next-generation pastors/admins.

Proxy child profiles are not listed to all next-generation members.

Public activity records may include copied child display data:

```ts
childId: string;
childName: string;
groupId?: string;
isPublic: boolean;
```

This allows public word fruit or family worship records to show a child's name without opening the full child profile.

## Role Priority

When a user has multiple departments, the default experience is selected by `primaryDepartment`.

Recommended priority:

1. `교사`
2. `학부모`
3. `청년`
4. `학생`

This means a teacher-parent lands in the teacher-oriented flow by default, because teacher work is more operational. Their personal profile still shows parent cards and child management. A young-adult-parent can have `primaryDepartment` set by the user or admin, with parent functions still visible on the profile.

## UI Design

### Signup And Admin Approval

The signup form should allow multiple role selections. If a person selects `학부모`, the form should invite them to add children after signup or after approval. If they select `교사`, the admin approval screen should support assigning one or more class groups.

The admin member screen should show:

- Role chips for all departments.
- A clear primary role selector.
- Teacher group assignments.
- Parent child links and proxy child summaries.

### My Page

The profile page should become role-card based:

- Teacher card: assigned groups, class dashboard, attendance, students' word fruit.
- Parent card: child list, add proxy child, word fruit, family worship.
- Young adult card: young adult resources, Q&A, reading or study surfaces.
- Student card: bible reading chart and student-only resources.

The default prominent card follows `primaryDepartment`, but all role cards appear when the user owns those roles.

### Parent Child Management

Parents can add proxy child profiles with:

- Child name.
- Department/class group.
- Optional memo or grade label.

Parents can edit or hide their own proxy children. Admins can manage all child profiles.

## Migration Plan

1. Add role helper functions and tests while keeping current behavior unchanged.
2. Extend member types and Firestore rules for `departments`, `primaryDepartment`, and `roleProfiles`.
3. Add `next_generation_children` rules and API helpers.
4. Update parent onboarding to create first-class proxy child records.
5. Update word fruit and family worship to read children through the new helper while preserving existing `proxyChildren`.
6. Update admin member management for multi-role editing.
7. Update my page to show role cards based on helper functions.
8. Gradually replace direct `member.department === ...` checks with role helpers.

## Testing

Tests should cover:

- A single-role member keeps the same primary behavior.
- A teacher-parent defaults to teacher UI and still sees parent tools.
- A parent can read their proxy child profile.
- A teacher can read proxy children in assigned groups only.
- General next-generation members cannot list unrelated proxy children.
- Public activity records can show copied child names without granting profile access.

## Non-Goals

This design does not require children to create accounts. It also does not make proxy child profiles public to all next-generation members. Linking a proxy child to a future real login is reserved through `linkedUid`, but the first implementation only needs to store the reserved field without building the account-linking workflow.
