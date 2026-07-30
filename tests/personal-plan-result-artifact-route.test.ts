import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  handlePersonalPlanResultArtifactRequest,
  type PersonalPlanResultArtifactRouteDeps,
} from "../src/app/api/quiz/personal-plan-result-artifact/route"

const leadId = "550e8400-e29b-41d4-a716-446655440000"

function deps(): PersonalPlanResultArtifactRouteDeps {
  return {
    checkRateLimit: async () => ({ allowed: true }),
    isConfigured: () => true,
    send: async () => undefined,
    siteUrl: "https://chaarlie.de",
    store: {
      async claimLead() {
        return null
      },
      async loadAttachedArtifact() {
        return null
      },
      async markSent() {},
      async markFailed() {},
    },
  }
}

test("validates configuration before claiming a personal-plan email", async () => {
  let claims = 0
  const base = deps()
  base.isConfigured = () => false
  base.store.claimLead = async () => {
    claims += 1
    return null
  }

  const result = await handlePersonalPlanResultArtifactRequest({ leadId }, base)
  assert.equal(result.status, 503)
  assert.equal(claims, 0)
})

test("returns the 200 send result for a valid personal-plan lead and attached public artifact", async () => {
  const base = deps()
  let sent = 0
  base.store.claimLead = async () => ({
    id: leadId,
    quiz_kind: "personal_plan",
    email: "mia@example.com",
    artifact_email_status: "sending",
  })
  base.store.loadAttachedArtifact = async () => ({
    priorities: [],
    public_offer_model: {
      profileLine: "Für welliges, mittelstarkes Haar",
      primaryMessage: { kind: "concern", label: "Frizz und viele abstehende Haare" },
      diagnosticRows: [
        {
          id: "surface_manageability",
          title: "Oberfläche",
          todayLabel: "viel Potenzial",
          summary: "Dein Plan reduziert Frizz und Reibung.",
        },
        {
          id: "moisture_dryness",
          title: "Feuchtigkeit",
          todayLabel: "viel Potenzial",
          summary: "Dein Plan stimmt die Pflegeintensität ab.",
        },
        {
          id: "definition",
          title: "Definition",
          todayLabel: "viel Potenzial",
          summary: "Dein Plan bringt deine Struktur besser zur Geltung.",
        },
      ],
      planFitStatement: "Ein klarer Plan statt widersprüchlicher Tipps.",
    },
  })
  base.send = async () => {
    sent += 1
  }

  const result = await handlePersonalPlanResultArtifactRequest({ leadId }, base)
  assert.deepEqual(result, { status: 200, body: { sent: true, skipped: false } })
  assert.equal(sent, 1)
})

test("uses the recoverable copy when lead rate limiting is unavailable", async () => {
  const base = deps()
  base.checkRateLimit = async () => ({ allowed: false, error: "service_unavailable" })
  const result = await handlePersonalPlanResultArtifactRequest({ leadId }, base)

  assert.equal(result.status, 503)
  assert.match(JSON.stringify(result.body), /gerade nicht vorbereitet/)
})

test("the reveal requests the dedicated email endpoint with keepalive without awaiting it", () => {
  const reveal = readFileSync(
    new URL("../src/app/result/[leadId]/reveal/personal-plan-result-reveal.tsx", import.meta.url),
    "utf8",
  )
  const client = readFileSync(
    new URL("../src/lib/personal-plan-quiz/result-email-client.ts", import.meta.url),
    "utf8",
  )

  assert.match(client, /\/api\/quiz\/personal-plan-result-artifact/)
  assert.match(client, /keepalive:\s*true/)
  assert.match(reveal, /void requestPersonalPlanResultArtifactEmail/)
})
