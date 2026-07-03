import { appendResearchArtifact, buildPublishPreflight } from "@chaarlie/product-intake-core"
import { NextResponse } from "next/server"

import {
  loadSubmission,
  validateSubmissionReady,
} from "../../../../../../../scripts/product-intake/review-actions"
import { assertLocalServiceRoute, createServiceClient } from "../../../_lib/service-client"

type PreflightParams = {
  params: Promise<{ submissionId: string }>
}

export async function POST(request: Request, { params }: PreflightParams) {
  const { submissionId } = await params

  try {
    assertLocalServiceRoute(request)
    const client = createServiceClient()
    const preflight = await buildPublishPreflight(client, submissionId, {
      publishRouteEnabled: false,
    })
    const approvalValidation = validateSubmissionReady(await loadSubmission(client, submissionId))
    const approvalBlockers = approvalValidation.ok
      ? []
      : approvalValidation.missingFields.map((field) => `approval_validation_failed: ${field}`)
    const guardedPreflight = {
      ...preflight,
      ok: preflight.ok && approvalValidation.ok,
      blockers: [...preflight.blockers, ...approvalBlockers],
      next_action:
        preflight.ok && approvalValidation.ok
          ? preflight.next_action
          : "Blocker klaeren und Preflight erneut starten.",
    }

    await appendResearchArtifact(client, {
      submissionId,
      kind: "publication_preview",
      status: guardedPreflight.ok ? "ready" : "blocked",
      payload: guardedPreflight,
      confidence: guardedPreflight.ok ? 1 : 0,
      promptVersion: "phase_2_preflight_v1",
    })

    return NextResponse.json({
      ok: guardedPreflight.ok,
      preflight: guardedPreflight,
      message: guardedPreflight.next_action,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Publish-Preflight konnte nicht erstellt werden.",
      },
      { status: 500 },
    )
  }
}
