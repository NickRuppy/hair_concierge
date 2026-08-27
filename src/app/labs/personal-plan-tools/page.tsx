import { notFound } from "next/navigation"

import { ApplicationDay } from "@/components/application/application-day"
import type { ApplicationDayView } from "@/components/application/application-types"
import { NeedPlanScreen } from "@/components/personal-plan-start/need-plan-screen"
import { adaptInitialNeedSnapshotToPlanStartViewModel } from "@/components/personal-plan-start/snapshot-adapter"
import { ToolsLabCheckpoint, ToolsLabRefinementQuestion, ToolsLabRoutine } from "./tools-lab-client"
import { STAGE1_STAGE2_LAB_ENVELOPE } from "@/app/labs/personal-plan-stage-1-2/fixture"
import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import { createStage2RefinementSession } from "@/lib/personal-plan/refinement/session"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2QuestionId,
} from "@/lib/personal-plan/refinement/types"
import { routinePayloadSchema } from "@/lib/personal-plan/routine/contracts"
import { projectToolsForDay } from "@/lib/personal-plan/tools/application"
import { buildToolPlan } from "@/lib/personal-plan/tools/assets"
import { projectToolCareFacts } from "@/lib/personal-plan/tools/facts"
import { buildStage1ToolBlocks } from "@/lib/personal-plan/tools/presentation"
import {
  computeToolRoutes,
  toolProfileFactsFromPlanProfile,
} from "@/lib/personal-plan/tools/routes"

/**
 * Dev-only review harness for the Hair Tools journey.
 *
 * It renders the real production components at whatever viewport the reviewer
 * opens, so Stage 1 → Feinschliff → Produkte → Routine → Anwendung can be
 * checked in one pass. It is never reachable outside local development.
 */

const REFINEMENT_ANSWERS: PersonalPlanRefinementAnswersV1 = {
  currentProductCategories: [],
  wetWashFrequency: "weekly_2x",
  towel: { material: "frottee", technique: "rough_rubbing" },
  dryingRoutes: ["diffuser_or_airflow_shaping"],
  additionalHeatTools: ["straightener"],
  heatEvents: {
    "heat:diffuser_airflow_shaping": { frequency: "weekly_2x" },
    "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "sometimes" },
  },
  nightProtection: [],
  toolFamiliesWithSomething: ["brushes_combs", "securing_sectioning", "drying_textiles"],
  toolForms: {
    brushes_combs: ["wide_tooth_comb"],
    securing_sectioning: [],
    airflow: [],
    heated_styling: [],
    heatless_styling: [],
    wash_application: [],
    night_protection: [],
  },
}

const COMPLETED_CARE_QUESTIONS: Stage2QuestionId[] = [
  "current_product_categories",
  "wet_wash_frequency",
  "towel_handling",
  "drying_routes",
  "additional_heat_tools",
  "heat:diffuser_airflow_shaping",
  "heat:straightener",
  "night_protection",
]

export default async function PersonalPlanToolsLabPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>
}) {
  if (process.env.NODE_ENV !== "development") notFound()
  const { section } = await searchParams

  const computed = computeNeedPlan({
    rawEnvelope: STAGE1_STAGE2_LAB_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-21T12:00:00.000Z",
    tools: { care: projectToolCareFacts(undefined), inventory: {} },
  })
  if (computed.status !== "ready") notFound()
  const plan = adaptInitialNeedSnapshotToPlanStartViewModel(computed.snapshot, {
    toolsEnabled: true,
  })
  if (!plan) notFound()

  const care = projectToolCareFacts(REFINEMENT_ANSWERS)
  const inventory = { ...(REFINEMENT_ANSWERS.toolForms ?? {}) }
  const refinedRoutes = computeToolRoutes({
    profile: toolProfileFactsFromPlanProfile(computed.snapshot.profile),
    care,
    inventory,
    scalpApplicationJob: false,
  })
  const refinedToolPlan = buildToolPlan({ routes: refinedRoutes })
  const checkpointCards =
    buildStage1ToolBlocks(refinedToolPlan, { hasOptionalPage: false }).basis?.cards ?? []

  const session = createStage2RefinementSession({
    pathVersion: "lab",
    triggerContext: {
      relevantCategories: [...computed.snapshot.renderedOrder],
      hasReportedIrritatedScalp: false,
      dryShampooBridgeEligibility: "ineligible",
      toolsEnabled: true,
    },
    answers: REFINEMENT_ANSWERS,
    completedQuestionIds: COMPLETED_CARE_QUESTIONS,
  })

  const routinePayload = routinePayloadSchema.parse({
    schemaVersion: 2,
    planId: "20000000-0000-4000-8000-000000000001",
    versionId: "routine-lab",
    parentVersionId: null,
    source: {
      refinedVersionId: "30000000-0000-4000-8000-000000000001",
      productPortfolioVersionId: "portfolio-lab",
      sourceFingerprint: "b".repeat(64),
      compilerVersion: "personal-plan-routine-compiler.v2",
      authorityVersions: { routine: "personal-plan-routine-compiler.v2" },
      renderedOrder: [],
    },
    intent: { schemaVersion: 1, categories: [] },
    sections: [
      { key: "basis", itemKeys: [] },
      { key: "optional", itemKeys: [] },
    ],
    items: [],
    createdAt: "2026-08-21T12:00:00.000Z",
    toolAssets: refinedToolPlan.assets,
    toolOccurrences: refinedToolPlan.occurrences,
    toolGuidance: refinedToolPlan.guidance,
  })

  const dayProjection = projectToolsForDay({
    dayType: "wash_day",
    assets: refinedToolPlan.assets,
    occurrences: refinedToolPlan.occurrences,
    guidance: refinedToolPlan.guidance,
  })
  const day: ApplicationDayView = {
    dayType: "wash_day",
    sortOrder: 10,
    labelDe: "Waschtag",
    summaryDe: "Waschen, sanft trocknen und stylen.",
    cadenceDe: "Bei deiner nächsten Haarwäsche",
    // Same ordering rule the production view adapter applies.
    steps: [
      ...dayProjection.sections,
      ...dayProjection.transitions.map((transition) => ({
        kind: "transition" as const,
        stepKey: transition.stepKey,
        copyDe: transition.copyDe,
      })),
    ],
    isPartial: false,
    provisionalProductCount: 0,
    unresolvedProductCount: 0,
    shelf: dayProjection.shelf,
  }

  if (section === "stage1") {
    return <NeedPlanScreen screen={plan.basis} hasOptionalPage={Boolean(plan.optional)} />
  }
  if (section === "stage1-optional" && plan.optional) {
    return <NeedPlanScreen screen={plan.optional} hasOptionalPage />
  }
  if (section === "stage2-overview" || section === "stage2-forms") {
    return (
      <ToolsLabRefinementQuestion
        session={session}
        questionId={section === "stage2-overview" ? "tools_overview" : "tools:brushes_combs:1"}
      />
    )
  }
  if (section === "stage3") {
    return <ToolsLabCheckpoint cards={checkpointCards} />
  }
  if (section === "stage4") {
    return (
      <ToolsLabRoutine
        view={{
          status: "active",
          personalPlanId: "20000000-0000-4000-8000-000000000001",
          planRevision: 1,
          sourceRevision: 1,
          activeVersion: { id: "routine-lab", payload: routinePayload },
          pendingProposal: null,
          productPresentation: { catalogProducts: [] },
        }}
      />
    )
  }
  if (section === "stage5") {
    return <ApplicationDay day={day} />
  }

  return (
    <main className="mx-auto max-w-[560px] px-5 py-10">
      <h1 className="font-header text-2xl text-[#291a43]">Hair Tools — Review-Harness</h1>
      <p className="mt-2 text-sm text-[#706a65]">Nur lokal. Öffne einen Abschnitt:</p>
      <ul className="mt-4 space-y-2 text-sm">
        {[
          ["stage1", "Stage 1 — Idealplan Basis"],
          ["stage1-optional", "Stage 1 — Idealplan Optional"],
          ["stage2-overview", "Feinschliff — vier Abschnitte"],
          ["stage2-forms", "Feinschliff — Produktarten"],
          ["stage3", "Produkte — Tool-Checkpoint"],
          ["stage4", "Routine — Deine Tools"],
          ["stage5", "Anwendung — Waschtag"],
        ].map(([key, label]) => (
          <li key={key}>
            <a
              className="text-[#6B50A0] underline"
              href={`/labs/personal-plan-tools?section=${key}`}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </main>
  )
}
