import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import {
  HairPortrait,
  HairPortraitArtwork,
  getNextPortraitImageFailure,
  getNextPortraitImageState,
  normalizePortraitImageSrcForComparison,
  type PortraitImageFailure,
} from "../src/components/quiz/hair-portrait"
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

test("HairPortraitArtwork renders the complete selected portrait without analysis controls", () => {
  const config = derivePortraitConfig({
    structure: "coily",
    density: "medium",
    hair_length: "short",
    treatment: ["natur"],
  })
  const html = renderToStaticMarkup(
    <HairPortraitArtwork className="preparation-portrait" config={config} />,
  )

  const bodyIndex = html.indexOf('data-portrait-layer="body"')
  const imageIndex = html.indexOf('data-portrait-layer="image"')

  assert.match(html, /class="mx-auto w-full max-w-\[32rem\] preparation-portrait"/)
  assert.ok(bodyIndex > -1, "hair-only assets must receive the shared body layer")
  assert.ok(bodyIndex < imageIndex, "body must sit below image")
  assert.match(html, /src="\/images\/quiz\/hair-portrait\/coily-short\.webp"/)
  assert.match(html, /Symbolische Darstellung aus deinen Angaben: kurzes, coily Haar\./)
  assert.match(html, /Das Portrait zeigt deine natürliche Haarstruktur\./)
  assert.doesNotMatch(
    html,
    /data-portrait-layer="leaders"|data-portrait-layer="markers"|data-portrait-marker=|type="button"|role="group"/,
  )
  assert.doesNotMatch(html, /Bruchstellen zuerst|Mehr Feuchtigkeit|Ruhigere Oberfläche/)
})

test("HairPortraitArtwork accepts raw answers and omits the shared body for ownBody assets", () => {
  const html = renderToStaticMarkup(
    <HairPortraitArtwork
      rawAnswers={{
        structure: "straight",
        density: "low",
        hair_length: "very_short",
        treatment: ["natur"],
      }}
    />,
  )

  assert.match(html, /src="\/images\/quiz\/hair-portrait\/straight-very-short\.webp"/)
  assert.doesNotMatch(html, /data-portrait-layer="body"/)
  assert.doesNotMatch(html, /data-portrait-layer="leaders"|data-portrait-layer="markers"/)
})

test("HairPortrait renders the selected generated portrait as a decorative priority image", () => {
  const config = derivePortraitConfig({
    structure: "wavy",
    density: "high",
    hair_length: "medium",
    treatment: ["dauerwelle"],
  })
  const html = renderToStaticMarkup(
    <HairPortrait config={config} priorities={priorities} selectedIndex={0} onSelect={() => {}} />,
  )

  assert.match(
    html,
    /<link rel="preload" as="image" href="\/images\/quiz\/hair-portrait\/curly-medium\.webp"/,
  )
  assert.match(
    html,
    /<img alt="" data-portrait-layer="image" width="720" height="720"[^>]*class="relative z-10 block h-auto w-full"[^>]*src="\/images\/quiz\/hair-portrait\/curly-medium\.webp"/,
  )
  assert.match(html, /data-nimg="1"/)
  assert.doesNotMatch(html, /role="img"|<title|<desc|data-portrait-strand/)
  assert.match(html, /Symbolische Darstellung aus deinen Angaben: mittellanges, lockiges Haar\./)
  assert.match(
    html,
    /Das Portrait zeigt die dauergewellte Struktur vereinfacht als lockiges Haar\./,
  )
  assert.doesNotMatch(html, /hoher Dichte|Naturansatz|dauergewellte Längen/)
})

