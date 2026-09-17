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
import { mobileEditProfilePatch } from "./profile-edit-contract"
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
async function publish(
  client: SupabaseClient,
  binding: Binding,
  source: ScannerSourceRead,
  patch: Record<string, unknown>,
  answers: QuizAnswers | null,
  submission: RegistrationSubmission | null,
) {
  const leadId = binding.p_mode === "create" || binding.p_mode === "replace" ? randomUUID() : null
  // Explicit replacement/completion becomes its own owner-bound source. Do not
  // silently inherit paid answers or pick an unrelated email/newest lead.
  const profile = { ...source.profile, ...patch }
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
      p_patch: patch,
      p_quiz_answers: answers,
      p_lead_id: leadId,
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
    return await publish(
      client,
      binding,
      source,
      input.choice === "keep" ? {} : mobileEditProfilePatch(submission.answers),
      input.choice === "keep" ? null : submission.answers,
      submission,
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
    return await publish(client, binding, source, merged.patch, merged.answers, null)
  } catch (error) {
    if (error instanceof RegistrationCompletionError) throw error
    if (error instanceof ZodError) throw new RegistrationCompletionError("invalid_submission")
    throw new RegistrationCompletionError("temporarily_unavailable")
  }
}
