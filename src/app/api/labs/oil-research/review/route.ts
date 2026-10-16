import { NextResponse } from "next/server"
import {
  oilResearchReviewRequestSchema,
  reviewOilResearchItem,
} from "@/lib/labs/oil-research-access"
import { OilReviewConflict } from "@/lib/oil-research/review-state"
export async function handleOilResearchReviewRequest(input: { body: unknown }) {
  if (process.env.NODE_ENV !== "development")
    return NextResponse.json({ error: "Nur lokal in development verfügbar." }, { status: 404 })
  const parsed = oilResearchReviewRequestSchema.safeParse(input.body)
  if (!parsed.success)
    return NextResponse.json({ error: "Ungültige Öl-Review-Anfrage." }, { status: 400 })
  try {
    return NextResponse.json({ saved: true, result: await reviewOilResearchItem(parsed.data) })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof OilReviewConflict
            ? error.message
            : "Der Öl-Prüfstand konnte nicht sicher gespeichert werden.",
      },
      { status: error instanceof OilReviewConflict ? 409 : 500 },
    )
  }
}
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development")
    return NextResponse.json({ error: "Nur lokal in development verfügbar." }, { status: 404 })
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Ungültige JSON-Anfrage." }, { status: 400 })
  }
  return handleOilResearchReviewRequest({ body })
}
