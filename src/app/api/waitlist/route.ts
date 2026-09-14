import { NextResponse } from "next/server"

export function createWaitlistPostHandler() {
  return async function POST(_request?: Request) {
    void _request
    return NextResponse.json(
      { error: "Die Anmeldung zur Warteliste ist geschlossen." },
      { status: 410 },
    )
  }
}

export const POST = createWaitlistPostHandler()
