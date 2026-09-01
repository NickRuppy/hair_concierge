import { NextResponse } from "next/server"
import { z } from "zod"

import {
  createPartnerInvitations,
  listPartnerInvitations,
  mutatePartnerInvitation,
} from "@/lib/partner-access/service"
import { sendPartnerInvitationEmail } from "@/lib/partner-access/email"
import { createClient } from "@/lib/supabase/server"

const NO_STORE = { "Cache-Control": "private, no-store" }
const createSchema = z.object({
  creators: z
    .array(
      z.object({ name: z.string().trim().min(1).max(120), email: z.string().email().max(320) }),
    )
    .min(1)
    .max(100),
})
const actionSchema = z.object({
  action: z.enum(["revoke", "reactivate", "rotate", "send"]),
  invitationId: z.string().uuid(),
})

async function requireAdmin() {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 }) }
  const { data } = await client.from("profiles").select("is_admin").eq("id", user.id).single()
  if (!data?.is_admin)
    return { response: NextResponse.json({ error: "Nicht erlaubt." }, { status: 403 }) }
  return { userId: user.id }
}

export async function GET() {
  const auth = await requireAdmin()
  if ("response" in auth) return auth.response
  try {
    return NextResponse.json({ invitations: await listPartnerInvitations() }, { headers: NO_STORE })
  } catch {
    return NextResponse.json(
      { error: "Partnerzugänge konnten nicht geladen werden." },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if ("response" in auth) return auth.response
  const body = createSchema.safeParse(await request.json().catch(() => null))
  if (!body.success)
    return NextResponse.json({ error: "Bitte prüfe Namen und E-Mail-Adressen." }, { status: 400 })
  try {
    const invitations = await createPartnerInvitations(body.data.creators, {
      createdByUserId: auth.userId,
    })
    return NextResponse.json({ invitations }, { headers: NO_STORE, status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Partnerzugänge konnten nicht erstellt werden.",
      },
      { status: 409 },
    )
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin()
  if ("response" in auth) return auth.response
  const body = actionSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: "Ungültige Aktion." }, { status: 400 })
  try {
    if (body.data.action === "send") {
      await sendPartnerInvitationEmail(body.data.invitationId)
    } else {
      await mutatePartnerInvitation(body.data.action, body.data.invitationId)
    }
    return NextResponse.json(
      {
        invitation:
          (await listPartnerInvitations()).find(
            (row) => row.invitationId === body.data.invitationId,
          ) ?? null,
      },
      { headers: NO_STORE },
    )
  } catch {
    return NextResponse.json(
      { error: "Partnerzugang konnte nicht aktualisiert werden." },
      { status: 409 },
    )
  }
}
