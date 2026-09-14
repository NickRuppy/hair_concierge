import { after, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStripe } from "@/lib/stripe/client"
import { deferRequiredTrialNotices } from "@/lib/billing/trial-notice-dispatch"
import {
  requestTrialPaidCancellation,
  type TrialPaidCancellationDeps,
} from "@/lib/billing/trial-paid-cancellation"
export const runtime = "nodejs"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Deps = TrialPaidCancellationDeps & {
  userId: () => Promise<string | null>
  requestCancellation?: typeof requestTrialPaidCancellation
}
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } })
export async function POST(request: Request) {
  const auth = await createClient()
  const response = await handleTrialPaidCancellation(request, {
    userId: async () => (await auth.auth.getUser()).data.user?.id ?? null,
    client: createAdminClient(),
    stripe: getStripe,
  })
  if (response.ok) deferRequiredTrialNotices(after)
  return response
}
export async function handleTrialPaidCancellation(request: Request, deps: Deps) {
  const userId = await deps.userId()
  if (!userId) return reply({ error: "unauthenticated" }, 401)
  if (
    request.headers.get("origin") !== new URL(request.url).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return reply({ error: "invalid_origin" }, 403)
  if (
    request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !==
    "application/json"
  )
    return reply({ error: "invalid_request" }, 400)
  const raw = await request.text()
  if (raw.length > 2048) return reply({ error: "invalid_request" }, 400)
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return reply({ error: "invalid_request" }, 400)
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    return reply({ error: "invalid_request" }, 400)
  const body = value as Record<string, unknown>
  if (
    Object.keys(body).length !== 2 ||
    typeof body.requestId !== "string" ||
    !UUID.test(body.requestId) ||
    typeof body.enrollmentId !== "string" ||
    !UUID.test(body.enrollmentId)
  )
    return reply({ error: "invalid_request" }, 400)
  try {
    const receipt = await (deps.requestCancellation ?? requestTrialPaidCancellation)(
      { requestId: body.requestId, enrollmentId: body.enrollmentId, authenticatedUserId: userId },
      deps,
    )
    return reply(receipt)
  } catch {
    return reply({ error: "paid_cancellation_unavailable" }, 409)
  }
}
