import { enqueueResearchJob } from "@chaarlie/product-intake-core"
import { NextResponse } from "next/server"

import { assertLocalServiceRoute, createServiceClient } from "../../../_lib/service-client"
import { kickLocalCodexWorker } from "../../../_lib/local-worker-kick"

type ResearchParams = {
  params: Promise<{ submissionId: string }>
}

export async function POST(request: Request, { params }: ResearchParams) {
  const { submissionId } = await params

  if (!submissionId.trim()) {
    return NextResponse.json({ error: "Submission-ID fehlt." }, { status: 400 })
  }

  try {
    assertLocalServiceRoute(request)
    const job = await enqueueResearchJob(createServiceClient(), submissionId, "source_research")
    const workerKick = kickLocalCodexWorker()

    return NextResponse.json({
      ok: true,
      message: workerKick.ready
        ? "Research-Job ist eingereiht und der lokale Worker ist bereit."
        : "Research-Job ist eingereiht, aber der lokale Worker konnte nicht gestartet werden.",
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
        error:
          error instanceof Error ? error.message : "Research-Job konnte nicht eingereiht werden.",
      },
      { status: 500 },
    )
  }
}
