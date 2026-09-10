import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { GatedAnwendungExample } from "../src/components/gated-preview/gated-anwendung-example"
import { GatedChatExample } from "../src/components/gated-preview/gated-chat-example"
import { GatedRoutineExample } from "../src/components/gated-preview/gated-routine-example"
import { GATED_EXAMPLE_COPY } from "../src/lib/gated-preview/example-copy"
import { GATED_EXAMPLE_PRODUCTS } from "../src/lib/gated-preview/fixtures/example-products"
import { GATED_CHAT_EXAMPLE_MESSAGES } from "../src/lib/gated-preview/fixtures/chat-example"
import { shouldRenderGatedExample } from "../src/lib/gated-preview/gate"
import { loadAuthenticatedAppPageTier } from "../src/lib/auth/authenticated-app-route-access"
import { PREMIUM_FEATURES } from "../src/lib/premium-sheet/context"

/**
 * T12: the free tier's Routine / Anwendung / Chat are the REAL components fed static
 * example data, framed by T11's `GatedPreview`. These tests pin the two halves that a
 * refactor could silently break: which tier gets the example at all, and what the example
 * actually says.
 */

// --- tier branching ---------------------------------------------------------

test("only the free tier renders the example", async () => {
  assert.equal(await shouldRenderGatedExample(async () => "free"), true)
  assert.equal(await shouldRenderGatedExample(async () => "premium"), false)
})

test("with the freemium flag off the tier resolves premium without any lookup", async () => {
  const previous = process.env.FREEMIUM_SCANNER_FIRST_ENABLED
  delete process.env.FREEMIUM_SCANNER_FIRST_ENABLED
  try {
    // No Supabase client is created and no billing/moderator read happens: the loader
    // returns before `createClient()`, which is why this call can run at all in a plain
    // node test with no request context.
    assert.equal(await loadAuthenticatedAppPageTier(), "premium")
    assert.equal(await shouldRenderGatedExample(), false)
  } finally {
    if (previous === undefined) delete process.env.FREEMIUM_SCANNER_FIRST_ENABLED
    else process.env.FREEMIUM_SCANNER_FIRST_ENABLED = previous
  }
})

const SOURCE_ROOT = path.resolve(process.cwd(), "src")

const GATED_ROUTES = [
  ["app/routine/page.tsx", "GatedRoutineExample"],
  ["app/anwendung/page.tsx", "GatedAnwendungExample"],
  ["app/chat/page.tsx", "GatedChatExample"],
] as const

for (const [route, component] of GATED_ROUTES) {
  test(`${route} gates on the server tier before it resolves the real page`, () => {
    const source = readFileSync(path.join(SOURCE_ROOT, route), "utf8")
    const gate = source.indexOf("await shouldRenderGatedExample()")
    assert.ok(gate > -1, `${route} must derive the tier server-side`)
    assert.match(
      source.slice(gate, gate + 200),
      new RegExp(`return <${component} \\/>`),
      `${route} must return the example for the free tier`,
    )
    // The gate is a guard clause, not a wrapper: everything the real page does still
    // happens verbatim below it for premium and for flag-off.
    assert.ok(source.indexOf("shouldRenderGatedExample") < source.lastIndexOf("return"))
  })
}

// --- copy -------------------------------------------------------------------

test("each page has its own benefit line, never the sheet's own copy and never a generic pitch", () => {
  const benefits = Object.values(GATED_EXAMPLE_COPY).map((copy) => copy.benefit)
  assert.equal(new Set(benefits).size, benefits.length, "no page repeats another's benefit")

  for (const copy of Object.values(GATED_EXAMPLE_COPY)) {
    // T11 carry-forward 2: the sheet shows `PREMIUM_FEATURES[feature].benefit` the moment
    // the CTA opens it — repeating it above the CTA would say it twice in two seconds.
    assert.notEqual(copy.benefit, PREMIUM_FEATURES[copy.feature].benefit)
    assert.doesNotMatch(copy.cta, /Premium freischalten/)
    assert.match(copy.exampleLabel, /^Beispiel · /)
    // Benefit-framed: the CTA names what the reader unlocks, not the product tier.
    assert.match(copy.cta, /freischalten$/)
  }
})

test("the sheet context is the page's own", () => {
  assert.deepEqual(
    Object.values(GATED_EXAMPLE_COPY).map(({ feature, source }) => ({ feature, source })),
    [
      { feature: "routine", source: "gated:routine" },
      { feature: "anwendung", source: "gated:anwendung" },
      { feature: "chat", source: "gated:chat" },
    ],
  )
})

// --- rendered examples ------------------------------------------------------

function render(Composition: () => React.ReactElement) {
  return renderToStaticMarkup(<Composition />)
}

