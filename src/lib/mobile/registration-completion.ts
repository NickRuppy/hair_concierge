import "server-only"
import { randomUUID } from "node:crypto"
import { ZodError } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { QuizAnswers } from "@/lib/quiz/types"
import { buildLegacyQuizStage1Source } from "@/lib/personal-plan/input"
import {
  prepareScannerContext,
  rebaseScannerSource,
  scannerSourceHash,
  type ScannerSourceRead,
} from "@/lib/scan/scanner-context"
import { readScannerProfileSource } from "@/lib/scan/scanner-context-supabase"
import { parseUserFactsRow } from "@/lib/user-facts/read"
import {
  MobileProfileFactsError,
  buildMobileHandEditFacts,
  buildMobileQuizFacts,
  toProfileFactsArgument,
  type MobileFactsWrite,
} from "./profile-facts-patch"
import {
  registrationSubmissionSchema,
  registrationSubmissionHash,
  type RegistrationSubmission,
} from "./registration-contract"
import { mergeMissingProfileAnswers } from "./profile-completion-contract"

export class RegistrationCompletionError extends Error {
  constructor(
    readonly code:
      | "profile_conflict"
      | "profile_required"
      | "invalid_submission"
      | "invalid_attempt"
      | "temporarily_unavailable",
  ) {
    super(code)
    this.name = "RegistrationCompletionError"
  }
}
export type RegistrationReady = {
  status: "ready"
  profileRevision: string
  contextRevision: string
}
function ready(data: unknown): RegistrationReady {
  const row = data as Record<string, unknown> | null
  if (row?.outcome === "profile_conflict" || row?.outcome === "stale_source")
    throw new RegistrationCompletionError("profile_conflict")
  if (row?.outcome === "profile_required") throw new RegistrationCompletionError("profile_required")
  if (row?.outcome === "invalid_attempt") throw new RegistrationCompletionError("invalid_attempt")
  if (
    row?.outcome !== "ready" ||
    typeof row.profileRevision !== "string" ||
    !/^\d+$/.test(row.profileRevision) ||
    typeof row.contextRevision !== "string"
  )
    throw new RegistrationCompletionError("temporarily_unavailable")
  return {
    status: "ready",
    profileRevision: row.profileRevision,
    contextRevision: row.contextRevision,
  }
}
async function rpc(client: SupabaseClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw new RegistrationCompletionError("temporarily_unavailable")
  return data
}
type Binding = {
  p_user_id: string
  p_request_id: string
  p_request_hash: string
  p_mode: string
  p_attempt_id: string | null
  p_send_generation: string | null
  p_email: string | null
  p_submission_hash: string | null
}
/** Clean-switch task 4: the facts builders' refusals, as this flow's errors. A quiz taken now
 * that is not the latest (only possible with a future-dated stored quiz) is a conflict, never a
 * silently dropped registration. */
function factsError(error: unknown): never {
  if (error instanceof MobileProfileFactsError) {
    if (error.code === "not_newer") throw new RegistrationCompletionError("profile_conflict")
    if (error.code === "invalid_answers")
      throw new RegistrationCompletionError("invalid_submission")
  }
  throw new RegistrationCompletionError("temporarily_unavailable")
}

function storedFacts(userId: string, source: ScannerSourceRead) {
  return source.profile ? parseUserFactsRow(userId, source.profile) : null
}

