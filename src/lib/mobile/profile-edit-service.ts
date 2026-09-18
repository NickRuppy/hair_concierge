import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { MobileError } from "./auth"
import {
  mobileEditQuestions,
  mobileEditProfilePatch,
  type ProfileEditRequest,
} from "./profile-edit-contract"
import { mobileProfileAnswers } from "./profile-service"
import { prepareScannerContext } from "@/lib/scan/scanner-context"
import {
  editableScannerQuizAnswers,
  readScannerProfileSource,
  publishProfileEdit,
  ProfileEditError,
} from "@/lib/scan/profile-edit"

export async function loadMobileProfileEdit(client: SupabaseClient, userId: string) {
  const source = await readScannerProfileSource(client, userId)
  if (!prepareScannerContext(source)) throw new MobileError("profile_required", 403)
  const answers = editableScannerQuizAnswers(source)
  return {
    profileRevision: source.profileRevision,
    answers,
    questions: mobileEditQuestions(answers),
  }
}
export async function saveMobileProfileEdit(
  client: SupabaseClient,
  userId: string,
  input: ProfileEditRequest,
) {
  try {
    const result = await publishProfileEdit(client, userId, {
      expectedProfileRevision: input.expectedProfileRevision,
      requestId: input.requestId,
      patch: mobileEditProfilePatch(input.answers),
      quizAnswers: input.answers,
    })
    return {
      profileRevision: result.profileRevision,
      contextRevision: result.contextRevision,
      answers: mobileProfileAnswers(result.profile, result.prepared, input.answers),
    }
  } catch (error) {
    if (error instanceof ProfileEditError)
      throw new MobileError(
        error.code,
        error.code === "profile_conflict" ? 409 : error.code === "profile_required" ? 403 : 503,
      )
    throw error
  }
}
