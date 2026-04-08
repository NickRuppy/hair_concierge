import { z } from "zod"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  deleteUserMemoryEntry,
  updateUserMemoryEntry,
} from "@/lib/rag/user-memory"
import { ERR_UNAUTHORIZED, ERR_INVALID_DATA } from "@/lib/vocabulary"

const memoryUpdateSchema = z.object({
  content: z.string().trim().min(1).max(500),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
  }

  const body = await request.json()
  const parsed = memoryUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: ERR_INVALID_DATA, details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const memory = await updateUserMemoryEntry(user.id, id, parsed.data.content)
  if (!memory) {
    return NextResponse.json({ error: "Erinnerung nicht gefunden" }, { status: 404 })
  }

  return NextResponse.json({ memory })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
  }

  const deleted = await deleteUserMemoryEntry(user.id, id)
  if (!deleted) {
    return NextResponse.json({ error: "Erinnerung nicht gefunden" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