test("HairPortrait composes the exact visual layers around hair-only assets", () => {
  const config = derivePortraitConfig({
    structure: "coily",
    density: "medium",
    hair_length: "short",
    treatment: ["natur"],
  })
  const html = renderToStaticMarkup(
    <HairPortrait config={config} priorities={priorities} selectedIndex={0} onSelect={() => {}} />,
  )

  const bodyIndex = html.indexOf('data-portrait-layer="body"')
  const imageIndex = html.indexOf('data-portrait-layer="image"')
  const leaderIndex = html.indexOf('data-portrait-layer="leaders"')
  const markerIndex = html.indexOf('data-portrait-layer="markers"')

  assert.match(html, /data-portrait-layer="wrapper"[^>]*>/)
  assert.match(
    html,
    /class="isolate relative mx-auto aspect-square w-full min-w-0 overflow-visible"/,
  )
  assert.ok(bodyIndex > -1, "hair-only assets must receive the shared body layer")
  assert.ok(bodyIndex < imageIndex, "body must sit below image")
  assert.ok(imageIndex < leaderIndex, "leaders must sit above image")
  assert.ok(leaderIndex < markerIndex, "buttons must sit above decorative leaders")
  assert.match(html, /data-portrait-layer="body"[^>]*viewBox="0 0 1024 1024"/)
  assert.equal((html.match(/stroke-\[#8f84a8\] stroke-\[7\]/g) ?? []).length, 4)
  assert.match(html, /data-portrait-layer="leaders"[^>]*viewBox="0 0 100 100"/)
  assert.equal((html.match(/stroke-\[#8f84a8\] stroke-\[0\.55\]/g) ?? []).length, 3)
})

test("HairPortrait does not draw the shared body for approved ownBody pixie assets", () => {
  const config = derivePortraitConfig({
    structure: "straight",
    density: "low",
    hair_length: "very_short",
    treatment: ["natur"],
  })
  const html = renderToStaticMarkup(
    <HairPortrait config={config} priorities={priorities} selectedIndex={0} onSelect={() => {}} />,
  )

  assert.match(html, /src="\/images\/quiz\/hair-portrait\/straight-very-short\.webp"/)
  assert.doesNotMatch(html, /data-portrait-layer="body"/)
  assert.match(html, /data-portrait-layer="leaders"/)
  assert.match(html, /data-portrait-layer="markers"/)
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
  assert.match(html, /style="left:50%;top:18%"/)
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
  assert.equal((html.match(/dauergewellte Struktur vereinfacht/g) ?? []).length, 1)
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
  assert.match(html, /src="\/images\/quiz\/hair-portrait\/generic\.webp"/)
  assert.match(html, /data-portrait-layer="body"/)
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

test("HairPortrait image fallback advances once to generic and then terminal hidden state", () => {
  assert.equal(getNextPortraitImageState("selected"), "generic")
  assert.equal(getNextPortraitImageState("generic"), "hidden")
  assert.equal(getNextPortraitImageState("hidden"), "hidden")
})

test("HairPortrait image fallback compares same-origin absolute and relative image paths", () => {
  assert.equal(
    normalizePortraitImageSrcForComparison(
      "http://localhost:3516/images/quiz/hair-portrait/wavy-long.webp",
      "http://localhost:3516",
    ),
    "/images/quiz/hair-portrait/wavy-long.webp",
  )
  assert.equal(
    normalizePortraitImageSrcForComparison(
      "http://localhost:3516/images/quiz/hair-portrait/curly-long.webp",
      "http://localhost:3516",
    ),
    "/images/quiz/hair-portrait/curly-long.webp",
  )
  assert.equal(
    normalizePortraitImageSrcForComparison(
      "https://example.com/images/quiz/hair-portrait/wavy-long.webp",
      "http://localhost:3516",
    ),
    "https://example.com/images/quiz/hair-portrait/wavy-long.webp",
  )
})

test("HairPortrait image fallback accepts absolute selected failures for the same path only", () => {
  const selectedSrc = "/images/quiz/hair-portrait/wavy-long.webp"
  const initialFailure: PortraitImageFailure = { selectedSrc: "", state: "selected" }

  assert.deepEqual(
    getNextPortraitImageFailure(initialFailure, {
      selectedSrc,
      failedSrc: "http://localhost:3516/images/quiz/hair-portrait/wavy-long.webp",
      renderedSrc: selectedSrc,
      currentOrigin: "http://localhost:3516",
    }),
    { selectedSrc, state: "generic" },
  )
  assert.deepEqual(
    getNextPortraitImageFailure(initialFailure, {
      selectedSrc,
      failedSrc: "http://localhost:3516/images/quiz/hair-portrait/curly-long.webp",
      renderedSrc: selectedSrc,
      currentOrigin: "http://localhost:3516",
    }),
    initialFailure,
  )
})

test("HairPortrait image fallback ignores duplicate or stale selected failures after generic renders", () => {
  const selectedSrc = "/images/quiz/hair-portrait/wavy-long.webp"
  const genericSrc = "/images/quiz/hair-portrait/generic.webp"
  const initialFailure: PortraitImageFailure = { selectedSrc: "", state: "selected" }

  const genericFailure = getNextPortraitImageFailure(initialFailure, {
    selectedSrc,
    failedSrc: selectedSrc,
    renderedSrc: selectedSrc,
  })
  const duplicateSelectedFailure = getNextPortraitImageFailure(genericFailure, {
    selectedSrc,
    failedSrc: selectedSrc,
    renderedSrc: genericSrc,
  })
  const staleSelectedFailure = getNextPortraitImageFailure(genericFailure, {
    selectedSrc,
    failedSrc: "/images/quiz/hair-portrait/curly-medium.webp",
    renderedSrc: genericSrc,
  })

  assert.deepEqual(genericFailure, { selectedSrc, state: "generic" })
  assert.deepEqual(duplicateSelectedFailure, genericFailure)
  assert.deepEqual(staleSelectedFailure, genericFailure)
})

test("HairPortrait image fallback hides only after the rendered generic image fails", () => {
  const selectedSrc = "/images/quiz/hair-portrait/wavy-long.webp"
  const genericSrc = "/images/quiz/hair-portrait/generic.webp"
  const genericFailure: PortraitImageFailure = { selectedSrc, state: "generic" }

  assert.deepEqual(
    getNextPortraitImageFailure(genericFailure, {
      selectedSrc,
      failedSrc: genericSrc,
      renderedSrc: genericSrc,
    }),
    { selectedSrc, state: "hidden" },
  )
})

test("HairPortrait image fallback hides immediately when the selected asset is already generic", () => {
  const genericSrc = "/images/quiz/hair-portrait/generic.webp"
  const initialFailure: PortraitImageFailure = { selectedSrc: "", state: "selected" }

  assert.deepEqual(
    getNextPortraitImageFailure(initialFailure, {
      selectedSrc: genericSrc,
      failedSrc: genericSrc,
      renderedSrc: genericSrc,
    }),
    { selectedSrc: genericSrc, state: "hidden" },
  )
})

test("HairPortrait density does not change the selected asset or visual copy", () => {
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

  assert.match(low, /src="\/images\/quiz\/hair-portrait\/wavy-medium\.webp"/)
  assert.match(high, /src="\/images\/quiz\/hair-portrait\/wavy-medium\.webp"/)
  assert.doesNotMatch(low, /niedriger Dichte|mittlerer Dichte|hoher Dichte/)
  assert.doesNotMatch(high, /niedriger Dichte|mittlerer Dichte|hoher Dichte/)
})
