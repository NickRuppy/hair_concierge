import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const quizSource = readFileSync("src/components/personal-plan-quiz/personal-plan-quiz.tsx", "utf8")
const optionCardSource = quizSource.slice(
  quizSource.indexOf("function OptionCard({"),
  quizSource.indexOf("function MobileBottomAction"),
)

test("standard personal-plan option cards reserve a full-width row for the trailing selector", () => {
  // Older iPhone browser engines can shrink-wrap a child of the column-flex card.
  // The explicit width makes short and long labels use the same selector column.
  assert.match(optionCardSource, /"flex w-full flex-1 gap-3"/)
  assert.match(optionCardSource, /"min-w-0 flex-1"/)
  assert.match(
    optionCardSource,
    /"mt-0\.5 flex h-6 w-6 shrink-0 items-center justify-center border"/,
  )
})
