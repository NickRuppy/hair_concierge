import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { QuizAnswers } from "@/lib/quiz/types"
import {
  buildMobileHandEditFacts,
  toProfileFactsArgument,
  type MobileFactsWrite,
} from "@/lib/mobile/profile-facts-patch"
import { buildProfileAnswersFacts, type ProfileAnswers } from "@/lib/hair-profile/profile-answers"
import { profileAfterDiagnosticsWrite } from "@/lib/user-facts/hand-edit"
import { parseUserFactsRow } from "@/lib/user-facts/read"
import { readScannerProfileSource } from "./scanner-context-supabase"
import {
  editableScannerQuizAnswers,
  prepareScannerContext,
  rebaseScannerSource,
  scannerSourceHash,
  type PreparedScannerContext,
} from "./scanner-context"

export { readScannerProfileSource, editableScannerQuizAnswers }

export class ProfileEditError extends Error {
  constructor(readonly code: "profile_conflict" | "profile_required" | "temporarily_unavailable") {
    super(code)
    this.name = "ProfileEditError"
  }
}
export type ProfileEditResult = {
  profileRevision: string
  contextRevision: string
  profile: Record<string, unknown>
  quizAnswers: QuizAnswers
  prepared: PreparedScannerContext
}
type StoredPublication = {
  outcome: string
  profileRevision: string
  contextRevision: string
  profile: Record<string, unknown>
  quizAnswers: QuizAnswers
  context: {
    input_snapshot: Pick<
      PreparedScannerContext,
      "source" | "userRefinementAnswers" | "userRefinementQuestionIds" | "assumedQuestionIds"
    >
    output_snapshot: PreparedScannerContext["snapshot"]
    snapshot_source: PreparedScannerContext["snapshotSource"]
    source_hash: string
  }
}
function result(data: StoredPublication): ProfileEditResult {
  if (data.outcome === "profile_conflict" || data.outcome === "stale_source")
    throw new ProfileEditError("profile_conflict")
  if (data.outcome === "profile_required") throw new ProfileEditError("profile_required")
  if (
    data.outcome !== "ready" ||
    typeof data.contextRevision !== "string" ||
    !/^\d+$/.test(data.profileRevision) ||
    !data.profile ||
    !data.context?.input_snapshot?.source ||
    !data.context?.output_snapshot
  )
    throw new ProfileEditError("temporarily_unavailable")
  const context = data.context
  return {
    profileRevision: data.profileRevision,
    contextRevision: data.contextRevision,
    profile: data.profile,
    quizAnswers: data.quizAnswers,
    prepared: {
      snapshot: context.output_snapshot,
      snapshotSource: context.snapshot_source,
      sourceHash: context.source_hash,
      source: context.input_snapshot.source,
      userRefinementAnswers: context.input_snapshot.userRefinementAnswers,
      userRefinementQuestionIds: context.input_snapshot.userRefinementQuestionIds,
      assumedQuestionIds: context.input_snapshot.assumedQuestionIds,
      refinedVersionId: data.contextRevision,
      refinedInputHash: context.source_hash,
    },
  }
}

/** Every variant saves facts through `user_facts_save_v1` inside the publish transaction; there
 * is no column patch (clean-switch fix round 1 deleted the last one with `PUT /api/profile`). */
export type ProfileEditInput =
  | {
      expectedProfileRevision: string
      requestId: string
      /** MOBILE path (clean-switch task 3): the complete submitted answers are saved as a hand
       * edit through `user_facts_save_v1` inside the publish transaction; no column patch. */
      quizAnswers: QuizAnswers
      saveAsFacts: true
    }
  | {
      expectedProfileRevision: string
      requestId: string
      /** WEB editors (clean-switch task 5, `POST /api/profile/answers`): the quiz-vocabulary
       * answers are saved as a hand edit through `user_facts_save_v1` inside the publish
       * transaction (`buildProfileAnswersFacts`); no column patch. */
      profileAnswers: ProfileAnswers
    }

