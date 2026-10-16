import "server-only"
import { NextResponse } from "next/server"
import { z } from "zod"
import { ProductIntakeReviewError, type ReviewActionRequest } from "@chaarlie/product-intake-core"
import { requireAdmin } from "@/lib/auth/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  executeReviewAction,
  loadReviewPublicationPreflight,
  publishReviewedProduct,
  retryReviewNotification,
} from "./review-publication"

const uuid = z.string().uuid()
const sha = z.string().regex(/^[a-f0-9]{64}$/)
const comment = z.string().trim().min(1).max(4000)
const binding = z.object({
  request_id: uuid,
  job_id: uuid.nullable(),
  review_cycle_id: uuid.nullable(),
  payload_revision: z.number().int().positive(),
  payload_sha256: sha,
})
const schema = z.discriminatedUnion("action", [
  binding.extend({ action: z.literal("approve_data") }).strict(),
  binding.extend({ action: z.literal("approve_image"), approved_asset_sha256: sha }).strict(),
  binding.extend({ action: z.literal("approve_no_image"), comment }).strict(),
  binding.extend({ action: z.literal("reject_image"), comment }).strict(),
  binding.extend({ action: z.literal("approve_raw"), approved_asset_sha256: sha }).strict(),
  binding.extend({ action: z.literal("rework"), comment }).strict(),
  binding
    .extend({
      action: z.literal("answer"),
      field_path: z.enum([
        "product.canonical_brand",
        "product.product_line",
        "product.clean_name",
        "research.separate_deep_cleanser_listing",
      ]),
      value: z.string().trim().min(1).max(500),
    })
    .strict(),
  binding
    .extend({
      action: z.literal("request_info"),
      reason: comment,
      next_step: comment,
      missing_fields: z.array(z.string().trim().min(1).max(128)).max(20),
      confirm: z.literal(true),
    })
    .strict(),
  binding
    .extend({
      action: z.literal("reject"),
      reason: comment,
      next_step: z.string().trim().max(4000),
      confirm: z.literal(true),
    })
    .strict(),
  binding
    .extend({ action: z.literal("link_existing"), product_id: uuid, confirm: z.literal(true) })
    .strict(),
  binding.extend({ action: z.literal("preflight") }).strict(),
  binding
    .extend({
      action: z.literal("publish"),
      data_decision_id: uuid,
      image_decision_id: uuid,
      confirm: z.literal(true),
    })
    .strict(),
  z
    .object({
      action: z.literal("retry_publication_notification"),
      publication_id: uuid,
      confirm: z.literal(true),
    })
    .strict(),
  z
    .object({
      action: z.literal("retry_decision_notification"),
      decision_id: uuid,
      confirm: z.literal(true),
    })
    .strict(),
])

const defaults = {
  requireAdmin,
  createAdminClient,
  executeReviewAction,
  loadReviewPublicationPreflight,
  publishReviewedProduct,
  retryReviewNotification,
}
const headers = { "Cache-Control": "private, no-store" }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers })

