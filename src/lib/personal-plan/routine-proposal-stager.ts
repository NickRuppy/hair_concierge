import { z } from "zod"

import type { JsonValue } from "./persistence"
import type { InitialNeedPlanSnapshot } from "./types"
import type { ProductCadenceAuthorityFact } from "./routine/cadence"

const opaqueIdSchema = z.string().min(1)
const boundedReasonCodeSchema = z.string().min(1).max(96)

const MAX_JSON_DEPTH = 24
const MAX_JSON_NODES = 10_000
const MAX_JSON_SERIALIZED_BYTES = 524_288

function isBoundedJson(value: unknown): value is JsonValue {
  let nodes = 0
  let valid = true

  function visit(current: unknown, depth: number): void {
    if (!valid || depth > MAX_JSON_DEPTH || ++nodes > MAX_JSON_NODES) {
      valid = false
      return
    }
    if (
      current === null ||
      typeof current === "string" ||
      typeof current === "number" ||
      typeof current === "boolean"
    ) {
      valid &&= Number.isFinite(current as number) || typeof current !== "number"
      return
    }
    if (Array.isArray(current)) {
      current.forEach((child) => visit(child, depth + 1))
      return
    }
    if (typeof current === "object") {
      const prototype = Object.getPrototypeOf(current)
      if (prototype !== Object.prototype && prototype !== null) {
        valid = false
        return
      }
      for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
        if (key.length > 256) {
          valid = false
          return
        }
        visit(child, depth + 1)
      }
      return
    }
    valid = false
  }

  visit(value, 0)
  if (!valid) return false
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8") <= MAX_JSON_SERIALIZED_BYTES
  } catch {
    return false
  }
}

const boundedJsonSchema: z.ZodType<JsonValue> = z.unknown().superRefine((value, context) => {
  if (!isBoundedJson(value)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Expected bounded JSON value" })
  }
}) as z.ZodType<JsonValue>

const authorityVersionsSchema = z
  .record(z.string().min(1).max(128), z.string().min(1).max(128))
  .refine((value) => Object.keys(value).length <= 128, "Expected at most 128 authority versions")

export type RoutineCandidate = {
  schemaVersion: number
  compilerVersion: string
  authorityVersions: Record<string, string>
  sourceFingerprint: string
  payload: JsonValue
  proposalDelta: JsonValue
}

export type RoutineCandidateCompilerInput = {
  userId: string
  personalPlanId: string
  productDraftId: string
  expectedRevision: number
  expectedSourceRevision: number
  portfolioSchemaVersion: number
  portfolioSnapshot: JsonValue
  refinedNeedSnapshot: InitialNeedPlanSnapshot
  cadenceAuthorityFacts?: readonly ProductCadenceAuthorityFact[]
}

/**
 * The production composition root must inject the server-owned compiler. This
 * port deliberately has no default implementation: a fixture compiler is only
 * appropriate in deterministic tests or local development seams.
 */
export type RoutineCandidateCompiler = {
  compile(input: RoutineCandidateCompilerInput): Promise<RoutineCandidate>
}

export type RoutineProposalStageRequest = {
  userId: string
  personalPlanId: string
  productDraftId: string
  expectedRevision: number
  expectedSourceRevision: number
  portfolio: {
    schemaVersion: number
    snapshot: JsonValue
  }
  candidate: RoutineCandidate
}

export type RoutineProposalStageResult =
  | {
      status: "completed" | "already_completed"
      portfolioVersionId: string
      routineVersionId: string
      /** Null only for the first atomically activated Routine. */
      routineProposalId: string | null
      revision: number
    }
  | { status: "revision_conflict"; currentRevision: number }
  | { status: "source_revision_conflict"; currentSourceRevision: number }
  | { status: "stale_source"; currentRefinedNeedVersionId: string }
  | { status: "invalid_source"; reasonCode: string }
  | { status: "snapshot_too_large" }
  | { status: "temporarily_unavailable" }

export const routineCandidateSchema: z.ZodType<RoutineCandidate> = z.object({
  schemaVersion: z.number().int().positive(),
  compilerVersion: z.string().min(1).max(128),
  authorityVersions: authorityVersionsSchema,
  sourceFingerprint: z.string().min(1).max(128),
  payload: boundedJsonSchema,
  proposalDelta: boundedJsonSchema,
})

