import { after, NextResponse } from "next/server"
import { deferRequiredTrialNotices } from "@/lib/billing/trial-notice-dispatch"
import { createClient } from "@/lib/supabase/server"

import { submitTrialCancellationDeclaration } from "@/lib/billing/trial-cancellation-declarations"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStripe } from "@/lib/stripe/client"
import { reconcilePayPalTrialCancellation } from "@/lib/paypal/trial-cancellation"
import {
  decodeTrialCancellationCapability,
  projectTrialCancellationCapability,
  reconcileStripeTrialCancellation,
} from "@/lib/stripe/trial-cancellation"

export const runtime = "nodejs"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Admin = ReturnType<typeof createAdminClient>
type PayPalDeps = {
  retrieve: (
    subscriptionId: string,
  ) => Promise<import("@/lib/paypal/subscription-shapes").PayPalSubscription>
  cancel: (subscriptionId: string, reason: string) => Promise<void>
}
type Deps = {
  userId: () => Promise<string | null>
  admin: Admin
  stripe: () => ReturnType<typeof getStripe>
  paypal?: () => Promise<PayPalDeps>
  secret: string
}
type CapabilityDeps = Pick<Deps, "userId" | "admin" | "secret"> & { requestId: () => string }

function invalidRequest() {
  return NextResponse.json({ error: "invalid_request" }, { status: 400 })
}

function isExactPostBody(value: unknown): value is { enrollmentId: string; capability: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return (
    Object.keys(record).length === 2 &&
    Object.hasOwn(record, "enrollmentId") &&
    Object.hasOwn(record, "capability") &&
    typeof record.enrollmentId === "string" &&
    typeof record.capability === "string" &&
    UUID.test(record.enrollmentId)
  )
}

export async function GET(request: Request) {
  const auth = await createClient()
  return handleTrialCancellationCapability(request, {
    userId: async () => (await auth.auth.getUser()).data.user?.id ?? null,
    admin: createAdminClient(),
    secret: process.env.TRIAL_CANCELLATION_SIGNING_SECRET ?? "",
    requestId: crypto.randomUUID,
  })
}

export async function POST(request: Request) {
  const auth = await createClient()
  const response = await handleTrialCancellation(request, {
    userId: async () => (await auth.auth.getUser()).data.user?.id ?? null,
    admin: createAdminClient(),
    stripe: getStripe,
    paypal: async () => {
      const { retrievePayPalSubscription, cancelPayPalSubscription } =
        await import("@/lib/paypal/subscriptions")
      return { retrieve: retrievePayPalSubscription, cancel: cancelPayPalSubscription }
    },
    secret: process.env.TRIAL_CANCELLATION_SIGNING_SECRET ?? "",
  })
  if (response.ok) deferRequiredTrialNotices(after)
  return response
}

export async function handleTrialCancellationCapability(request: Request, deps: CapabilityDeps) {
  const userId = await deps.userId()
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  const url = new URL(request.url)
  if (url.searchParams.size !== 1 || !url.searchParams.has("enrollmentId")) return invalidRequest()
  const enrollmentId = url.searchParams.get("enrollmentId")
  if (!enrollmentId || !UUID.test(enrollmentId) || deps.secret.length < 32) return invalidRequest()
  try {
    const issued = await deps.admin.rpc("issue_trial_cancellation_capability", {
      p_enrollment_id: enrollmentId,
      p_user_id: userId,
    })
    if (issued.error || issued.data !== true) return invalidRequest()
  } catch {
    return invalidRequest()
  }
  return NextResponse.json({
    capability: projectTrialCancellationCapability(
      { enrollmentId, requestId: deps.requestId() },
      deps.secret,
    ),
  })
}

export async function handleTrialCancellation(request: Request, deps: Deps) {
  const userId = await deps.userId()
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  if (request.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase() !== "application/json")
    return invalidRequest()
  const body = await request.json().catch(() => null)
  if (!isExactPostBody(body)) return invalidRequest()
  const capability = decodeTrialCancellationCapability(body.capability, deps.secret)
  if (!capability || capability.enrollmentId !== body.enrollmentId) return invalidRequest()
  try {
    // The declaration RPC replays a prior accepted request even if this trial has
    // since expired; capability issuance is intentionally not repeated here.
    const declaration = await submitTrialCancellationDeclaration(
      {
        requestId: capability.requestId,
        authenticatedUserId: userId,
        enrollmentId: capability.enrollmentId,
      },
      deps.admin,
    )
    let providerStatus: "confirmed" | "pending" = "pending"
    try {
      providerStatus = await reconcileSavedTrialCancellation(
        declaration.declarationId,
        userId,
        deps,
      )
    } catch {
      /* durable declaration remains acknowledged */
    }
    return NextResponse.json({ declaration, providerStatus })
  } catch {
    return NextResponse.json({ error: "cancellation_unavailable" }, { status: 409 })
  }
}

async function reconcileSavedTrialCancellation(declarationId: string, userId: string, deps: Deps) {
  const loaded = await deps.admin.rpc("load_trial_cancellation_provider_operation", {
    p_declaration_id: declarationId,
    p_user_id: userId,
  })
  const rows = Array.isArray(loaded.data) ? loaded.data : [loaded.data]
  if (loaded.error || rows.length !== 1 || !rows[0] || typeof rows[0] !== "object")
    return "pending" as const
  const provider = (rows[0] as Record<string, unknown>).provider
  if (provider === "stripe") {
    return reconcileStripeTrialCancellation({
      declarationId,
      userId,
      rpc: (name, args) => deps.admin.rpc(name, args),
      stripe: deps.stripe(),
    })
  }
  if (provider === "paypal") {
    if (!deps.paypal) return "pending" as const
    const paypal = await deps.paypal()
    return reconcilePayPalTrialCancellation({
      declarationId,
      userId,
      rpc: (name, args) => deps.admin.rpc(name, args),
      ...paypal,
    })
  }
  return "pending" as const
}
