import { enqueueResearchJob } from "@chaarlie/product-intake-core"
import { NextResponse } from "next/server"

import { assertLocalServiceRoute, createServiceClient } from "../../../_lib/service-client"
import { kickLocalCodexWorker } from "../../../_lib/local-worker-kick"

type QueueParams = {
  params: Promise<{ submissionId: string }>
}

export async function POST(_request: Request, { params }: QueueParams) {
  const { submissionId } = await params

  if (!submissionId.trim()) {
    return NextResponse.json({ error: "Submission-ID fehlt." }, { status: 400 })
  }

  try {
    assertLocalServiceRoute(_request)
    const job = await enqueueResearchJob(createServiceClient(), submissionId, "identity")
    const workerKick = kickLocalCodexWorker()

    return NextResponse.json({
      ok: true,
      message: workerKick.ready
        ? "Job ist eingereiht und der lokale Worker ist bereit."
        : "Job ist eingereiht, aber der lokale Worker konnte nicht gestartet werden.",
      workerKick,
      job: {
        jobId: job.id,
        jobStatus: job.status,
        jobStage: job.stage,
        nextAction: "Wartet auf Worker",
        updatedAt: job.updated_at,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Job konnte nicht eingereiht werden.",
      },
      { status: 500 },
    )
  }
}
