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

/* ── Short lookup maps for the OG card (punchy one-liners) ── */

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
  stretches_bounces: "Balance stimmt",
  stretches_stays: "Protein fehlt",
  snaps: "Feuchtigkeit fehlt",
}

const surfaceShort: Record<string, string> = {
  glatt: "Schuppenschicht intakt",
  leicht_uneben: "Leicht aufgeraut",
  rau: "Stark geschaedigt",
}

const scalpShort: Record<string, string> = {
  fettig: "Fettige Kopfhaut",
  ausgeglichen: "Kopfhaut ausgeglichen",
  trocken: "Trockene Kopfhaut",
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

  // Hero hair type
  const thickness = thicknessHero[a.thickness ?? ""] ?? ""
  const structure = structureHero[a.structure ?? ""] ?? ""
  const emoji = heroEmoji[a.structure ?? ""] ?? "\uD83E\uDDEC"

  // 3 compact findings
  const finding1 = balanceShort[a.pulltest ?? ""] ?? "Analyse laeuft"
  const finding2 = surfaceShort[a.fingertest ?? ""] ?? "Keine Angabe"
  const finding3 = scalpShort[a.scalp_type ?? ""] ?? "Keine Angabe"

  // Goals as short text
  const goalMap: Record<string, string> = {
    spliss: "Spliss",
    frizz: "Frizz",
    kein_volumen: "Mehr Volumen",
    zu_viel_volumen: "Weniger Volumen",
    glanzlos: "Mehr Glanz",
    kopfhaut: "Kopfhaut",
    haarausfall: "Haarausfall",
  }
  const goalsArr = (a.goals ?? []).map((g) => goalMap[g] ?? g).slice(0, 3)
  const goalsLine = goalsArr.join("  /  ") || ""

  // Load custom fonts at runtime
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
          padding: "80px 65px",
          color: "white",
          fontFamily: "Montserrat",
          backgroundImage: "linear-gradient(170deg, #2a2325 0%, #1a1617 50%, #231F20 100%)",
        }}
      >
        {/* Brand mark */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 60 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <div style={{ width: 5, height: 30, backgroundColor: "#F5C518", borderRadius: 3 }} />
            <div style={{ width: 5, height: 30, backgroundColor: "#C9A013", borderRadius: 3 }} />
            <div style={{ width: 5, height: 30, backgroundColor: "#7A6010", borderRadius: 3 }} />
          </div>
          <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: 24, color: "#777", letterSpacing: 6 }}>
            TOM BOT
          </div>
        </div>

        {/* Hero emoji */}
        <div style={{ display: "flex", fontSize: 140, marginBottom: 30 }}>
          {emoji}
        </div>

        {/* Hair type — the BIG result */}
        <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: 96, color: "#F5C518", lineHeight: 1, marginBottom: 8 }}>
          {thickness} {structure}
        </div>
        <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: 96, color: "#F5C518", lineHeight: 1, marginBottom: 20 }}>
          HAARE
        </div>

        {/* Name subtitle */}
        <div style={{ display: "flex", fontSize: 30, color: "#888", marginBottom: 70 }}>
          {name}S HAAR-DIAGNOSE
        </div>

        {/* Gold divider */}
        <div style={{ display: "flex", width: 80, height: 4, backgroundColor: "#F5C518", borderRadius: 2, marginBottom: 52 }} />

        {/* Finding 1 */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 36 }}>
          <div style={{ display: "flex", fontSize: 42 }}>{"\u2696\uFE0F"}</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 16, color: "#F5C518", letterSpacing: 3, marginBottom: 6 }}>PROTEIN / FEUCHTIGKEIT</div>
            <div style={{ display: "flex", fontSize: 32, color: "white" }}>{finding1}</div>
          </div>
        </div>

        {/* Finding 2 */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 36 }}>
          <div style={{ display: "flex", fontSize: 42 }}>{"\uD83D\uDD2C"}</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 16, color: "#F5C518", letterSpacing: 3, marginBottom: 6 }}>OBERFLAECHE</div>
            <div style={{ display: "flex", fontSize: 32, color: "white" }}>{finding2}</div>
          </div>
        </div>

        {/* Finding 3 */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 36 }}>
          <div style={{ display: "flex", fontSize: 42 }}>{"\uD83E\uDDF4"}</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 16, color: "#F5C518", letterSpacing: 3, marginBottom: 6 }}>KOPFHAUT</div>
            <div style={{ display: "flex", fontSize: 32, color: "white" }}>{finding3}</div>
          </div>
        </div>

        {/* Goals */}
        {goalsLine && (
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 56 }}>
            <div style={{ display: "flex", fontSize: 42 }}>{"\uD83C\uDFAF"}</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 16, color: "#F5C518", letterSpacing: 3, marginBottom: 6 }}>DEINE ZIELE</div>
              <div style={{ display: "flex", fontSize: 30, color: "white" }}>{goalsLine}</div>
            </div>
          </div>
        )}

        {/* Tom quote — the emotional hook */}
        <div
          style={{
            display: "flex",
            border: "3px solid #F5C518",
            borderRadius: 20,
            padding: "44px 40px",
            marginBottom: 60,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 16, color: "#F5C518", letterSpacing: 4, marginBottom: 18 }}>
              TOM SAGT
            </div>
            <div style={{ display: "flex", fontSize: 38, color: "white", lineHeight: 1.4 }}>
              {quote}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginTop: "auto" }}>
          <div style={{ display: "flex", fontSize: 24, color: "#777" }}>
            Was sagt Tom zu DEINEM Haar?
          </div>
          <div
            style={{
              display: "flex",
              backgroundColor: "#F5C518",
              color: "#231F20",
              fontFamily: "Bebas Neue",
              fontSize: 32,
              padding: "18px 60px",
              borderRadius: 14,
              letterSpacing: 4,
            }}
          >
            QUIZ STARTEN
          </div>
          <div style={{ display: "flex", fontSize: 18, color: "#555", marginTop: 4 }}>
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
