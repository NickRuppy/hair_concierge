import { ImageResponse } from "next/og"
import { createClient } from "@supabase/supabase-js"
import { buildCardData } from "@/lib/quiz/result-card-data"
import type { QuizAnswers } from "@/lib/quiz/types"

export const runtime = "edge"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function sanitize(text: string): string {
  return text
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, " - ")
    .replace(/\u00B7/g, " / ")
    .replace(/\u2026/g, "...")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params

  if (!UUID_RE.test(leadId)) {
    return new Response("Invalid ID", { status: 400 })
  }

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
  const name = sanitize((lead.name as string).toUpperCase())
  const quote = sanitize((lead.share_quote as string) || "Deine Haare verdienen die richtige Pflege.")
  const summary = sanitize(cardData.summaryLine)
  const cards = cardData.cards.slice(0, 6).map((c) => ({
    t: sanitize(c.title).toUpperCase(),
    d: sanitize(c.description).slice(0, 90),
  }))

  // Load custom fonts at runtime
  const origin = new URL(request.url).origin
  const [bebasData, montserratData] = await Promise.all([
    fetch(`${origin}/fonts/BebasNeue-Regular.ttf`).then((r) => r.arrayBuffer()),
    fetch(`${origin}/fonts/Montserrat-Regular.ttf`).then((r) => r.arrayBuffer()),
  ])

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", backgroundColor: "#231F20", width: "100%", height: "100%", padding: "70px 55px", color: "white", fontFamily: "Montserrat" }}>
        {/* Brand mark */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 50 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <div style={{ width: 5, height: 30, backgroundColor: "#F5C518", borderRadius: 3 }} />
            <div style={{ width: 5, height: 30, backgroundColor: "#C9A013", borderRadius: 3 }} />
            <div style={{ width: 5, height: 30, backgroundColor: "#7A6010", borderRadius: 3 }} />
          </div>
          <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: 26, color: "#888", letterSpacing: 6 }}>
            TOM BOT
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: 68, color: "white", marginBottom: 12 }}>
          {name}, DEINE HAAR-DIAGNOSE
        </div>

        {/* Summary */}
        <div style={{ display: "flex", fontSize: 30, color: "#999", marginBottom: 50 }}>
          {summary}
        </div>

        {/* Badge 1 */}
        <div style={{ display: "flex", backgroundColor: "#2E2A2B", borderLeft: "4px solid #F5C518", borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 16, color: "#F5C518", letterSpacing: 2, marginBottom: 6 }}>{cards[0]?.t}</div>
            <div style={{ display: "flex", fontSize: 22, color: "#ccc" }}>{cards[0]?.d}</div>
          </div>
        </div>

        {/* Badge 2 */}
        <div style={{ display: "flex", backgroundColor: "#2E2A2B", borderLeft: "4px solid #F5C518", borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 16, color: "#F5C518", letterSpacing: 2, marginBottom: 6 }}>{cards[1]?.t}</div>
            <div style={{ display: "flex", fontSize: 22, color: "#ccc" }}>{cards[1]?.d}</div>
          </div>
        </div>

        {/* Badge 3 */}
        <div style={{ display: "flex", backgroundColor: "#2E2A2B", borderLeft: "4px solid #F5C518", borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 16, color: "#F5C518", letterSpacing: 2, marginBottom: 6 }}>{cards[2]?.t}</div>
            <div style={{ display: "flex", fontSize: 22, color: "#ccc" }}>{cards[2]?.d}</div>
          </div>
        </div>

        {/* Badge 4 */}
        <div style={{ display: "flex", backgroundColor: "#2E2A2B", borderLeft: "4px solid #F5C518", borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 16, color: "#F5C518", letterSpacing: 2, marginBottom: 6 }}>{cards[3]?.t}</div>
            <div style={{ display: "flex", fontSize: 22, color: "#ccc" }}>{cards[3]?.d}</div>
          </div>
        </div>

        {/* Badge 5 */}
        <div style={{ display: "flex", backgroundColor: "#2E2A2B", borderLeft: "4px solid #F5C518", borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 16, color: "#F5C518", letterSpacing: 2, marginBottom: 6 }}>{cards[4]?.t}</div>
            <div style={{ display: "flex", fontSize: 22, color: "#ccc" }}>{cards[4]?.d}</div>
          </div>
        </div>

        {/* Badge 6 */}
        <div style={{ display: "flex", backgroundColor: "#2E2A2B", borderLeft: "4px solid #F5C518", borderRadius: 12, padding: "20px 24px", marginBottom: 30 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 16, color: "#F5C518", letterSpacing: 2, marginBottom: 6 }}>{cards[5]?.t}</div>
            <div style={{ display: "flex", fontSize: 22, color: "#ccc" }}>{cards[5]?.d}</div>
          </div>
        </div>

        {/* Quote box */}
        <div style={{ display: "flex", border: "2px solid #C9A013", borderRadius: 14, padding: "24px 28px", marginBottom: 40 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 14, color: "#F5C518", letterSpacing: 2, marginBottom: 10 }}>TOM SAGT</div>
            <div style={{ display: "flex", fontSize: 28, color: "white" }}>{quote}</div>
          </div>
        </div>

        {/* CTA */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: "auto" }}>
          <div style={{ display: "flex", fontSize: 22, color: "#888" }}>
            Was sagt Tom zu DEINEM Haar?
          </div>
          <div style={{ display: "flex", backgroundColor: "#F5C518", color: "#231F20", fontSize: 26, padding: "14px 44px", borderRadius: 12, letterSpacing: 2 }}>
            QUIZ STARTEN
          </div>
          <div style={{ display: "flex", fontSize: 18, color: "#666", marginTop: 6 }}>
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
