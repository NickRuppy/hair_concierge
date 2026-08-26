import type { Stage1ProductExamplePreviewResponse } from "@/lib/personal-plan/product-preview-contract"

export const PLAN_ACCEPT_ERROR =
  "Dein Plan konnte nicht übernommen werden. Versuche es noch einmal."
/**
 * Shown once re-fetching has failed to converge, i.e. the mismatch is
 * structural rather than a race. Naming the working path beats a retry that
 * cannot succeed.
 */
export const PLAN_ACCEPT_UNAVAILABLE_NOTICE =
  "Die direkte Übernahme ist gerade nicht möglich. Der Feinschliff bringt dich sicher ans Ziel."
/**
 * Where a structurally stale seen state goes. Completing the refinement also
 * produces an accepted plan, so this is a detour, not a dead end. `refine=1`
 * suppresses the bridge auto-handoff exactly like every other explicit re-entry.
 */
export const PLAN_ACCEPT_REFINE_HREF = "/plan-start?refine=1"

/**
 * One seen-state entry per recommendation role, exactly as
 * `POST /api/personal-plan/accept-ideal-plan` expects it. The Stage-1 card
 * adapter drops these three fields, so they are echoed from the raw payload.
 */
export type AcceptIdealPlanSeenRole = {
  decisionKey: string
  productId: string
  factFingerprint: string
}

/**
 * Every role the user actually saw as a buyable recommendation. Roles the
 * payload could not show — no product yet, or a category whose choice depends
 * on an answer only the refinement collects — are deliberately absent: the
 * accept contract turns exactly those into server-derived `deferred` decisions.
 * An empty result is therefore a legitimate all-deferred acceptance, never a
 * blocker.
 */
export function deriveAcceptIdealPlanSeenRoles(
  response: Stage1ProductExamplePreviewResponse | null,
): AcceptIdealPlanSeenRole[] {
  if (!response) return []
  return response.previews.flatMap((preview) =>
    preview.kind === "recommendation"
      ? [
          {
            decisionKey: preview.decisionKey,
            productId: preview.productId,
            factFingerprint: preview.factFingerprint,
          },
        ]
      : [],
  )
}

/**
 * A single `seen_state_stale` is a recoverable race — the previews moved under
 * the user, and re-fetching converges. A second consecutive one means
 * re-fetching did NOT converge: the server plans a role the preview payload
 * does not contain at all, so every further retry produces the same 409.
 * Retire the path instead of looping.
 */
export function acceptStatusAfterStale(consecutiveStaleCount: number): "idle" | "unavailable" {
  return consecutiveStaleCount >= 2 ? "unavailable" : "idle"
}

export type AcceptIdealPlanOutcome =
  | { kind: "accepted"; href: string }
  /** The server plans other products than the user saw; re-fetch and retry. */
  | { kind: "seen_state_stale" }
  /**
   * A pinned product is no longer plannable. Same shape of problem as a stale
   * seen state — fresh previews may resolve it — so it gets the same treatment.
   */
  | { kind: "recommendation_unavailable" }
  /** A real Stage 2 is already under way — continue it instead of accepting. */
  | { kind: "refinement_in_progress" }
  | { kind: "plan_already_accepted"; href: "/routine" }
  /**
   * The plan cannot be accepted as it stands (`acceptance_not_ready`,
   * `conflict`, `stage_not_ready`). Re-posting the same payload can never
   * change that, so the refinement — which also ends in an accepted plan — is
   * the way out.
   */
  | { kind: "refinement_required" }
  /** Genuinely transient (rate limit, 5xx, network): retrying is meaningful. */
  | { kind: "error" }

/** 409 bodies whose only cure is completing the refinement. */
const REFINEMENT_REQUIRED_ERRORS = new Set(["acceptance_not_ready", "conflict", "stage_not_ready"])