/** One authenticated POST boundary; the actor and submission never come from the body. */
export function createProductReviewActionHandler(overrides: Partial<typeof defaults> = {}) {
  const deps = { ...defaults, ...overrides }
  return async (request: Request, context: { params: Promise<{ submissionId: string }> }) => {
    try {
      const auth = await deps.requireAdmin()
      if ("response" in auth) {
        auth.response.headers.set("Cache-Control", "private, no-store")
        return auth.response
      }
      if (request.headers.get("origin") !== new URL(request.url).origin)
        return json({ error: "Ungültige Anfrage. Bitte öffne die Produktprüfung erneut." }, 403)
      const { submissionId } = await context.params
      if (!uuid.safeParse(submissionId).success)
        return json({ error: "Produktprüfung nicht gefunden." }, 404)
      if (Number(request.headers.get("content-length")) > 16_384)
        return json({ error: "Die Anfrage ist zu lang." }, 413)
      const text = await request.text()
      if (new TextEncoder().encode(text).byteLength > 16_384)
        return json({ error: "Die Anfrage ist zu lang." }, 413)
      let input: unknown
      try {
        input = JSON.parse(text)
      } catch {
        return json({ error: "Bitte prüfe die eingegebenen Angaben." }, 400)
      }
      const parsed = schema.safeParse(input)
      if (!parsed.success)
        return json(
          { error: "Bitte prüfe die Angaben und bestätige die Aktion ausdrücklich." },
          400,
        )
      const body = parsed.data
      const client = deps.createAdminClient()
      if (
        body.action === "retry_publication_notification" ||
        body.action === "retry_decision_notification"
      ) {
        // Prevent a receipt from another product being used through this detail URL.
        const current = await deps.loadReviewPublicationPreflight(client, submissionId)
        if (body.action === "retry_publication_notification") {
          if (current.publication?.id !== body.publication_id)
            return json(
              { error: "Der Veröffentlichungsbeleg gehört nicht zu diesem Eintrag." },
              409,
            )
          return json(
            await deps.retryReviewNotification(client, { publicationId: body.publication_id }),
          )
        }
        const { data, error } = await client
          .from("product_intake_review_decisions")
          .select("id")
          .eq("id", body.decision_id)
          .eq("submission_id", submissionId)
          .maybeSingle()
        if (error) throw error
        if (!data) return json({ error: "Diese Anfrage gehört nicht zu diesem Eintrag." }, 409)
        return json(await deps.retryReviewNotification(client, { decisionId: body.decision_id }))
      }
      const { action, ...rest } = body
      const common = {
        request_id: rest.request_id,
        submission_id: submissionId,
        job_id: rest.job_id,
        review_cycle_id: rest.review_cycle_id,
        payload_revision: rest.payload_revision,
        payload_sha256: rest.payload_sha256,
        reviewed_by: auth.userId,
      }
      if (action === "preflight") {
        const result = await deps.loadReviewPublicationPreflight(client, submissionId)
        if (
          result.payload_revision !== common.payload_revision ||
          result.payload_sha256 !== common.payload_sha256 ||
          result.job_id !== common.job_id ||
          result.review_cycle_id !== common.review_cycle_id
        )
          throw new ProductIntakeReviewError("review_stale")
        return json(result)
      }
      if (body.action === "publish")
        return json(
          await deps.publishReviewedProduct(client, {
            ...common,
            data_decision_id: body.data_decision_id,
            image_decision_id: body.image_decision_id,
            confirm: true,
          }),
        )
      let mapped: ReviewActionRequest
      if (body.action === "approve_no_image")
        mapped = {
          ...common,
          action: "approve_image",
          approved_asset_sha256: null,
          reviewer_value: { no_image: true },
          comment: body.comment,
        }
      else if (body.action === "answer") {
        const key = body.field_path.split(".").at(-1)!
        if (
          key === "separate_deep_cleanser_listing" &&
          !["keep_regular_only", "review_extra_separately"].includes(body.value)
        )
          return json(
            { error: "Bitte wähle eine der beiden Entscheidungen für den zusätzlichen Eintrag." },
            400,
          )
        mapped = {
          ...common,
          action: "answer",
          field_path: body.field_path,
          reviewer_value: {
            [key === "separate_deep_cleanser_listing" ? "choice" : key]: body.value,
          },
        }
      } else if (body.action === "request_info")
        mapped = {
          ...common,
          action: "request_info",
          reviewer_value: {
            reason: body.reason,
            next_step: body.next_step,
            missing_fields: body.missing_fields,
          },
        }
      else if (body.action === "reject")
        mapped = {
          ...common,
          action: "reject",
          reviewer_value: { reason: body.reason, next_step: body.next_step || null },
        }
      else if (body.action === "link_existing")
        mapped = {
          ...common,
          action: "link_existing",
          reviewer_value: { product_id: body.product_id },
        }
      else
        mapped = {
          ...common,
          action: body.action,
          ...("comment" in body ? { comment: body.comment } : {}),
          ...("approved_asset_sha256" in body
            ? { approved_asset_sha256: body.approved_asset_sha256 }
            : {}),
        }
      return json(await deps.executeReviewAction(client, mapped))
    } catch (error) {
      if (error instanceof ProductIntakeReviewError) {
        const stale = /stale|revision|cycle|binding/.test(error.code)
        return json(
          {
            error: stale
              ? "Die Recherche hat sich geändert. Bitte lade den Eintrag neu und prüfe die aktuelle Version."
              : "Die Aktion konnte nicht abgeschlossen werden. Bitte lade den aktuellen Stand und prüfe die offenen Punkte.",
            code: error.code,
          },
          error.status,
        )
      }
      return json(
        {
          error:
            "Das Ergebnis konnte nicht bestätigt werden. Bitte lade den Eintrag neu, bevor du weitere Aktionen startest.",
        },
        503,
      )
    }
  }
}
