import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { QuizAnswers } from "@/lib/quiz/types"

import { applyCompletenessDefaults, type CompletenessDefaultField } from "./completeness-defaults"
import { projectArtifactToFacts } from "./project-artifact"
import { projectLegacyLeadToFacts } from "./project-legacy-lead"
import { loadUserFacts, type UserFacts } from "./read"
import { saveUserFacts, type SaveUserFactsResult } from "./save"
import {
  DIAGNOSTICS_SCHEMA_VERSION,
  QUIZ_CONTEXT_SCHEMA_VERSION,
  diagnosticsV1Schema,
  quizContextV1Schema,
  type DiagnosticsPatch,
  type DiagnosticsV1,
  type DomainProvenance,
  type FieldProvenanceValue,
  type QuizContextPatch,
  type QuizContextV1,
} from "./schema"

/**
 * The ONE account-link facts writer (decision wave 1, Nick 2026-09-30: "latest own quiz
 * wins"), shared by `linkQuizToProfile` and the `/plan-bereit` link path.
 *
 * A quiz overwrites the profile only when it is the user's OWN (the callers establish that —
 * email/user_id ownership or an active field-test enrollment — before calling this) and NEWER
 * than the profile's last facts change. A winning quiz REPLACES the diagnostics document (and,
 * for a personal-plan artifact, quiz_context): fields the new quiz does not carry are cleared
 * with explicit nulls, `source` is the new source, goals come from the new quiz. An older quiz
 * never overwrites: it goes through `create_only`, which records it in
 * `provenance.preservedCandidates` and leaves the facts untouched.
 *
 * Completeness defaults (item B: density "medium", hair length "long") are applied to the
 * projection and marked `assumed`; `source.raw` stays the untouched envelope, so an unedited
 * record never feeds a guessed value into Stage 1.
 */

export type AccountLinkQuiz =
  | {
      kind: "artifact"
      artifactId: string
      leadId: string
      /** `personal_plan_prepared_artifacts.quiz_answers`, verbatim. */
      envelope: unknown
      /** `personal_plan_prepared_artifacts.created_at` — the quiz timestamp. */
      createdAt: string | null | undefined
    }
  | {
      kind: "lead"
      leadId: string
      quizAnswers: QuizAnswers
      /** `leads.created_at` — the quiz timestamp. */
      createdAt: string | null | undefined
    }

export type AccountLinkFactsOutcome = "replaced" | "preserved"

const DIAGNOSTICS_FIELDS = Object.keys(diagnosticsV1Schema.shape).filter(
  (field) => field !== "source",
) as Array<Exclude<keyof DiagnosticsV1, "source">>

const QUIZ_CONTEXT_FIELDS = Object.keys(quizContextV1Schema.shape) as Array<keyof QuizContextV1>

function parseTime(value: string | null | undefined): number | null {
  if (typeof value !== "string") return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : time
}

/**
 * Whether a quiz taken at `quizCreatedAt` may replace the stored diagnostics.
 *
 * - no facts row / no diagnostics document: no real quiz yet -> write.
 * - a `legacy_columns` document (the backfill's own lossy import, no quiz behind it): no real
 *   quiz yet -> write, regardless of timestamps (its `at` is the backfill run time). This
 *   matches `user_facts_save_v1`, whose `create_only` also merges over `legacy_columns`.
 * - otherwise the quiz must be strictly newer than the later of `provenance.at` and
 *   `provenance.editedAt`. An unknown quiz time, or a document with no readable provenance
 *   time at all, never overwrites (older-never-overwrites is the conservative side).
 */
export function quizSupersedesFacts(
  facts: Pick<UserFacts, "diagnostics" | "provenance"> | null,
  quizCreatedAt: string | null | undefined,
): boolean {
  const diagnostics = facts?.diagnostics
  if (!diagnostics) return true
  if (diagnostics.source.kind === "legacy_columns") return true

  const quizTime = parseTime(quizCreatedAt)
  if (quizTime === null) return false

  const provenance = facts.provenance.diagnostics
  const changes = [parseTime(provenance?.at), parseTime(provenance?.editedAt)].filter(
    (time): time is number => time !== null,
  )
  if (changes.length === 0) return false
  return quizTime > Math.max(...changes)
}

