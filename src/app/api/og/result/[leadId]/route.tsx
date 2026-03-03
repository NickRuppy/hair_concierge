import { ImageResponse } from "next/og"
import { createClient } from "@supabase/supabase-js"
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

/* ── Lookup maps ── */

const structureHero: Record<string, string> = {
  straight: "GLATTE",
  wavy: "WELLIGE",
  curly: "LOCKIGE",
  coily: "KRAUSE",
}

const thicknessHero: Record<string, string> = {
  fine: "FEINE",
  normal: "MITTLERE",
  coarse: "DICKE",
}

const heroEmoji: Record<string, string> = {
  straight: "\uD83E\uDDB0",
  wavy: "\uD83D\uDCA7",
  curly: "\u27B0",
  coily: "\uD83E\uDDF6",
}

const balanceShort: Record<string, string> = {
  stretches_bounces: "Stimmt",
  stretches_stays: "Protein fehlt",
  snaps: "Zu trocken",
}

const surfaceShort: Record<string, string> = {
  glatt: "Intakt",
  leicht_uneben: "Aufgeraut",
  rau: "Geschaedigt",
}

const scalpShort: Record<string, string> = {
  fettig: "Fettig",
  ausgeglichen: "Ausgeglichen",
  trocken: "Trocken",
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

  const a = lead.quiz_answers as QuizAnswers
  const name = sanitize((lead.name as string).toUpperCase())
  const quote = sanitize(
    (lead.share_quote as string) || "Deine Haare verdienen die richtige Pflege."
  )

  const thickness = thicknessHero[a.thickness ?? ""] ?? ""
  const structure = structureHero[a.structure ?? ""] ?? ""
  const emoji = heroEmoji[a.structure ?? ""] ?? "\uD83E\uDDEC"

  const finding1 = balanceShort[a.pulltest ?? ""] ?? "-"
  const finding2 = surfaceShort[a.fingertest ?? ""] ?? "-"
  const finding3 = scalpShort[a.scalp_type ?? ""] ?? "-"

  const origin = new URL(request.url).origin
  const [bebasData, montserratData] = await Promise.all([
    fetch(`${origin}/fonts/BebasNeue-Regular.ttf`).then((r) => r.arrayBuffer()),
    fetch(`${origin}/fonts/Montserrat-Regular.ttf`).then((r) => r.arrayBuffer()),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          color: "white",
          fontFamily: "Montserrat",
          backgroundImage: "linear-gradient(180deg, #1a1617 0%, #231F20 50%, #1a1617 100%)",
        }}
      >
        {/* Gold top accent bar */}
        <div
          style={{
            display: "flex",
            width: "100%",
            height: 6,
            backgroundImage: "linear-gradient(90deg, #7A6010 0%, #F5C518 50%, #7A6010 100%)",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "50px 65px 70px",
            flex: 1,
          }}
        >
          {/* Brand mark */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 4 }}>
              <div style={{ width: 5, height: 24, backgroundColor: "#F5C518", borderRadius: 3 }} />
              <div style={{ width: 5, height: 24, backgroundColor: "#C9A013", borderRadius: 3 }} />
              <div style={{ width: 5, height: 24, backgroundColor: "#7A6010", borderRadius: 3 }} />
            </div>
            <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: 22, color: "#666", letterSpacing: 6 }}>
              TOM BOT
            </div>
          </div>

          {/* Section label */}
          <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: 32, color: "#F5C518", letterSpacing: 10, marginBottom: 4 }}>
            HAAR-DIAGNOSE
          </div>

          {/* Name */}
          <div style={{ display: "flex", fontSize: 22, color: "#666", letterSpacing: 3, marginBottom: 70 }}>
            {name}
          </div>

          {/* Emoji in gold-rimmed circle */}
          <div
            style={{
              display: "flex",
              width: 240,
              height: 240,
              borderRadius: 120,
              backgroundColor: "#2a2210",
              border: "3px solid #C9A013",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 40,
            }}
          >
            <div style={{ display: "flex", fontSize: 130 }}>{emoji}</div>
          </div>

          {/* Hair type — THE hero result */}
          <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: 105, color: "white", lineHeight: 1 }}>
            {thickness}
          </div>
          <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: 105, color: "white", lineHeight: 1, marginBottom: 6 }}>
            {structure}
          </div>
          <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: 130, color: "#F5C518", lineHeight: 1, marginBottom: 56 }}>
            HAARE
          </div>

          {/* Gold gradient divider */}
          <div
            style={{
              display: "flex",
              width: 140,
              height: 5,
              backgroundImage: "linear-gradient(90deg, #7A6010, #F5C518, #7A6010)",
              borderRadius: 3,
              marginBottom: 52,
            }}
          />

          {/* 3 stat boxes side by side */}
          <div style={{ display: "flex", gap: 18, marginBottom: 56, width: "100%" }}>
            {/* Box 1: Balance */}
            <div
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                alignItems: "center",
                backgroundColor: "#2a2628",
                borderRadius: 20,
                padding: "32px 14px",
                borderTop: "4px solid #F5C518",
              }}
            >
              <div style={{ display: "flex", fontSize: 48, marginBottom: 14 }}>{"\u2696\uFE0F"}</div>
              <div style={{ display: "flex", fontSize: 18, color: "#F5C518", letterSpacing: 2, marginBottom: 10 }}>BALANCE</div>
              <div style={{ display: "flex", fontSize: 28, color: "white" }}>{finding1}</div>
            </div>
            {/* Box 2: Surface */}
            <div
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                alignItems: "center",
                backgroundColor: "#2a2628",
                borderRadius: 20,
                padding: "32px 14px",
                borderTop: "4px solid #F5C518",
              }}
            >
              <div style={{ display: "flex", fontSize: 48, marginBottom: 14 }}>{"\uD83D\uDD2C"}</div>
              <div style={{ display: "flex", fontSize: 18, color: "#F5C518", letterSpacing: 2, marginBottom: 10 }}>OBERFLAECHE</div>
              <div style={{ display: "flex", fontSize: 28, color: "white" }}>{finding2}</div>
            </div>
            {/* Box 3: Scalp */}
            <div
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                alignItems: "center",
                backgroundColor: "#2a2628",
                borderRadius: 20,
                padding: "32px 14px",
                borderTop: "4px solid #F5C518",
              }}
            >
              <div style={{ display: "flex", fontSize: 48, marginBottom: 14 }}>{"\uD83E\uDDF4"}</div>
              <div style={{ display: "flex", fontSize: 18, color: "#F5C518", letterSpacing: 2, marginBottom: 10 }}>KOPFHAUT</div>
              <div style={{ display: "flex", fontSize: 28, color: "white" }}>{finding3}</div>
            </div>
          </div>

          {/* Tom quote — flex: 1 absorbs remaining space */}
          <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", padding: "0 20px" }}>
            <div style={{ display: "flex", fontSize: 18, color: "#F5C518", letterSpacing: 5, marginBottom: 16 }}>
              TOM SAGT
            </div>
            <div style={{ display: "flex", fontSize: 40, color: "#ccc", lineHeight: 1.5, marginBottom: 20 }}>
              {'"'}{quote}{'"'}
            </div>
            <div style={{ display: "flex", fontSize: 22, color: "#F5C518", letterSpacing: 5 }}>
              -- TOM
            </div>
          </div>

          {/* CTA */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", fontSize: 26, color: "#666" }}>
              Was sagt Tom zu DEINEM Haar?
            </div>
            <div
              style={{
                display: "flex",
                backgroundImage: "linear-gradient(90deg, #C9A013, #F5C518, #C9A013)",
                color: "#1a1617",
                fontFamily: "Bebas Neue",
                fontSize: 40,
                padding: "22px 100px",
                borderRadius: 16,
                letterSpacing: 5,
              }}
            >
              QUIZ STARTEN
            </div>
            <div style={{ display: "flex", fontSize: 20, color: "#444", marginTop: 4 }}>
              tombot.de/quiz
            </div>
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
