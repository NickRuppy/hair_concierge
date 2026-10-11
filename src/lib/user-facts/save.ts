import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import {
  careHabitsPatchSchema,
  diagnosticsPatchSchema,
  domainProvenanceSchema,
  quizContextPatchSchema,
  shoppingPreferencesPatchSchema,
  type CareHabitsPatch,
  type DiagnosticsPatch,
  type DomainProvenance,
  type QuizContextPatch,
  type ShoppingPreferencesPatch,
} from "./schema"

/**
 * The write side of the `hair_profiles` fact domains, over the single writer RPC
 * `public.user_facts_save_v1` (see `supabase/migrations/20260929231300_user_facts_save_v1.sql`
 * for the authoritative field-level-merge / CAS / draft-binding contract this wraps).
 */

/** A programming error: the caller handed `saveUserFacts` a patch or provenance envelope that
 * fails its own schema. Never thrown for a legitimate conflict — those come back as a typed
 * `SaveUserFactsResult`, not an exception. */
export class UserFactsValidationError extends Error {
  constructor(
    message: string,
    readonly issues: z.ZodIssue[],
  ) {
    super(message)
    this.name = "UserFactsValidationError"
  }
}

/** Transport failure calling `user_facts_save_v1`, an `invalid_input` result (itself a caller
 * bug the RPC detected), or a result payload this client does not recognise.
 * `reason` carries the RPC's own `invalid_input` reason string (task 4 fix round 1); `payload`
 * carries the raw, unrecognised RPC response for an unrecognised-payload error, kept as a
 * structured field rather than serialised into the message. */
export class UserFactsWriteError extends Error {
  readonly cause?: unknown
  readonly reason?: string
  readonly payload?: unknown

  constructor(message: string, options?: { cause?: unknown; reason?: string; payload?: unknown }) {
    super(message)
    this.name = "UserFactsWriteError"
    this.cause = options?.cause
    this.reason = options?.reason
    this.payload = options?.payload
  }
}

/** Maps to the three `p_source_draft_id` / `p_expected_draft_revision` /
 * `p_expected_initial_version_id` RPC params (F22 draft binding). */
export type DraftBinding = {
  sourceDraftId: string
  expectedDraftRevision: number
  expectedInitialVersionId: string
}

/** `expectedUpdatedAt` (fix round 6, I1): the row's `updated_at` exactly as the caller loaded it
 * (a string — PostgREST keeps the microseconds, a `Date` would not). When given, any other stored
 * value is a `revision_conflict` with reason `updated_at_mismatch`; each `ok` / `preserved`
 * result carries the new `updatedAt` for the next write. Only the backfill passes it: it must not
 * overwrite a legacy write that left `facts_revision` alone. */
export type SaveUserFactsInput =
  | {
      userId: string
      domain: "diagnostics"
      patch: DiagnosticsPatch
      provenance: DomainProvenance
      expectedRevision?: number
      mode?: "upsert" | "create_only"
      draftBinding?: DraftBinding
      expectedUpdatedAt?: string
    }
  | {
      userId: string
      domain: "care_habits"
      patch: CareHabitsPatch
      provenance: DomainProvenance
      expectedRevision?: number
      mode?: "upsert" | "create_only"
      draftBinding?: DraftBinding
      expectedUpdatedAt?: string
    }
  | {
      userId: string
      domain: "quiz_context"
      patch: QuizContextPatch
      provenance: DomainProvenance
      expectedRevision?: number
      mode?: "upsert" | "create_only"
      draftBinding?: DraftBinding
      expectedUpdatedAt?: string
    }
  | {
      userId: string
      domain: "shopping_preferences"
      patch: ShoppingPreferencesPatch
      provenance: DomainProvenance
      expectedRevision?: number
      mode?: "upsert" | "create_only"
      draftBinding?: DraftBinding
      expectedUpdatedAt?: string
    }

