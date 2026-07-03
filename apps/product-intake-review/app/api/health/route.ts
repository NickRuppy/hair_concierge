import { NextResponse } from "next/server"

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "@chaarlie/product-intake-review",
    mode: "local-placeholder",
    checkedAt: new Date().toISOString(),
  })
}
