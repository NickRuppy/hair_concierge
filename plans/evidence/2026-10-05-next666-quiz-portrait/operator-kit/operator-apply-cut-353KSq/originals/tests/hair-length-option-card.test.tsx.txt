import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { HairLengthOptionCard } from "../src/components/quiz/hair-length-option-card"
import { HairPortraitFigure } from "../src/components/quiz/hair-portrait-figure"

const portraitConfig = {
  kind: "personalized" as const,
  density: "medium" as const,
  length: "very_long" as const,
  naturalRootPattern: "coily" as const,
  treatedLengthPattern: "coily" as const,
  treatmentState: "none" as const,
}

const ownBodyPortraitConfig = {
  ...portraitConfig,
  length: "very_short" as const,
  naturalRootPattern: "straight" as const,
  treatedLengthPattern: "straight" as const,
}

test("shared hair-length card keeps the complete decorative portrait composition inside one fixed media frame", () => {
  const html = renderToStaticMarkup(
    <HairLengthOptionCard
      config={portraitConfig}
      description="Taille oder länger."
      label="Sehr lang"
      onClick={() => {}}
      selected={false}
      selectionVariant="regular"
    />,
  )

  assert.match(html, /data-hair-length-card="true" data-selection-variant="regular"/)
  assert.match(html, /h-\[184px\]/)
  assert.match(html, /h-\[140px\]/)
  assert.match(html, /\[@media\(max-height:700px\)\]:h-\[152px\]/)
  assert.match(html, /data-hair-portrait-media="true"/)
  assert.match(
    html,
    /class="flex h-full w-full items-center justify-center scale-\[0\.9\]" data-hair-portrait-art="true"/,
  )
  assert.match(html, /<svg aria-hidden="true"/)
  assert.match(html, /<img alt=""/)
  assert.match(html, /aria-pressed="false"/)
  assert.match(html, /aria-describedby="[^"]+"/)
})

test("shared portrait figure keeps very-short own-body assets self-contained", () => {
  const html = renderToStaticMarkup(<HairPortraitFigure config={ownBodyPortraitConfig} />)

  assert.match(html, /src="\/images\/quiz\/hair-portrait\/straight-very-short\.webp"/)
  assert.doesNotMatch(html, /<svg/)
  assert.match(html, /<img alt=""/)
})

test("shared hair-length card preserves the Personal Plan selected treatment", () => {
  const html = renderToStaticMarkup(
    <HairLengthOptionCard
      config={portraitConfig}
      label="Sehr lang"
      onClick={() => {}}
      selected
      selectionVariant="personal-plan"
    />,
  )

  assert.match(html, /data-selection-variant="personal-plan"/)
  assert.match(html, /bg-\[var\(--brand-plum-ice\)\]/)
  assert.match(html, /h-6 w-6/)
  assert.match(html, /aria-pressed="true"/)
})
