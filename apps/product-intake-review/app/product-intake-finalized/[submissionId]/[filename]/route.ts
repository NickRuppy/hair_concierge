import { readFile } from "node:fs/promises"
import { extname, join } from "node:path"

import { NextResponse } from "next/server"

import { assertLocalServiceRoute } from "../../../api/_lib/service-client"
import { resolveFinalizedImagePath } from "./image-path"

type FinalizedImageParams = {
  params: Promise<{ submissionId: string; filename: string }>
}

export async function GET(request: Request, { params }: FinalizedImageParams) {
  try {
    assertLocalServiceRoute(request)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Bild kann nicht geladen werden.",
      },
      { status: 403 },
    )
  }

  const { submissionId, filename } = await params
  const root =
    process.env.PRODUCT_INTAKE_FINALIZED_IMAGE_DIR?.trim() ||
    join(process.cwd(), "apps/product-intake-review/public/product-intake-finalized")
  const file = resolveFinalizedImagePath(root, submissionId, filename)
  if (!file) return NextResponse.json({ error: "Bild nicht gefunden." }, { status: 404 })

  try {
    const bytes = await readFile(file)
    return new Response(bytes, {
      headers: {
        "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
        "Content-Type": contentTypeForImage(file),
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return NextResponse.json({ error: "Bild nicht gefunden." }, { status: 404 })
  }
}

function contentTypeForImage(file: string): string {
  switch (extname(file).toLowerCase()) {
    case ".png":
      return "image/png"
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    default:
      return "image/webp"
  }
}
