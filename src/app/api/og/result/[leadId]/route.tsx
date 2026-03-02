import { ImageResponse } from "next/og"
import { createClient } from "@supabase/supabase-js"
import { buildCardData } from "@/lib/quiz/result-card-data"
import type { QuizAnswers } from "@/lib/quiz/types"

export const runtime = "edge"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params

  if (!UUID_RE.test(leadId)) {
    return new Response("Invalid ID", { status: 400 })
  }

  // Fetch lead data
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, quiz_answers, share_quote")
    .eq("id", leadId)
    .single()

  if (!lead) {
    return new Response("Not found", { status: 404 })
  }

  const cardData = buildCardData(lead.quiz_answers as QuizAnswers)
  const name = (lead.name as string).toUpperCase()
  const quote = (lead.share_quote as string) || "Deine Haare verdienen die richtige Pflege."

  // Load fonts from public/ at runtime (kept out of bundle to stay under 1 MB Edge limit)
  const origin = new URL(request.url).origin
  const [bebasRes, montserratRes] = await Promise.all([
    fetch(`${origin}/fonts/BebasNeue-Regular.ttf`),
    fetch(`${origin}/fonts/Montserrat-Regular.ttf`),
  ])

  if (!bebasRes.ok || !montserratRes.ok) {
    return new Response(
      `Font load failed: bebas=${bebasRes.status} montserrat=${montserratRes.status}`,
      { status: 500 }
    )
  }

  const [bebasData, montserratData] = await Promise.all([
    bebasRes.arrayBuffer(),
    montserratRes.arrayBuffer(),
  ])

  // Pick top 4 cards (skip Ziele — too verbose for image)
  const badges = cardData.cards.slice(0, 4)

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: 1080,
          height: 1920,
          backgroundColor: "#231F20",
          padding: "80px 60px",
          fontFamily: "Montserrat",
          color: "white",
        }}
      >
        {/* Brand mark */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 60 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <div style={{ width: 6, height: 36, backgroundColor: "#F5C518", borderRadius: 3 }} />
            <div style={{ width: 6, height: 36, backgroundColor: "rgba(245,197,24,0.6)", borderRadius: 3 }} />
            <div style={{ width: 6, height: 36, backgroundColor: "rgba(245,197,24,0.3)", borderRadius: 3 }} />
          </div>
          <span
            style={{
              fontFamily: "Bebas Neue",
              fontSize: 28,
              color: "rgba(255,255,255,0.5)",
              letterSpacing: 6,
            }}
          >
            TOM BOT
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontFamily: "Bebas Neue",
            fontSize: 72,
            color: "white",
            lineHeight: 1.1,
            marginBottom: 16,
          }}
        >
          {name}, DEINE HAAR-DIAGNOSE
        </div>

        {/* Summary line */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 32,
            color: "rgba(255,255,255,0.6)",
            marginBottom: 60,
          }}
        >
          {cardData.summaryLine}
        </div>

        {/* Attribute badges */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            marginBottom: 60,
          }}
        >
          {badges.map((badge) => (
            <div
              key={badge.title}
              style={{
                display: "flex",
                flexDirection: "column",
                backgroundColor: "rgba(255,255,255,0.06)",
                borderLeft: "4px solid #F5C518",
                borderRadius: 12,
                padding: "24px 28px",
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  color: "#F5C518",
                  letterSpacing: 2,
                  marginBottom: 8,
                }}
              >
                {badge.title.toUpperCase()}
              </div>
              <div
                style={{
                  fontSize: 24,
                  color: "rgba(255,255,255,0.8)",
                  lineHeight: 1.4,
                }}
              >
                {badge.description.length > 120
                  ? badge.description.slice(0, 117) + "..."
                  : badge.description}
              </div>
            </div>
          ))}
        </div>

        {/* Quote box */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            border: "2px solid rgba(245,197,24,0.4)",
            borderRadius: 16,
            padding: 32,
            flexGrow: 1,
          }}
        >
          <div
            style={{
              fontSize: 16,
              color: "#F5C518",
              letterSpacing: 2,
              marginBottom: 12,
            }}
          >
            TOM SAGT
          </div>
          <div
            style={{
              fontSize: 30,
              color: "white",
              lineHeight: 1.5,
            }}
          >
            {"\u201C"}{quote}{"\u201D"}
          </div>
        </div>

        {/* Bottom CTA */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            marginTop: 40,
          }}
        >
          <div style={{ fontSize: 24, color: "rgba(255,255,255,0.5)" }}>
            Was sagt Tom zu DEINEM Haar?
          </div>
          <div
            style={{
              display: "flex",
              backgroundColor: "#F5C518",
              color: "#231F20",
              fontSize: 28,
              padding: "16px 48px",
              borderRadius: 12,
              letterSpacing: 2,
            }}
          >
            QUIZ STARTEN
          </div>
          <div style={{ fontSize: 20, color: "rgba(255,255,255,0.35)", marginTop: 8 }}>
            tombot.de/quiz
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts: [
        { name: "Bebas Neue", data: bebasData, style: "normal" as const, weight: 400 as const },
        { name: "Montserrat", data: montserratData, style: "normal" as const, weight: 400 as const },
      ],
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600",
      },
    }
  )
}