export type SaveUserFactsResult =
  | {
      status: "ok"
      revision: number
      changed: boolean
      diagnosticsHash: string | null
      updatedAt?: string
    }
  | {
      status: "preserved"
      revision: number
      changed: false
      diagnosticsHash: string | null
      updatedAt?: string
    }
  | {
      status: "revision_conflict"
      revision: number
      /** `updated_at_mismatch`: `expectedUpdatedAt` no longer matches the row. */
      reason?: "revision_mismatch" | "updated_at_mismatch"
    }
  | {
      status: "draft_conflict"
      reason: "not_found" | "not_in_progress" | "revision_mismatch" | "stale_source"
    }

const PATCH_SCHEMAS = {
  diagnostics: diagnosticsPatchSchema,
  care_habits: careHabitsPatchSchema,
  quiz_context: quizContextPatchSchema,
  shopping_preferences: shoppingPreferencesPatchSchema,
} as const

// Validates the raw `user_facts_save_v1` RPC payload. `invalid_input` is included here (it is
// a real, documented status the SQL function returns) so it round-trips through the "unknown
// payload" check as a recognised shape, then gets converted into a thrown error below — a
// caller bug the RPC caught is not something `saveUserFacts` can hand back as a result.
const rpcResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    revision: z.number(),
    changed: z.boolean(),
    diagnosticsHash: z.string().nullable(),
    updatedAt: z.string().optional(),
  }),
  z.object({
    status: z.literal("preserved"),
    revision: z.number(),
    changed: z.literal(false),
    diagnosticsHash: z.string().nullable(),
    updatedAt: z.string().optional(),
  }),
  z.object({
    status: z.literal("revision_conflict"),
    revision: z.number(),
    reason: z.enum(["revision_mismatch", "updated_at_mismatch"]).optional(),
  }),
  z.object({
    status: z.literal("draft_conflict"),
    reason: z.enum(["not_found", "not_in_progress", "revision_mismatch", "stale_source"]),
  }),
  z.object({
    status: z.literal("invalid_input"),
    reason: z.string(),
  }),
])

export async function saveUserFacts(
  admin: SupabaseClient,
  input: SaveUserFactsInput,
): Promise<SaveUserFactsResult> {
  const patchSchema = PATCH_SCHEMAS[input.domain]
  const patchResult = patchSchema.safeParse(input.patch)
  if (!patchResult.success) {
    throw new UserFactsValidationError(
      `saveUserFacts: invalid ${input.domain} patch`,
      patchResult.error.issues,
    )
  }

  const provenanceResult = domainProvenanceSchema.safeParse(input.provenance)
  if (!provenanceResult.success) {
    throw new UserFactsValidationError(
      "saveUserFacts: invalid provenance",
      provenanceResult.error.issues,
    )
  }

  const { data, error } = await admin.rpc("user_facts_save_v1", {
    p_user_id: input.userId,
    p_domain: input.domain,
    p_patch: patchResult.data,
    p_provenance: provenanceResult.data,
    p_expected_revision: input.expectedRevision ?? null,
    p_mode: input.mode ?? "upsert",
    p_source_draft_id: input.draftBinding?.sourceDraftId ?? null,
    p_expected_draft_revision: input.draftBinding?.expectedDraftRevision ?? null,
    p_expected_initial_version_id: input.draftBinding?.expectedInitialVersionId ?? null,
    // Absent unless given: every other caller's RPC call is unchanged.
    ...(input.expectedUpdatedAt !== undefined
      ? { p_expected_updated_at: input.expectedUpdatedAt }
      : {}),
  })

  if (error) {
    throw new UserFactsWriteError(`user_facts_save_v1 transport error: ${error.message}`, {
      cause: error,
    })
  }

  const parsed = rpcResultSchema.safeParse(data)
  if (!parsed.success) {
    throw new UserFactsWriteError("user_facts_save_v1 returned an unrecognised payload", {
      cause: parsed.error,
      payload: data,
    })
  }

  if (parsed.data.status === "invalid_input") {
    throw new UserFactsWriteError(
      `user_facts_save_v1 rejected the call (invalid_input: ${parsed.data.reason})`,
      { reason: parsed.data.reason },
    )
  }

  return parsed.data
}