/** Auth-verified UID only. The route owns strict patch/quiz validation. */
export async function publishProfileEdit(
  client: SupabaseClient,
  userId: string,
  input: ProfileEditInput,
): Promise<ProfileEditResult> {
  try {
    const requestHash = scannerSourceHash(input)
    const receipt = await client.rpc("scanner_profile_edit_receipt", {
      p_user_id: userId,
      p_request_id: input.requestId,
      p_request_hash: requestHash,
    })
    if (receipt.error) throw new ProfileEditError("temporarily_unavailable")
    if (receipt.data) return result(receipt.data)
    const read = await readScannerProfileSource(client, userId)
    if (read.profileRevision !== input.expectedProfileRevision)
      throw new ProfileEditError("profile_conflict")
    const before = prepareScannerContext(read)
    if (!before) throw new ProfileEditError("profile_required")
    // The facts are built against the row this read saw; the scanner clock CAS in the SQL
    // function guarantees the row is unchanged when they are written. The scanner context is
    // prepared from the columns the door WILL derive (the parity-tested TS oracle), so the
    // published context and the stored row can never disagree.
    const facts: MobileFactsWrite =
      "profileAnswers" in input
        ? buildProfileAnswersFacts({
            answers: input.profileAnswers,
            stored: parseUserFactsRow(userId, read.profile ?? {}),
            row: read.profile,
            now: new Date().toISOString(),
          })
        : buildMobileHandEditFacts({
            answers: input.quizAnswers,
            stored: parseUserFactsRow(userId, read.profile ?? {}),
            now: new Date().toISOString(),
          })
    // The row the door will leave: derived columns AND the merged facts document, which the
    // scanner reads first (one vocabulary).
    const profile = profileAfterDiagnosticsWrite(read.profile, facts)
    const previousQuiz = editableScannerQuizAnswers(read)
    const priorEdit = {
      profileRevision: read.profileRevision,
      quizAnswers: previousQuiz,
      profile: read.profile!,
      input: {
        source: before.source,
        userRefinementAnswers: before.userRefinementAnswers,
        userRefinementQuestionIds: before.userRefinementQuestionIds,
      },
    }
    const quizAnswers =
      ("quizAnswers" in input ? input.quizAnswers : undefined) ??
      editableScannerQuizAnswers({ ...read, profile, edit: priorEdit })
    // Carry only the last authoritative explicit details; never reimport a
    // discarded paid answer when an edited basic dimension later returns.
    const prepared = prepareScannerContext({
      ...read,
      profile,
      initial: null,
      refined: null,
      edit: {
        profileRevision: read.profileRevision,
        quizAnswers,
        profile,
        input: {
          // With a facts document the context rebuilds the source from the facts; the lossy
          // answer-based rebase is only the fallback for a row that still has none.
          source: profile.diagnostics
            ? before.source
            : rebaseScannerSource(before.source, quizAnswers, previousQuiz),
          userRefinementAnswers: before.userRefinementAnswers,
          userRefinementQuestionIds: before.userRefinementQuestionIds,
        },
      },
    })
    if (!prepared) throw new ProfileEditError("profile_required")
    const publication = await client.rpc("scanner_profile_edit_publish", {
      p_user_id: userId,
      p_request_id: input.requestId,
      p_request_hash: requestHash,
      p_expected_profile_revision: input.expectedProfileRevision,
      p_expected_source_revision: read.sourceRevision,
      p_facts: toProfileFactsArgument(facts),
      p_quiz_answers: quizAnswers,
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
    })
    if (publication.error || !publication.data)
      throw new ProfileEditError("temporarily_unavailable")
    return result(publication.data)
  } catch (error) {
    if (error instanceof ProfileEditError) throw error
    throw new ProfileEditError("temporarily_unavailable")
  }
}