/** Per-field provenance for a quiz-sourced diagnostics document: every carried field is
 * `user`, except the completeness defaults, which are `assumed`. Sent in full on every quiz
 * write because `user_facts_save_v1` MERGES `fields` — a stale marker (an `assumed` default, a
 * backfill's `unknown_historical`) only disappears when this write names the field again. */
export function quizDiagnosticsFieldProvenance(
  diagnostics: DiagnosticsV1,
  assumedFields: readonly CompletenessDefaultField[] = [],
): Record<string, FieldProvenanceValue> {
  const fields: Record<string, FieldProvenanceValue> = {}
  for (const field of DIAGNOSTICS_FIELDS) {
    if (diagnostics[field] === undefined) continue
    fields[field] = (assumedFields as readonly string[]).includes(field) ? "assumed" : "user"
  }
  return fields
}

/** A full-replacement patch: every field the document does not carry is an explicit `null`
 * (the RPC's "clear" instruction), so nothing survives from the document it replaces. */
function replacementPatch<Field extends string>(
  document: Record<string, unknown>,
  fields: readonly Field[],
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  for (const field of fields) patch[field] = null
  for (const [key, value] of Object.entries(document)) {
    if (value !== undefined) patch[key] = value
  }
  return patch
}

type Projection = {
  diagnostics: DiagnosticsV1
  assumedFields: CompletenessDefaultField[]
  quizContext: QuizContextV1 | null
  provenanceSource: DomainProvenance["source"]
  candidate: { kind: "artifact" | "lead"; id: string }
}

function project(quiz: AccountLinkQuiz): Projection {
  if (quiz.kind === "artifact") {
    const { diagnostics, quizContext } = projectArtifactToFacts({
      envelope: quiz.envelope,
      artifactId: quiz.artifactId,
      leadId: quiz.leadId,
    })
    return {
      ...applyCompletenessDefaults(diagnostics),
      quizContext,
      provenanceSource: { kind: "personal_plan_artifact", id: quiz.artifactId },
      candidate: { kind: "artifact", id: quiz.artifactId },
    }
  }
  const { diagnostics } = projectLegacyLeadToFacts({
    leadId: quiz.leadId,
    quizAnswers: quiz.quizAnswers,
  })
  return {
    ...applyCompletenessDefaults(diagnostics),
    quizContext: null,
    provenanceSource: { kind: "legacy_lead", id: quiz.leadId },
    candidate: { kind: "lead", id: quiz.leadId },
  }
}

/** Account linking never passes a draft binding, so a `draft_conflict` (or anything but
 * ok/preserved once revision conflicts are handled) means something is badly wrong. */
function assertApplied(
  result: SaveUserFactsResult,
  domain: "diagnostics" | "quiz_context",
): asserts result is Extract<SaveUserFactsResult, { status: "ok" | "preserved" }> {
  if (result.status !== "ok" && result.status !== "preserved") {
    throw new Error(`saveUserFacts(${domain}) returned unexpected status "${result.status}"`)
  }
}

