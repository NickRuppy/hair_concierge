import {
  getConditionerResearchLabData,
  getConditionerResearchProductDetail,
  isConditionerResearchLabEnabled,
} from "@/lib/labs/conditioner-research-access"
import { NextResponse } from "next/server"

function unavailable() {
  return NextResponse.json({ error: "Nur lokal in development verfuegbar." }, { status: 404 })
}

export async function GET(request: Request) {
  if (!isConditionerResearchLabEnabled()) return unavailable()

  try {
    const data = getConditionerResearchLabData()
    const url = new URL(request.url)
    const productId =
      url.searchParams.get("productId")?.trim() || url.searchParams.get("itemId")?.trim()
    const detail = productId ? getConditionerResearchProductDetail(productId) : data.initialDetail
    if (!detail)
      return NextResponse.json(
        { error: "Produkt nicht im Conditioner-Pilot gefunden." },
        { status: 404 },
      )

    return NextResponse.json({ ...data, detail })
  } catch {
    return NextResponse.json(
      { error: "Conditioner-Research-Artefakte konnten nicht geladen werden." },
      { status: 500 },
    )
  }
}
