import type { RoutinePayloadV1 } from "../routine/contracts"
import type { InitialNeedPlanSnapshot, PlanCategoryDecision } from "../types"
import { toolAnswersFromCareHabits } from "@/lib/user-facts/known-care-answers"
import type { CareHabitsV1, FieldProvenanceValue } from "@/lib/user-facts/schema"

import { buildToolPlan } from "./assets"
import type {
  PlanToolPlan,
  PlanToolRoute,
  ToolAsset,
  ToolGuidance,
  ToolOccurrence,
} from "./contracts"
import {
  projectToolCareFacts,
  reportedToolInventoryFromFacts,
  type ToolCareFacts,
  type ToolCareProvenance,
} from "./facts"
import {
  buildStage1ToolBlocks,
  type ToolBlockViewModel,
  type ToolCardViewModel,
} from "./presentation"
import { computeToolRoutes, toolProfileFactsFromPlanProfile } from "./routes"

/**
 * Read-time Hair Tools view (plan `plans/2026-10-09-hair-tools-port.md` §4 „Read-time tool
 * view"). Tool content is DERIVED on every read from the member's current facts and the plan
 * they are looking at — it is never stored in a need snapshot or a routine version. One pure
 * function feeds all three surfaces, so Stage 1, Routine and Anwendung can never disagree.
 */

/** The slice of a need snapshot the Tool engine reads: the profile and the category decisions. */
export type ToolViewNeedSnapshot = Pick<InitialNeedPlanSnapshot, "profile" | "decisions">

export type BuildToolViewInput = {
  careHabits: Partial<CareHabitsV1> | null
  fieldProvenance: Record<string, FieldProvenanceValue> | undefined
  needSnapshot: ToolViewNeedSnapshot
  /** The active (or proposed) Routine the member is looking at; `null` before a Routine exists. */
  routine: RoutinePayloadV1 | null
  /** Stage 1 only: whether the Idealplan has an Optional page to put optional Tools on. */
  hasOptionalPage: boolean
  /** The server-resolved rollout. Anything but `true` yields no view at all. */
  toolsEnabled: boolean | undefined
}

/** A Stage-1 Tool card, marked when its „Nutze deins" rests only on a behaviour projection. */
export type Stage1ToolCard = ToolCardViewModel & { derived?: true }
export type Stage1ToolBlock = Omit<ToolBlockViewModel, "cards"> & { cards: Stage1ToolCard[] }
export type Stage1ToolCards = { basis: Stage1ToolBlock | null; optional: Stage1ToolBlock | null }

/**
 * `Deine Tools` on the Routine page: one row per physical Tool. `derivedAssetKeys` names the
 * rows whose „Nutze deins" rests only on a behaviour projection („du föhnst" ⇒ a Föhn), never on
 * something the member named (`D4`).
 */
export type ToolRoutineSection = { assets: ToolAsset[]; derivedAssetKeys: string[] }

/**
 * What the Anwendung (Task 9) feeds `projectToolsForDay` per day: the assets, their dated
 * occurrences on the shared day graph, and the behaviour-only guidance lines.
 */
export type ToolApplicationGuidance = {
  assets: ToolAsset[]
  occurrences: ToolOccurrence[]
  guidance: ToolGuidance[]
}

export type ToolView = {
  stage1Cards: Stage1ToolCards
  /** `null` when the plan holds no Tool asset — the Routine then renders no section. */
  routineSection: ToolRoutineSection | null
  applicationGuidance: ToolApplicationGuidance
}

export function buildToolView(input: BuildToolViewInput): ToolView | null {
  if (input.toolsEnabled !== true) return null
  const plan = buildToolPlan({
    routes: computeToolRoutes({
      profile: toolProfileFactsFromPlanProfile(input.needSnapshot.profile),
      care: toolCareFactsFromFacts(input.careHabits, input.fieldProvenance),
      // D5: only pages the member answered herself count as owned (assumed/derived never do).
      inventory: reportedToolInventoryFromFacts(input.careHabits, input.fieldProvenance),
      scalpApplicationJob: input.routine
        ? scalpApplicationJobFromRoutine(input.routine)
        : scalpApplicationJobFromDecisions(input.needSnapshot.decisions),
    }),
  })
  const derived = derivedAssetKeys(plan)
  const blocks = buildStage1ToolBlocks(plan, { hasOptionalPage: input.hasOptionalPage })
  return {
    stage1Cards: {
      basis: markDerived(blocks.basis, derived),
      optional: markDerived(blocks.optional, derived),
    },
    routineSection:
      plan.assets.length > 0
        ? {
            assets: plan.assets,
            derivedAssetKeys: plan.assets
              .map((asset) => asset.assetKey)
              .filter((key) => derived.has(key)),
          }
        : null,
    applicationGuidance: {
      assets: plan.assets,
      occurrences: plan.occurrences,
      guidance: plan.guidance,
    },
  }
}

/** The member's stored facts the view reads: `care_habits` and its per-field provenance. */
export type ToolFactsSource = {
  careHabits: Partial<CareHabitsV1> | null
  fieldProvenance: Record<string, FieldProvenanceValue> | undefined
}

/**
 * A stored need snapshot (JSON) as the slice the engine reads, or `null` when it does not carry
 * the profile and decisions the engine needs — the caller then shows no Tools rather than
 * guessing.
 */
