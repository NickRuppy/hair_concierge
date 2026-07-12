import { ImageResponse } from "next/og"

export const size = { width: 512, height: 512 }
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
        borderRadius: 128,
        background: "#34174F",
      }}
    >
      <svg width="288" height="288" viewBox="0 0 24 24" fill="#FDFBF9">
        <path d="M12 2C9 7 5 11 5 15a7 7 0 0014 0c0-4-4-8-7-13z" />
      </svg>
    </div>,
    size,
  )
}
