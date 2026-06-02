import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { hasCurrentAppAccess } from "@/lib/billing/subscriptions"

export const runtime = "nodejs"

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ hasAccess: false }, { status: 401 })
  }

  const hasAccess = await hasCurrentAppAccess(supabase, {
    userId: user.id,
    email: user.email,
  })

  return NextResponse.json({ hasAccess })
}
