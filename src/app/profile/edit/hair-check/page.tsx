import { redirect } from "next/navigation"
import Link from "next/link"
import { EditHairCheckFlow } from "@/components/profile/edit-hair-check-flow"
import { createClient } from "@/lib/supabase/server"
import {
  getHairCheckEditConfig,
  isHairCheckEditField,
  resolveHairCheckReturnTo,
} from "@/lib/profile/hair-check-edit-config"
import type { HairProfile } from "@/lib/types"

interface PageProps {
  searchParams: Promise<{
    field?: string | string[]
    returnTo?: string | string[]
  }>
}

export default async function ProfileEditHairCheckPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const params = await searchParams
  const field = Array.isArray(params.field) ? params.field[0] : params.field
  const returnTo = resolveHairCheckReturnTo(params.returnTo)
  const nextParams = new URLSearchParams()

  if (typeof field === "string") {
    nextParams.set("field", field)
  }

  nextParams.set("returnTo", returnTo)

  const nextPath = `/profile/edit/hair-check?${nextParams.toString()}`

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth?next=${encodeURIComponent(nextPath)}`)
  }

  if (!isHairCheckEditField(field)) {
    redirect(returnTo)
  }

  const { data: hairProfile, error: hairProfileError } = await supabase
    .from("hair_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  if (hairProfileError) {
    console.error("[profile-edit-hair-check] failed to load hair profile:", hairProfileError)

    return (
      <main className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-[620px] flex-col justify-center px-5 py-8 md:px-10 md:py-12">
        <div className="rounded-[18px] border border-destructive/20 bg-destructive/5 p-5">
          <p className="type-overline text-destructive">Profil nicht geladen</p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-medium leading-tight text-[var(--text-heading)]">
            Deine Haar-Check-Antwort konnte gerade nicht geöffnet werden.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Bitte lade die Seite noch einmal oder gehe zurück zum Profil. So verhindern wir, dass du
            versehentlich auf Basis eines leeren Profils speicherst.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link
              href={nextPath}
              className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Erneut versuchen
            </Link>
            <Link
              href={returnTo}
              className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground"
            >
              Zurück zum Profil
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-[620px] flex-col justify-center px-5 py-8 md:px-10 md:py-12">
      <EditHairCheckFlow
        userId={user.id}
        config={getHairCheckEditConfig(field)}
        hairProfile={(hairProfile as HairProfile | null) ?? null}
        returnTo={returnTo}
      />
    </main>
  )
}
