"use client"

import { useCallback, useState } from "react"

import { Stage2PreviewClient } from "@/app/labs/personal-plan-stage-2/preview-client"
import type { Stage2HandoffPayload } from "@/components/personal-plan-refinement/refinement-flow"
import { Stage3ProductsFlow } from "@/components/personal-plan-products/stage3-products-flow"
import type { Stage3EntryContext } from "@/lib/personal-plan/products/contracts"
import { developmentStage3Analytics } from "@/lib/personal-plan/products/stage3-development-analytics"
import type { Stage2TriggerContext } from "@/lib/personal-plan/refinement/types"

import { prepareStage3EntryContextAction } from "./actions"

export function PersonalPlanStage1To3JourneyClient({
  triggerContext,
}: {
  triggerContext: Stage2TriggerContext
}) {
  const [entryContext, setEntryContext] = useState<Stage3EntryContext | null>(null)

  const handleHandoff = useCallback(async (payload: Stage2HandoffPayload) => {
    const nextEntryContext = await prepareStage3EntryContextAction(payload)
    setEntryContext(nextEntryContext)
  }, [])

  return (
    <div data-personal-plan-stage1-to-3>
      <div hidden={entryContext !== null} aria-hidden={entryContext !== null || undefined}>
        <Stage2PreviewClient
          scenario="ready"
          triggerContext={triggerContext}
          onHandoff={handleHandoff}
        />
      </div>
      {entryContext ? (
        <div data-stage3-entry-refined-version-id={entryContext.refinedVersionId}>
          <Stage3ProductsFlow
            key={entryContext.refinedVersionId}
            entryContext={entryContext}
            draftId={`fixture-stage3-${entryContext.refinedVersionId}`}
            userId="fixture-user"
            analytics={developmentStage3Analytics}
            onBackToRefinement={() => setEntryContext(null)}
          />
        </div>
      ) : null}
    </div>
  )
}
