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

/**
 * What the active routine says about the evaluated subject — the person's final
 * choice, after their own Routine edits (`routine/editor.ts` keeps `items` in
 * sync with the edited intent).
 *
 * An uncovered subject keeps the product that still hangs off its item, because
 * the fallback chain may have to fall back onto preserving it.
 */
type RoutineSubjectState =
  | { kind: "owned"; acknowledgedOverride: boolean }
  | { kind: "pending" }
  | { kind: "planned"; productId: string | null }
  | { kind: "uncovered"; source: "user" | "system"; product: "owned" | "pending" | "none" }
  | { kind: "absent" }

/**
 * Preservation order. Every non-`select_replacement` action must appear in the
 * evaluation's `allowedActions` (`production-persistence-gateway.ts:1164`), and
 * the real category authorities routinely allow exactly ONE action — an `ideal`
 * owned product allows only `keep_owned`, a `mismatch` one only
 * `acknowledge_override` (`authority/categories/mask.ts:316`,
 * `categories/shampoo.ts:248`). So every chain must keep walking rather than
 * assume `leave_uncovered` is always available.
 *
 * `keep_owned` ⇄ `acknowledge_override` are each other's fallback: the same
 * owned product, before and after the new verdict decided whether keeping it is
 * an override.
 */
const KEEP_OWNED_CHAIN = ["keep_owned", "acknowledge_override", "leave_uncovered"] as const
const ACKNOWLEDGE_OVERRIDE_CHAIN = [
  "acknowledge_override",
  "keep_owned",
  "leave_uncovered",
] as const
const KEEP_PENDING_CHAIN = ["keep_pending", "leave_uncovered"] as const
const PLAN_RECOMMENDATION_CHAIN = ["plan_recommendation", "leave_uncovered"] as const
const LEAVE_UNCOVERED_CHAIN = ["leave_uncovered"] as const
/**
 * Leaving the role uncovered is the person's choice, but a category authority
 * that permits nothing else would otherwise block the whole recompute. Plan
 * decision 12 (manual routine edits may be lost on recompute) makes preserving
 * the underlying product the better loss than a failed pass.
 */
const UNCOVERED_OWNED_CHAIN = ["leave_uncovered", "keep_owned", "acknowledge_override"] as const
const UNCOVERED_PENDING_CHAIN = ["leave_uncovered", "keep_pending"] as const

function routineItemsBySubjectKey(routine: RoutinePayloadV1): Map<string, RoutineItem> {
  const items = new Map<string, RoutineItem>()
  for (const item of routine.items) {
    for (const decisionKey of item.sourceDecisionKeys) {
      if (!items.has(decisionKey)) items.set(decisionKey, item)
    }
  }
  return items
}

/**
 * Who excluded the role.
 *
 * The compiler flattens both causes onto the same `inclusion: "excluded"` item:
 * a Stage-3 `leave_uncovered` decision (with its deferral reason) and a
 * person's own category exclusion. Only `intent.categories[].inclusionSource`
 * separates them (`routine/contracts.ts:58`): `"user"` is the person's edit,
 * `"stage3"` is the system's own deferral. An item excluded inside a category
 * that is still included can only be a Stage-3 deferral.
 *
 * A category missing from the intent (never true for compiler output) is read
 * as the person's own exclusion — the conservative side, since a system
 * deferral re-derives a reason whose copy nudges back into the Produkte module.
 */
function exclusionSourceFor(routine: RoutinePayloadV1, item: RoutineItem): "user" | "system" {
  const category = routine.intent.categories.find(
    (candidate) => candidate.category === item.category,
  )
  if (!category) return "user"
  if (category.inclusion === "included") return "system"
  return category.inclusionSource === "user" ? "user" : "system"
}

function routineStateFor(
  routine: RoutinePayloadV1,
  item: RoutineItem | undefined,
): RoutineSubjectState {
  if (!item) return { kind: "absent" }
  const product =
    item.product.kind === "owned"
      ? ("owned" as const)
      : item.product.kind === "pending_review"
        ? ("pending" as const)
        : ("none" as const)
  if (item.state.inclusion === "excluded") {
    return { kind: "uncovered", source: exclusionSourceFor(routine, item), product }
  }
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
      return { kind: "uncovered", source: exclusionSourceFor(routine, item), product }
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

/**
 * The reason a role the person never chose a product for is left uncovered.
 * A buyable recommendation exists but was never seen, so it may not be planned
 * on their behalf (founder ruling R5) — it becomes a visible, linked gap.
 */
function deferralReasonFor(evaluation: Stage3AuthorityEvaluation): Stage3DecisionDeferralReason {
  return hasBuyableRecommendation(evaluation) ? "unseen_recommendation" : "no_product"
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
 *
 * Only a `known` evaluation may be replaced: the gateway does not re-check the
 * status for `select_replacement`, so refusing here is what keeps a decision
 * from being written against a verdict the authority never established.
 */
function replacementCandidateFor(
  bundles: Map<string, Stage3DecisionReviewBundle>,
  evaluation: Stage3AuthorityEvaluation,
  productId: string | null,
): Stage3SelectedComparisonCandidate | null {
  if (productId === null || evaluation.status !== "known") return null
  const alternatives = bundles.get(evaluation.subjectKey)?.fitComparison.alternatives ?? []
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
 * - a product the person never saw is never planned for them. An unseen
 *   recommendation stays a visible gap (founder ruling R5).
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
    chain: readonly Stage3AuthorityActionKind[],
    deferralReason?: Stage3DecisionDeferralReason,
  ) {
    const allowed = new Set<string>(evaluation.allowedActions)
    const action = chain.find((candidate) => allowed.has(candidate))
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

    const state = routineStateFor(input.routine, items.get(evaluation.subjectKey))
    switch (state.kind) {
      case "owned":
        resolve(
          evaluation,
          state.acknowledgedOverride ? ACKNOWLEDGE_OVERRIDE_CHAIN : KEEP_OWNED_CHAIN,
        )
        break
      case "pending":
        resolve(evaluation, KEEP_PENDING_CHAIN)
        break
      case "planned": {
        // The planned product is still the one the plan recommends: the person
        // saw and accepted exactly it, so re-planning it is not a silent buy.
        if (
          isPrimaryRecommendation(evaluation, state.productId) &&
          hasBuyableRecommendation(evaluation)
        ) {
          resolve(evaluation, PLAN_RECOMMENDATION_CHAIN)
          break
        }
        // Second chance for that same seen product: as a bundle candidate it
        // survives even when the authority no longer lets us plan it directly.
        const candidate = replacementCandidateFor(bundles, evaluation, state.productId)
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
        // Whatever the engine would put there now is a product the person has
        // never seen, so the role becomes a visible gap instead (R5).
        resolve(evaluation, LEAVE_UNCOVERED_CHAIN, deferralReasonFor(evaluation))
        break
      }
      case "uncovered":
        resolve(
          evaluation,
          state.product === "owned"
            ? UNCOVERED_OWNED_CHAIN
            : state.product === "pending"
              ? UNCOVERED_PENDING_CHAIN
              : LEAVE_UNCOVERED_CHAIN,
          // The person's own exclusion carries no reason, exactly as the plan
          // reads today. A role Stage 3 itself deferred re-derives one: the old
          // reason belongs to the old authority.
          state.source === "user" ? undefined : deferralReasonFor(evaluation),
        )
        break
      case "absent":
        resolve(evaluation, LEAVE_UNCOVERED_CHAIN, deferralReasonFor(evaluation))
        break
    }
  }

  return { intents, blocked }
}
