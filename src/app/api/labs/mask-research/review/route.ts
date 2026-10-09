import { NextResponse } from "next/server"

import {
  getMaskResearchLabData,
  isMaskResearchLabEnabled,
  maskResearchReviewRequestSchema,
  reviewMaskResearchItem,
} from "@/lib/labs/mask-research-access"

type ReviewRequestInput = {
  body: unknown
  environment?: NodeJS.ProcessEnv | Partial<NodeJS.ProcessEnv>
}

function unavailable() {
  return NextResponse.json({ error: "Nur lokal in development verfügbar." }, { status: 404 })
}

export async function handleMaskResearchReviewRequest(input: ReviewRequestInput) {
  if (!isMaskResearchLabEnabled(input.environment ?? process.env)) return unavailable()

  const parsed = maskResearchReviewRequestSchema.safeParse(input.body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültige Review-Anfrage.", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const result = reviewMaskResearchItem(parsed.data)
    if (result.status === "not_found")
      return NextResponse.json({ error: result.error }, { status: 404 })
    if (result.status === "stale_record")
      return NextResponse.json({ error: result.error }, { status: 409 })
    if (result.status === "persistence_failed")
      return NextResponse.json({ error: result.error }, { status: 500 })
    if (result.status === "blocked")
      return NextResponse.json(
        { error: "Diese Mask-Review-Aktion ist blockiert.", blockers: result.blockers },
        { status: 409 },
      )

    const data = getMaskResearchLabData()
    return NextResponse.json({ result, data, detail: result.item })
  } catch {
    return NextResponse.json(
      { error: "Der gespeicherte Mask-Review-Stand konnte nicht sicher gelesen werden." },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Ungültige JSON-Anfrage." }, { status: 400 })
  }
  return handleMaskResearchReviewRequest({ body })
}
