import { NextResponse } from "next/server"
import { safeBearerTokenMatches } from "@/app/api/billing/payment-monitor/route"
import { dispatchTrialRequiredNotices } from "@/lib/billing/trial-required-notices-delivery"
export const runtime = "nodejs"
export const maxDuration = 60
export async function handleTrialRequiredNoticeReconcile(
  request: Request,
  dependencies: { cronSecret?: string; dispatch?: typeof dispatchTrialRequiredNotices } = {},
) {
  if (
    !safeBearerTokenMatches(
      request.headers.get("authorization"),
      dependencies.cronSecret ?? process.env.CRON_SECRET,
    )
  )
    return { status: 401, body: { error: "unauthorized" } }
  try {
    const delivery = await (dependencies.dispatch ?? dispatchTrialRequiredNotices)()
    return { status: delivery.blocked ? 503 : 200, body: { trialRequiredNoticeDelivery: delivery } }
  } catch {
    return { status: 500, body: { error: "trial_required_notice_delivery_failed" } }
  }
}
export async function GET(request: Request) {
  const result = await handleTrialRequiredNoticeReconcile(request)
  return NextResponse.json(result.body, { status: result.status })
}
