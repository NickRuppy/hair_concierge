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
  _request: Request,
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
  const cards = cardData.cards.slice(0, 4).map((c) => ({
    t: sanitize(c.title).toUpperCase(),
    d: sanitize(c.description).slice(0, 100),
  }))

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", backgroundColor: "#231F20", width: "100%", height: "100%", padding: 60, color: "white" }}>
        <div style={{ display: "flex", fontSize: 60, marginBottom: 12 }}>{name}, DEINE HAAR-DIAGNOSE</div>
        <div style={{ display: "flex", fontSize: 28, color: "#999", marginBottom: 40 }}>{summary}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", backgroundColor: "#333", borderRadius: 10, padding: 20, marginBottom: 12 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 14, color: "#F5C518", marginBottom: 4 }}>{cards[0]?.t}</div>
              <div style={{ display: "flex", fontSize: 20, color: "#ccc" }}>{cards[0]?.d}</div>
            </div>
          </div>
          <div style={{ display: "flex", backgroundColor: "#333", borderRadius: 10, padding: 20, marginBottom: 12 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 14, color: "#F5C518", marginBottom: 4 }}>{cards[1]?.t}</div>
              <div style={{ display: "flex", fontSize: 20, color: "#ccc" }}>{cards[1]?.d}</div>
            </div>
          </div>
          <div style={{ display: "flex", backgroundColor: "#333", borderRadius: 10, padding: 20, marginBottom: 12 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 14, color: "#F5C518", marginBottom: 4 }}>{cards[2]?.t}</div>
              <div style={{ display: "flex", fontSize: 20, color: "#ccc" }}>{cards[2]?.d}</div>
            </div>
          </div>
          <div style={{ display: "flex", backgroundColor: "#333", borderRadius: 10, padding: 20, marginBottom: 12 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 14, color: "#F5C518", marginBottom: 4 }}>{cards[3]?.t}</div>
              <div style={{ display: "flex", fontSize: 20, color: "#ccc" }}>{cards[3]?.d}</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", border: "2px solid #F5C518", borderRadius: 12, padding: 24, marginTop: 20 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 14, color: "#F5C518", marginBottom: 8 }}>TOM SAGT</div>
            <div style={{ display: "flex", fontSize: 24, color: "white" }}>{quote}</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 30 }}>
          <div style={{ display: "flex", backgroundColor: "#F5C518", color: "#231F20", fontSize: 24, padding: "12px 40px", borderRadius: 10 }}>QUIZ STARTEN</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920 }
  )
}
