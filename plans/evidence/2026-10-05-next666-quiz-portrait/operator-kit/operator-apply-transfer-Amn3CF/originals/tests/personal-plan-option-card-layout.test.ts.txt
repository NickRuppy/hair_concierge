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
    /"personal-plan-option-check mt-0\.5 flex h-6 w-6 shrink-0 items-center justify-center border"/,
  )
})

test("both personal-plan option-card branches share press and selected-check motion hooks", () => {
  assert.equal((optionCardSource.match(/personal-plan-option-card/g) ?? []).length, 2)
  assert.equal((optionCardSource.match(/personal-plan-option-check/g) ?? []).length, 2)
})
