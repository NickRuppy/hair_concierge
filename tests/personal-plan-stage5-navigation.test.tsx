import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("Stage 5 leaves the shared Header unchanged while rollout is off", () => {
  const header = readFileSync("src/components/layout/header.tsx", "utf8")
  assert.equal((header.match(/href="\/anwendung"/g) ?? []).length, 0)
  assert.match(header, /RoutineAttentionIndicator/)
})

test("Stage 5 does not add a competing application shell or navigation", () => {
  for (const file of [
    "src/components/layout/authenticated-app-shell.tsx",
    "src/components/layout/personal-plan-navigation.tsx",
  ]) {
    assert.throws(() => readFileSync(file, "utf8"))
  }
})
