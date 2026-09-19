import "server-only"

import { randomBytes } from "node:crypto"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  canonicalizePersonalPlanAnswers,
  hashPersonalPlanAnswers,
  personalPlanDurableAnswersSchema,
} from "./persistence"
import { buildPersonalPlanPreparedArtifact } from "./prepared-plan"
import type { PersonalPlanQuizSubmissionEnvelope } from "./types"

const envelopeSchema = z
  .object({
    kind: z.literal("personal_plan"),
    version: z.union([z.literal(2), z.literal(3)]),
    answers: personalPlanDurableAnswersSchema,
  })
  .strict()

export type ReturnArtifactRepairResult =
  | { status: "repaired" | "already_present"; artifactId: string }
  | { status: "cannot_reconstruct" | "conflict" | "forbidden" | "unavailable" }

type RepairRpc = (
  name: string,
  args: Record<string, unknown>,
) => PromiseLike<{
  data: unknown
  error: { code?: string } | null
}>

/** POST/PATCH only. The caller must establish authenticated access and the exact
 * authorized email-return session before passing its persisted lead snapshot.
 * The RPC independently verifies ownership and compares that snapshot under lock.
 * Existing artifacts may only be superseded for cumulative additions/corrections
 * to previously missing/invalid required facts, before Stage1 references them.
 * No defaults are invented for missing historical Personal Plan context.
 */
export async function repairReturningPersonalPlanArtifact(
  input: { leadId: string; userId: string; quizAnswers: unknown },
  deps: { rpc?: RepairRpc } = {},
): Promise<ReturnArtifactRepairResult> {
  if (
    !z.string().uuid().safeParse(input.leadId).success ||
    !z.string().uuid().safeParse(input.userId).success
  )
    return { status: "forbidden" }
  const parsed = envelopeSchema.safeParse(input.quizAnswers)
  if (!parsed.success) return { status: "cannot_reconstruct" }

  // v2 is accepted only when its actual values satisfy today's durable schema.
  // Older combined concerns are deliberately not split into unreported facts.
  const builderEnvelope = canonicalizePersonalPlanAnswers(parsed.data.answers)
  let prepared: ReturnType<typeof buildPersonalPlanPreparedArtifact>
  try {
    prepared = buildPersonalPlanPreparedArtifact(builderEnvelope)
  } catch {
    return { status: "cannot_reconstruct" }
  }

  try {
    const rpc: RepairRpc = deps.rpc ?? ((name, args) => createAdminClient().rpc(name, args))
    const { data, error } = await rpc("repair_return_personal_plan_artifact", {
      p_lead_id: input.leadId,
      p_user_id: input.userId,
      // Preserve the exact envelope for CAS and immutable artifact provenance.
      p_expected_quiz_answers: input.quizAnswers,
      p_answer_hash: hashPersonalPlanAnswers(
        input.quizAnswers as PersonalPlanQuizSubmissionEnvelope,
      ),
      p_claim_token_hash: randomBytes(32).toString("hex"),
      p_canonical_profile: prepared.canonicalProfile,
      p_fallback_metadata: prepared.fallbackMetadata,
      p_priorities: prepared.priorities,
      p_diagnostic_scores: prepared.diagnosticScores,
      p_public_offer_model: prepared.publicOfferModel,
      p_locked_plan: prepared.lockedPlan,
    })
    if (error) return { status: error.code === "23505" ? "conflict" : "unavailable" }
    const row = Array.isArray(data) && data.length === 1 ? data[0] : null
    if (!row || typeof row !== "object") return { status: "unavailable" }
    if (
      (row.status === "repaired" || row.status === "already_present") &&
      typeof row.artifact_id === "string"
    ) {
      return { status: row.status, artifactId: row.artifact_id }
    }
    if (row.status === "conflict" || row.status === "forbidden") return { status: row.status }
    return { status: "unavailable" }
  } catch {
    return { status: "unavailable" }
  }
}
