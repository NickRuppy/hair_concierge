import { redirect } from "next/navigation"

import { moderatorReturnPath } from "@/lib/auth/moderator-return"
import {
  resolveModeratorMember,
  type ModeratorUser,
} from "@/lib/personal-plan-field-test/moderator"
import { createClient } from "@/lib/supabase/server"

import { ModeratorAccountEntry } from "./moderator-account-entry"

type ModeratorAccountPageProps = {
  searchParams: Promise<{ campaign?: string | string[] }>
}

type ModeratorAccountPageDependencies = {
  createClient: typeof createClient
  resolveMember: typeof resolveModeratorMember
  redirect: (destination: string) => never
}

const DEFAULT_DEPENDENCIES: ModeratorAccountPageDependencies = {
  createClient,
  resolveMember: resolveModeratorMember,
  redirect,
}

export function createModeratorAccountPage(
  overrides: Partial<ModeratorAccountPageDependencies> = {},
) {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...overrides }

  return async function ModeratorAccountPage({ searchParams }: ModeratorAccountPageProps) {
    const { campaign } = await searchParams
    const campaignId = typeof campaign === "string" ? campaign : null
    const returnTo = campaignId ? moderatorReturnPath(campaignId) : null
    if (!campaignId || !returnTo) return dependencies.redirect("/test/haarplan/beendet")

    const supabase = await dependencies.createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return dependencies.redirect(`/auth?next=${encodeURIComponent(returnTo)}`)

    const moderatorUser: ModeratorUser = {
      id: user.id,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
    }
    const member = await dependencies.resolveMember({ campaignId, user: moderatorUser })

    // Application routing resumes the persisted frontier, including an accepted routine.
    if (member.kind === "active") return dependencies.redirect("/anwendung")
    if (member.kind === "ended") return dependencies.redirect("/test/haarplan/beendet")

    return <ModeratorAccountEntry campaignId={campaignId} />
  }
}
