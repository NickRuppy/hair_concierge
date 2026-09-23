import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import {
  claimRefusalHint,
  DiscoveryInvitationCard,
  validateInvitationEmail,
} from "../src/app/beratung/einladung/discovery-invitation-client"

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

test("the claim response's code decides whether the session hint appears", () => {
  assert.match(
    claimRefusalHint({ code: "signed_in_other_account", error: REFUSAL }) ?? "",
    new RegExp(HINT),
  )
  assert.equal(claimRefusalHint({ code: "existing_paid_access", error: "…" }), null)
  assert.equal(claimRefusalHint({ code: "existing_access_kind", error: "…" }), null)
  assert.equal(claimRefusalHint({ error: REFUSAL }), null)
  assert.equal(claimRefusalHint(null), null)
})

test("the invite always shows an editable e-mail field, prefilled when the admin entered one", () => {
  const prefilled = renderToStaticMarkup(
    <DiscoveryInvitationCard email="lea@example.test" mode="ready" name="Lea Sommer" />,
  )
  assert.match(prefilled, /<input[^>]*type="email"[^>]*value="lea@example.test"/)
  assert.ok(prefilled.includes("Deine E-Mail"))
  assert.ok(!/<input[^>]*readonly/i.test(prefilled))
  assert.ok(!/<input[^>]*disabled/i.test(prefilled))

  const empty = renderToStaticMarkup(
    <DiscoveryInvitationCard email="" mode="ready" name="Lea Sommer" />,
  )
  assert.match(empty, /<input[^>]*type="email"[^>]*value=""/)
  assert.ok(empty.includes("Los geht"))
})

test("the magic-link screen names the address the link went to", () => {
  const markup = renderToStaticMarkup(
    <DiscoveryInvitationCard email="lea@example.test" mode="email_sent" name="Lea Sommer" />,
  )
  assert.ok(markup.includes("Schau kurz in deine E-Mails."))
  assert.ok(markup.includes("lea@example.test"))
  assert.ok(!markup.includes("<input"))
})

test("the invite page checks the address before it claims", () => {
  assert.equal(validateInvitationEmail(""), "Bitte gib deine E-Mail-Adresse ein.")
  assert.equal(validateInvitationEmail("   "), "Bitte gib deine E-Mail-Adresse ein.")
  assert.equal(validateInvitationEmail("lea@"), "Bitte prüf deine E-Mail-Adresse.")
  assert.equal(validateInvitationEmail("lea example@x.de"), "Bitte prüf deine E-Mail-Adresse.")
  assert.equal(validateInvitationEmail(" lea@example.test "), null)
})
