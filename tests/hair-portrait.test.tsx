import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { HairPortrait } from "../src/components/quiz/hair-portrait"
import { derivePortraitConfig } from "../src/lib/quiz/portrait-config"
import type { GuidedStoryPriority } from "../src/lib/quiz/guided-story-priorities"

const priorities: [GuidedStoryPriority, GuidedStoryPriority, GuidedStoryPriority] = [
  {
    family: "strength_damage",
    tier: 1,
    variantId: "strength_damage.haarbruch_schaden_basis",
    title: "Bruchstellen zuerst",
    finding: "Deine Längen brauchen Schutz.",
    why: "Der Zugtest und deine Ziele zeigen eine klare Belastung.",
    helps: "Wir starten mit einer stärkenden Routine.",
    matchedConcerns: ["breakage"],
    matchedGoals: ["strengthen"],
    isCentral: true,
  },
  {
    family: "moisture_dryness",
    tier: 2,
    variantId: "moisture_dryness.trockenheit_basis",
    title: "Mehr Feuchtigkeit",
    finding: "Die Oberfläche wirkt trocken.",
    why: "Rauigkeit und Trockenheit passen zusammen.",
    helps: "Wir ergänzen Pflege, die nicht beschwert.",
    matchedConcerns: ["dryness"],
    matchedGoals: ["moisture"],
    isCentral: false,
  },
  {
    family: "surface_manageability",
    tier: 3,
    variantId: "surface_manageability.frizz",
    title: "Ruhigere Oberfläche",
    finding: "Frizz ist ein Nebenthema.",
    why: "Das passt zu deiner Struktur.",
    helps: "Wir halten Styling-Hürden klein.",
    matchedConcerns: ["frizz"],
    matchedGoals: ["less_frizz"],
    isCentral: false,
  },
]

test("HairPortrait renders a hidden deterministic SVG plus a concise DOM text equivalent", () => {
  const config = derivePortraitConfig({
    structure: "wavy",
    density: "high",
    hair_length: "medium",
    treatment: ["dauerwelle"],
  })
  const html = renderToStaticMarkup(
    <HairPortrait config={config} priorities={priorities} selectedIndex={0} onSelect={() => {}} />,
  )

  assert.match(html, /<svg[^>]*aria-hidden="true"[^>]*viewBox="0 0 360 440"/)
  assert.match(html, /preserveAspectRatio="xMidYMid meet"/)
  assert.doesNotMatch(html, /role="img"|<title|<desc/)
  assert.match(
    html,
    /Symbolische Darstellung aus deinen Angaben: mittellanges, welliges Haar mit hoher Dichte\./,
  )
  assert.match(html, /Naturansatz, dauergewellte Längen\./)
})

test("HairPortrait renders three native marker buttons with accessible selected state", () => {
  const config = derivePortraitConfig({
    structure: "curly",
    density: "medium",
    hair_length: "long",
    treatment: ["chemisch_geglaettet"],
  })
  const html = renderToStaticMarkup(
    <HairPortrait config={config} priorities={priorities} selectedIndex={1} onSelect={() => {}} />,
  )

  assert.match(html, /role="group"/)
  assert.match(html, /aria-label="Analysemarker im Haarportrait"/)
  assert.equal((html.match(/type="button"/g) ?? []).length, 3)
  assert.equal((html.match(/data-portrait-marker=/g) ?? []).length, 3)
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1)
  assert.equal((html.match(/aria-pressed="false"/g) ?? []).length, 2)
  assert.match(html, /min-h-\[44px\]/)
  assert.match(html, /min-w-\[44px\]/)
  assert.match(html, /max-w-\[6\.75rem\]/)
  assert.match(html, /focus-visible:ring-2/)
  assert.doesNotMatch(html, /autofocus/)
  assert.match(html, />Stabilität</)
  assert.match(html, />Feuchtigkeit</)
  assert.match(html, />Oberfläche</)
  assert.match(html, /Bruchstellen zuerst/)
  assert.match(html, /Mehr Feuchtigkeit/)
  assert.match(html, /Ruhigere Oberfläche/)
})

test("HairPortrait keeps complete copy in the non-visual equivalent only", () => {
  const config = derivePortraitConfig({
    structure: "wavy",
    density: "high",
    hair_length: "medium",
    treatment: ["dauerwelle"],
  })
  const html = renderToStaticMarkup(
    <HairPortrait config={config} priorities={priorities} selectedIndex={0} onSelect={() => {}} />,
  )

  assert.equal((html.match(/Symbolische Darstellung aus deinen Angaben/g) ?? []).length, 1)
  assert.equal((html.match(/Naturansatz, dauergewellte Längen\./g) ?? []).length, 1)
  assert.doesNotMatch(html, /border-t border-\[#e6ddd3\]/)
})

test("HairPortrait keeps generic copy unspecific when portrait axes are incomplete", () => {
  const config = derivePortraitConfig({ structure: "wavy", density: "medium" })
  const html = renderToStaticMarkup(
    <HairPortrait config={config} priorities={priorities} selectedIndex={0} onSelect={() => {}} />,
  )

  assert.match(html, /Symbolische Darstellung auf Basis der verfügbaren Antworten\./)
  assert.match(
    html,
    /Ein neutrales Portrait zeigt die Analysebereiche ohne konkrete Haarmerkmale\./,
  )
  assert.doesNotMatch(html, /mittellanges|welliges|Dichte|dauergewellte|geglättete/)
})

test("HairPortrait uses neutral visible labels for legacy fallback markers", () => {
  const config = derivePortraitConfig({
    structure: "straight",
    density: "low",
    hair_length: "short",
    treatment: ["natur"],
  })
  const legacyPriorities: [GuidedStoryPriority, GuidedStoryPriority, GuidedStoryPriority] =
    priorities.map((priority, index) => ({
      ...priority,
      isFallback: true,
      variantId: `legacy.${index}`,
    })) as [GuidedStoryPriority, GuidedStoryPriority, GuidedStoryPriority]
  const html = renderToStaticMarkup(
    <HairPortrait
      config={config}
      priorities={legacyPriorities}
      selectedIndex={0}
      onSelect={() => {}}
    />,
  )

  assert.match(html, />Basis</)
  assert.match(html, />Pflege</)
  assert.match(html, />Routine</)
})

test("HairPortrait exposes static density and treatment classes without changing stroke token", () => {
  const low = renderToStaticMarkup(
    <HairPortrait
      config={derivePortraitConfig({
        structure: "wavy",
        density: "low",
        hair_length: "medium",
        treatment: ["natur"],
      })}
      priorities={priorities}
      selectedIndex={0}
      onSelect={() => {}}
    />,
  )
  const high = renderToStaticMarkup(
    <HairPortrait
      config={derivePortraitConfig({
        structure: "wavy",
        density: "high",
        hair_length: "medium",
        treatment: ["natur"],
      })}
      priorities={priorities}
      selectedIndex={0}
      onSelect={() => {}}
    />,
  )

  assert.equal((low.match(/data-portrait-strand=/g) ?? []).length, 5)
  assert.equal((high.match(/data-portrait-strand=/g) ?? []).length, 12)
  assert.equal((low.match(/stroke-\[var\(--portrait-hair-stroke\)\]/g) ?? []).length, 5)
  assert.equal((high.match(/stroke-\[var\(--portrait-hair-stroke\)\]/g) ?? []).length, 12)
})
