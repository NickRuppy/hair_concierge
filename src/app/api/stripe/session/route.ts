import { NextResponse, type NextRequest } from "next/server"
import { getStripe } from "@/lib/stripe/client"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 })
  }

  const stripe = getStripe()
  const session = await stripe.checkout.sessions.retrieve(id)
  return NextResponse.json({
    status: session.status,
    email: session.customer_details?.email ?? null,
    customer: typeof session.customer === "string" ? session.customer : null,
  })
}
