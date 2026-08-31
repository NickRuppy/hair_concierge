import type {
  Stage3AuthorityActionKind,
  Stage3AuthorityEvaluation,
  Stage3AuthoritySemanticIntent,
} from "@/lib/personal-plan/products/authority/contracts"
import type { Stage3DecisionDeferralReason } from "@/lib/personal-plan/products/contracts"
import type { Stage3SelectedComparisonCandidate } from "@/lib/personal-plan/products/fit-comparison"
import type { Stage3DecisionReviewBundle } from "@/lib/personal-plan/products/production-persistence-gateway"
import type { RoutinePayloadV1 } from "@/lib/personal-plan/routine/contracts"

import type {
  Stage3RecomputeBlockedSubject,
  Stage3RecomputeIntentInput,
  Stage3RecomputeIntentPlan,
} from "./types"

type RoutineItem = RoutinePayloadV1["items"][number]

type PreferredAction = Exclude<Stage3AuthorityActionKind, "select_replacement">

/**
 * What the active routine says about the evaluated subject — the person's final
 * choice, after their own Routine edits (`routine/editor.ts` keeps `items` in
 * sync with the edited intent).
 */
type RoutineSubjectState =
  | { kind: "owned"; acknowledgedOverride: boolean }
  | { kind: "pending" }
  | { kind: "planned"; productId: string | null }
  | { kind: "uncovered" }
  | { kind: "absent" }

/**
 * Preservation order per preferred action. Every non-`select_replacement`
 * action must appear in the evaluation's `allowedActions`
 * (`production-persistence-gateway.ts`), so a preferred action the new
 * authority forbids walks to the next-best way of preserving the same choice
 * and ends at `leave_uncovered`.
 *
 * `keep_owned` ⇄ `acknowledge_override` are each other's fallback: the same
 * owned product, before and after the new verdict decided whether keeping it is
 * an override.
 */
const FALLBACK_CHAINS: Record<PreferredAction, readonly Stage3AuthorityActionKind[]> = {
  keep_owned: ["keep_owned", "acknowledge_override", "leave_uncovered"],
  acknowledge_override: ["acknowledge_override", "keep_owned", "leave_uncovered"],
  keep_pending: ["keep_pending", "leave_uncovered"],
  plan_recommendation: ["plan_recommendation", "leave_uncovered"],
  leave_uncovered: ["leave_uncovered"],
}

function routineItemsBySubjectKey(routine: RoutinePayloadV1): Map<string, RoutineItem> {
  const items = new Map<string, RoutineItem>()
  for (const item of routine.items) {
    for (const decisionKey of item.sourceDecisionKeys) {
      if (!items.has(decisionKey)) items.set(decisionKey, item)
    }
  }
  return items
}

function routineStateFor(item: RoutineItem | undefined): RoutineSubjectState {
  if (!item) return { kind: "absent" }
  // An excluded item is a role the person left out on purpose, whatever product
  // still hangs off it.
  if (item.state.inclusion === "excluded") return { kind: "uncovered" }
  switch (item.product.kind) {
    case "owned":
      return {
        kind: "owned",
        acknowledgedOverride: item.state.fitDecision === "informed_override",
      }
    case "pending_review":
      return { kind: "pending" }
    case "planned":
      return { kind: "planned", productId: item.product.productId }
    case "none":
      return { kind: "uncovered" }
  }
}

/** Exactly the shape `plan_recommendation` requires — mirrors `direct-acceptance/accept.ts`. */
function hasBuyableRecommendation(evaluation: Stage3AuthorityEvaluation): boolean {
  return (
    evaluation.status === "known" &&
    Boolean(evaluation.recommendation) &&
    Boolean(evaluation.recommendationFactFingerprint) &&
    evaluation.allowedActions.includes("plan_recommendation")
  )
}

function isPrimaryRecommendation(
  evaluation: Stage3AuthorityEvaluation,
  productId: string | null,
): boolean {
  return (
    productId !== null &&
    evaluation.status === "known" &&
    evaluation.recommendation?.productId === productId
  )
}

/**
 * The bundle is the only source of alternative candidates and their fact
 * fingerprints; `resolveDecisions` validates a `select_replacement` against
 * exactly this list. A candidate without a fingerprint cannot be selected.
 */
