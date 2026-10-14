import { NextResponse } from "next/server"

const DEPRECATED_SETUP_LINK_ERROR =
  "Dieser Link wird nicht mehr verwendet. Bitte kehre zur Kontoaktivierung zurück."

export function POST() {
  return NextResponse.json({ error: DEPRECATED_SETUP_LINK_ERROR }, { status: 410 })
}
