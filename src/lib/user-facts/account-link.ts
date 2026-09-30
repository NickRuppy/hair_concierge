import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { QuizAnswers } from "@/lib/quiz/types"

import {
  applyCompletenessDefaults,
  existingCompletenessValues,
  type CompletenessDefaultField,
  type KeptField,
} from "./completeness-defaults"
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
 * email/user_id ownership or an active field-test enrollment — before calling this) and was
 * TAKEN after the stored quiz and after any hand edit (`quizSupersedesFacts`). A winning quiz
 * REPLACES the diagnostics document and quiz_context (an artifact's own answers; a legacy lead
 * clears a previous artifact's, F4): fields the new quiz does not carry are cleared
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
 * Whether a quiz taken at `quizTakenAt` may replace the stored diagnostics (decision wave 1,
 * sharpened by wave-1 fixes F1 and F3, Nick 2026-09-30):
 *
 *   incoming wins iff takenAt > max(stored quiz time, editedAt ?? -inf)
 *
 * - no facts row / no diagnostics document: no real quiz yet -> write.
 * - the stored quiz time is WHEN THAT QUIZ WAS TAKEN — `diagnostics.source.takenAt` (F1) — and
 *   only for documents written before F1 the provenance write time `provenance.at`. So a quiz
 *   taken Monday never beats one taken Tuesday, whichever of the two is linked first.
 * - a `legacy_columns` document (the backfill's own lossy import) has no quiz behind it, so
 *   its stored quiz time is -inf (its `at` is the backfill run time, not a quiz): any quiz
 *   wins — unless a hand edit (`editedAt`) is at least as new as the quiz (F3).
 * - an unknown quiz time never beats anything but "no quiz at all": the conservative side.
 *
 * `create_only` is the losers' path only; `user_facts_save_v1` treats it as a pure preserve.
 */
export function quizSupersedesFacts(
  facts: Pick<UserFacts, "diagnostics" | "provenance"> | null,
  quizTakenAt: string | null | undefined,
): boolean {
  const diagnostics = facts?.diagnostics
  if (!diagnostics) return true

  const provenance = facts.provenance.diagnostics
  const editedTime = parseTime(provenance?.editedAt)
  const storedQuizTime =
    diagnostics.source.kind === "legacy_columns"
      ? null
      : (parseTime(diagnostics.source.takenAt) ?? parseTime(provenance?.at))
  const bars = [storedQuizTime, editedTime].filter((time): time is number => time !== null)

  if (diagnostics.source.kind === "legacy_columns" && bars.length === 0) return true
  const quizTime = parseTime(quizTakenAt)
  if (quizTime === null || bars.length === 0) return false
  return quizTime > Math.max(...bars)
}

/** Per-field provenance for a quiz-sourced diagnostics document: every carried field is
 * `user`, except the completeness defaults, which are `assumed`, and the values kept from the
 * existing profile (F2), which keep the provenance they had (and are left out of the map when
 * they had none, so nothing claims a `user` answer the quiz never gave). Sent in full on every
 * quiz write because `user_facts_save_v1` MERGES `fields` — a stale marker (an `assumed`
 * default, a backfill's `unknown_historical`) only disappears when this write names the field
 * again. */
export function quizDiagnosticsFieldProvenance(
  diagnostics: DiagnosticsV1,
  assumedFields: readonly CompletenessDefaultField[] = [],
  keptFields: readonly KeptField[] = [],
): Record<string, FieldProvenanceValue> {
  const fields: Record<string, FieldProvenanceValue> = {}
  for (const field of DIAGNOSTICS_FIELDS) {
    if (diagnostics[field] === undefined) continue
    const kept = keptFields.find((entry) => entry.field === field)
    if (kept) {
      if (kept.provenance) fields[field] = kept.provenance
      continue
    }
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
  /** The quiz's own diagnostics, BEFORE completeness defaults: those depend on the existing
   * profile (F2), so they are applied per attempt against the freshly loaded facts. */
  diagnostics: DiagnosticsV1
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
      takenAt: quiz.createdAt,
    })
    return {
      diagnostics,
      quizContext,
      provenanceSource: { kind: "personal_plan_artifact", id: quiz.artifactId },
      candidate: { kind: "artifact", id: quiz.artifactId },
    }
  }
  const { diagnostics } = projectLegacyLeadToFacts({
    leadId: quiz.leadId,
    quizAnswers: quiz.quizAnswers,
    takenAt: quiz.createdAt,
  })
  return {
    diagnostics,
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

  // One reload on a revision_conflict, re-deciding from the fresh facts; a second conflict
  // throws rather than looping against a live concurrent writer.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const facts = await loadUserFacts(admin, userId)
    const nowIso = new Date().toISOString()

    // F2: a default only fills a hole the existing profile cannot fill either.
    const completed = applyCompletenessDefaults(
      projection.diagnostics,
      existingCompletenessValues({
        diagnostics: facts?.diagnostics,
        fields: facts?.provenance.diagnostics?.fields,
        columns: facts?.legacyColumns,
      }),
    )
    const diagnosticsPatch = replacementPatch(
      completed.diagnostics,
      DIAGNOSTICS_FIELDS,
    ) as DiagnosticsPatch
    const diagnosticsFields = quizDiagnosticsFieldProvenance(
      completed.diagnostics,
      completed.assumedFields,
      completed.keptFields,
    )

    if (!quizSupersedesFacts(facts, quiz.createdAt)) {
      // Not newer: `create_only` leaves the diagnostics alone and records this quiz as a
      // preserved candidate there.
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
      // Round 2 (controller ruling): a losing quiz writes NOTHING to quiz_context. The loser
      // path only runs over an existing diagnostics document, and a create_only on a NULL
      // quiz_context would otherwise plant the loser's answers next to the winner's
      // diagnostics.
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

    // A winning quiz replaces BOTH domains. An artifact brings its own quiz_context; a legacy
    // lead carries none, so it clears the one a previous artifact left (F4: every field null),
    // and no answer from the previous quiz survives next to the new diagnostics.
    const quizContext = projection.quizContext ?? (facts?.quizContext ? {} : null)
    if (quizContext) {
      await replaceQuizContext(admin, {
        userId,
        quizContext,
        provenanceSource: projection.provenanceSource,
        at: nowIso,
        expectedRevision: diagnosticsResult.revision,
        candidate: projection.candidate,
      })
    }
    return "replaced"
  }

  // Unreachable: the loop either returns or throws on its second pass.
  throw new Error("writeAccountLinkFacts: exhausted its revision_conflict retry")
}

/** Whether a stored diagnostics source is the quiz this link wrote. */
function sourceIsCandidate(
  source: DiagnosticsV1["source"] | undefined,
  candidate: Projection["candidate"],
): boolean {
  if (!source) return false
  if (candidate.kind === "artifact") {
    return "artifactId" in source && source.artifactId === candidate.id
  }
  return source.kind === "legacy_quiz" && source.leadId === candidate.id
}

/** The winning quiz's quiz_context (an artifact's answers, or `{}` to clear a previous
 * artifact's after a legacy lead won — F4), as a full replacement pinned to the revision the
 * diagnostics write just produced. On a revision_conflict it reloads once: if the diagnostics
 * document no longer comes from this quiz a concurrent writer superseded the whole link and
 * there is nothing left to do; otherwise it retries once against the fresh revision. */
async function replaceQuizContext(
  admin: SupabaseClient,
  input: {
    userId: string
    quizContext: QuizContextV1
    provenanceSource: DomainProvenance["source"]
    at: string
    expectedRevision: number
    candidate: Projection["candidate"]
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
    if (!facts || !sourceIsCandidate(facts.diagnostics?.source, input.candidate)) return
    expectedRevision = facts.revision
  }
  throw new Error("saveUserFacts(quiz_context) hit a second revision_conflict")
}
