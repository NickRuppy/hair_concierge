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

  // Quick smoke test: if ?test=1, return a minimal image without DB
  const url = new URL(request.url)
  if (url.searchParams.get("test") === "1") {
    return new ImageResponse(
      (
        <div style={{ display: "flex", backgroundColor: "#231F20", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
          <div style={{ color: "white", fontSize: 60 }}>Hello OG</div>
        </div>
      ),
      { width: 1080, height: 1920 }
    )
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
  const badges = cardData.cards.slice(0, 4)

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#231F20",
          padding: 60,
          color: "white",
        }}
      >
        <div style={{ fontSize: 64, marginBottom: 16 }}>
          {name}, DEINE HAAR-DIAGNOSE
        </div>

        <div style={{ display: "flex", fontSize: 32, color: "rgba(255,255,255,0.6)", marginBottom: 48 }}>
          {cardData.summaryLine}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 48 }}>
          {badges.map((badge) => (
            <div
              key={badge.title}
              style={{
                display: "flex",
                flexDirection: "column",
                backgroundColor: "rgba(255,255,255,0.08)",
                borderLeft: "4px solid #F5C518",
                borderRadius: 12,
                padding: 24,
              }}
            >
              <div style={{ fontSize: 16, color: "#F5C518", marginBottom: 8 }}>
                {badge.title.toUpperCase()}
              </div>
              <div style={{ fontSize: 22, color: "rgba(255,255,255,0.8)", lineHeight: 1.4 }}>
                {badge.description.length > 100
                  ? badge.description.slice(0, 97) + "..."
                  : badge.description}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            border: "2px solid rgba(245,197,24,0.4)",
            borderRadius: 16,
            padding: 32,
            marginBottom: 48,
          }}
        >
          <div style={{ fontSize: 14, color: "#F5C518", letterSpacing: 2, marginBottom: 12 }}>
            TOM SAGT
          </div>
          <div style={{ fontSize: 28, color: "white", lineHeight: 1.5 }}>
            {quote}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: "auto" }}>
          <div style={{ fontSize: 22, color: "rgba(255,255,255,0.5)" }}>
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
            }}
          >
            QUIZ STARTEN
          </div>
          <div style={{ fontSize: 18, color: "rgba(255,255,255,0.35)", marginTop: 8 }}>
            tombot.de/quiz
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920 }
  )
}
