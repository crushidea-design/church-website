/** Pure Drive Activity interpretation. No credentials, requests, or raw-data logging. */
type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject | undefined => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : undefined;
const owns = (value: JsonObject, key: string) => Object.hasOwn(value, key);

export type ApprovalDiagnostics = {
  approved: boolean;
  reason: 'APPROVED' | 'INCOMPLETE_ACTIVITY' | 'MALFORMED_ACTIVITY' | 'NO_MOVE' | 'IMPRECISE_MOVE_TIME' |
    'LATEST_MOVE_TIED' | 'LATEST_TARGET_UNVERIFIED' | 'LATEST_ACTOR_UNVERIFIED' |
    'LATEST_DESTINATION_UNVERIFIED' | 'MODIFIED_NOT_BEFORE_MOVE';
  pageCount: number; complete: boolean; moveCount: number;
  inheritedActorCount: number; inheritedTargetCount: number; inheritedTimeCount: number;
  knownActorCount: number; approverMatchCount: number; targetMatchCount: number; destinationMatchCount: number;
  unresolvedActorCount: number; unresolvedTargetCount: number; impreciseTimeCount: number;
};

// Inherit only absent fields and only a unique candidate. Never cross-join summary arrays.
function inherit(action: JsonObject, entry: JsonObject, field: string, plural: string) {
  if (owns(action, field)) return { value: action[field], inherited: false };
  const candidates = entry[plural];
  const inherited = Array.isArray(candidates) && candidates.length === 1;
  return { value: inherited ? candidates[0] : undefined, inherited };
}

function personName(value: unknown): string | undefined {
  const actor = object(value);
  const user = object(actor?.user);
  const known = object(user?.knownUser);
  // Unknown/deleted/system/impersonated actors are not the configured human approver.
  if (!actor || Object.keys(actor).length !== 1 || !user || Object.keys(user).length !== 1 || !known) return undefined;
  const name = known.personName;
  return typeof name === 'string' && /^people\/[A-Za-z0-9_-]+$/.test(name) ? name : undefined;
}

function itemName(value: unknown): string | undefined {
  const target = object(value);
  if (!target || Object.keys(target).length !== 1) return undefined;
  const name = object(target.driveItem)?.name;
  return typeof name === 'string' && /^items\/[A-Za-z0-9_-]+$/.test(name) ? name : undefined;
}

function timestamp(value: unknown): number | undefined {
  // REST output is RFC3339. Reject coercible objects, empty strings, and date-only values.
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return undefined;
  const date = value.slice(0, 10);
  const midnight = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== date) return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : undefined;
}

/** Returns only fixed codes, counts and booleans, safe for an optional diagnostic sink. */
export function evaluateApprovalMoves(pages: readonly unknown[], context: {
  documentId: string; folderId: string; approver: string; modifiedTime: string; complete: boolean;
}): ApprovalDiagnostics {
  const report: ApprovalDiagnostics = {
    approved: false, reason: 'NO_MOVE', pageCount: pages.length, complete: context.complete, moveCount: 0,
    inheritedActorCount: 0, inheritedTargetCount: 0, inheritedTimeCount: 0, knownActorCount: 0,
    approverMatchCount: 0, targetMatchCount: 0, destinationMatchCount: 0,
    unresolvedActorCount: 0, unresolvedTargetCount: 0, impreciseTimeCount: 0,
  };
  type Move = { time: number | undefined; targetMatches: boolean; actorMatches: boolean; destinationMatches: boolean };
  let latest: Move | undefined;
  let tied = false;
  let malformed = false;
  for (const rawPage of pages) {
    const page = object(rawPage);
    if (!page || (owns(page, 'nextPageToken') && typeof page.nextPageToken !== 'string') ||
      (owns(page, 'activities') && !Array.isArray(page.activities))) { malformed = true; continue; }
    for (const rawEntry of (page.activities ?? []) as unknown[]) {
      const entry = object(rawEntry);
      if (!entry || !Array.isArray(entry.actions) || entry.actions.length === 0) { malformed = true; continue; }
      for (const rawAction of entry.actions) {
        const action = object(rawAction);
        const detail = object(action?.detail);
        if (!action || !detail || Object.keys(detail).length !== 1) { malformed = true; continue; }
        if (!owns(detail, 'move')) continue; // A grouped permission change is not another move.
        const move = object(detail.move);
        if (!move) { malformed = true; continue; }
        report.moveCount++;
        const actor = inherit(action, entry, 'actor', 'actors');
        const target = inherit(action, entry, 'target', 'targets');
        const inheritedTime = !owns(action, 'timestamp') && !owns(action, 'timeRange');
        const timeSource = inheritedTime ? entry : action;
        // An explicit range (or malformed explicit time) must not fall back to summary time.
        const time = owns(timeSource, 'timeRange') ? undefined : timestamp(timeSource.timestamp);
        const person = personName(actor.value);
        const item = itemName(target.value);
        const candidate: Move = {
          time, targetMatches: item === `items/${context.documentId}`, actorMatches: person === context.approver,
          destinationMatches: Array.isArray(move.addedParents) && move.addedParents.length === 1 &&
            itemName(move.addedParents[0]) === `items/${context.folderId}`,
        };
        report.inheritedActorCount += Number(actor.inherited);
        report.inheritedTargetCount += Number(target.inherited);
        report.inheritedTimeCount += Number(inheritedTime && (owns(entry, 'timestamp') || owns(entry, 'timeRange')));
        report.knownActorCount += Number(person !== undefined);
        report.approverMatchCount += Number(candidate.actorMatches);
        report.targetMatchCount += Number(candidate.targetMatches);
        report.destinationMatchCount += Number(candidate.destinationMatches);
        report.unresolvedActorCount += Number(person === undefined);
        report.unresolvedTargetCount += Number(item === undefined);
        report.impreciseTimeCount += Number(time === undefined);
        // Select the newest move BEFORE checking actor, target, or destination. An
        // unapproved/ambiguous newest event must never expose an older approval.
        if (time !== undefined) {
          if (!latest || time > latest.time!) { latest = candidate; tied = false; }
          else if (time === latest.time) tied = true;
        }
      }
    }
  }
  const modified = timestamp(context.modifiedTime);
  report.reason = malformed ? 'MALFORMED_ACTIVITY'
    : !context.complete ? 'INCOMPLETE_ACTIVITY'
    : !report.moveCount ? 'NO_MOVE'
    // Without a precise time, an event cannot be proven older than the chosen one.
    : report.impreciseTimeCount || !latest ? 'IMPRECISE_MOVE_TIME'
    : tied ? 'LATEST_MOVE_TIED'
    : !latest.targetMatches ? 'LATEST_TARGET_UNVERIFIED'
    : !latest.actorMatches ? 'LATEST_ACTOR_UNVERIFIED'
    : !latest.destinationMatches ? 'LATEST_DESTINATION_UNVERIFIED'
    : modified === undefined || modified >= latest.time! ? 'MODIFIED_NOT_BEFORE_MOVE'
    : 'APPROVED';
  report.approved = report.reason === 'APPROVED';
  return report;
}
