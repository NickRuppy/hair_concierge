import {
  authenticatedProfileUser,
  createProfileAnswersPost,
  saveProfileAnswers,
  type ProfileAnswersSaveDeps,
} from "@/lib/hair-profile/edit-route"
import { createProductionSyncPlanWithFacts } from "@/lib/personal-plan/facts-recompute"
import { recomputeRoutineAfterHabitsCompletion } from "@/lib/personal-plan/refinement-recompute/orchestrator"
import { createProductionStage3RecomputeDeps } from "@/lib/personal-plan/refinement-recompute/production-deps"
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
  // A saved profile moves the user's plan (central profile PR2). The admin client is built per
  // call, like the other routes; both deps are never-fail from the save's point of view.
  syncPlanWithFacts: (input) => createProductionSyncPlanWithFacts(createAdminClient())(input),
  recomputeRoutine: ({ userId, personalPlanId, refinedVersionId }) =>
    recomputeRoutineAfterHabitsCompletion(
      createProductionStage3RecomputeDeps({ userId, admin: createAdminClient() }),
      { userId, personalPlanId, refinedVersionId },
    ),
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

// A plan rebase plus the inline routine recompute can outlast the default ceiling; same shape and
// reason as `personal-plan/stage-2/route.ts`'s habits recompute.
export const maxDuration = 60
