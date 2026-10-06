import { buildBondbuilderDecision } from "./categories/bondbuilder"
import { buildConditionerDecision } from "./categories/conditioner"
import { computeDeepCleansingDecision } from "./categories/deep-cleansing"
import { computeDryShampooDecision } from "./categories/dry-shampoo"
import { computeHeatProtectantDecision } from "./categories/heat-protectant"
import { buildLeaveInDecision } from "./categories/leave-in"
import { buildMaskDecision } from "./categories/mask"
import { buildOilDecision } from "./categories/oil"
import { computeScalpCareDecision } from "./categories/scalp-care"
import { computeShampooDecision } from "./categories/shampoo"
import {
  buildPlanProfile,
  hashSupportedPersonalPlanQuizEnvelope,
  parseSupportedStage1Source,
} from "./input"
import { buildPlanNeedAssessment } from "./needs"
import { composeStage1Portfolio } from "./portfolio"
import {
  STAGE1_CATEGORY_ORDER,
  type InitialNeedPlanSnapshot,
  type PlanCategoryDecision,
  type PlanMissingFactId,
  type PlanRoutineContext,
} from "./types"

type ComputeNeedPlanInput = {
  rawEnvelope: unknown
  artifactId: string
  projection: "initial_quiz" | "refined_post_plan"
  computationVersion: string
  createdAt: string
  routine?: PlanRoutineContext
}

export type ComputeNeedPlanResult =
  | { status: "ready"; snapshot: InitialNeedPlanSnapshot }
  | {
      status: "needs_clarification"
      missingFacts: ["shampoo_frequency"]
    }
  | {
      status: "incomplete_input"
      error: {
        code: "invalid_quiz_envelope" | "unsupported_quiz_version"
        quizVersion: number | null
      }
    }

function collectDeferredFacts(decisions: readonly PlanCategoryDecision[]): PlanMissingFactId[] {
  const found = new Set<PlanMissingFactId>()
  for (const category of STAGE1_CATEGORY_ORDER) {
    const decision = decisions.find((candidate) => candidate.category === category)
    for (const fact of decision?.deferredFacts ?? []) found.add(fact)
  }
  return [...found].sort()
}

function renderedOrder(decisions: readonly PlanCategoryDecision[]) {
  const visible = new Set(
    decisions
      .filter((decision) => decision.needTier === "basis" || decision.needTier === "optional")
      .map((decision) => decision.category),
  )
  return STAGE1_CATEGORY_ORDER.filter((category) => visible.has(category))
}

export function computeNeedPlan(input: ComputeNeedPlanInput): ComputeNeedPlanResult {
  const parsed = parseSupportedStage1Source(input.rawEnvelope)
  if (!parsed.ok) return { status: "incomplete_input", error: parsed.error }

  const profile = buildPlanProfile(parsed.source, {
    artifactId: input.artifactId,
    projection: input.projection,
    routine: input.routine,
  })
  if (
    input.projection === "refined_post_plan" &&
    profile.routine.shampooFrequency.state === "unknown"
  ) {
    return { status: "needs_clarification", missingFacts: ["shampoo_frequency"] }
  }
  const assessments = buildPlanNeedAssessment(profile)
  const localDecisions: PlanCategoryDecision[] = [
    computeShampooDecision(profile, assessments),
    buildConditionerDecision(profile, assessments),
    buildLeaveInDecision(profile, assessments),
    computeHeatProtectantDecision(profile, assessments),
    buildOilDecision(profile, assessments),
    buildMaskDecision(profile, assessments.damage),
    computeScalpCareDecision(profile, assessments),
    computeDryShampooDecision(profile, assessments),
    buildBondbuilderDecision(profile, assessments.damage),
    computeDeepCleansingDecision(profile, assessments),
  ]
  const { decisions, coverage } = composeStage1Portfolio(profile, localDecisions)

  return {
    status: "ready",
    snapshot: {
      schemaVersion: 1,
      snapshotKind: "initial_need",
      computationVersion: input.computationVersion,
      inputHash: hashSupportedPersonalPlanQuizEnvelope(parsed.source),
      createdAt: input.createdAt,
      sourceQuiz: parsed.source,
      profile,
      assessments,
      decisions,
      coverage,
      // Exact-product previews are a frozen selector boundary. Stage 1 exposes the
      // typed slot, while Stage 2 owns catalog fit and selection.
      productPreviews: [],
      renderedOrder: renderedOrder(decisions),
      deferredFacts: collectDeferredFacts(decisions),
    },
  }
}
