import type { NextRequest } from "next/server"
import { z } from "zod"

import { saveDiscoveryCallSheet } from "@/lib/discovery/call-sheet"

import {
  discoveryCockpitError,
  discoveryCockpitJson,
  guardDiscoveryCockpitRequest,
  readJsonBody,
  type DiscoveryCockpitRouteDependencies,
} from "../../shared"

/**
 * `PATCH /api/admin/beratung/<enrollmentId>/call-sheet` — the runsheet's own row
 * (`discovery_call_sheets`, consult-runsheet T5). The read is server-side on the page
 * (`loadDiscoveryCallSheet`); this is the one write.
 *
 * Gate order, as the research and item routes: same-origin (403, CSRF) → kill switch (404)
 * → the shared `requireAdmin` (401/403) → the intake the URL names (404). Then:
 *
 *   bad body          → 400 `invalid_body` (every §6 contract is checked here — the
 *                       database only knows „is an array")
 *   200 `{ callSheet }` — the stored row, as the page's parser reads it
 *
 * Partial: each column the body names is set, each absent one is left as stored, so the
 * brief (score, brief, commitments) and the follow-up (feedback, touchpoints) save
 * independently. Upsert: a legacy enrollment without a row gets one on the first save.
 * No freeze: the sheet is Nick's working copy around the call, editable after finalising.
 */

const TEXT_MAX = 20_000
const LIST_MAX = 50

// Half points („7,5"): participants rate like that (Nomi, 2026-10-09).
const score = z.number().min(1).max(10).multipleOf(0.5)
const isoTimestamp = z.iso.datetime({ offset: true })
const isoDate = z.iso.date()
const text = z.string().max(TEXT_MAX)

const rescore = z
  .object({ score, at: isoTimestamp, channel: z.enum(["whatsapp", "call"]) })
  .strict()

const touchpoint = z
  .object({
    kind: z.enum(["text_checkin", "rescore_call"]),
    due_on: isoDate,
    done_at: isoTimestamp.nullable(),
  })
  .strict()

const hebel = z
  .object({
    title: text,
    note: text,
    points: z.number().finite().nullable(),
    // `null` = a row from a pre-v4 brief (rendered as one flat list, R26).
    bucket: z.enum(["produkt", "umgang"]).nullable(),
  })
  .strict()

const briefRevision = z
  .object({
    sections: z
      .object({
        mechanik: text,
        diagnose: text,
        hebel: z.array(hebel).max(LIST_MAX),
        swapReasons: z.record(z.string().max(200), text),
        zielLuecken: z.array(text).max(LIST_MAX),
        callFragen: z.array(text).max(LIST_MAX),
        erwartungen: z.array(text).max(LIST_MAX),
      })
      .strict(),
    generated_at: isoTimestamp.nullable(),
    generated_by: z.enum(["manual", "agent"]),
    source_hash: z.string().max(200).nullable(),
  })
  .strict()

// `previous` (one revision, never nested) is optional: a manual save omits it, and
// `saveDiscoveryCallSheet` then keeps the stored one — no client drops it by omission.
const consultBrief = briefRevision
  .extend({ previous: briefRevision.nullable().optional() })
  .strict()

const habitCommitment = z
  .object({
    id: z.string().trim().min(1).max(300),
    label: z.string().trim().min(1).max(500),
    committed: z.boolean(),
  })
  .strict()

const bodySchema = z
  .object({
    baseline_score: score.nullable().optional(),
    rescores: z.array(rescore).max(LIST_MAX).optional(),
    touchpoints: z.array(touchpoint).max(LIST_MAX).optional(),
    consult_brief: consultBrief.optional(),
    // A commitment's id is its identity (content-derived, see `discoveryHabitCommitmentId`):
    // two rows with one id would bind one checkbox to two entries.
    habit_commitments: z
      .array(habitCommitment)
      .max(LIST_MAX)
      .refine((rows) => new Set(rows.map((row) => row.id)).size === rows.length, {
        message: "duplicate_commitment_id",
      })
      .optional(),
    // R28: routine complexity, asked in the call — two options only.
    complexity: z.enum(["essenziell", "normal"]).nullable().optional(),
    feedback: text.nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: "empty_patch" })

export type DiscoveryCallSheetRouteDependencies = DiscoveryCockpitRouteDependencies & {
  saveCallSheet?: typeof saveDiscoveryCallSheet
}

export function createDiscoveryCallSheetHandler(
  overrides: DiscoveryCallSheetRouteDependencies = {},
) {
  const { saveCallSheet = saveDiscoveryCallSheet, ...guardOverrides } = overrides

  return async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ enrollmentId: string }> },
  ) {
    // CSRF first: the admin cookie rides along on a cross-site request too.
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      return discoveryCockpitError("cross_origin", 403)
    }
    const { enrollmentId } = await context.params
    const guard = await guardDiscoveryCockpitRequest(enrollmentId, guardOverrides)
    if (!guard.ok) return guard.response
    const { admin, intake } = guard

    const body = bodySchema.safeParse(await readJsonBody(request))
    if (!body.success) return discoveryCockpitError("invalid_body", 400)

    try {
      const callSheet = await saveCallSheet(intake.enrollmentId, body.data, admin)
      return discoveryCockpitJson({ callSheet })
    } catch (error) {
      console.error("[discovery] call sheet write failed:", error)
      return discoveryCockpitError("unavailable", 503)
    }
  }
}

export const PATCH = createDiscoveryCallSheetHandler()
