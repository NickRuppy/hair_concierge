import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { z } from "zod"

import type { PersonalPlanRefinementAnswersV1 } from "@/lib/personal-plan/refinement/types"
import type { SupportedStage1Source } from "@/lib/personal-plan/types"

import {
  careHabitsV1Schema,
  diagnosticsV1Schema,
  factsProvenanceSchema,
  quizContextV1Schema,
  type CareHabitsV1,
  type DiagnosticsV1,
  type FactsProvenance,
  type QuizContextV1,
} from "./schema"
import { toStage1Source } from "./stage1-source"

export { toStage1Source } from "./stage1-source"

/** A stored fact domain (or `facts_provenance`) failed to parse against its own schema.
 * Corrupt facts must be loud: `loadUserFacts` never silently returns a partial or null domain
 * for a row that actually has data there. */
export class UserFactsReadError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = "UserFactsReadError"
  }
}

export type UserFacts = {
  userId: string
  diagnostics: DiagnosticsV1 | null
  careHabits: CareHabitsV1 | null
  quizContext: QuizContextV1 | null
  provenance: FactsProvenance
  revision: number
  /** The two legacy columns the completeness defaults consult when no facts document carries
   * the value (wave-1 fix F2: a default only fills a hole). Raw column values, unvalidated. */
  legacyColumns?: { density: string | null; hair_length: string | null }
}

function parseDomain<Schema extends z.ZodType>(
  schema: Schema,
  raw: unknown,
  domain: string,
  userId: string,
): z.infer<Schema> | null {
  if (raw === null || raw === undefined) return null
  const result = schema.safeParse(raw)
  if (!result.success) {
    throw new UserFactsReadError(
      `loadUserFacts: corrupt ${domain} facts for user ${userId}`,
      result.error,
    )
  }
  return result.data
}

/** Loads the four `hair_profiles` fact columns for one user. Returns `null` only when the row
 * itself does not exist — a row with an empty/null domain still returns a `UserFacts` with
 * `null` for that domain. */
export async function loadUserFacts(
  admin: SupabaseClient,
  userId: string,
): Promise<UserFacts | null> {
  const { data, error } = await admin
    .from("hair_profiles")
    .select(
      "user_id, diagnostics, care_habits, quiz_context, facts_provenance, facts_revision, density, hair_length",
    )
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw new UserFactsReadError(
      `loadUserFacts: failed to load hair_profiles for user ${userId}: ${error.message}`,
      error,
    )
  }
  if (!data) return null

  const diagnostics = parseDomain(diagnosticsV1Schema, data.diagnostics, "diagnostics", userId)
  const careHabits = parseDomain(careHabitsV1Schema, data.care_habits, "care_habits", userId)
  const quizContext = parseDomain(quizContextV1Schema, data.quiz_context, "quiz_context", userId)

  const provenanceResult = factsProvenanceSchema.safeParse(data.facts_provenance ?? {})
  if (!provenanceResult.success) {
    throw new UserFactsReadError(
      `loadUserFacts: corrupt facts_provenance for user ${userId}`,
      provenanceResult.error,
    )
  }

  return {
    userId,
    diagnostics,
    careHabits,
    quizContext,
    provenance: provenanceResult.data,
    revision: data.facts_revision,
    legacyColumns: {
      density: typeof data.density === "string" ? data.density : null,
      hair_length: typeof data.hair_length === "string" ? data.hair_length : null,
    },
  }
}

/** `PersonalPlanRefinementAnswersV1` is `CareHabitsV1` minus the legacy `brushesCombs` field
 * (no Stage-2 version ever carried it). Absent fields stay absent — this never synthesises a
 * key that was not present in the stored domain. */
export function toRefinementAnswers(
  facts: Pick<UserFacts, "careHabits">,
): PersonalPlanRefinementAnswersV1 {
  if (!facts.careHabits) return {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to drop it
  const { brushesCombs, ...refinementAnswers } = facts.careHabits
  return refinementAnswers
}

/** Re-emits the Stage-1 source for a loaded facts record (F26), delegating to Task-1's
 * `toStage1Source`. `null` when there is no diagnostics domain at all — there is nothing to
 * emit. */
export function toStage1SourceFromFacts(facts: UserFacts): SupportedStage1Source | null {
  if (!facts.diagnostics) return null
  return toStage1Source({
    diagnostics: facts.diagnostics,
    quizContext: facts.quizContext,
    editedAt: facts.provenance.diagnostics?.editedAt,
  }) as SupportedStage1Source
}
