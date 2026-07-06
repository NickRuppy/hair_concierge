import {
  loadProductIntakeSubmissionDetail,
  loadResearchJob,
  saveReviewDecision,
  updateResearchJob,
  type ProductIntakeResearchArtifact,
  type ProductIntakeReviewDecision,
} from "@chaarlie/product-intake-core"
import { NextResponse } from "next/server"

import { kickLocalCodexWorker } from "../../../_lib/local-worker-kick"
import { assertLocalServiceRoute, createServiceClient } from "../../../_lib/service-client"

type DecisionParams = {
  params: Promise<{ submissionId: string }>
}

const allowedDecisions = new Set<ProductIntakeReviewDecision>([
  "approved",
  "change_requested",
  "image_approved",
  "image_rejected",
  "publish_approved",
  "needs_more_info",
  "reject",
])

export async function POST(request: Request, { params }: DecisionParams) {
  const { submissionId } = await params

  try {
    assertLocalServiceRoute(request)
    const body = (await request.json()) as {
      jobId?: string | null
      fieldPath?: string
      decision?: ProductIntakeReviewDecision
      proposedValue?: Record<string, unknown> | null
      reviewerValue?: Record<string, unknown> | null
      comment?: string | null
    }
    const fieldPath = body.fieldPath?.trim()
    const decision = body.decision

    if (!fieldPath) {
      return NextResponse.json({ error: "Feldpfad fehlt." }, { status: 400 })
    }
    if (!decision || !allowedDecisions.has(decision)) {
      return NextResponse.json({ error: "Review-Entscheidung ist ungueltig." }, { status: 400 })
    }
    const fieldError = validateDecisionFieldPath(decision, fieldPath)
    if (fieldError) {
      return NextResponse.json({ error: fieldError }, { status: 400 })
    }

    const client = createServiceClient()
    const row = await saveReviewDecision(client, {
      submissionId,
      jobId: body.jobId ?? null,
      fieldPath,
      decision,
      proposedValue: normalizeJsonRecord(body.proposedValue),
      reviewerValue: normalizeJsonRecord(body.reviewerValue),
      comment: body.comment?.trim() || null,
      reviewedBy: "nick",
    })
    const queuedImageJob =
      decision === "approved" && fieldPath === "raw.image" && body.jobId
        ? await queueImageProcessingJob(client, body.jobId)
        : null
    const finalImageOverride =
      decision === "image_approved" && fieldPath === "final.image"
        ? await markLatestProcessedImageAccepted(client, submissionId)
        : null
    const workerKick = queuedImageJob ? kickLocalCodexWorker() : null
    const finalDecision =
      !queuedImageJob && shouldCheckFinalApproval(fieldPath)
        ? await approveProductIfReviewComplete(client, submissionId)
        : null

    return NextResponse.json({
      ok: true,
      decision: row,
      finalDecision,
      finalImageOverride,
      job: queuedImageJob
        ? {
            jobId: queuedImageJob.id,
            jobStatus: queuedImageJob.status,
            jobStage: queuedImageJob.stage,
            updatedAt: queuedImageJob.updated_at,
          }
        : undefined,
      workerKick,
      message: queuedImageJob
        ? workerKick?.ready
          ? "Rohbild gespeichert. Bildverarbeitung ist eingereiht und der lokale Worker ist bereit."
          : "Rohbild gespeichert. Bildverarbeitung ist eingereiht, aber der lokale Worker konnte nicht gestartet werden."
        : finalDecision
          ? "Finalbild und Eigenschaften sind freigegeben. Produkt-Handoff ist fachlich freigegeben."
          : decision === "image_rejected"
            ? "Bildentscheidung gespeichert. Fordere ein anderes Bild an oder starte Rework."
            : decision === "change_requested"
              ? "Kommentar gespeichert. Klicke Rework product, wenn alle Aenderungen markiert sind."
              : "Review-Entscheidung gespeichert.",
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Review-Entscheidung konnte nicht gespeichert werden.",
      },
      { status: 500 },
    )
  }
}

