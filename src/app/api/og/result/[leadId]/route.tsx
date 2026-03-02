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

  try {
    const cardData = buildCardData(lead.quiz_answers as QuizAnswers)
    const name = (lead.name as string).toUpperCase()
    const quote = (lead.share_quote as string) || "Deine Haare verdienen die richtige Pflege."

    // Load fonts from public/ at runtime (kept out of bundle to stay under 1 MB Edge limit)
    const origin = new URL(request.url).origin
    const [bebasData, montserratData] = await Promise.all([
      fetch(`${origin}/fonts/BebasNeue-Regular.ttf`).then((r) => r.arrayBuffer()),
      fetch(`${origin}/fonts/Montserrat-Regular.ttf`).then((r) => r.arrayBuffer()),
    ])

    // Pick top 4 cards (skip Ziele — too verbose for image)
    const badges = cardData.cards.slice(0, 4)

    const response = new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "1080px",
            height: "1920px",
            backgroundColor: "#231F20",
            padding: "80px 60px",
            fontFamily: "Montserrat",
            color: "white",
          }}
        >
          {/* Brand mark */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "60px" }}>
            <div style={{ display: "flex", gap: "4px" }}>
              <div style={{ width: "6px", height: "36px", backgroundColor: "#F5C518", borderRadius: "3px" }} />
              <div style={{ width: "6px", height: "36px", backgroundColor: "rgba(245,197,24,0.6)", borderRadius: "3px" }} />
              <div style={{ width: "6px", height: "36px", backgroundColor: "rgba(245,197,24,0.3)", borderRadius: "3px" }} />
            </div>
            <span
              style={{
                fontFamily: "Bebas Neue",
                fontSize: "28px",
                color: "rgba(255,255,255,0.5)",
                letterSpacing: "6px",
              }}
            >
              TOM BOT
            </span>
          </div>

          {/* Headline */}
          <div
            style={{
              fontFamily: "Bebas Neue",
              fontSize: "72px",
              color: "white",
              lineHeight: 1.1,
              marginBottom: "16px",
            }}
          >
            {name}, DEINE HAAR-DIAGNOSE
          </div>

          {/* Summary line */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              fontSize: "32px",
              color: "rgba(255,255,255,0.6)",
              marginBottom: "60px",
            }}
          >
            {cardData.summaryLine}
          </div>

          {/* Attribute badges */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              marginBottom: "60px",
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
                  borderRadius: "12px",
                  padding: "24px 28px",
                }}
              >
                <div
                  style={{
                    fontSize: "18px",
                    color: "#F5C518",
                    letterSpacing: "2px",
                    marginBottom: "8px",
                  }}
                >
                  {badge.title.toUpperCase()}
                </div>
                <div
                  style={{
                    fontSize: "24px",
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
              borderRadius: "16px",
              padding: "32px",
              flexGrow: 1,
            }}
          >
            <div
              style={{
                fontSize: "16px",
                color: "#F5C518",
                letterSpacing: "2px",
                marginBottom: "12px",
              }}
            >
              TOM SAGT
            </div>
            <div
              style={{
                fontSize: "30px",
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
              gap: "12px",
              marginTop: "40px",
            }}
          >
            <div
              style={{
                fontSize: "24px",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              Was sagt Tom zu DEINEM Haar?
            </div>
            <div
              style={{
                display: "flex",
                backgroundColor: "#F5C518",
                color: "#231F20",
                fontSize: "28px",
                padding: "16px 48px",
                borderRadius: "12px",
                letterSpacing: "2px",
              }}
            >
              QUIZ STARTEN
            </div>
            <div
              style={{
                fontSize: "20px",
                color: "rgba(255,255,255,0.35)",
                marginTop: "8px",
              }}
            >
              tombot.de/quiz
            </div>
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1920,
        fonts: [
          { name: "Bebas Neue", data: bebasData, style: "normal", weight: 400 as const },
          { name: "Montserrat", data: montserratData, style: "normal", weight: 400 as const },
        ],
      }
    )

    response.headers.set(
      "Cache-Control",
      "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600"
    )

    return response
  } catch (err) {
    return new Response(`OG generation failed: ${err instanceof Error ? err.message : String(err)}`, { status: 500 })
  }
}
