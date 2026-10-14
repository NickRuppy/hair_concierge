import { notFound } from "next/navigation"

import {
  PORTFOLIO_PRESENTATION_RESOLVED,
  ROUTINE_VIEW_RESOLVED,
} from "@/app/labs/feinschliff-journey/fixtures"
import { STAGE1_STAGE2_LAB_ENVELOPE } from "@/app/labs/personal-plan-stage-1-2/fixture"
import { ApplicationDay } from "@/components/application/application-day"
import type { ApplicationDayView } from "@/components/application/application-types"
import { NeedPlanScreen } from "@/components/personal-plan-start/need-plan-screen"
import {
  adaptInitialNeedSnapshotToPlanStartViewModel,
  planStartHasOptionalPage,
} from "@/components/personal-plan-start/snapshot-adapter"
import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import { projectToolsForDay } from "@/lib/personal-plan/tools/application"
import {
  buildToolCheckpointGroups,
  toolCheckpointInventory,
} from "@/lib/personal-plan/tools/checkpoint"
import { buildToolView } from "@/lib/personal-plan/tools/read-view"

import { toolsLabCareFacts, toolsLabToolsDoneSession } from "./fixture"
import { ToolsLabCheckpoint, ToolsLabRefinementQuestion, ToolsLabRoutine } from "./tools-lab-client"

/**
 * Dev-only review harness for the Hair Tools journey (flag on).
 *
 * Renders the real production components on Lena's fixture (`fixture.ts`): Stage 1 with the
 * read-time Tool cards, the Feinschliff tool pages, the Tool-Checkpoint, the Routine's
 * `Deine Tools` and the Anwendung's wash-day tool blocks — all from `buildToolView` over one
 * fixture `care_habits` set, exactly as the read paths derive them. No DB, never reachable
 * outside local development.
 */

const SECTIONS = [
  ["stage1", "Stage 1 — Plan Basis (Tool-Karten)"],
  ["stage1-optional", "Stage 1 — Plan Optional"],
  ["stage2-overview", "Feinschliff — Was hast du schon?"],
  ["stage2-forms", "Feinschliff — Bürsten & Kämme"],
  ["checkpoint", "Tool-Checkpoint — Das hast du schon"],
  ["routine", "Routine — Deine Tools"],
  ["anwendung", "Anwendung — Waschtag (nur Tool-Schritte)"],
] as const

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
    createdAt: "2026-10-10T12:00:00.000Z",
  })
  if (computed.status !== "ready") notFound()

  const facts = toolsLabCareFacts()
  const stage1View = buildToolView({
    ...facts,
    needSnapshot: computed.snapshot,
    routine: null,
    hasOptionalPage: planStartHasOptionalPage(computed.snapshot),
    toolsEnabled: true,
  })
  const routineView = buildToolView({
    ...facts,
    needSnapshot: computed.snapshot,
    routine: ROUTINE_VIEW_RESOLVED.activeVersion!.payload,
    hasOptionalPage: false,
    toolsEnabled: true,
  })
  if (!stage1View || !routineView) notFound()

  if (section === "stage1" || section === "stage1-optional") {
    const plan = adaptInitialNeedSnapshotToPlanStartViewModel(
      { ...computed.snapshot, stage1ToolCards: stage1View.stage1Cards },
      { toolsEnabled: true },
    )
    if (!plan) notFound()
    if (section === "stage1-optional" && plan.optional) {
      return <NeedPlanScreen screen={plan.optional} hasOptionalPage />
    }
    return <NeedPlanScreen screen={plan.basis} hasOptionalPage={Boolean(plan.optional)} />
  }

  const toolsDone = toolsLabToolsDoneSession()
  if (section === "stage2-overview" || section === "stage2-forms") {
    return (
      <ToolsLabRefinementQuestion
        session={toolsDone}
        questionId={section === "stage2-overview" ? "tools_overview" : "tools:brushes_combs:1"}
      />
    )
  }
  if (section === "checkpoint") {
    return (
      <ToolsLabCheckpoint groups={buildToolCheckpointGroups(toolCheckpointInventory(toolsDone))} />
    )
  }
  if (section === "routine") {
    return (
      <ToolsLabRoutine
        view={{
          ...ROUTINE_VIEW_RESOLVED,
          ...(routineView.routineSection ? { toolSection: routineView.routineSection } : {}),
        }}
        portfolioPresentation={PORTFOLIO_PRESENTATION_RESOLVED}
      />
    )
  }
  if (section === "anwendung") {
    const projection = projectToolsForDay({
      dayType: "wash_day",
      ...routineView.applicationGuidance,
    })
    const day: ApplicationDayView = {
      dayType: "wash_day",
      sortOrder: 10,
      labelDe: "Waschtag",
      summaryDe: "Waschen, sanft trocknen und stylen.",
      cadenceDe: "Bei deiner nächsten Haarwäsche",
      steps: [
        ...projection.sections,
        ...projection.transitions.map((transition) => ({
          kind: "transition" as const,
          stepKey: transition.stepKey,
          copyDe: transition.copyDe,
        })),
      ],
      isPartial: false,
      provisionalProductCount: 0,
      unresolvedProductCount: 0,
      shelf: projection.shelf,
    }
    return <ApplicationDay day={day} overviewHref="/labs/personal-plan-tools" />
  }

  return (
    <main className="mx-auto max-w-[560px] px-5 py-10">
      <h1 className="font-header text-2xl text-[#291a43]">Hair Tools — Review-Harness</h1>
      <p className="mt-2 text-sm text-[#706a65]">Nur lokal. Öffne einen Abschnitt:</p>
      <ul className="mt-4 space-y-2 text-sm">
        {SECTIONS.map(([key, label]) => (
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
