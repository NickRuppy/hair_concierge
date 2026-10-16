import { supportsResearchDataset } from "@/lib/labs/research/model"
import { NextResponse } from "next/server"
import { z } from "zod"
import { getSharedResearchLab } from "@/lib/labs/research/access"

const querySchema = z.object({
  category: z.enum(["mask", "shampoo", "conditioner", "leave-in", "oil"]).default("mask"),
  dataset: z
    .enum(["default", "pilot", "wave-01", "wave-02", "intake", "candidate"])
    .default("default"),
  itemId: z.string().trim().min(1).max(200).optional(),
})

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development")
    return NextResponse.json({ error: "Nur in development verfügbar." }, { status: 404 })
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success)
    return NextResponse.json(
      { error: "Unbekannte Kategorie oder ungültige Auswahl." },
      { status: 400 },
    )
  if (!supportsResearchDataset(parsed.data.category, parsed.data.dataset))
    return NextResponse.json(
      { error: "Datensatz für diese Kategorie nicht unterstützt." },
      { status: 400 },
    )
  try {
    return NextResponse.json({
      data: getSharedResearchLab(parsed.data.category, parsed.data.dataset, parsed.data.itemId),
    })
  } catch {
    return NextResponse.json(
      {
        error:
          "Die ausgewählten Forschungsartefakte konnten nicht geladen werden. Auswahl und lokale Dateien prüfen.",
      },
      { status: 500 },
    )
  }
}