async function queueImageProcessingJob(
  client: Parameters<typeof loadResearchJob>[0],
  jobId: string,
) {
  const existing = await loadResearchJob(client, jobId)
  if (!existing) throw new Error(`Research-Job ${jobId} wurde nicht gefunden.`)

  if (existing.attempt_count >= existing.max_attempts) {
    const { error } = await client
      .from("product_intake_research_jobs")
      .update({ attempt_count: 0 })
      .eq("id", jobId)

    if (error) {
      throw new Error(`Bildverarbeitung konnte nicht erneut freigegeben werden: ${error.message}`)
    }
  }

  return updateResearchJob(client, {
    jobId,
    status: "queued",
    stage: "image_judging",
    progress: {
      ...existing.progress,
      message: "Rohbild wurde freigegeben. Bildverarbeitung wartet auf den Worker.",
      raw_image_approved_at: new Date().toISOString(),
      next_step: "process_image_for_final_review",
      source: "review_cockpit",
    },
    lastError: null,
  })
}

async function markLatestProcessedImageAccepted(
  client: Parameters<typeof loadResearchJob>[0],
  submissionId: string,
) {
  const detail = await loadProductIntakeSubmissionDetail(client, submissionId)
  const processedImage = detail?.artifacts.find((artifact) => artifact.kind === "processed_image")
  if (!processedImage) return null
  if (
    processedImage.status === "pending_review" &&
    booleanValue(processedImage.payload.final_image_ready) === true &&
    booleanValue(processedImage.payload.transparent_background_detected) === true
  ) {
    return null
  }

  const payload = {
    ...processedImage.payload,
    final_image_ready: true,
    transparent_background_detected: true,
    human_qa_override: true,
    human_qa_override_at: new Date().toISOString(),
    human_qa_override_reason:
      "Nick accepted the processed image in the review cockpit despite automatic image QA warning.",
  }

  const { data, error } = await client
    .from("product_intake_research_artifacts")
    .update({
      status: "pending_review",
      payload,
    })
    .eq("id", processedImage.id)
    .select("*")
    .single()

  if (error) {
    throw new Error(`Finalbild konnte nicht als akzeptiert markiert werden: ${error.message}`)
  }

  return data as ProductIntakeResearchArtifact
}

function validateDecisionFieldPath(decision: ProductIntakeReviewDecision, fieldPath: string) {
  if (
    (decision === "image_approved" || decision === "image_rejected") &&
    fieldPath !== "final.image" &&
    fieldPath !== "raw.image"
  ) {
    return "Bild-Entscheidungen muessen auf raw.image oder final.image gespeichert werden."
  }
  if (decision === "publish_approved" && fieldPath !== "final.product") {
    return "Finale Produktfreigabe muss auf final.product gespeichert werden."
  }
  return null
}

function normalizeJsonRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function shouldCheckFinalApproval(fieldPath: string) {
  return fieldPath === "final.image" || fieldPath === "final.properties"
}

async function approveProductIfReviewComplete(
  client: Parameters<typeof loadResearchJob>[0],
  submissionId: string,
) {
  const detail = await loadProductIntakeSubmissionDetail(client, submissionId)
  if (!detail) return null

  const processedImage = detail.artifacts.find(
    (artifact) =>
      artifact.kind === "processed_image" &&
      artifact.status === "pending_review" &&
      booleanValue(artifact.payload.final_image_ready) === true &&
      booleanValue(artifact.payload.transparent_background_detected) === true,
  )
  if (!processedImage) return null

  const processedAt = new Date(processedImage.created_at).getTime()
  const finalImageApproved = detail.decisions.some(
    (decision) =>
      decision.field_path === "final.image" &&
      decision.decision === "image_approved" &&
      new Date(decision.reviewed_at).getTime() >= processedAt,
  )
  const propertiesApproved = detail.decisions.some(
    (decision) => decision.field_path === "final.properties" && decision.decision === "approved",
  )
  const alreadyApproved = detail.decisions.some(
    (decision) =>
      decision.field_path === "final.product" && decision.decision === "publish_approved",
  )

  if (!finalImageApproved || !propertiesApproved || alreadyApproved) return null

  return saveReviewDecision(client, {
    submissionId,
    jobId: detail.job?.id ?? null,
    fieldPath: "final.product",
    decision: "publish_approved",
    comment: "Auto-approved after processed image and properties were both approved.",
    reviewedBy: "nick",
  })
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true
    if (value.toLowerCase() === "false") return false
  }
  return null
}
