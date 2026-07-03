import { requestReworkJob } from "@chaarlie/product-intake-core"
import { NextResponse } from "next/server"

import { assertLocalServiceRoute, createServiceClient } from "../../../_lib/service-client"
import { kickLocalCodexWorker } from "../../../_lib/local-worker-kick"

type ReworkParams = {
  params: Promise<{ submissionId: string }>
}

type ReworkRequestBody = {
  message?: string
  reworkType?: string
}

export async function POST(request: Request, { params }: ReworkParams) {
  const { submissionId } = await params

  try {
    assertLocalServiceRoute(request)
    const body = (await request.json().catch(() => ({}))) as ReworkRequestBody
    const isImageSearch = body.reworkType === "image_search"
    const job = await requestReworkJob(createServiceClient(), submissionId, {
      message: isImageSearch
        ? (body.message ??
          "Nick hat das Bild abgelehnt und eine neue Bildsuche nach dem Bildstandard angefordert.")
        : (body.message ??
          "Nick hat Review-Kommentare markiert und einen Produkt-Rework angefordert."),
      requested_by: "nick",
      requested_at: new Date().toISOString(),
      rework_type: body.reworkType ?? "product_rework",
    })
    const workerKick = kickLocalCodexWorker()

    return NextResponse.json({
      ok: true,
      message: isImageSearch
        ? workerKick.ready
          ? "Bildsuche ist sichtbar eingereiht und der lokale Worker ist bereit."
          : "Bildsuche ist sichtbar eingereiht, aber der lokale Worker konnte nicht gestartet werden."
        : workerKick.ready
          ? "Rework-Job ist sichtbar eingereiht und der lokale Worker ist bereit."
          : "Rework-Job ist sichtbar eingereiht, aber der lokale Worker konnte nicht gestartet werden.",
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
        error: error instanceof Error ? error.message : "Rework konnte nicht eingereiht werden.",
      },
      { status: 500 },
    )
  }
}
