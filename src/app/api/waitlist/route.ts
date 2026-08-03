import { after, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"

import { syncWaitlistSignupToCustomerIo } from "@/lib/customerio/waitlist-sync"
import { FUNNEL_SESSION_COOKIE } from "@/lib/funnel/cookie"
import { resolveFunnelCookieContext } from "@/lib/funnel/server"
import { checkRateLimit, WAITLIST_RATE_LIMIT } from "@/lib/rate-limit"

const waitlistSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Bitte gib deinen Vornamen an")
      .max(80, "Bitte bleib bei maximal 80 Zeichen"),
    email: z.string().trim().email("Bitte gib eine gültige E-Mail-Adresse an").max(160),
  })
  .strict()

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown"

  // checkRateLimit wirft, wenn der Supabase-Admin-Client nicht konfiguriert ist.
  // Ohne diesen Fang antwortet die Route mit einem leeren 500er, und der Eintrag
  // geht kommentarlos verloren. Bewusst fail-closed: kein Rate-Limit heisst nicht
  // "durchwinken".
  let rateCheck: Awaited<ReturnType<typeof checkRateLimit>>
  try {
    rateCheck = await checkRateLimit(ip, WAITLIST_RATE_LIMIT)
  } catch (error) {
    console.error("[waitlist] rate limit unavailable", error)
    rateCheck = { allowed: false, error: "service_unavailable" }
  }

  if (!rateCheck.allowed) {
    const unavailable = rateCheck.error === "service_unavailable"
    return NextResponse.json(
      {
        error: unavailable
          ? "Eintrag ist gerade nicht möglich. Bitte versuch es in einem Moment nochmal."
          : "Zu viele Anfragen",
      },
      { status: unavailable ? 503 : 429 },
    )
  }

  let parsed: z.infer<typeof waitlistSchema>
  try {
    parsed = waitlistSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: "Bitte prüfe Name und E-Mail-Adresse" }, { status: 400 })
  }

  const cookieStore = await cookies()
  const funnelContext = await resolveFunnelCookieContext(
    cookieStore.get(FUNNEL_SESSION_COOKIE)?.value,
  )
  const createdAt = new Date().toISOString()

  // Customer.io ist hier der Datenspeicher der Warteliste, nicht nur der Versender.
  // Deshalb wird der Sync abgewartet: Ein stiller Fehlschlag wuerde bedeuten, dass
  // der Eintrag nirgends existiert.
  try {
    const { identify } = await syncWaitlistSignupToCustomerIo({
      createdAt,
      email: parsed.email,
      funnelPackageKey: funnelContext?.packageKey,
      funnelSessionId: funnelContext?.sessionId,
      name: parsed.name,
    })

    if (!identify.ok) {
      return NextResponse.json(
        { error: "Eintrag konnte gerade nicht gespeichert werden. Bitte versuch es nochmal." },
        { status: 502 },
      )
    }
  } catch (error) {
    console.error("[waitlist] signup failed", error)
    return NextResponse.json(
      { error: "Eintrag konnte gerade nicht gespeichert werden. Bitte versuch es nochmal." },
      { status: 502 },
    )
  }

  after(() => {
    console.info("[waitlist] signup stored", { funnelPackageKey: funnelContext?.packageKey })
  })

  return NextResponse.json({ ok: true })
}
