import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { EditGoalsFlow } from "@/components/profile/edit-goals-flow"
import type { HairTexture } from "@/lib/vocabulary"

interface PageProps {
  searchParams: Promise<{
    returnTo?: string | string[]
  }>
}

function resolveReturnTo(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return "/profile"
  }
  return candidate
}

export default async function ProfileEditGoalsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const params = await searchParams
  const returnTo = resolveReturnTo(params.returnTo)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/auth?next=${encodeURIComponent("/profile/edit/goals")}`)
  }

  const { data: hairProfile } = await supabase
    .from("hair_profiles")
    .select("goals, hair_texture")
    .eq("user_id", user.id)
    .single()

  const initialGoals = Array.isArray(hairProfile?.goals) ? (hairProfile.goals as string[]) : []
  const hairTexture = (hairProfile?.hair_texture as HairTexture | null) ?? null

  return (
    <div className="mx-auto max-w-[540px] px-5 py-8 md:px-10 md:py-12">
      <EditGoalsFlow
        userId={user.id}
        initialGoals={initialGoals}
        hairTexture={hairTexture}
        returnTo={returnTo}
      />
    </div>
  )
}
