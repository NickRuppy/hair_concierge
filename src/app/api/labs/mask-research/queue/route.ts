import { NextResponse } from "next/server"

import {
  getMaskResearchLabData,
  getMaskResearchProductDetail,
  isMaskResearchLabEnabled,
} from "@/lib/labs/mask-research-access"

function unavailable() {
  return NextResponse.json({ error: "Nur lokal in development verfügbar." }, { status: 404 })
}

export async function GET(request: Request) {
  if (!isMaskResearchLabEnabled()) return unavailable()

  try {
    const data = getMaskResearchLabData()
    const url = new URL(request.url)
    const productId =
      url.searchParams.get("productId")?.trim() || url.searchParams.get("itemId")?.trim()
    const detail = productId ? getMaskResearchProductDetail(productId) : data.initialDetail
    if (!detail)
      return NextResponse.json(
        { error: "Produkt nicht im Mask-Gold-Set gefunden." },
        { status: 404 },
      )

    return NextResponse.json({ ...data, detail })
  } catch {
    return NextResponse.json(
      { error: "Mask-Research-Artefakte konnten nicht geladen werden." },
      { status: 500 },
    )
  }
}
