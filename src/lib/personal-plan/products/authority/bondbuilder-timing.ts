import type { BondbuilderTiming } from "@/lib/personal-plan/refinement/types"
import type { InitialNeedPlanSnapshot } from "@/lib/personal-plan/types"

/**
 * The Bondbuilder timing a selection must respect, read from the (refined) Need snapshot.
 * Anything but a stated before/after-wash answer — an initial snapshot, a refined version from
 * before the question existed, „Ist mir egal“ — is `no_preference`, which leaves today's
 * selection (trust tier, then cheapest first) untouched.
 */
export function bondbuilderTimingFromSnapshot(
  snapshot: Pick<InitialNeedPlanSnapshot, "profile"> | null | undefined,
): BondbuilderTiming {
  const timing = snapshot?.profile?.routine?.bondbuilderTiming
  return timing?.state === "known" ? timing.value : "no_preference"
}
