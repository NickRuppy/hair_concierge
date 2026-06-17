import { NextResponse } from "next/server"
import {
  PRODUCT_INTAKE_BUCKET,
  ProductIntakeImageValidationError,
  validateProductIntakeImageFile,
  type ProductIntakeImageKind,
} from "@/lib/product-intake/image-validation"
import { isProductIntakeEnabled } from "@/lib/product-intake/config"
import { checkRateLimit } from "@/lib/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { ERR_UNAUTHORIZED } from "@/lib/vocabulary"

const PRODUCT_INTAKE_UPLOAD_RATE_LIMIT = {
  prefix: "product-intake-upload",
  limit: 20,
  windowMs: 60 * 60_000,
}

function parseImageKind(value: FormDataEntryValue | null): ProductIntakeImageKind {
  return value === "barcode" ? "barcode" : "front"
}

export async function POST(request: Request) {
  if (!isProductIntakeEnabled()) {
    return NextResponse.json(
      { error: "Produktaufnahme ist aktuell deaktiviert.", code: "product_intake_disabled" },
      { status: 503 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
  }

  const rateCheck = await checkRateLimit(user.id, PRODUCT_INTAKE_UPLOAD_RATE_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        error:
          rateCheck.error === "service_unavailable"
            ? "Bildupload ist gerade nicht verfügbar. Bitte versuche es gleich erneut."
            : "Du hast gerade viele Bilder hochgeladen. Bitte warte kurz und versuche es dann erneut.",
        code: rateCheck.error === "service_unavailable" ? "rate_limit_unavailable" : "rate_limited",
      },
      { status: rateCheck.error === "service_unavailable" ? 503 : 429 },
    )
  }

  const formData = await request.formData()
  const file = formData.get("file")
  const kind = parseImageKind(formData.get("kind"))

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Bitte lade ein Bild hoch.", code: "missing_file" },
      { status: 400 },
    )
  }

  try {
    const image = await validateProductIntakeImageFile(file, kind)
    const path = `tmp/${user.id}/${crypto.randomUUID()}.${image.extension}`
    const admin = createAdminClient()
    const { error } = await admin.storage
      .from(PRODUCT_INTAKE_BUCKET)
      .upload(path, Buffer.from(image.bytes), {
        contentType: image.mimeType,
        upsert: false,
        cacheControl: "3600",
        metadata: {
          user_id: user.id,
          image_kind: kind,
          validation: image.validationMetadata.validation,
        },
      })

    if (error) {
      console.error("[product-intake] image upload failed", error)
      return NextResponse.json({ error: "Bild konnte nicht gespeichert werden." }, { status: 500 })
    }

    return NextResponse.json({
      bucket: PRODUCT_INTAKE_BUCKET,
      path,
      image_kind: kind,
      mime_type: image.mimeType,
      size_bytes: image.size,
      validation_status: image.validationStatus,
      validation_metadata: image.validationMetadata,
    })
  } catch (error) {
    if (error instanceof ProductIntakeImageValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }

    console.error("[product-intake] image validation failed", error)
    return NextResponse.json({ error: "Bild konnte nicht verarbeitet werden." }, { status: 500 })
  }
}
