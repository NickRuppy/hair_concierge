import { NextResponse } from "next/server"
import { safeBearerTokenMatches } from "@/app/api/billing/payment-monitor/route"
import { dispatchTrialReminders } from "@/lib/billing/trial-reminders-delivery"
export const runtime = "nodejs"
export const maxDuration = 60
export async function handleTrialReminderReconcile(
  request: Request,
  dependencies: { cronSecret?: string; dispatch?: typeof dispatchTrialReminders } = {},
) {
  if (
    !safeBearerTokenMatches(
      request.headers.get("authorization"),
      dependencies.cronSecret ?? process.env.CRON_SECRET,
    )
  )
    return { status: 401, body: { error: "unauthorized" } }
  try {
    const delivery = await (dependencies.dispatch ?? dispatchTrialReminders)()
    return { status: delivery.blocked ? 503 : 200, body: { trialReminderDelivery: delivery } }
  } catch {
    return { status: 500, body: { error: "trial_reminder_delivery_failed" } }
  }
}
export async function GET(request: Request) {
  const result = await handleTrialReminderReconcile(request)
  return NextResponse.json(result.body, { status: result.status })
}
