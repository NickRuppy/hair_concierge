import { NextResponse } from "next/server"

const DEPRECATED_SETUP_LINK_ERROR =
  "Dieser Link wird nicht mehr verwendet. Bitte kehre zur Kontoaktivierung zurück."

type RouteResult = {
  status: number
  body: Record<string, unknown>
}

export function POST() {
  return NextResponse.json({ error: DEPRECATED_SETUP_LINK_ERROR }, { status: 410 })
}

export function handleSendSetupLink(): RouteResult {
  return {
    status: 410,
    body: { error: DEPRECATED_SETUP_LINK_ERROR },
  }
}
