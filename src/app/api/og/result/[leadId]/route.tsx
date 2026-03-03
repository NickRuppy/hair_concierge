import { ImageResponse } from "next/og"
import { createClient } from "@supabase/supabase-js"
import { buildCardData } from "@/lib/quiz/result-card-data"
import type { QuizAnswers } from "@/lib/quiz/types"

export const runtime = "edge"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Replace Unicode chars unsupported by the default Noto Sans Latin font */
function sanitize(text: string): string {
  return text
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, " - ")
    .replace(/\u00B7/g, " / ")
    .replace(/\u2026/g, "...")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 3) + "..." : text
}

function Badge({ title, desc }: { title: string; desc: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "rgba(255,255,255,0.06)",
        borderLeft: "4px solid #F5C518",
        borderRadius: 12,
        padding: "20px 24px",
        marginBottom: 16,
      }}
    >
      <div style={{ fontSize: 16, color: "#F5C518", letterSpacing: 2, marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 22, color: "rgba(255,255,255,0.8)", lineHeight: 1.4 }}>
        {desc}
      </div>
    </div>
  )
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

  // Hardcoded test data to isolate rendering vs data issue
  const name = "TEST"
  const quote = "Deine Haare brauchen Protein."
  const summary = "Wellig / Mittel / Trocken"
  const b = [
    { t: "HAARTYP", d: "Mittlere, wellige Haare" },
    { t: "HAARSTAERKE", d: "Mittel - gute Basis." },
    { t: "OBERFLAECHE", d: "Leicht aufgeraut." },
    { t: "PROTEIN", d: "Haare sind ueberdehnt." },
  ]
  // Suppress unused warnings
  void buildCardData
  void lead

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#231F20",
          padding: "70px 55px",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 50 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <div style={{ width: 5, height: 30, backgroundColor: "#F5C518", borderRadius: 3 }} />
            <div style={{ width: 5, height: 30, backgroundColor: "#F5C518", opacity: 0.6, borderRadius: 3 }} />
            <div style={{ width: 5, height: 30, backgroundColor: "#F5C518", opacity: 0.3, borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 24, color: "rgba(255,255,255,0.5)", letterSpacing: 6 }}>
            TOM BOT
          </div>
        </div>

        <div style={{ fontSize: 64, color: "white", lineHeight: 1.1, marginBottom: 12 }}>
          {name}, DEINE HAAR-DIAGNOSE
        </div>

        <div style={{ fontSize: 28, color: "rgba(255,255,255,0.6)", marginBottom: 50 }}>
          {summary}
        </div>

        <Badge title={b[0]?.t ?? ""} desc={b[0]?.d ?? ""} />
        <Badge title={b[1]?.t ?? ""} desc={b[1]?.d ?? ""} />
        <Badge title={b[2]?.t ?? ""} desc={b[2]?.d ?? ""} />
        <Badge title={b[3]?.t ?? ""} desc={b[3]?.d ?? ""} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            border: "2px solid rgba(245,197,24,0.4)",
            borderRadius: 16,
            padding: 28,
            marginTop: 20,
            marginBottom: 40,
          }}
        >
          <div style={{ fontSize: 14, color: "#F5C518", letterSpacing: 2, marginBottom: 10 }}>
            TOM SAGT
          </div>
          <div style={{ fontSize: 26, color: "white", lineHeight: 1.5 }}>
            {quote}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 22, color: "rgba(255,255,255,0.5)" }}>
            Was sagt Tom zu DEINEM Haar?
          </div>
          <div
            style={{
              display: "flex",
              backgroundColor: "#F5C518",
              color: "#231F20",
              fontSize: 26,
              padding: "14px 44px",
              borderRadius: 12,
              letterSpacing: 2,
            }}
          >
            QUIZ STARTEN
          </div>
          <div style={{ fontSize: 18, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>
            tombot.de/quiz
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600",
      },
    }
  )
}
