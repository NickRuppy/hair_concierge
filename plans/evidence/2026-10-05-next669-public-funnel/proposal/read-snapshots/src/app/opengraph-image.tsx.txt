import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const runtime = "nodejs"
export const alt = "Chaarlie — Kostenlose Haaranalyse in 2 Minuten"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OgImage() {
  const [serif, sans] = await Promise.all([
    readFile(join(process.cwd(), "public/fonts/PlayfairDisplay-Regular.ttf")),
    readFile(join(process.cwd(), "public/fonts/PlusJakartaSans-Regular.ttf")),
  ])

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "72px",
        background: "linear-gradient(160deg, #FDFBF9 0%, #F2EEFA 100%)",
        fontFamily: "Jakarta",
      }}
    >
      {/* Left: copy */}
      <div style={{ display: "flex", flexDirection: "column", width: "600px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontFamily: "Jakarta",
            fontSize: "22px",
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: "#D4616A",
            marginBottom: "28px",
          }}
        >
          ● Kostenlose 2-Minuten-Haaranalyse
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            fontFamily: "Playfair",
            fontSize: "62px",
            lineHeight: 1.1,
            color: "#2A1845",
          }}
        >
          In 2 Minuten verstehst du besser, welche Pflege zu deinen&nbsp;
          <span style={{ color: "#6B50A0", display: "flex" }}>Haaren passt.</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: "44px",
            fontFamily: "Playfair",
            fontSize: "34px",
            color: "#2A1845",
          }}
        >
          <span style={{ display: "flex", color: "#2A1845" }}>chaarlie</span>
        </div>
      </div>

      {/* Right: simplified result-phone card */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "300px",
          background: "#ffffff",
          borderRadius: "28px",
          border: "1px solid rgba(0,0,0,0.06)",
          padding: "22px",
          boxShadow: "0 30px 60px -20px rgba(42,24,69,0.35)",
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: "Jakarta",
            fontSize: "13px",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "#6B50A0",
            marginBottom: "12px",
          }}
        >
          Dein Haarprofil
        </div>
        <div style={{ display: "flex", flexDirection: "row", gap: "10px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              background: "#FDEEF0",
              borderRadius: "14px",
              padding: "14px",
            }}
          >
            <span
              style={{
                display: "flex",
                fontFamily: "Jakarta",
                fontSize: "12px",
                color: "#C0555D",
                marginBottom: "10px",
              }}
            >
              HEUTE
            </span>
            <span
              style={{
                display: "flex",
                fontFamily: "Playfair",
                fontSize: "17px",
                color: "#6B3439",
              }}
            >
              wenig Feuchtigkeit
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              background: "#E8F4ED",
              borderRadius: "14px",
              padding: "14px",
            }}
          >
            <span
              style={{
                display: "flex",
                fontFamily: "Jakarta",
                fontSize: "12px",
                color: "#2D8A57",
                marginBottom: "10px",
              }}
            >
              MÖGLICHES PFLEGEZIEL
            </span>
            <span
              style={{
                display: "flex",
                fontFamily: "Playfair",
                fontSize: "17px",
                color: "#1F4D33",
              }}
            >
              mehr Geschmeidigkeit
            </span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "12px",
            background: "#F2EEFA",
            borderRadius: "14px",
            padding: "14px",
          }}
        >
          <span
            style={{
              display: "flex",
              fontFamily: "Jakarta",
              fontSize: "11px",
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: "#6B50A0",
              marginBottom: "6px",
            }}
          >
            Dein größter Hebel
          </span>
          <span
            style={{ display: "flex", fontFamily: "Playfair", fontSize: "18px", color: "#2A1845" }}
          >
            Feuchtigkeit aufbauen
          </span>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Playfair", data: serif, style: "normal", weight: 400 },
        { name: "Jakarta", data: sans, style: "normal", weight: 400 },
      ],
    },
  )
}
