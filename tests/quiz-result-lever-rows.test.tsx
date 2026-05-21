// tests/quiz-result-lever-rows.test.tsx
import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

// @ts-expect-error - Component not implemented yet (TDD red phase). Removed in Task 5's component creation step.
import { QuizResultLeverRows } from "../src/components/quiz/quiz-result-lever-rows"

test("lever rows renders the primary product with a star and the secondary product with a plus", () => {
  const html = renderToStaticMarkup(
    <QuizResultLeverRows
      products={[
        { name: "Conditioner", description: "Stabilisiert die Oberfläche der Längen." },
        { name: "Leave-in", description: "Hält die Wirkung zwischen den Wäschen." },
      ]}
    />,
  )

  assert.match(html, /Conditioner/)
  assert.match(html, /Stabilisiert die Oberfläche der Längen\./)
  assert.match(html, /Leave-in/)
  assert.match(html, /Hält die Wirkung zwischen den Wäschen\./)
  assert.match(html, /aria-label="Primärer Hebel"/)
  assert.match(html, /aria-label="Sekundärer Hebel"/)
})
