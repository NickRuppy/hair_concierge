import { NextResponse } from "next/server"

import {
  getLeaveInResearchLabData,
  getLeaveInResearchProductDetail,
  isLeaveInResearchLabEnabled,
} from "@/lib/labs/leave-in-research-access"

function unavailable() {
  return NextResponse.json({ error: "Nur lokal in development verfügbar." }, { status: 404 })
}

export async function GET(request: Request) {
  if (!isLeaveInResearchLabEnabled()) return unavailable()

  try {
    const data = getLeaveInResearchLabData()
    const url = new URL(request.url)
    const productId =
      url.searchParams.get("productId")?.trim() || url.searchParams.get("itemId")?.trim()
    const detail = productId ? getLeaveInResearchProductDetail(productId) : data.initialDetail
    if (!detail)
      return NextResponse.json(
        { error: "Produkt nicht im Leave-In-Gold-Set gefunden." },
        { status: 404 },
      )

    return NextResponse.json({ ...data, detail })
  } catch {
    return NextResponse.json(
      { error: "Leave-In-Research-Artefakte konnten nicht geladen werden." },
      { status: 500 },
    )
  }
}