async function publish(
  client: SupabaseClient,
  binding: Binding,
  source: ScannerSourceRead,
  facts: MobileFactsWrite | null,
  answers: QuizAnswers | null,
  submission: RegistrationSubmission | null,
  leadId: string | null,
  /** create / replace: the one time of the quiz taken now — the facts' `source.takenAt` and the
   * inserted lead's `created_at`. */
  quizTakenAt: string | null = null,
) {
  // Explicit replacement/completion becomes its own owner-bound source. Do not
  // silently inherit paid answers or pick an unrelated email/newest lead.
  // The scanner context is prepared from the columns the door WILL derive (the parity-tested
  // TS oracle), so the published context and the stored row agree.
  const profile = { ...source.profile, ...facts?.columns }
  const prepared =
    binding.p_mode === "keep"
      ? prepareScannerContext(source)
      : prepareScannerContext({
          ...source,
          profile,
          plan: null,
          initial: null,
          refined: null,
          refinements: [],
          leads: [],
          edit: {
            profileRevision: source.profileRevision,
            quizAnswers: answers!,
            profile,
            input:
              binding.p_mode === "missing" && source.edit
                ? {
                    source: rebaseScannerSource(
                      source.edit.input.source,
                      answers!,
                      source.edit.quizAnswers,
                    ),
                    userRefinementAnswers: source.edit.input.userRefinementAnswers,
                    userRefinementQuestionIds: source.edit.input.userRefinementQuestionIds,
                  }
                : {
                    source: buildLegacyQuizStage1Source({
                      leadId: leadId ?? "profile",
                      answers: answers!,
                    }),
                    userRefinementAnswers: {},
                    userRefinementQuestionIds: [],
                  },
          },
        })
  if (!prepared) throw new RegistrationCompletionError("profile_required")
  return ready(
    await rpc(client, "mobile_registration_publish", {
      ...binding,
      p_expected_profile_revision: source.profileRevision,
      p_expected_source_revision: source.sourceRevision,
      p_facts: facts ? toProfileFactsArgument(facts) : null,
      p_quiz_answers: answers,
      p_lead_id: leadId,
      p_quiz_taken_at: quizTakenAt,
      p_submission: submission,
      p_source_hash: prepared.sourceHash,
      p_engine_version: prepared.snapshot.computationVersion,
      p_input_snapshot: {
        source: prepared.source,
        userRefinementAnswers: prepared.userRefinementAnswers,
        userRefinementQuestionIds: prepared.userRefinementQuestionIds,
        assumedQuestionIds: prepared.assumedQuestionIds,
      },
      p_output_snapshot: prepared.snapshot,
      p_snapshot_source: prepared.snapshotSource,
    }),
  )
}
/** UID/email/generation come exclusively from verified completion authority. */
export async function completeMobileRegistration(
  client: SupabaseClient,
  userId: string,
  email: string,
  input: {
    attemptId: string
    sendGeneration: string
    submission: RegistrationSubmission
    choice: "create" | "keep" | "replace"
    expectedProfileRevision: string
  },
): Promise<RegistrationReady> {
  try {
    const parsed = registrationSubmissionSchema.safeParse(input.submission)
    if (!parsed.success || parsed.data.email !== email.trim().toLowerCase())
      throw new RegistrationCompletionError("invalid_submission")
    const submission = parsed.data
    const hash = registrationSubmissionHash(submission)
    const binding: Binding = {
      p_user_id: userId,
      p_request_id: submission.requestId,
      p_request_hash: scannerSourceHash({
        hash,
        choice: input.choice,
        expectedProfileRevision: input.expectedProfileRevision,
      }),
      p_mode: input.choice,
      p_attempt_id: input.attemptId,
      p_send_generation: input.sendGeneration,
      p_email: submission.email,
      p_submission_hash: hash,
    }
    const receipt = await rpc(client, "mobile_registration_publication_receipt", binding)
    if (receipt) return ready(receipt)
    const source = await readScannerProfileSource(client, userId)
    if (
      source.profileRevision !== input.expectedProfileRevision ||
      (input.choice === "create" && source.profile) ||
      (input.choice !== "create" && !source.profile)
    )
      throw new RegistrationCompletionError("profile_conflict")
    // create / replace are a quiz taken now: the web account link's "latest own quiz wins"
    // winner write, sourced from the lead this publication inserts. keep writes nothing.
    const leadId = input.choice === "keep" ? null : randomUUID()
    const quizTakenAt = leadId ? new Date().toISOString() : null
    let facts: MobileFactsWrite | null = null
    if (leadId) {
      try {
        facts = buildMobileQuizFacts({
          answers: submission.answers,
          leadId,
          stored: storedFacts(userId, source),
          now: quizTakenAt!,
        })
      } catch (error) {
        factsError(error)
      }
    }
    return await publish(
      client,
      binding,
      source,
      facts,
      input.choice === "keep" ? null : submission.answers,
      submission,
      leadId,
      quizTakenAt,
    )
  } catch (error) {
    if (error instanceof RegistrationCompletionError) throw error
    if (error instanceof ZodError) throw new RegistrationCompletionError("invalid_submission")
    throw new RegistrationCompletionError("temporarily_unavailable")
  }
}
/** Ordinary verified login: no registration consent or account-name mutation. */
export async function completeMobileProfile(
  client: SupabaseClient,
  userId: string,
  input: { requestId: string; expectedProfileRevision: string; answers: Partial<QuizAnswers> },
): Promise<RegistrationReady> {
  try {
    const binding: Binding = {
      p_user_id: userId,
      p_request_id: input.requestId,
      p_request_hash: scannerSourceHash(input),
      p_mode: "missing",
      p_attempt_id: null,
      p_send_generation: null,
      p_email: null,
      p_submission_hash: null,
    }
    const receipt = await rpc(client, "mobile_registration_publication_receipt", binding)
    if (receipt) return ready(receipt)
    const source = await readScannerProfileSource(client, userId)
    if (source.profileRevision !== input.expectedProfileRevision)
      throw new RegistrationCompletionError("profile_conflict")
    const merged = mergeMissingProfileAnswers(source.profile, input.answers)
    // Completion names only the missing answers (a hand edit of those groups, after "latest
    // own quiz wins" with the quiz taken now); nothing missing writes nothing, as before.
    let facts: MobileFactsWrite | null = null
    if (merged.missing.length > 0) {
      try {
        facts = buildMobileHandEditFacts({
          answers: merged.answers,
          stored: storedFacts(userId, source),
          now: new Date().toISOString(),
          groups: merged.missing,
          completion: true,
        })
      } catch (error) {
        factsError(error)
      }
    }
    return await publish(client, binding, source, facts, merged.answers, null, null)
  } catch (error) {
    if (error instanceof RegistrationCompletionError) throw error
    if (error instanceof ZodError) throw new RegistrationCompletionError("invalid_submission")
    throw new RegistrationCompletionError("temporarily_unavailable")
  }
}
