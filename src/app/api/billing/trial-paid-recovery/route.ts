import { after, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStripe } from "@/lib/stripe/client"
import { deferRequiredTrialNotices } from "@/lib/billing/trial-notice-dispatch"
import {
  beginTrialPaidRecoveryOperation,
  loadTrialPaidRecoveryOperation,
  type TrialPaidRecoveryOperation,
} from "@/lib/billing/trial-paid-recovery-operations"
import { beginPayPalTrialPaidRecovery } from "@/lib/paypal/trial-paid-recovery"
export const runtime = "nodejs"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const kinds = ["recover_unpaid", "repair_paid"]
type ProviderInput = {
  operationId: string
  authenticatedUserId: string
  successUrl: string
  cancelUrl: string
  client: ReturnType<typeof createAdminClient>
  stripe: ReturnType<typeof getStripe>
}
type ProviderResult = { operationId: string; status: string; approvalUrl?: string }
type Deps = {
  userId: () => Promise<string | null>
  admin: ReturnType<typeof createAdminClient>
  stripe: () => ReturnType<typeof getStripe>
  begin?: typeof beginTrialPaidRecoveryOperation
  load?: typeof loadTrialPaidRecoveryOperation
  paypal?: typeof beginPayPalTrialPaidRecovery
  stripeRecovery?: (input: ProviderInput) => Promise<ProviderResult>
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v)
const id = (v: unknown): v is string => typeof v === "string" && UUID.test(v)
const exact = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k))
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } })
const invalid = () => reply({ error: "invalid_request" }, 400)
async function defaults(): Promise<Deps> {
  const auth = await createClient()
  return {
    userId: async () => (await auth.auth.getUser()).data.user?.id ?? null,
    admin: createAdminClient(),
    stripe: getStripe,
  }
}
export async function GET(request: Request) {
  return handleTrialPaidRecoveryGet(request, await defaults())
}
export async function POST(request: Request) {
  const response = await handleTrialPaidRecoveryPost(request, await defaults())
  if (response.ok) deferRequiredTrialNotices(after)
  return response
}
export async function handleTrialPaidRecoveryGet(request: Request, deps: Deps) {
  const userId = await deps.userId()
  if (!userId) return reply({ error: "unauthenticated" }, 401)
  const url = new URL(request.url),
    enrollmentId = url.searchParams.get("enrollmentId")
  if (url.searchParams.size !== 1 || !id(enrollmentId)) return invalid()
  try {
    const result = await deps.admin.rpc("load_trial_paid_recovery_public_view", {
      p_enrollment_id: enrollmentId,
      p_authenticated_user_id: userId,
    })
    if (result.error) throw new Error("Unavailable")
    const v = result.data
    if (!record(v) || v.enrollmentId !== enrollmentId)
      return reply({ error: "recovery_unavailable" }, 409)
    if (
      !Number.isSafeInteger(v.revision) ||
      Number(v.revision) < 0 ||
      typeof v.originalTrialEndAt !== "string" ||
      !Number.isFinite(Date.parse(v.originalTrialEndAt)) ||
      typeof v.cancelAtPeriodEnd !== "boolean" ||
      (v.kind !== null && !kinds.includes(String(v.kind))) ||
      !(
        v.paidThroughAt === null ||
        (typeof v.paidThroughAt === "string" && Number.isFinite(Date.parse(v.paidThroughAt)))
      ) ||
      !record(v.offer)
    )
      throw new Error("Invalid view")
    const o = v.offer
    if (
      !["month", "year"].includes(String(o.interval)) ||
      o.currency !== "EUR" ||
      !Number.isSafeInteger(o.firstAmountMinor) ||
      Number(o.firstAmountMinor) < 0 ||
      !Number.isSafeInteger(o.renewalAmountMinor) ||
      Number(o.renewalAmountMinor) < 0
    )
      throw new Error("Invalid offer")
    let pendingOperation = null
    if (v.pendingOperation !== null) {
      const p = v.pendingOperation
      if (!record(p) || !id(p.operationId) || !kinds.includes(String(p.kind)))
        throw new Error("Invalid pending operation")
      pendingOperation = { operationId: p.operationId, kind: p.kind }
    }
    return reply({
      enrollmentId,
      revision: v.revision,
      originalTrialEndAt: v.originalTrialEndAt,
      paidThroughAt: v.paidThroughAt,
      cancelAtPeriodEnd: v.cancelAtPeriodEnd,
      kind: v.kind,
      offer: {
        interval: o.interval,
        currency: o.currency,
        firstAmountMinor: o.firstAmountMinor,
        renewalAmountMinor: o.renewalAmountMinor,
      },
      pendingOperation,
    })
  } catch {
    return reply({ error: "recovery_unavailable" }, 503)
  }
}
export async function handleTrialPaidRecoveryPost(request: Request, deps: Deps) {
  const userId = await deps.userId()
  if (!userId) return reply({ error: "unauthenticated" }, 401)
  const origin = new URL(request.url).origin
  if (
    request.headers.get("origin") !== origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return reply({ error: "invalid_origin" }, 403)
  if (
    request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !==
    "application/json"
  )
    return invalid()
  const raw = await request.text()
  if (raw.length > 4096) return invalid()
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return invalid()
  }
  if (!record(body) || !id(body.operationId)) return invalid()
  const operationId = body.operationId
  let operation: TrialPaidRecoveryOperation
  try {
    if (body.action === "begin") {
      if (
        !exact(body, ["action", "operationId", "enrollmentId", "expectedRevision", "kind"]) ||
        !id(body.enrollmentId) ||
        !Number.isSafeInteger(body.expectedRevision) ||
        Number(body.expectedRevision) < 0 ||
        !kinds.includes(String(body.kind))
      )
        return invalid()
      operation = await (deps.begin ?? beginTrialPaidRecoveryOperation)(deps.admin, {
        operationId,
        enrollmentId: body.enrollmentId,
        authenticatedUserId: userId,
        kind: body.kind as "recover_unpaid" | "repair_paid",
        expectedRevision: Number(body.expectedRevision),
      })
    } else if (body.action === "reconcile") {
      if (!exact(body, ["action", "operationId"])) return invalid()
      operation = await (deps.load ?? loadTrialPaidRecoveryOperation)(deps.admin, {
        operationId,
        authenticatedUserId: userId,
      })
    } else return invalid()
    if (operation.id !== operationId || operation.userId !== userId)
      throw new Error("Owner mismatch")
  } catch {
    return reply({ error: "recovery_conflict" }, 409)
  }
  if (operation.status === "abandoned") return reply({ status: "abandoned", operationId })
  try {
    const success = new URL("/profile", origin)
    success.searchParams.set("trialPaidRecovery", operationId)
    const cancel = new URL(success)
    cancel.searchParams.set("trialPaidRecoveryReturn", "cancel")
    let result: ProviderResult
    if (operation.provider === "paypal")
      result = await (deps.paypal ?? beginPayPalTrialPaidRecovery)(
        {
          operationId,
          authenticatedUserId: userId,
          returnUrl: success.href,
          cancelUrl: cancel.href,
        },
        { supabase: deps.admin },
      )
    else if (operation.provider === "stripe") {
      const provider =
        deps.stripeRecovery ??
        (async (input: ProviderInput) => {
          const { beginStripeTrialPaidRecovery } = await import("@/lib/stripe/trial-paid-recovery")
          return beginStripeTrialPaidRecovery(input)
        })
      result = await provider({
        operationId,
        authenticatedUserId: userId,
        client: deps.admin,
        stripe: deps.stripe(),
        successUrl: success.href,
        cancelUrl: cancel.href,
      })
    } else throw new Error("Unsupported provider")
    if (result.operationId !== operationId) throw new Error("Operation mismatch")
    if (result.status === "committed" || result.status === "abandoned")
      return reply({ status: result.status, operationId })
    if (result.status === "approval_required") {
      const url = new URL(result.approvalUrl ?? "")
      const hosts =
        operation.provider === "paypal"
          ? ["www.paypal.com", "www.sandbox.paypal.com"]
          : ["checkout.stripe.com", "buy.stripe.com"]
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        !hosts.includes(url.hostname)
      )
        throw new Error("Invalid approval URL")
      return reply({ status: "approval_required", operationId, approvalUrl: url.href })
    }
    return reply({ status: "pending", operationId }, 202)
  } catch {
    return reply({ status: "pending", operationId }, 202)
  }
}