function replacementCandidateFor(
  bundles: Map<string, Stage3DecisionReviewBundle>,
  subjectKey: string,
  productId: string | null,
): Stage3SelectedComparisonCandidate | null {
  if (productId === null) return null
  const alternatives = bundles.get(subjectKey)?.fitComparison.alternatives ?? []
  const candidate = alternatives.find((alternative) => alternative.productId === productId)
  return candidate && candidate.factFingerprint ? candidate : null
}

/**
 * Maps a rehydrated Stage-3 draft's fresh evaluations onto the semantic intents
 * that re-express the person's existing plan against the new refined need.
 *
 * Pure and deterministic: the intents come out in evaluation order, nothing is
 * read outside the input, and no clock or randomness participates.
 *
 * Two rules the case map exists to protect:
 * - a product the person owns, planned or is waiting on is preserved as such
 *   wherever the new authority still permits it;
 * - a role the plan never had is never silently planned. It stays a visible gap
 *   with a deferral reason (founder ruling R5).
 *
 * Subjects the new authority permits no action on are returned as blocked
 * markers instead of intents, so the orchestrator can classify the whole
 * recompute rather than emit an action the gateway would reject.
 */
export function buildStage3RecomputeIntents(
  input: Stage3RecomputeIntentInput,
): Stage3RecomputeIntentPlan {
  const items = routineItemsBySubjectKey(input.routine)
  const bundles = new Map(
    input.reviewBundles.map((bundle) => [bundle.authorityEvaluation.subjectKey, bundle]),
  )
  const intents: Stage3AuthoritySemanticIntent[] = []
  const blocked: Stage3RecomputeBlockedSubject[] = []

  function resolve(
    evaluation: Stage3AuthorityEvaluation,
    preferred: PreferredAction,
    deferralReason?: Stage3DecisionDeferralReason,
  ) {
    const allowed = new Set<string>(evaluation.allowedActions)
    const action = FALLBACK_CHAINS[preferred].find((candidate) => allowed.has(candidate))
    if (!action) {
      blocked.push({ subjectKey: evaluation.subjectKey, blocked: "no_allowed_action" })
      return
    }
    intents.push({
      type: "resolve_decision",
      subjectKey: evaluation.subjectKey,
      action,
      // `deferralReason` is only legal together with `leave_uncovered`.
      ...(action === "leave_uncovered" && deferralReason ? { deferralReason } : {}),
    })
  }

  for (const evaluation of input.evaluations) {
    // An `unsupported` evaluation allows no action at all; the recompute as a
    // whole is unavailable rather than partially wrong.
    if (evaluation.status === "unsupported") {
      blocked.push({ subjectKey: evaluation.subjectKey, blocked: "unsupported" })
      continue
    }

    const state = routineStateFor(items.get(evaluation.subjectKey))
    switch (state.kind) {
      case "owned":
        resolve(evaluation, state.acknowledgedOverride ? "acknowledge_override" : "keep_owned")
        break
      case "pending":
        resolve(evaluation, "keep_pending")
        break
      case "planned": {
        if (
          isPrimaryRecommendation(evaluation, state.productId) &&
          evaluation.allowedActions.includes("plan_recommendation" as never)
        ) {
          resolve(evaluation, "plan_recommendation")
          break
        }
        // Also the second chance for a still-primary product the new authority
        // no longer lets us plan directly: as a candidate it keeps the purchase.
        const candidate = replacementCandidateFor(bundles, evaluation.subjectKey, state.productId)
        if (candidate) {
          // Exempt from the allowedActions check; validated against the bundle.
          intents.push({
            type: "resolve_decision",
            subjectKey: evaluation.subjectKey,
            action: "select_replacement",
            selectedCandidateId: candidate.productId,
            selectedCandidateFactFingerprint: candidate.factFingerprint,
          })
          break
        }
        // The planned product is gone from the catalog or lost its fingerprint.
        // Planning the new primary is allowed — the person already accepted a
        // planned purchase for this role — and a role that cannot be filled at
        // all is a genuine product gap.
        resolve(evaluation, "plan_recommendation", "no_product")
        break
      }
      case "uncovered":
        // Uncovered by the person's own choice: no deferral reason, exactly as
        // the existing plan reads today.
        resolve(evaluation, "leave_uncovered")
        break
      case "absent":
        resolve(
          evaluation,
          "leave_uncovered",
          hasBuyableRecommendation(evaluation) ? "unseen_recommendation" : "no_product",
        )
        break
    }
  }

  return { intents, blocked }
}
