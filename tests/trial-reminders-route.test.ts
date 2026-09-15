import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { NextRequest } from "next/server"
import {
  handleTrialReminderReconcile,
  maxDuration,
} from "../src/app/api/billing/trial-reminders/reconcile/route"
import { createUpdateSession, type UpdateSessionDependencies } from "../src/lib/supabase/middleware"
const url = "https://chaarlie.de/api/billing/trial-reminders/reconcile"
const stats = {
  claimed: 0,
  queued: 0,
  supportRequired: 0,
  skipped: 0,
  blocked: false,
  disabled: false,
}
test("reminder cron authenticates before all work and exposes aggregate state only", async () => {
  let calls = 0
  const dispatch = async () => {
    calls++
    return stats
  }
  for (const auth of [undefined, "Bearer wrong", "Basic secret"]) {
    const r = await handleTrialReminderReconcile(
      new Request(url, { headers: auth ? { authorization: auth } : {} }),
      { cronSecret: "secret", dispatch },
    )
    assert.equal(r.status, 401)
  }
  assert.equal(calls, 0)
  const request = new Request(url, { headers: { authorization: "Bearer secret" } })
  assert.deepEqual(
    await handleTrialReminderReconcile(request, { cronSecret: "secret", dispatch }),
    { status: 200, body: { trialReminderDelivery: stats } },
  )
  assert.equal(calls, 1)
  assert.equal(
    (
      await handleTrialReminderReconcile(request, {
        cronSecret: "secret",
        dispatch: async () => ({ ...stats, blocked: true }),
      })
    ).status,
    503,
  )
  assert.deepEqual(
    await handleTrialReminderReconcile(request, {
      cronSecret: "secret",
      dispatch: async () => {
        throw new Error("private customer info")
      },
    }),
    { status: 500, body: { error: "trial_reminder_delivery_failed" } },
  )
})
test("configured five-minute cron reaches server-auth handler without browser login", async () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8"))
  assert.deepEqual(
    config.crons.find((c: { path: string }) => c.path === "/api/billing/trial-reminders/reconcile"),
    { path: "/api/billing/trial-reminders/reconcile", schedule: "*/5 * * * *" },
  )
  assert.equal(maxDuration, 60)
  let sessions = 0
  const deps = {
    createServerClient: () => {
      sessions++
      throw new Error("browser Auth must not run")
    },
    getRouteEnvironment: () => ({
      nodeEnv: "production",
      vercelEnv: "production",
      localDevLoginEnabled: false,
      ciOfferPageLabEnabled: false,
      ciPersonalPlanStage3LabEnabled: false,
      ciPersonalPlanProductionJourneyEnabled: false,
    }),
  } as unknown as UpdateSessionDependencies
  const response = await createUpdateSession(deps)(new NextRequest(url))
  assert.equal(sessions, 0)
  assert.equal(response.headers.get("location"), null)
  assert.equal(response.status, 200)
})
