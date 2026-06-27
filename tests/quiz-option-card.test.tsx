import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { QuizOptionCard } from "../src/components/quiz/quiz-option-card"

test("quiz option card centers the icon row against single-line labels", () => {
  const html = renderToStaticMarkup(
    <QuizOptionCard icon="product-shampoo" label="Shampoo" active={false} onClick={() => {}} />,
  )

  assert.match(html, /grid-cols-\[auto_minmax\(0,1fr\)_auto\]/)
  assert.match(html, /\bitems-center\b/)
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

  assert.match(html, /grid-cols-\[auto_minmax\(0,1fr\)_auto\]/)
  assert.match(html, /\bitems-center\b/)
  assert.doesNotMatch(html, /\bitems-start\b/)
})

test("quiz option card reserves a fixed right action rail for trailing info", () => {
  const html = renderToStaticMarkup(
    <QuizOptionCard
      icon="product-conditioner"
      label="Conditioner"
      active={false}
      onClick={() => {}}
      trailing={<button type="button">i</button>}
    />,
  )

  assert.match(html, /grid-cols-\[auto_minmax\(0,1fr\)_auto\]/)
  assert.match(html, /min-w-\[4\.25rem\]/)
  assert.match(html, /\bjustify-end\b/)
  assert.match(html, /<p id="[^"]+" class="break-words hyphens-auto/)
})

test("quiz option card keeps trailing info outside the selectable card button", async () => {
  const html = renderToStaticMarkup(
    <QuizOptionCard
      icon="product-conditioner"
      label="Conditioner"
      description="Pflege nach dem Shampoo"
      active={false}
      onClick={() => {}}
      trailing={<button type="button">i</button>}
    />,
  )
  const source = await readFile("src/components/ui/info-tip.tsx", "utf8")
  const accessibleButtonMatch = html.match(
    /<button type="button" aria-labelledby="([^"]+)" aria-describedby="([^"]+)"/,
  )

  assert.ok(accessibleButtonMatch)
  assert.match(html, new RegExp(`<p id="${accessibleButtonMatch[1]}"[^>]*>Conditioner</p>`))
  assert.match(
    html,
    new RegExp(`<p id="${accessibleButtonMatch[2]}"[^>]*>Pflege nach dem Shampoo</p>`),
  )
  assert.match(html, /<button type="button">i<\/button>/)
  assert.match(html, /<\/button><div class="pointer-events-none relative z-10 grid/)
  assert.doesNotMatch(html, /role="button"/)
  assert.match(source, /event\.stopPropagation\(\)/)
  assert.match(source, /event\.key === "Escape"/)
  assert.match(source, /aria-describedby=\{open \? popupId : undefined\}/)
  assert.match(html, /\bfocus-visible:ring-inset\b/)
  assert.match(html, /\baria-pressed="false"/)
})

test("single-select screen syncs prop changes and cancels delayed selection on back", async () => {
  const source = await readFile(
    "src/components/onboarding/screens/single-select-screen.tsx",
    "utf8",
  )

  assert.match(source, /useEffect\(\(\) => \{\s*setLocalSelected\(selected\)/)
  assert.match(source, /clearTimeout\(advanceTimerRef\.current\)/)
  assert.match(source, /function handleBack\(\)/)
  assert.match(source, /cancelPendingAdvance\(\)/)
})