test("the Routine example is the real Routine page, filled with real catalog products", () => {
  const html = render(GatedRoutineExample)

  assert.match(html, /Deine Routine/)
  assert.match(html, /Deine Basis/)
  assert.match(html, /Optional/)
  // Five included products — the copy the real page derives from the payload.
  assert.match(html, /Deine Routine mit 5 Produkten\./)

  for (const product of Object.values(GATED_EXAMPLE_PRODUCTS)) {
    assert.ok(
      html.includes(product.displayName.replace(/&/g, "&amp;")),
      `${product.displayName} appears in the example`,
    )
    assert.ok(html.includes(product.imageUrl), `${product.displayName} shows its catalog image`)
  }

  // No live affordance survived: no „Anpassen", no detail buttons, no basis gap.
  assert.doesNotMatch(html, /Anpassen/)
  assert.doesNotMatch(html, /data-routine-detail-button/)
  assert.doesNotMatch(html, /Basis-Baustein fehlt/)
  assert.doesNotMatch(html, /Änderungen prüfen/)
})

test("the Anwendung example shows populated days, not empty ones", () => {
  const html = render(GatedAnwendungExample)

  assert.match(html, /Anwendung/)
  assert.match(html, /Waschtag/)
  assert.match(html, /Intensivpflegetag/)
  assert.match(html, /Stylingtag/)
  assert.match(html, /Pausentag/)

  // Nick's explicit requirement: days carry actual products. Every non-rest day puts a
  // real product on its shelf, so no day renders as a row of empty silhouettes.
  const openSlots = html.match(/data-application-shelf-slot="open"/g) ?? []
  assert.equal(openSlots.length, 0, "no open/unresolved shelf slot in the example")
  assert.match(html, /data-application-shelf-slot="confirmed"/)
  assert.match(html, /data-application-rest-day-visual/, "the Pausentag keeps its rest visual")

  // Nothing is „teilweise bereit" — an example must not model a broken plan.
  assert.doesNotMatch(html, /Teilweise bereit/)
  assert.doesNotMatch(html, /Detail(s)? offen/)
})

test("the Chat example is a short, capability-true transcript through the real bubbles", () => {
  const html = render(GatedChatExample)

  assert.match(html, /data-testid="message-user"/)
  assert.match(html, /data-testid="message-assistant"/)
  assert.match(html, /data-testid="chat-input"/)
  assert.match(html, /disabled=""/, "the composer renders visibly unusable")

  // Short: Nick asked for something short — two turns, four messages.
  assert.equal(GATED_CHAT_EXAMPLE_MESSAGES.length, 4)
  assert.equal(GATED_CHAT_EXAMPLE_MESSAGES.filter((m) => m.role === "user").length, 2)

  const transcript = GATED_CHAT_EXAMPLE_MESSAGES.map((m) => m.content ?? "").join("\n")
  // Capability-true: general hair-care Q&A the paid chat genuinely does. No scan-aware
  // claim and no verdict explanation — those are explicitly forbidden content here.
  for (const forbidden of [/scan/i, /gescannt/i, /verdict/i, /passt nicht/i, /Merkliste/i]) {
    assert.doesNotMatch(transcript, forbidden, `the transcript must not claim ${forbidden}`)
  }
  // No feedback affordance and no product card: both need live handlers.
  assert.doesNotMatch(html, /Antwort positiv bewerten/)
  assert.doesNotMatch(html, /weitere Empfehlungen/)
})

test("no example message carries a timestamp — a formatted one would mismatch on hydration", () => {
  for (const message of GATED_CHAT_EXAMPLE_MESSAGES) {
    assert.equal(message.created_at, "")
  }
  assert.doesNotMatch(render(GatedChatExample), /type-caption text-muted-foreground">\d\d:\d\d/)
})

test("every example is framed by GatedPreview with its own label, benefit and one CTA", () => {
  const pages = [
    [GatedRoutineExample, GATED_EXAMPLE_COPY.routine],
    [GatedAnwendungExample, GATED_EXAMPLE_COPY.anwendung],
    [GatedChatExample, GATED_EXAMPLE_COPY.chat],
  ] as const

  for (const [Composition, copy] of pages) {
    const html = render(Composition)
    assert.match(html, new RegExp(`data-gated-preview="${copy.feature}"`))
    assert.ok(html.includes(copy.exampleLabel), `${copy.feature}: „Beispiel" band`)
    assert.ok(html.includes(copy.benefit), `${copy.feature}: benefit line`)
    assert.ok(html.includes(copy.cta), `${copy.feature}: CTA`)
    assert.equal(
      (html.match(/data-gated-preview-cta-block/g) ?? []).length,
      1,
      `${copy.feature}: exactly one CTA block`,
    )
  }
})
