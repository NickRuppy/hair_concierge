import { authenticatedProfileUser } from "@/lib/hair-profile/edit-route"
import {
  createShoppingPreferencesPost,
  saveShoppingPreferences,
  type ShoppingPreferencesSaveDeps,
} from "@/lib/hair-profile/shopping-preferences-route"
import { isShoppingBudgetEnabled } from "@/lib/personal-plan/release"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { loadUserFacts } from "@/lib/user-facts/read"
import { saveUserFacts } from "@/lib/user-facts/save"

const shoppingPreferencesDeps: ShoppingPreferencesSaveDeps = {
  createAdminClient,
  loadUserFacts,
  saveUserFacts,
  now: () => new Date().toISOString(),
}

/** The member's budget answer: a `shopping_preferences` write through `user_facts_save_v1`. It
 * never touches the diagnostics, the personal plan or the routine. */
export const POST = createShoppingPreferencesPost({
  getUserId: async () =>
    authenticatedProfileUser(
      (await createClient()) as unknown as Parameters<typeof authenticatedProfileUser>[0],
    ),
  save: (userId, body) => saveShoppingPreferences(shoppingPreferencesDeps, userId, body),
  isEnabled: () => isShoppingBudgetEnabled(),
})
