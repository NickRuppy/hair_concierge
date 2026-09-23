import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { DiscoveryInvitationCard } from "../src/app/beratung/einladung/discovery-invitation-client"

const REFUSAL = "Dieses Konto kann diese Einladung nicht nutzen."
const HINT = "Du bist gerade mit einem anderen Konto angemeldet."

test("a signed-in-elsewhere refusal tells the participant how to get out of it", () => {
  const markup = renderToStaticMarkup(
    <DiscoveryInvitationCard
      email="lea@example.test"
      error={REFUSAL}
      errorHint={`${HINT} Melde dich ab oder öffne den Link in einem privaten Fenster.`}
      mode="ready"
      name="Lea Sommer"
    />,
  )
  assert.ok(markup.includes(REFUSAL))
  assert.ok(markup.includes(HINT))
})

test("other refusals keep their own copy without the session hint", () => {
  const markup = renderToStaticMarkup(
    <DiscoveryInvitationCard
      email="lea@example.test"
      error="Dieses Konto hat bereits vollen Zugang zu Chaarlie."
      mode="ready"
      name="Lea Sommer"
    />,
  )
  assert.ok(!markup.includes(HINT))
})

test("the invite CTA uses the coral funnel CTA, not plum", () => {
  const markup = renderToStaticMarkup(
    <DiscoveryInvitationCard email="lea@example.test" mode="ready" name="Lea Sommer" />,
  )
  assert.ok(markup.includes("bg-[var(--brand-coral)]"))
  assert.ok(!markup.includes("bg-[var(--brand-plum)]"))
})
