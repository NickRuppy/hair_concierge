import { notFound } from "next/navigation"

import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import { deriveStage2TriggerContext } from "@/lib/personal-plan/refinement/stage1-adapter"
import { Stage2PreviewClient } from "@/app/labs/personal-plan-stage-2/preview-client"

import { STAGE1_STAGE2_LAB_ENVELOPE } from "./fixture"

export default function PersonalPlanStage1Stage2LabPage() {
  if (process.env.NODE_ENV !== "development") notFound()

  const result = computeNeedPlan({
    rawEnvelope: STAGE1_STAGE2_LAB_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-07T12:00:00.000Z",
  })
  if (result.status !== "ready") notFound()

  const triggerContext = deriveStage2TriggerContext(result.snapshot)

  return (
    <main>
      <aside
        className="mx-auto mt-4 w-[min(100%-2rem,42rem)] rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white"
        data-stage1-stage2-integration
      >
        <strong>Lokaler Integrationstest</strong>
        <span className="mt-1 block text-white/75">
          Stage 2 wird aus einem echten Stage-1-Plan mit {triggerContext.relevantCategories.length}{" "}
          sichtbaren Kategorien gestartet.
        </span>
      </aside>
      <Stage2PreviewClient scenario="ready" triggerContext={triggerContext} />
    </main>
  )
}
