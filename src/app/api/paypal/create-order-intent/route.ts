import { NextResponse } from "next/server"

// Existing PayPal orders keep their capture and fulfillment routes. This endpoint
// only creates new one-time orders, which are no longer offered.
export async function POST(_request?: Request) {
  void _request
  return NextResponse.json(
    { error: "Der einmalige Haarplan ist nicht mehr verfügbar." },
    { status: 410 },
  )
}
