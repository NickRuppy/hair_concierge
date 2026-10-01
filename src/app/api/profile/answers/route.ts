import {
  authenticatedProfileUser,
  createProfileAnswersPost,
  saveProfileAnswers,
  type ProfileAnswersSaveDeps,
} from "@/lib/hair-profile/edit-route"
import { publishProfileEdit } from "@/lib/scan/profile-edit"
import { prepareScannerContext } from "@/lib/scan/scanner-context"
import { readScannerProfileSource } from "@/lib/scan/scanner-context-supabase"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { saveUserFacts } from "@/lib/user-facts/save"

const profileAnswersDeps: ProfileAnswersSaveDeps = {
  createAdminClient,
  readScannerProfileSource,
  prepareScannerContext,
  publishProfileEdit,
  saveUserFacts,
  loadProfileRow: async (admin, userId) => {
    const { data, error } = await admin
      .from("hair_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
    if (error) throw error
    return data
  },
  randomUUID: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
}

/** The web profile editors' save (Haar-Check inline editor, Ziele editor): the quiz's
 * vocabulary in, a hand edit through `user_facts_save_v1` out (clean-switch task 5). */
export const POST = createProfileAnswersPost({
  getUserId: async () =>
    authenticatedProfileUser(
      (await createClient()) as unknown as Parameters<typeof authenticatedProfileUser>[0],
    ),
  save: (userId, answers) => saveProfileAnswers(profileAnswersDeps, userId, answers),
})
