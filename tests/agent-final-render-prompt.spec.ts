import assert from "node:assert/strict"
import test from "node:test"

import { AGENT_FINAL_RENDER_PROMPT } from "../src/lib/agent/orchestrator/prompt"

test("final render prompt keeps pre-wash oil away from scalp-treatment claims", () => {
  assert.match(AGENT_FINAL_RENDER_PROMPT, /Bei Pre-Wash-Oel/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /Laengen und Spitzen/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /Nicht sagen, dass Oel die Kopfhaut beruhigt/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /Schuppen\/Juckreiz loest/)
})

test("final render prompt ties conceptual oil comparisons back to the user", () => {
  assert.match(AGENT_FINAL_RENDER_PROMPT, /konzeptuellen Oel-Vergleichen/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /kurzen \"in deinem Fall\"-Satz/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /Pre-Wash/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /Finish-Oel/)
})

test("final render prompt preserves all selected product options in order", () => {
  assert.match(AGENT_FINAL_RENDER_PROMPT, /alle Produkte aus selected_products\.products/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /gegebenen Reihenfolge/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /nicht eigenmaechtig von drei Tool-Produkten auf zwei/)
})

test("final render prompt preserves spray versus cream leave-in comparisons", () => {
  assert.match(AGENT_FINAL_RENDER_PROMPT, /Spray-vs-Creme-Leave-in/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /Ersetze das Spray nicht durch eine Lotion/)
})

test("final render prompt requires profile deviation notices up front", () => {
  assert.match(AGENT_FINAL_RENDER_PROMPT, /Pflicht: Wenn selected_products\.profile_basis/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /Profil-Hinweis:/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /ersten Antwortsatz/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /nicht als dauerhaft gespeicherte Profilkorrektur/)
})
