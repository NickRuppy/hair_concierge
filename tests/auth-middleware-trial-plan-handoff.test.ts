import assert from "node:assert/strict"
import test from "node:test"

import { scenario, trialRow } from "./auth-middleware-trial-plan-handoff.fixtures"

for (const enabled of [false, true]) {
  test(`trial Personal Plan handoff with freemium ${enabled ? "on" : "off"}`, async (t) => {
    const original = process.env.FREEMIUM_SCANNER_FIRST_ENABLED
    process.env.FREEMIUM_SCANNER_FIRST_ENABLED = String(enabled)
    try {
      for (const provider of ["stripe", "paypal"] as const) {
        await t.test(
          `${provider}: saved routine reaches routine, application and chat after accept/reload`,
          async () => {
            for (const path of ["/routine", "/routine?planUpdated=1", "/anwendung", "/chat"]) {
              const response = await scenario({ provider }).request(path)
              assert.equal(response.status, 200, path)
              assert.equal(response.headers.get("location"), null, path)
            }
          },
        )
        await t.test(
          `${provider}: pending routine opens review and chat, application still requires acceptance`,
          async () => {
            for (const path of ["/routine", "/chat"]) {
              const response = await scenario({ provider, planState: "pending" }).request(path)
              assert.equal(response.status, 200, path)
            }
            const response = await scenario({ provider, planState: "pending" }).request(
              "/anwendung",
            )
            assert.equal(response.headers.get("location"), "https://chaarlie.de/routine")
          },
        )
        await t.test(
          `${provider}: incomplete plan stays at its Personal Plan frontier`,
          async () => {
            const response = await scenario({ provider, planState: "incomplete" }).request(
              "/routine",
            )
            assert.equal(response.headers.get("location"), "https://chaarlie.de/plan-start")
          },
        )
        for (const invalid of ["expired", "revoked", "malformed"] as const) {
          await t.test(
            `${provider}: ${invalid} trial cannot use a stored routine to restore access`,
            async () => {
              const row = trialRow(provider)
              row.trial_access_facts =
                invalid === "malformed"
                  ? {}
                  : {
                      ...(row.trial_access_facts as Record<string, unknown>),
                      ...(invalid === "expired"
                        ? { originalTrialEndAt: "2026-09-16T07:00:00Z", cancelAtPeriodEnd: true }
                        : { accessRevoked: true }),
                    }
              const response = await scenario({ row }).request("/anwendung")
              assert.equal(response.status, 307)
              assert.equal(new URL(response.headers.get("location")!).pathname, "/reactivate")
            },
          )
        }
      }
      for (const source of ["legacy", "ineligible"] as const) {
        await t.test(`${source} source does not gain a bypass from a routine pointer`, async () => {
          const fixture = scenario({ source })
          const response = await fixture.request("/anwendung")
          assert.equal(response.headers.get("location"), "https://chaarlie.de/onboarding")
          assert.equal(fixture.calls.paid, 0)
        })
      }
      await t.test("manual-only access cannot unlock a historical plan source", async () => {
        const response = await scenario({ manualAccessOnly: true }).request("/anwendung")
        assert.equal(response.headers.get("location"), "https://chaarlie.de/onboarding")
      })
      await t.test("unprepared source keeps the recovery handoff", async () => {
        const response = await scenario({ planState: "unprepared" }).request("/routine")
        assert.equal(response.headers.get("location"), "https://chaarlie.de/plan-bereit")
      })
      await t.test("unavailable frontier fails closed despite a saved routine", async () => {
        const response = await scenario({ source: "unavailable" }).request("/anwendung")
        assert.equal(response.status, 503)
      })
      await t.test("unavailable independent billing fails closed", async () => {
        for (const provider of ["stripe", "paypal"] as const) {
          for (const path of ["/routine", "/anwendung", "/chat"]) {
            const response = await scenario({ provider, billingUnavailable: true }).request(path)
            assert.equal(response.status, 503, `${provider} ${path}`)
            assert.equal(response.headers.get("location"), null)
          }
        }
      })
    } finally {
      if (original === undefined) delete process.env.FREEMIUM_SCANNER_FIRST_ENABLED
      else process.env.FREEMIUM_SCANNER_FIRST_ENABLED = original
    }
  })
}
