import { after, NextResponse } from "next/server"
import { deferRequiredTrialNotices } from "@/lib/billing/trial-notice-dispatch"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStripe } from "@/lib/stripe/client"
import {
  loadTrialManagementOperation,
  beginTrialManagementOperation,
  type TrialManagementOperation,
} from "@/lib/billing/trial-management-operations"
import { reconcileStripeTrialManagement } from "@/lib/stripe/trial-management"
import { startStripeTrialManagementApproval } from "@/lib/stripe/trial-management-approval"
import { beginPayPalTrialManagement } from "@/lib/paypal/trial-management"

export const runtime = "nodejs"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Deps = {
  userId: () => Promise<string | null>
  admin: ReturnType<typeof createAdminClient>
  stripe: () => ReturnType<typeof getStripe>
  loadOperation?: typeof loadTrialManagementOperation
  begin?: typeof beginTrialManagementOperation
  stripeManagement?: typeof reconcileStripeTrialManagement
  stripeApproval?: typeof startStripeTrialManagementApproval
  paypalManagement?: typeof beginPayPalTrialManagement
}
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } })
}
function invalid() {
  return reply({ error: "invalid_request" }, 400)
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}
function exact(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).length === keys.length && keys.every((k) => Object.hasOwn(value, k))
}
function id(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value)
}
/** Provider redirects are not a generic external navigation capability. */
export function validTrialManagementApprovalUrl(
  value: unknown,
  provider: "stripe" | "paypal",
): string | null {
  if (typeof value !== "string") return null
  try {
    const url = new URL(value)
    const hosts =
      provider === "paypal"
        ? ["www.paypal.com", "www.sandbox.paypal.com"]
        : ["checkout.stripe.com", "buy.stripe.com"]
    return url.protocol === "https:" &&
      hosts.includes(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.port
      ? url.href
      : null
  } catch {
    return null
  }
}
async function defaults(): Promise<Deps> {
  const auth = await createClient()
  return {
    userId: async () => (await auth.auth.getUser()).data.user?.id ?? null,
    admin: createAdminClient(),
    stripe: getStripe,
  }
}
export async function GET(request: Request) {
  return handleTrialManagementGet(request, await defaults())
}
export async function POST(request: Request) {
  const response = await handleTrialManagementPost(request, await defaults())
  if (response.ok) deferRequiredTrialNotices(after)
  return response
}

export async function handleTrialManagementGet(request: Request, deps: Deps) {
  const userId = await deps.userId()
  if (!userId) return reply({ error: "unauthenticated" }, 401)
  const url = new URL(request.url),
    enrollmentId = url.searchParams.get("enrollmentId")
  if (url.searchParams.size !== 1 || !id(enrollmentId)) return invalid()
  try {
    const result = await deps.admin.rpc("load_trial_management_public_view", {
      p_enrollment_id: enrollmentId,
      p_authenticated_user_id: userId,
    })
    if (result.error) throw new Error("Trial management view unavailable")
    if (!record(result.data) || result.data.enrollmentId !== enrollmentId)
      return reply({ error: "management_unavailable" }, 409)
    // This service-only RPC projects public fields in one database snapshot;
    // provider IDs and raw frozen catalog never enter the response.
    const view = result.data
    if (
      !Number.isSafeInteger(view.revision) ||
      Number(view.revision) < 0 ||
      !["month", "year"].includes(String(view.interval)) ||
      typeof view.originalTrialEndAt !== "string" ||
      !Number.isFinite(Date.parse(view.originalTrialEndAt)) ||
      typeof view.cancelAtPeriodEnd !== "boolean" ||
      typeof view.canManage !== "boolean" ||
      !record(view.offers)
    )
      throw new Error("Invalid trial view")
    const offers: Record<string, unknown> = {}
    for (const interval of ["month", "year"]) {
      const offer = view.offers[interval]
      if (
        !record(offer) ||
        offer.interval !== interval ||
        offer.currency !== "EUR" ||
        !Number.isSafeInteger(offer.firstAmountMinor) ||
        Number(offer.firstAmountMinor) < 0 ||
        !Number.isSafeInteger(offer.renewalAmountMinor) ||
        Number(offer.renewalAmountMinor) < 0
      )
        throw new Error("Invalid public trial offer")
      offers[interval] = {
        interval,
        currency: "EUR",
        firstAmountMinor: offer.firstAmountMinor,
        renewalAmountMinor: offer.renewalAmountMinor,
      }
    }
    let pendingOperation = null
    if (view.pendingOperation !== null) {
      const pending = view.pendingOperation
      if (
        !record(pending) ||
        !id(pending.operationId) ||
        !["switch", "restore"].includes(String(pending.kind)) ||
        !["month", "year"].includes(String(pending.targetInterval))
      )
        throw new Error("Invalid pending operation")
      pendingOperation = {
        operationId: pending.operationId,
        kind: pending.kind,
        targetInterval: pending.targetInterval,
      }
    }
    return reply({
      enrollmentId,
      revision: view.revision,
      interval: view.interval,
      originalTrialEndAt: view.originalTrialEndAt,
      cancelAtPeriodEnd: view.cancelAtPeriodEnd,
      canManage: view.canManage,
      offers,
      pendingOperation,
    })
  } catch {
    return reply({ error: "management_unavailable" }, 503)
  }
}

export async function handleTrialManagementPost(request: Request, deps: Deps) {
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
  let operation: TrialManagementOperation
  try {
    if (body.action === "begin") {
      if (
        !exact(body, [
          "action",
          "operationId",
          "enrollmentId",
          "expectedRevision",
          "kind",
          "targetInterval",
        ]) ||
        !id(body.enrollmentId) ||
        !Number.isSafeInteger(body.expectedRevision) ||
        Number(body.expectedRevision) < 0 ||
        (body.kind !== "switch" && body.kind !== "restore") ||
        (body.targetInterval !== "month" && body.targetInterval !== "year")
      )
        return invalid()
      operation = await (deps.begin ?? beginTrialManagementOperation)(deps.admin, {
        operationId,
        enrollmentId: body.enrollmentId,
        authenticatedUserId: userId,
        kind: body.kind,
        expectedRevision: Number(body.expectedRevision),
        targetInterval: body.targetInterval,
      })
    } else if (body.action === "reconcile") {
      if (!exact(body, ["action", "operationId"])) return invalid()
      operation = await (deps.loadOperation ?? loadTrialManagementOperation)(deps.admin, {
        operationId,
        authenticatedUserId: userId,
      })
    } else return invalid()
    if (operation.userId !== userId || operation.id !== operationId)
      throw new Error("Management owner mismatch")
  } catch {
    return reply({ error: "management_conflict" }, 409)
  }
  if (operation.status === "abandoned") return reply({ status: "abandoned", operationId })
  try {
    let result: { status: string; operationId: string; approvalUrl?: string }
    if (operation.provider === "stripe") {
      const stripe = deps.stripe()
      result = await (deps.stripeManagement ?? reconcileStripeTrialManagement)({
        operationId,
        authenticatedUserId: userId,
        client: deps.admin,
        stripe,
      })
      if (result.status === "requires_approval") {
        const successUrl = new URL("/profile", origin)
        successUrl.searchParams.set("trialManagement", operationId)
        const cancelUrl = new URL(successUrl)
        cancelUrl.searchParams.set("trialManagementReturn", "cancel")
        result = await (deps.stripeApproval ?? startStripeTrialManagementApproval)({
          operationId,
          authenticatedUserId: userId,
          client: deps.admin,
          stripe,
          successUrl: successUrl.href,
          cancelUrl: cancelUrl.href,
        })
      }
    } else if (operation.provider === "paypal") {
      const returnUrl = new URL("/profile", origin)
      returnUrl.searchParams.set("trialManagement", operationId)
      const cancelUrl = new URL(returnUrl)
      cancelUrl.searchParams.set("trialManagementReturn", "cancel")
      // begin is itself durable: existing provider requests reconcile; an unissued
      // saved operation may safely resume after a lost initial HTTP response.
      result = await (deps.paypalManagement ?? beginPayPalTrialManagement)(
        {
          operationId,
          authenticatedUserId: userId,
          returnUrl: returnUrl.href,
          cancelUrl: cancelUrl.href,
        },
        { supabase: deps.admin },
      )
    } else throw new Error("Unsupported management provider")
    if (result.operationId !== operationId) throw new Error("Management operation mismatch")
    if (result.status === "committed" || result.status === "abandoned")
      return reply({ status: result.status, operationId })
    if (result.status === "approval_required") {
      const approvalUrl = validTrialManagementApprovalUrl(result.approvalUrl, operation.provider)
      if (!approvalUrl) throw new Error("Invalid approval destination")
      return reply({ status: "approval_required", operationId, approvalUrl })
    }
    if (result.status === "requires_approval")
      return reply({ status: "requires_approval", operationId }, 202)
    return reply({ status: "pending", operationId }, 202)
  } catch {
    // The durable operation may already have provider effects. Preserve its ID;
    // the next request reconciles it instead of creating a second change.
    return reply({ status: "pending", operationId }, 202)
  }
}
