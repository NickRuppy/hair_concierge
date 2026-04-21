import { NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe/client"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).email !== "string" ||
    typeof (body as Record<string, unknown>).session_id !== "string"
  ) {
    return NextResponse.json({ error: "Missing email or session_id" }, { status: 400 })
  }

  const { email, session_id } = body as { email: string; session_id: string }

  // Verify email matches the Stripe checkout session to prevent abuse
  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(session_id)
    if (session.status !== "complete") {
      return NextResponse.json({ error: "Zahlung nicht abgeschlossen" }, { status: 403 })
    }
    const sessionEmail = session.customer_details?.email
    if (!sessionEmail || sessionEmail.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: "E-Mail stimmt nicht ueberein" }, { status: 403 })
    }
  } catch (err) {
    console.error("[send-magic-link] Stripe verification failed:", err)
    return NextResponse.json({ error: "Verifizierung fehlgeschlagen" }, { status: 500 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  const supabase = createAdminClient()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/onboarding`,
      shouldCreateUser: false,
    },
  })

  if (error) {
    console.error("[send-magic-link] signInWithOtp failed:", error.message)
    return NextResponse.json(
      { error: "E-Mail konnte nicht gesendet werden. Bitte versuche es erneut." },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
