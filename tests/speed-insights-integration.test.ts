import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { sanitizeSpeedInsightsEvent } from "../src/lib/observability/speed-insights"

test("root layout renders exactly one ungated Speed Insights component", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8")
  const wrapper = readFileSync(
    "src/components/observability/privacy-safe-speed-insights.tsx",
    "utf8",
  )

  assert.match(layout, /<PrivacySafeSpeedInsights\s*\/>/)
  assert.doesNotMatch(layout, /@vercel\/speed-insights/)
  assert.equal(
    (wrapper.match(/<SpeedInsights\s+beforeSend=\{sanitizeSpeedInsightsEvent\}\s*\/>/g) ?? [])
      .length,
    1,
  )
  assert.doesNotMatch(layout, /loadConsent|analytics\s*===\s*true/)
})

test("Speed Insights keeps only canonical URLs for the seven measured route groups", () => {
  const cases = [
    ["https://chaarlie.de/plan-start?lead=private", "/plan-start"],
    ["https://chaarlie.de/plan-bereit?lead=private", "/plan-bereit"],
    ["https://chaarlie.de/routine/today?next=%2Fprivate", "/routine"],
    ["https://chaarlie.de/anwendung/wash-day", "/anwendung"],
    ["https://chaarlie.de/profile/edit/goals", "/profile"],
    ["https://chaarlie.de/chat/private-conversation-id", "/chat"],
    ["https://chaarlie.de/tracker?entry=private", "/tracker"],
  ] as const

  for (const [url, canonicalPath] of cases) {
    assert.deepEqual(sanitizeSpeedInsightsEvent({ type: "vital", url, route: "/unsafe/[value]" }), {
      type: "vital",
      url: canonicalPath,
      route: canonicalPath,
    })
  }
})

test("Speed Insights drops auth, payment-return, result, and unknown URLs", () => {
  const unsafeUrls = [
    "https://chaarlie.de/welcome?session_id=cs_private",
    "https://chaarlie.de/welcome?provider=paypal&token=private",
    "https://chaarlie.de/result/00000000-0000-4000-8000-000000000001",
    "https://chaarlie.de/auth/confirm?code=private&token_hash=private",
    "https://chaarlie.de/api/auth/callback?next=%2Fprivate",
    "not a URL",
  ]

  for (const url of unsafeUrls) {
    assert.equal(sanitizeSpeedInsightsEvent({ type: "vital", url }), null)
  }
})

test("privacy notice accurately describes anonymous Speed Insights measurement", () => {
  const privacyNotice = readFileSync("src/app/datenschutz/page.tsx", "utf8")

  assert.match(privacyNotice, /Vercel Speed Insights/)
  assert.match(privacyNotice, /von\s*Parametern und Kennungen bereinigten Route und URL/)
  assert.match(privacyNotice, /Andere Bereiche werden nicht erfasst/)
  assert.match(privacyNotice, /Netzwerkgeschwindigkeit/)
  assert.match(privacyNotice, /Browser,\s*Gerätetyp und Betriebssystem/)
  assert.match(privacyNotice, /Land/)
  assert.match(privacyNotice, /Web Vitals einschließlich der\s*Elementzuordnung/)
  assert.match(
    privacyNotice,
    /weder einer einzelnen Person\s*noch einer IP-Adresse oder Sitzung\s*zugeordnet/,
  )
  assert.match(privacyNotice, /berechtigten Interesses nach Art\. 6\s*Abs\. 1 lit\. f DSGVO/)
})
