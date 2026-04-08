import { z } from "zod"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  backfillLegacyConversationMemory,
  ensureUserMemorySettings,
  listUserMemoryEntries,
} from "@/lib/rag/user-memory"
import { ERR_UNAUTHORIZED, ERR_INVALID_DATA, fehler } from "@/lib/vocabulary"

const memorySettingsSchema = z.object({
  memory_enabled: z.boolean(),
})

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
  }

  const admin = createAdminClient()
  const memoryEnabled = await ensureUserMemorySettings(user.id, admin)
  await backfillLegacyConversationMemory(user.id, admin)
  const entries = await listUserMemoryEntries(user.id, admin)

  return NextResponse.json({
    settings: { memory_enabled: memoryEnabled },
    entries,
  })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
  }

  const body = await request.json()
  const parsed = memorySettingsSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: ERR_INVALID_DATA, details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("user_memory_settings")
    .upsert(
      {
        user_id: user.id,
        memory_enabled: parsed.data.memory_enabled,
      },
      { onConflict: "user_id" }
    )
    .select("memory_enabled")
    .single()

  if (error) {
    return NextResponse.json({ error: fehler("Speichern") }, { status: 500 })
  }

  return NextResponse.json({ settings: data })
}
