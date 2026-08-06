import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

const skillRoot = ".agents/skills/category-specific-recommendation"
const skill = readFileSync(`${skillRoot}/SKILL.md`, "utf8")

test("category-specific-recommendation remains explicit-only", () => {
  const metadata = readFileSync(`${skillRoot}/agents/openai.yaml`, "utf8")

  assert.match(metadata, /^\s*default_prompt:.*\$category-specific-recommendation/m)
  assert.match(metadata, /^\s*allow_implicit_invocation:\s*false/m)
  assert.match(skill, /^description:.*Use only when Nick explicitly invokes this skill/m)
})

test("category-specific-recommendation routing remains manual-only", () => {
  const agentInstructions = readFileSync("AGENTS.md", "utf8")
  const reviewMap = readFileSync("docs/codex-review-map.md", "utf8")
  const legacyPlan = readFileSync("plans/2026-05-22-section-d-recommendation-evidence.md", "utf8")
  const bugSkill = readFileSync(".agents/skills/bug/SKILL.md", "utf8")
  const categorySection = agentInstructions.match(
    /### `category-specific-recommendation`[\s\S]*?(?=\n### |\n## |$)/,
  )?.[0]

  assert.ok(categorySection, "AGENTS.md must route category-specific-recommendation")
  assert.match(categorySection, /Use only when Nick explicitly invokes it/)
  assert.match(reviewMap, /When Nick explicitly invokes it, use `category-specific-recommendation`/)
  assert.match(
    legacyPlan,
    /Use `category-specific-recommendation` only when Nick explicitly invokes it/,
  )
  assert.match(
    bugSkill,
    /Route category logic to `category-specific-recommendation` only when Nick explicitly invokes that skill/,
  )
})

test("category-specific-recommendation links its definition checklist", () => {
  const checklistLink = skill.match(/\]\((references\/[^)]+\.md)\)/)?.[1]

  assert.ok(checklistLink, "SKILL.md must link a reference checklist")
  const checklistPath = `${skillRoot}/${checklistLink}`
  assert.ok(existsSync(checklistPath), `linked checklist must exist: ${checklistPath}`)
  assert.match(readFileSync(checklistPath, "utf8"), /^# Category definition checklist/m)
})