export async function writeAccountLinkFacts(
  admin: SupabaseClient,
  input: { userId: string; quiz: AccountLinkQuiz },
): Promise<AccountLinkFactsOutcome> {
  const { userId, quiz } = input
  const projection = project(quiz)
  const diagnosticsPatch = replacementPatch(
    projection.diagnostics,
    DIAGNOSTICS_FIELDS,
  ) as DiagnosticsPatch
  const diagnosticsFields = quizDiagnosticsFieldProvenance(
    projection.diagnostics,
    projection.assumedFields,
  )

  // One reload on a revision_conflict, re-deciding from the fresh facts; a second conflict
  // throws rather than looping against a live concurrent writer.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const facts = await loadUserFacts(admin, userId)
    const nowIso = new Date().toISOString()

    if (!quizSupersedesFacts(facts, quiz.createdAt)) {
      // Not newer: today's preserve behaviour. `create_only` leaves an existing domain alone
      // and records this quiz as a preserved candidate.
      const diagnosticsResult = await saveUserFacts(admin, {
        userId,
        domain: "diagnostics",
        patch: diagnosticsPatch,
        provenance: {
          source: projection.provenanceSource,
          schemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
          at: nowIso,
          fields: diagnosticsFields,
          preservedCandidates: [{ ...projection.candidate, at: nowIso }],
        },
        mode: "create_only",
      })
      assertApplied(diagnosticsResult, "diagnostics")
      if (projection.quizContext) {
        const quizContextResult = await saveUserFacts(admin, {
          userId,
          domain: "quiz_context",
          patch: projection.quizContext,
          provenance: {
            source: projection.provenanceSource,
            schemaVersion: QUIZ_CONTEXT_SCHEMA_VERSION,
            at: nowIso,
          },
          mode: "create_only",
        })
        assertApplied(quizContextResult, "quiz_context")
      }
      return "preserved"
    }

    const diagnosticsResult = await saveUserFacts(admin, {
      userId,
      domain: "diagnostics",
      patch: diagnosticsPatch,
      provenance: {
        source: projection.provenanceSource,
        schemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
        at: nowIso,
        fields: diagnosticsFields,
      },
      mode: "upsert",
      expectedRevision: facts?.revision ?? 0,
    })
    if (diagnosticsResult.status === "revision_conflict") {
      if (attempt === 0) continue
      throw new Error(
        `saveUserFacts(diagnostics) hit a second revision_conflict (row at revision ${diagnosticsResult.revision})`,
      )
    }
    assertApplied(diagnosticsResult, "diagnostics")

    if (projection.quizContext) {
      await replaceQuizContext(admin, {
        userId,
        quizContext: projection.quizContext,
        provenanceSource: projection.provenanceSource,
        at: nowIso,
        expectedRevision: diagnosticsResult.revision,
        candidateArtifactId: projection.candidate.id,
      })
    }
    return "replaced"
  }

  // Unreachable: the loop either returns or throws on its second pass.
  throw new Error("writeAccountLinkFacts: exhausted its revision_conflict retry")
}

/** The winning artifact's quiz_context, as a full replacement pinned to the revision the
 * diagnostics write just produced. On a revision_conflict it reloads once: if the diagnostics
 * document no longer comes from this artifact a concurrent writer superseded the whole link
 * and there is nothing left to do; otherwise it retries once against the fresh revision. */
async function replaceQuizContext(
  admin: SupabaseClient,
  input: {
    userId: string
    quizContext: QuizContextV1
    provenanceSource: DomainProvenance["source"]
    at: string
    expectedRevision: number
    candidateArtifactId: string
  },
): Promise<void> {
  const patch = replacementPatch(input.quizContext, QUIZ_CONTEXT_FIELDS) as QuizContextPatch
  let expectedRevision = input.expectedRevision

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await saveUserFacts(admin, {
      userId: input.userId,
      domain: "quiz_context",
      patch,
      provenance: {
        source: input.provenanceSource,
        schemaVersion: QUIZ_CONTEXT_SCHEMA_VERSION,
        at: input.at,
      },
      mode: "upsert",
      expectedRevision,
    })
    if (result.status !== "revision_conflict") {
      assertApplied(result, "quiz_context")
      return
    }
    if (attempt === 1) break

    const facts = await loadUserFacts(admin, input.userId)
    const source = facts?.diagnostics?.source
    if (
      !facts ||
      !source ||
      !("artifactId" in source) ||
      source.artifactId !== input.candidateArtifactId
    ) {
      return
    }
    expectedRevision = facts.revision
  }
  throw new Error("saveUserFacts(quiz_context) hit a second revision_conflict")
}
