import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"]
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json(
      { error: "Keine Datei hochgeladen" },
      { status: 400 }
    )
  }

  // Validate MIME type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Ungültiger Dateityp. Erlaubt: JPEG, PNG, WebP, HEIC" },
      { status: 400 }
    )
  }

  // Validate size
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Datei zu groß. Maximum: 10MB" },
      { status: 400 }
    )
  }

  // Validate extension
  const ext = file.name.split(".").pop()?.toLowerCase()
  const allowedExts = ["jpg", "jpeg", "png", "webp", "heic"]
  if (!ext || !allowedExts.includes(ext)) {
    return NextResponse.json(
      { error: "Ungültige Dateiendung" },
      { status: 400 }
    )
  }

  const fileName = `${user.id}/${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { data, error } = await supabase.storage
    .from("chat-images")
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: "Fehler beim Hochladen" },
      { status: 500 }
    )
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("chat-images").getPublicUrl(data.path)

  return NextResponse.json({ url: publicUrl })
}
