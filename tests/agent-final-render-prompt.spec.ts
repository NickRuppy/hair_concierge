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

test("final render prompt hides internal fallback markers from users", () => {
  assert.match(AGENT_FINAL_RENDER_PROMPT, /intern mit "Fallback:" markiert/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /nie in der Nutzerantwort ausgeben/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /schwaecheren Optionen nur nachgeordnet/)
})

test("final render prompt preserves spray versus cream leave-in comparisons", () => {
  assert.match(AGENT_FINAL_RENDER_PROMPT, /Spray-vs-Creme-Leave-in/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /Ersetze das Spray nicht durch eine Lotion/)
})

test("final render prompt explains the one-less-product value of integrated leave-in heat protection", () => {
  assert.match(AGENT_FINAL_RENDER_PROMPT, /verwende im Einstieg ausdruecklich/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /ein Produkt weniger/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /Zwei-in-eins-Route/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /separaten Hitzeschutz behalten/)
})

test("final render prompt requires profile deviation notices up front", () => {
  assert.match(AGENT_FINAL_RENDER_PROMPT, /Pflicht: Wenn selected_products\.profile_basis/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /Profil-Hinweis:/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /ersten Antwortsatz/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /nicht als dauerhaft gespeicherte Profilkorrektur/)
})

test("final render prompt gives conceptual split-end mask answers enough substance", () => {
  assert.match(AGENT_FINAL_RENDER_PROMPT, /konzeptuellen Spliss-Fragen zu Masken/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /3-5 kurzen Saetzen/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /physischer Faserschaden/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /sichtbaren Spliss schneiden lassen/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /Keine Produktliste/)
})

test("final render prompt keeps dry shampoo as a narrow bridge with hard-no guardrails", () => {
  assert.match(AGENT_FINAL_RENDER_PROMPT, /Bei Trockenshampoo/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /Between-Wash-Bruecke/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /reinigt die Kopfhaut nicht/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /spaeter ausgewaschen/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /keine Trockenshampoo-Produkte erfinden/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /keine Ersatzprodukte wie Babypuder/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /Auch ohne selected_products/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /route\.product_category=dry_shampoo/)
})