export function asToolViewNeedSnapshot(value: unknown): ToolViewNeedSnapshot | null {
  if (!isRecord(value) || !isRecord(value.profile) || !Array.isArray(value.decisions)) return null
  const { hair, goals, concerns, routine } = value.profile
  if (!isRecord(hair) || !isRecord(routine)) return null
  if (
    typeof hair.texture !== "string" ||
    typeof hair.thickness !== "string" ||
    typeof hair.length !== "string" ||
    !isStringArray(goals) ||
    !isStringArray(concerns) ||
    !isStringArray(routine.mechanicalExposureSignals)
  ) {
    return null
  }
  if (
    !value.decisions.every(
      (decision) =>
        isRecord(decision) &&
        typeof decision.category === "string" &&
        isStringArray(decision.roles),
    )
  ) {
    return null
  }
  return value as unknown as ToolViewNeedSnapshot
}

/**
 * Server side of Stage 1: the snapshot handed to the Idealplan adapter, carrying the read-time
 * Tool cards as the presentation-only `stage1ToolCards`. The stored snapshot is never touched;
 * any failure returns it undecorated, so a Tool problem can never take down the Idealplan.
 */
export function withStage1ToolCards(
  snapshot: unknown,
  input: { facts: ToolFactsSource | null; hasOptionalPage: boolean },
): unknown {
  const needSnapshot = asToolViewNeedSnapshot(snapshot)
  if (!needSnapshot || !input.facts) return snapshot
  try {
    const view = buildToolView({
      careHabits: input.facts.careHabits,
      fieldProvenance: input.facts.fieldProvenance,
      needSnapshot,
      routine: null,
      hasOptionalPage: input.hasOptionalPage,
      toolsEnabled: true,
    })
    if (!view || (!view.stage1Cards.basis && !view.stage1Cards.optional)) return snapshot
    return { ...(snapshot as Record<string, unknown>), stage1ToolCards: view.stage1Cards }
  } catch {
    return snapshot
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
}

/** The care fields the Tool engine reads (`ToolCareFacts`), by their `care_habits` key. */
const TOOL_CARE_FACT_FIELDS = [
  "dryingRoutes",
  "additionalHeatTools",
  "towel",
  "nightProtection",
  "heatEvents",
] as const

/**
 * The stored care facts as the engine's `ToolCareFacts`.
 *
 * The engine carries one provenance for the whole care slice. It is `reported` only when every
 * care fact present is the member's own (`user`); a single `assumed` (direct acceptance) or
 * `unknown_historical` (backfill — nothing provable) fact makes the slice `assumed`, which still
 * shapes the routes but never claims ownership or explicit absence (`D5`). Conservative on
 * purpose: the member's answered Tool pages carry her ownership on their own.
 */
export function toolCareFactsFromFacts(
  careHabits: Partial<CareHabitsV1> | null,
  fieldProvenance: Record<string, FieldProvenanceValue> | undefined,
): ToolCareFacts {
  const answers = careHabits ? toolAnswersFromCareHabits(careHabits as CareHabitsV1) : undefined
  const present = TOOL_CARE_FACT_FIELDS.filter((field) => careHabits?.[field] !== undefined)
  const provenance: ToolCareProvenance = present.every(
    (field) => fieldProvenance?.[field] === "user",
  )
    ? "reported"
    : "assumed"
  return projectToolCareFacts(answers, provenance)
}

/** Only a real applied scalp role creates a controlled-placement Tool job (Applikator). */
const SCALP_APPLICATION_ROLES = new Set<string>([
  "scalp_comfort",
  "scalp_exfoliant",
  "density_claim_tonic",
])

/** Before a Routine exists: the need snapshot's scalp-care decision. */
export function scalpApplicationJobFromDecisions(
  decisions: readonly Pick<PlanCategoryDecision, "category" | "needTier" | "roles">[],
): boolean {
  const scalpCare = decisions.find((decision) => decision.category === "scalp_care")
  if (!scalpCare || scalpCare.needTier === "not_needed" || scalpCare.needTier === null) return false
  return scalpCare.roles.some((role) => SCALP_APPLICATION_ROLES.has(role))
}

/** With a Routine: an included scalp-care item in an applied role. */
export function scalpApplicationJobFromRoutine(routine: Pick<RoutinePayloadV1, "items">): boolean {
  return routine.items.some(
    (item) =>
      item.category === "scalp_care" &&
      item.state.inclusion === "included" &&
      SCALP_APPLICATION_ROLES.has(item.role),
  )
}

/**
 * Assets whose „Nutze deins" rests only on derived evidence: no route the asset serves carries a
 * `reported` ownership of its lead form.
 */
function derivedAssetKeys(plan: PlanToolPlan): Set<string> {
  const routesByKey = new Map(plan.routes.map((route) => [route.routeKey, route]))
  const keys = new Set<string>()
  for (const asset of plan.assets) {
    if (asset.presentationState !== "use_yours") continue
    const lead = asset.productTypes[0]
    const routes = asset.routeKeys
      .map((key) => routesByKey.get(key))
      .filter((route): route is PlanToolRoute => Boolean(route))
    const reported = routes.some(
      (route) =>
        route.reportedOwnership.provenance === "reported" &&
        route.reportedOwnership.forms.includes(lead),
    )
    if (!reported) keys.add(asset.assetKey)
  }
  return keys
}

function markDerived(
  block: ToolBlockViewModel | null,
  derived: ReadonlySet<string>,
): Stage1ToolBlock | null {
  if (!block) return null
  return {
    ...block,
    cards: block.cards.map((card) =>
      card.state === "use_yours" && derived.has(card.id) ? { ...card, derived: true } : card,
    ),
  }
}
