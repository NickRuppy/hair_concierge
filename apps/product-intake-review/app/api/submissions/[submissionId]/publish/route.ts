import {
  appendResearchArtifact,
  buildPublishPreflight,
  loadProductIntakeSubmissionDetail,
  type JsonRecord,
  type ProductIntakeReviewDecisionRow,
} from "@chaarlie/product-intake-core"
import { NextResponse } from "next/server"

import { approveSubmissionById } from "../../../../../../../scripts/product-intake/approve"
import { assertLocalServiceRoute, createServiceClient } from "../../../_lib/service-client"
import {
  buildResearchedPayloadWithFinalImage,
  finalImageUploadDecisionFromArtifacts,
  uploadFinalizedReviewImage,
} from "./final-image-handoff"

type PublishParams = {
  params: Promise<{ submissionId: string }>
}

type AppliedApprovalResult = {
  product_id?: unknown
  submission?: {
    id?: unknown
    status?: unknown
    approved_product_id?: unknown
    user_product_usage_id?: unknown
  } | null
  notification?: unknown
}

export async function POST(request: Request, { params }: PublishParams) {
  const { submissionId } = await params

  try {
    assertLocalServiceRoute(request)
    const body = await readJsonBody(request)
    if (body.confirm !== true) {
      return NextResponse.json(
        {
          ok: false,
          submissionId,
          error: "Finale Supabase-Freigabe braucht confirm=true.",
        },
        { status: 400 },
      )
    }

    const client = createServiceClient()
    const finalImageHandoff = await prepareFinalImageForPublish(client, submissionId)
    const preflight = await buildPublishPreflight(client, submissionId, {
      publishRouteEnabled: true,
    })

    await appendResearchArtifact(client, {
      submissionId,
      kind: "publication_preview",
      status: preflight.ok ? "ready" : "blocked",
      payload: {
        ...preflight,
        final_image_handoff: finalImageHandoff,
        requested_confirm: body.confirm === true,
        publish_guard: preflight.ok ? "confirmed_review_cockpit_publish" : "preflight_blocked",
      },
      confidence: preflight.ok ? 1 : 0,
      promptVersion: "phase_4_publish_guard_v1",
    })

    if (!preflight.ok) {
      return NextResponse.json(
        {
          ok: false,
          submissionId,
          preflight,
          error: "Publish-Preflight hat Blocker. Bitte erst Review/Rework abschliessen.",
        },
        { status: 409 },
      )
    }

    const approval = await approveSubmissionById({
      submissionId,
      reviewedBy: "nick",
      reviewNotes: "Approved from Product Intake Review Cockpit.",
      apply: true,
      confirm: true,
    })
    const appliedApproval = assertAppliedApprovalResult(approval)

    await appendResearchArtifact(client, {
      submissionId,
      kind: "publish_result",
      status: "done",
      payload: {
        preflight,
        approved_product_id: appliedApproval.approvedProductId,
        approved_submission_id: appliedApproval.approvedSubmissionId,
        approved_submission_status: "approved",
        linked_user_product_usage_id: appliedApproval.linkedUserProductUsageId,
        final_image_handoff: finalImageHandoff,
        notification: appliedApproval.notification,
      },
      confidence: 1,
      promptVersion: "phase_4_publish_apply_v1",
    })

    return NextResponse.json({
      ok: true,
      submissionId,
      preflight,
      approvedProductId: appliedApproval.approvedProductId,
      notification: appliedApproval.notification,
      message: "Produkt wurde in Supabase freigegeben.",
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Publish konnte nicht gestartet werden."
    await appendFailedPublishResult(submissionId, message)

    return NextResponse.json(
      {
        error: message,
      },
      { status: message.startsWith("approval_validation_failed") ? 409 : 500 },
    )
  }
}

async function prepareFinalImageForPublish(
  client: ReturnType<typeof createServiceClient>,
  submissionId: string,
) {
  const detail = await loadProductIntakeSubmissionDetail(client, submissionId)
  if (!detail) {
    throw new Error(`Submission ${submissionId} wurde nicht gefunden.`)
  }

  const decision = finalImageUploadDecisionFromArtifacts(detail.artifacts)
  if (!decision.ok) {
    throw new Error(`final_image_handoff_failed: ${decision.reason}`)
  }
  const publishApproval = latestPublishApprovalDecision(detail.decisions)
  if (!publishApproval) {
    throw new Error("final_review_metadata_missing: final.product wurde noch nicht freigegeben.")
  }

  const upload = await uploadFinalizedReviewImage(client, decision)
  const nextPayload = buildResearchedPayloadWithFinalImage(
    (detail.payload ?? {}) as JsonRecord,
    decision.publicUrl,
    {
      reviewedBy: publishApproval.reviewed_by,
      reviewedAt: publishApproval.reviewed_at,
      notes: publishApproval.comment ?? "Approved from Product Intake Review Cockpit.",
    },
  )

  const { error } = await client
    .from("product_submissions")
    .update({ researched_payload: nextPayload })
    .eq("id", submissionId)
    .eq("status", "ready_for_review")
  if (error) {
    throw new Error(`final_image_payload_update_failed: ${error.message}`)
  }

  return {
    ...upload,
    product_image_url: decision.publicUrl,
  }
}

function latestPublishApprovalDecision(decisions: ProductIntakeReviewDecisionRow[]) {
  return (
    [...decisions]
      .filter(
        (decision) =>
          decision.field_path === "final.product" && decision.decision === "publish_approved",
      )
      .sort((a, b) => new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime())[0] ??
    null
  )
}

function assertAppliedApprovalResult(approval: AppliedApprovalResult | null | undefined) {
  const approvedProductId = stringValue(approval?.product_id)
  if (!approvedProductId) {
    throw new Error("approved_product_id_missing")
  }

  const submission = approval?.submission
  if (
    !submission ||
    submission.status !== "approved" ||
    submission.approved_product_id !== approvedProductId
  ) {
    throw new Error("approved_submission_state_missing")
  }

  if (approval?.notification === undefined) {
    throw new Error("notification_result_missing")
  }

  return {
    approvedProductId,
    approvedSubmissionId: stringValue(submission.id),
    linkedUserProductUsageId: stringValue(submission.user_product_usage_id),
    notification: approval.notification,
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

async function appendFailedPublishResult(submissionId: string, error: string) {
  try {
    await appendResearchArtifact(createServiceClient(), {
      submissionId,
      kind: "publish_result",
      status: "failed",
      payload: {
        error,
        failed_at: new Date().toISOString(),
        next_action:
          "Blocker korrigieren, Review erneut bestaetigen und Publish noch einmal starten.",
      },
      confidence: 0,
      promptVersion: "phase_4_publish_apply_v1",
    })
  } catch {
    // Publishing already failed; do not mask the original user-facing error.
  }
}

async function readJsonBody(request: Request): Promise<{ confirm?: boolean }> {
  try {
    return (await request.json()) as { confirm?: boolean }
  } catch {
    return {}
  }
}