export const routineProposalStageRequestSchema: z.ZodType<RoutineProposalStageRequest> = z.object({
  userId: opaqueIdSchema,
  personalPlanId: opaqueIdSchema,
  productDraftId: opaqueIdSchema,
  expectedRevision: z.number().int().nonnegative(),
  expectedSourceRevision: z.number().int().nonnegative(),
  portfolio: z.object({
    schemaVersion: z.number().int().positive(),
    snapshot: boundedJsonSchema,
  }),
  candidate: routineCandidateSchema,
})

export const routineProposalStageResultSchema: z.ZodType<RoutineProposalStageResult> =
  z.discriminatedUnion("status", [
    z.object({
      status: z.enum(["completed", "already_completed"]),
      portfolioVersionId: opaqueIdSchema,
      routineVersionId: opaqueIdSchema,
      routineProposalId: opaqueIdSchema.nullable(),
      revision: z.number().int().nonnegative(),
    }),
    z.object({
      status: z.literal("revision_conflict"),
      currentRevision: z.number().int().nonnegative(),
    }),
    z.object({
      status: z.literal("source_revision_conflict"),
      currentSourceRevision: z.number().int().nonnegative(),
    }),
    z.object({ status: z.literal("stale_source"), currentRefinedNeedVersionId: opaqueIdSchema }),
    z.object({ status: z.literal("invalid_source"), reasonCode: boundedReasonCodeSchema }),
    z.object({ status: z.literal("snapshot_too_large") }),
    z.object({ status: z.literal("temporarily_unavailable") }),
  ])

export function parseRoutineProposalStageResult(
  raw: unknown,
):
  | { ok: true; value: RoutineProposalStageResult }
  | { ok: false; error: { code: "invalid_stager_response" } } {
  const parsed = routineProposalStageResultSchema.safeParse(raw)
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: { code: "invalid_stager_response" } }
}

export type RoutineProposalStager = {
  stage(input: RoutineProposalStageRequest): Promise<RoutineProposalStageResult>
}

export type RoutineProposalRpcClient = {
  rpc(
    functionName:
      | "personal_plan_complete_product_draft_and_stage_routine"
      | "personal_plan_complete_draft_activate_initial_v1",
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: unknown | null }>
}

/**
 * Creates the service-client adapter. It issues one and only one RPC; all
 * portfolio/Routine/proposal writes, retries and idempotency stay inside SQL.
 */
export function createRoutineProposalStagerRpcAdapter(input: {
  client: RoutineProposalRpcClient
  activateInitialRoutine?: boolean
}): RoutineProposalStager {
  return {
    async stage(rawRequest) {
      const request = routineProposalStageRequestSchema.safeParse(rawRequest)
      if (!request.success) return { status: "temporarily_unavailable" }

      try {
        const response = await input.client.rpc(
          input.activateInitialRoutine
            ? "personal_plan_complete_draft_activate_initial_v1"
            : "personal_plan_complete_product_draft_and_stage_routine",
          {
            p_user_id: request.data.userId,
            p_personal_plan_id: request.data.personalPlanId,
            p_product_draft_id: request.data.productDraftId,
            p_expected_draft_revision: request.data.expectedRevision,
            p_expected_source_revision: request.data.expectedSourceRevision,
            p_portfolio_schema_version: request.data.portfolio.schemaVersion,
            p_portfolio_snapshot: request.data.portfolio.snapshot,
            p_routine_schema_version: request.data.candidate.schemaVersion,
            p_routine_compiler_version: request.data.candidate.compilerVersion,
            p_routine_authority_versions: request.data.candidate.authorityVersions,
            p_routine_source_fingerprint: request.data.candidate.sourceFingerprint,
            p_routine_payload: request.data.candidate.payload,
            p_proposal_delta: request.data.candidate.proposalDelta,
          },
        )
        if (response.error) return { status: "temporarily_unavailable" }
        const parsed = parseRoutineProposalStageResult(response.data)
        return parsed.ok ? parsed.value : { status: "temporarily_unavailable" }
      } catch {
        return { status: "temporarily_unavailable" }
      }
    },
  }
}
