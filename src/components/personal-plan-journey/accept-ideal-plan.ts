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
  /** A real Stage 2 is already under way — continue it instead of accepting. */
  | { kind: "refinement_in_progress" }
  | { kind: "plan_already_accepted"; href: "/routine" }
  | { kind: "error" }

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
    if (payload?.error === "seen_state_stale") return { kind: "seen_state_stale" }
    if (payload?.error === "refinement_in_progress") return { kind: "refinement_in_progress" }
    if (payload?.error === "plan_already_accepted") {
      return { kind: "plan_already_accepted", href: "/routine" }
    }
  }
  return { kind: "error" }
}

/** What the Idealplan CTA does once the accept attempt has resolved. */
export type AcceptIdealPlanFlowEffect =
  | { kind: "open_routine"; href: string }
  /** A refinement is already running — resume it in place. */
  | { kind: "continue_refinement" }
  /** Acceptance cannot converge; the refinement reaches the same destination. */
  | { kind: "open_refinement_route"; href: typeof PLAN_ACCEPT_REFINE_HREF }
  | { kind: "error" }

/**
 * The whole Stage-1 accept path in one place: accept what the user saw, absorb
 * a single stale race by re-fetching and retrying silently, and hand every
 * other outcome its own recovery. The fork screen is gone, so this must never
 * end in a state the user cannot leave.
 */
export async function runAcceptIdealPlanFlow(dependencies: {
  seenRoles: readonly AcceptIdealPlanSeenRole[]
  accept: (seenRoles: readonly AcceptIdealPlanSeenRole[]) => Promise<AcceptIdealPlanOutcome>
  /** Fresh previews after a stale conflict; `null` when they cannot be loaded. */
  refreshSeenRoles: () => Promise<AcceptIdealPlanSeenRole[] | null>
}): Promise<AcceptIdealPlanFlowEffect> {
  let seenRoles = dependencies.seenRoles
  let consecutiveStale = 0
  for (;;) {
    const outcome = await dependencies.accept(seenRoles)
    if (outcome.kind === "accepted" || outcome.kind === "plan_already_accepted") {
      return { kind: "open_routine", href: outcome.href }
    }
    if (outcome.kind === "refinement_in_progress") return { kind: "continue_refinement" }
    if (outcome.kind !== "seen_state_stale") return { kind: "error" }

    consecutiveStale += 1
    if (acceptStatusAfterStale(consecutiveStale) === "unavailable") {
      return { kind: "open_refinement_route", href: PLAN_ACCEPT_REFINE_HREF }
    }
    const refreshed = await dependencies.refreshSeenRoles()
    // Retrying with a seen state we could not refresh would silently defer
    // roles the user just saw. Let them retry instead.
    if (!refreshed) return { kind: "error" }
    seenRoles = refreshed
  }
}
