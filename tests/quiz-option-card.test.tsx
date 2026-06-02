import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { QuizOptionCard } from "../src/components/quiz/quiz-option-card"

test("quiz option card centers the icon row against single-line labels", () => {
  const html = renderToStaticMarkup(
    <QuizOptionCard icon="product-shampoo" label="Shampoo" active={false} onClick={() => {}} />,
  )

  assert.match(html, /<div class="flex items-center gap-3">/)
  assert.doesNotMatch(html, /\bitems-start\b/)
})

test("quiz option card centers descriptive rows against the full text block", () => {
  const html = renderToStaticMarkup(
    <QuizOptionCard
      icon="hair-wavy"
      label="Wellig"
      description="Bildet eine S-Kurve, keine 3D-Windung"
      active={false}
      onClick={() => {}}
    />,
  )

  assert.match(html, /<div class="flex items-center gap-3">/)
  assert.doesNotMatch(html, /\bitems-start\b/)
})
