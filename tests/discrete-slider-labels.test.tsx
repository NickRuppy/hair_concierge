import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { DiscreteSlider } from "../src/components/ui/slider"

test("two-line slider labels share marker coordinates and preserve distinct accessible text", () => {
  const html = renderToStaticMarkup(
    <DiscreteSlider
      stops={[
        {
          value: "monthly",
          label: "Ca. 1x/Monat",
          labelLines: ["1×/", "Monat"],
        },
        {
          value: "weekly",
          label: "1x/Woche",
          labelLines: ["1×/", "Woche"],
        },
        {
          value: "daily",
          label: "Täglich",
          labelLines: ["1×/", "Tag"],
        },
      ]}
      value="weekly"
      aria-label="Nutzungshäufigkeit"
    />,
  )

  assert.match(html, /class="[^"]*mx-10[^"]*" role="slider"/)
  assert.match(html, /data-slider-label-lane="true"[^>]*class="[^"]*mx-10[^"]*h-11/)
  assert.match(html, /data-slider-stop-marker="weekly"[^>]*style="left:50%"/)
  assert.match(
    html,
    /data-slider-stop-label="weekly"[^>]*style="left:50%;width:min\(12%, 2\.5rem\)"/,
  )
  assert.match(html, /aria-label="1×\/Woche"/)
  assert.match(html, /aria-valuetext="1x\/Woche"/)
  assert.match(html, /data-slider-label-line="1"[^>]*>1×\/<\/span>/)
  assert.match(html, /data-slider-label-line="2"[^>]*>Woche<\/span>/)
})

test("slider stops without two-line presentation retain their full visible label", () => {
  const html = renderToStaticMarkup(
    <DiscreteSlider
      stops={[
        { value: "low", label: "Niedrig" },
        { value: "high", label: "Hoch" },
      ]}
      value="low"
      aria-label="Intensität"
    />,
  )

  assert.match(html, /aria-label="Niedrig"/)
  assert.match(html, /aria-valuetext="Niedrig"/)
  assert.match(html, />Niedrig<\/span>/)
})

test("two-line labels without a slash keep a space in their accessible name", () => {
  const html = renderToStaticMarkup(
    <DiscreteSlider
      stops={[
        {
          value: "biweekly",
          label: "Ca. alle 2 Wochen",
          labelLines: ["Alle 2", "Wochen"],
        },
      ]}
      value="biweekly"
      aria-label="Nutzungshäufigkeit"
    />,
  )

  assert.match(html, /aria-label="Alle 2 Wochen"/)
})

test("partially supplied two-line labels fall back to the unconstrained full-label row", () => {
  const html = renderToStaticMarkup(
    <DiscreteSlider
      stops={[
        { value: "low", label: "Selten", labelLines: ["Sehr", "selten"] },
        { value: "high", label: "Sehr häufig" },
      ]}
      value="low"
      aria-label="Intensität"
    />,
  )

  assert.doesNotMatch(html, /data-slider-label-lane="true"/)
  assert.match(html, /aria-label="Selten"/)
  assert.match(html, /aria-label="Sehr häufig"/)
})
