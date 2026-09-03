import { NextResponse } from "next/server"

import {
  conditionerResearchReviewRequestSchema,
  getConditionerResearchLabData,
  isConditionerResearchLabEnabled,
  reviewConditionerResearchItem,
} from "@/lib/labs/conditioner-research-access"

type ReviewRequestInput = {
  body: unknown
  environment?: NodeJS.ProcessEnv | Partial<NodeJS.ProcessEnv>
}

function unavailable() {
  return NextResponse.json({ error: "Nur lokal in development verfügbar." }, { status: 404 })
}

export async function handleConditionerResearchReviewRequest(input: ReviewRequestInput) {
  if (!isConditionerResearchLabEnabled(input.environment ?? process.env)) return unavailable()

  const parsed = conditionerResearchReviewRequestSchema.safeParse(input.body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültige Review-Anfrage.", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const result = reviewConditionerResearchItem(parsed.data)
    if (result.status === "not_found")
      return NextResponse.json({ error: result.error }, { status: 404 })
    if (result.status === "persistence_failed")
      return NextResponse.json({ error: result.error }, { status: 500 })
    if (result.status === "blocked")
      return NextResponse.json(
        { error: "Diese Conditioner-Review-Aktion ist blockiert.", blockers: result.blockers },
        { status: 409 },
      )

    const data = getConditionerResearchLabData()
    return NextResponse.json({ result, data, detail: result.item })
  } catch {
    return NextResponse.json(
      { error: "Der gespeicherte Conditioner-Review-Stand konnte nicht sicher gelesen werden." },
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
  return handleConditionerResearchReviewRequest({ body })
}