export function interpretAcceptIdealPlanResponse(
  status: number,
  body: unknown,
): AcceptIdealPlanOutcome {
  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : null
  if (status === 200) {
    const next = payload?.next
    const href =
      next && typeof next === "object" && typeof (next as { href?: unknown }).href === "string"
        ? (next as { href: string }).href
        : null
    return payload?.status === "accepted" && href ? { kind: "accepted", href } : { kind: "error" }
  }
  if (status === 409) {
    const error = payload?.error
    if (error === "seen_state_stale") return { kind: "seen_state_stale" }
    if (error === "recommendation_unavailable") return { kind: "recommendation_unavailable" }
    if (error === "refinement_in_progress") return { kind: "refinement_in_progress" }
    if (error === "plan_already_accepted") {
      return { kind: "plan_already_accepted", href: "/routine" }
    }
    if (typeof error === "string" && REFINEMENT_REQUIRED_ERRORS.has(error)) {
      return { kind: "refinement_required" }
    }
  }
  return { kind: "error" }
}

/**
 * Whether the Stage-1 previews are in a state that may be accepted.
 *
 * The distinction that matters: previews that were REQUESTED and failed are not
 * the same as previews that were never requestable. In the first case the user
 * may well have been shown recommendations we simply cannot name any more, so
 * accepting would silently defer roles behind their back — route them into the
 * refinement instead. In the second case nothing was ever rendered, so an empty
 * seen state is the truth, and a plan whose previews genuinely contain no
 * recommendation accepts all-deferred exactly as designed.
 */
export type Stage1PreviewLoadState = "not_requested" | "loading" | "ready" | "unavailable"

export function acceptIdealPlanReadiness(
  state: Stage1PreviewLoadState,
): "accept" | "wait" | "refine" {
  if (state === "loading") return "wait"
  if (state === "unavailable") return "refine"
  return "accept"
}

/** What the Idealplan CTA does once the accept attempt has resolved. */
export type AcceptIdealPlanFlowEffect =
  | { kind: "open_routine"; href: string }
  /** A refinement is already running — resume it in place. */
  | { kind: "continue_refinement" }
  /** Acceptance cannot converge; the refinement reaches the same destination. */
  | { kind: "open_refinement_route"; href: typeof PLAN_ACCEPT_REFINE_HREF }
  | { kind: "error" }

const openRefinement = {
  kind: "open_refinement_route",
  href: PLAN_ACCEPT_REFINE_HREF,
} as const

/**
 * The whole Stage-1 accept path in one place: accept what the user saw, absorb
 * a single stale (or newly unavailable) recommendation by re-fetching and
 * retrying silently, and hand every other outcome its own recovery. The fork
 * screen is gone, so this must never end in a state the user cannot leave —
 * only genuinely transient failures stay on the inline retry.
 */
export async function runAcceptIdealPlanFlow(dependencies: {
  seenRoles: readonly AcceptIdealPlanSeenRole[]
  accept: (seenRoles: readonly AcceptIdealPlanSeenRole[]) => Promise<AcceptIdealPlanOutcome>
  /** Fresh previews after a stale conflict; `null` when they cannot be loaded. */
  refreshSeenRoles: () => Promise<AcceptIdealPlanSeenRole[] | null>
}): Promise<AcceptIdealPlanFlowEffect> {
  let seenRoles = dependencies.seenRoles
  let consecutiveSeenStateConflicts = 0
  for (;;) {
    const outcome = await dependencies.accept(seenRoles)
    if (outcome.kind === "accepted" || outcome.kind === "plan_already_accepted") {
      return { kind: "open_routine", href: outcome.href }
    }
    if (outcome.kind === "refinement_in_progress") return { kind: "continue_refinement" }
    // Nothing about a re-post can resolve these, so do not offer a retry that
    // cannot work — the refinement ends in an accepted plan too.
    if (outcome.kind === "refinement_required") return openRefinement
    if (outcome.kind !== "seen_state_stale" && outcome.kind !== "recommendation_unavailable") {
      return { kind: "error" }
    }

    consecutiveSeenStateConflicts += 1
    if (acceptStatusAfterStale(consecutiveSeenStateConflicts) === "unavailable") {
      return openRefinement
    }
    const refreshed = await dependencies.refreshSeenRoles()
    // Retrying with a seen state we could not refresh would silently defer
    // roles the user just saw, and re-posting the stale one loops forever.
    if (!refreshed) return openRefinement
    seenRoles = refreshed
  }
}
