import { retryResearchJob } from "@chaarlie/product-intake-core"
import { NextResponse } from "next/server"

import { assertLocalServiceRoute, createServiceClient } from "../../../_lib/service-client"
import { kickLocalCodexWorker } from "../../../_lib/local-worker-kick"

type RetryParams = {
  params: Promise<{ jobId: string }>
}

export async function POST(_request: Request, { params }: RetryParams) {
  const { jobId } = await params

  if (!jobId.trim()) {
    return NextResponse.json({ error: "Job-ID fehlt." }, { status: 400 })
  }

  try {
    assertLocalServiceRoute(_request)
    const updated = await retryResearchJob(createServiceClient(), jobId, {
      message: "Job wurde aus der Review-App erneut eingereiht.",
      retried_at: new Date().toISOString(),
      source: "review_cockpit",
    })
    const workerKick = kickLocalCodexWorker()

    return NextResponse.json({
      ok: true,
      message: workerKick.ready
        ? "Retry ist eingereiht und der lokale Worker ist bereit."
        : "Retry ist eingereiht, aber der lokale Worker konnte nicht gestartet werden.",
      workerKick,
      job: {
        jobId: updated.id,
        jobStatus: updated.status,
        jobStage: updated.stage,
        nextAction: "Wartet auf Worker",
        updatedAt: updated.updated_at,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Retry fehlgeschlagen.",
      },
      { status: 500 },
    )
  }
}
