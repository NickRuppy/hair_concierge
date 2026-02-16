"use server"

import { createClient } from "@/lib/supabase/server"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import { redirect } from "next/navigation"

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/auth?reason=signed_out")
}

/** Link a quiz lead to the currently authenticated user's profile. */
export async function linkLeadAction(leadId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await linkQuizToProfile(user.id, user.email, leadId)
}
