import { ImageResponse } from "next/og"

export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#FDFBF9",
        color: "#6B50A0",
        fontFamily: "serif",
        fontWeight: 700,
        fontSize: 28,
        lineHeight: 1,
      }}
    >
      c
    </div>,
    size,
  )
}
