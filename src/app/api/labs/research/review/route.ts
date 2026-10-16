import { supportsResearchDataset } from "@/lib/labs/research/model"
import { NextResponse } from "next/server"
import { z } from "zod"
import { getSharedResearchLab } from "@/lib/labs/research/access"
import { handleOilResearchReviewRequest } from "@/app/api/labs/oil-research/review/route"
import { handleMaskResearchReviewRequest } from "@/app/api/labs/mask-research/review/route"
import { handleShampooV14PilotReviewRequest } from "@/app/api/labs/shampoo-research/review/route"
import { handleConditionerResearchReviewRequest } from "@/app/api/labs/conditioner-research/review/route"
import { handleLeaveInResearchReviewRequest } from "@/app/api/labs/leave-in-research/review/route"

const requestSchema = z
  .object({
    category: z.enum(["mask", "shampoo", "conditioner", "leave-in", "oil"]),
    dataset: z.enum(["default", "pilot", "wave-01", "wave-02", "intake", "candidate"]),
    itemId: z.string().trim().min(1).max(200),
    displayFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    actionId: z.string().min(1).max(200),
    comment: z.string().max(4000).optional(),
  })
  .strict()

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development")
    return NextResponse.json({ error: "Nur in development verfügbar." }, { status: 404 })
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Ungültige JSON-Anfrage." }, { status: 400 })
  }
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: "Ungültige Review-Anfrage." }, { status: 400 })
  const input = parsed.data
  if (!supportsResearchDataset(input.category, input.dataset))
    return NextResponse.json(
      { error: "Datensatz für diese Kategorie nicht unterstützt." },
      { status: 400 },
    )
  let data
  try {
    data = getSharedResearchLab(input.category, input.dataset, input.itemId)
  } catch {
    return NextResponse.json(
      { error: "Der aktuelle Datensatz konnte nicht sicher geladen werden." },
      { status: 500 },
    )
  }
  if (data.detail.displayFingerprint !== input.displayFingerprint)
    return NextResponse.json(
      {
        error:
          "Die angezeigten Ergebnisse oder der Review-Stand haben sich geändert. Bitte neu laden; dein Kommentar bleibt erhalten.",
      },
      { status: 409 },
    )
  const action = [
    ...data.detail.actions,
    ...data.detail.properties.flatMap((property) => property.actions),
  ].find((candidate) => candidate.id === input.actionId)
  if (!action?.enabled)
    return NextResponse.json(
      { error: "Diese Review-Aktion ist derzeit blockiert." },
      { status: 409 },
    )
  if (action.kind === "rework" && !input.comment?.trim())
    return NextResponse.json(
      { error: "Bitte einen konkreten Prüfauftrag eingeben." },
      { status: 400 },
    )
  const nativeBody = {
    ...action.nativeBody,
    ...(input.comment?.trim() ? { comment: input.comment.trim() } : {}),
  }
  // Native validation, approval rules, rollback and persistence stay authoritative.
  const response =
    input.category === "oil"
      ? await handleOilResearchReviewRequest({ body: nativeBody })
      : input.category === "shampoo"
        ? handleShampooV14PilotReviewRequest(nativeBody)
        : input.category === "conditioner"
          ? await handleConditionerResearchReviewRequest({ body: nativeBody })
          : input.category === "leave-in"
            ? await handleLeaveInResearchReviewRequest({ body: nativeBody })
            : await handleMaskResearchReviewRequest({ body: nativeBody })
  if (!response.ok) return response
  try {
    return NextResponse.json({
      saved: true,
      data: getSharedResearchLab(input.category, input.dataset, input.itemId),
    })
  } catch {
    // A successful save must never be presented as a failed write/retry POST.
    return NextResponse.json({
      saved: true,
      refreshError:
        "Gespeichert. Die aktualisierte Anzeige konnte nicht geladen werden; bitte neu laden.",
    })
  }
}
