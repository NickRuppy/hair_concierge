import { authenticatedProfileUser } from "@/lib/hair-profile/edit-route"
import {
  createOnboardingCarePost,
  saveOnboardingCare,
  type OnboardingCareSaveDeps,
} from "@/lib/hair-profile/onboarding-care-route"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { saveUserFacts } from "@/lib/user-facts/save"

const onboardingCareDeps: OnboardingCareSaveDeps = {
  createAdminClient,
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
  now: () => new Date().toISOString(),
}

/** The onboarding care steps' save (heat tools, frequency, protection, towel, drying, brush,
 * night): the legacy column values in, a `care_habits` hand edit through `user_facts_save_v1`
 * out (clean-switch task 6). */
export const POST = createOnboardingCarePost({
  getUserId: async () =>
    authenticatedProfileUser(
      (await createClient()) as unknown as Parameters<typeof authenticatedProfileUser>[0],
    ),
  save: (userId, values) => saveOnboardingCare(onboardingCareDeps, userId, values),
})
