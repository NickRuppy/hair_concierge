import assert from "node:assert/strict"
import test from "node:test"

import {
  AGENT_V2_GUIDANCE_PACKAGE_IDS,
  getAgentV2GuidancePackageEntry,
} from "../src/lib/agent-v2/guidance/package-index"
import { loadAgentV2GuidancePackages } from "../src/lib/agent-v2/guidance/compiler"
import { selectGuidancePackageIds } from "../src/lib/agent-v2/tools/guidance-tool"

test("AgentV2 guidance index includes all required base packages", () => {
  for (const id of [
    "base.advisor_rules.v1",
    "base.answer_contract.v1",
    "base.product_recommendation.v1",
    "base.routine_building.v1",
    "base.general_advice.v1",
    "base.safety_boundaries.v1",
    "base.tone_and_format.v1",
  ]) {
    assert.ok((AGENT_V2_GUIDANCE_PACKAGE_IDS as readonly string[]).includes(id))
    assert.ok(getAgentV2GuidancePackageEntry(id))
  }
})

test("AgentV2 guidance index includes every active product category", () => {
  for (const id of [
    "category.shampoo.v1",
    "category.conditioner.v1",
    "category.leave_in.v1",
    "category.mask.v1",
    "category.oil.v1",
    "category.bondbuilder.v1",
    "category.deep_cleansing_shampoo.v1",
    "category.dry_shampoo.v1",
    "category.peeling.v1",
  ]) {
    assert.ok((AGENT_V2_GUIDANCE_PACKAGE_IDS as readonly string[]).includes(id))
    assert.ok(getAgentV2GuidancePackageEntry(id))
  }
})

test("loadAgentV2GuidancePackages loads structured metadata plus markdown brief", async () => {
  const result = await loadAgentV2GuidancePackages([
    "base.product_recommendation.v1",
    "category.shampoo.v1",
  ])

  assert.equal(result.packages.length, 2)
  assert.ok(result.packages[0].markdown_brief.length > 80)
  assert.ok(result.packages[0].hard_rules.every((rule) => rule.rule_id.length > 0))
  assert.ok(result.hard_rules.some((rule) => rule.rule_id === "product.no_uncatalogued_products"))
})

test("loadAgentV2GuidancePackages rejects unknown package ids", async () => {
  await assert.rejects(
    () => loadAgentV2GuidancePackages(["missing.package.v1"]),
    /Unknown AgentV2 guidance package/,
  )
})

test("routine layer hint loads routine guidance even without an answer mode hint", () => {
  const ids = selectGuidancePackageIds({
    answer_mode_hint: null,
    categories: [],
    routine_layer: "basics",
    safety_mode: "normal",
  })

  assert.ok(ids.includes("base.routine_building.v1"))
})

test("routine guidance keeps broad basics answers profile-linked and staged", async () => {
  const result = await loadAgentV2GuidancePackages(["base.routine_building.v1"])
  const brief = result.markdown_brief

  assert.match(brief, /shampoo role/i)
  assert.match(brief, /shampoo type/i)
  assert.match(brief, /conditioner role/i)
  assert.match(brief, /conditioner type/i)
  assert.match(brief, /biggest extra lever/i)
  assert.match(brief, /basics-first/i)
  assert.match(brief, /fine hair, dry scalp, oily scalp, curls, or damage/i)
})

test("product guidance frames ranked products as tradeoff options", async () => {
  const result = await loadAgentV2GuidancePackages(["base.product_recommendation.v1"])
  const brief = result.markdown_brief

  assert.match(brief, /options with tradeoffs/i)
  assert.match(brief, /cleanest fit/i)
  assert.match(brief, /profile\/tool facts/i)
  assert.match(brief, /one natural fit sentence/i)
  assert.match(brief, /Do not show raw property bullets/i)
  assert.match(brief, /routine_product_deep_dive/i)
  assert.match(brief, /return to the routine/i)
  assert.match(brief, /up to three products/i)
  assert.match(brief, /default to three products/i)
  assert.match(brief, /respect the explicit count/i)
  assert.match(brief, /Welche Spülung passt/i)
  assert.match(brief, /concrete category-fit ask/i)
  assert.doesNotMatch(brief, /wenn du nur eins nimmst/i)
})

test("tone guidance asks for warm light structure", async () => {
  const result = await loadAgentV2GuidancePackages(["base.tone_and_format.v1"])
  const brief = result.markdown_brief

  assert.match(brief, /light bold anchors/i)
  assert.match(brief, /brief why/i)
  assert.match(brief, /not clipped/i)
  assert.match(brief, /direct answer first/i)
  assert.match(brief, /profile-linked why/i)
  assert.match(brief, /Bullets are for sibling options/i)
  assert.match(brief, /Do not put a subheader above a long stack of bullets/i)
  assert.match(brief, /one practical next step or caveat/i)
})

test("routine guidance routes concrete product asks through routine product deep dive", async () => {
  const result = await loadAgentV2GuidancePackages(["base.routine_building.v1"])
  const brief = result.markdown_brief

  assert.match(brief, /concrete product ask inside an active routine/i)
  assert.match(brief, /routine_product_deep_dive/i)
  assert.match(brief, /select_products/i)
})

test("general advice guidance preserves routine context for category explanations", async () => {
  const result = await loadAgentV2GuidancePackages(["base.general_advice.v1"])
  const brief = result.markdown_brief

  assert.match(brief, /answer the category distinction first/i)
  assert.match(brief, /active routine context/i)
  assert.match(brief, /preserve routine context/i)
  assert.match(brief, /avoid concrete products unless explicitly asked/i)
  assert.match(brief, /return to the routine or a product deep dive/i)
  assert.match(brief, /Category First, Products On Ask/i)
  assert.match(brief, /switch to the product recommendation flow/i)
  assert.match(brief, /mask helps/i)
  assert.match(brief, /conditioner is enough/i)
})

test("base guidance teaches request interpretation and typed semantic tool args", async () => {
  const result = await loadAgentV2GuidancePackages([
    "base.answer_contract.v1",
    "base.product_recommendation.v1",
    "base.routine_building.v1",
    "base.general_advice.v1",
    "base.tone_and_format.v1",
  ])
  const brief = result.markdown_brief

  assert.match(brief, /request_interpretation/i)
  assert.match(brief, /terminal contract/i)
  assert.match(brief, /must match tool args and answer mode/i)
  assert.match(brief, /evidence_quote/i)
  assert.match(brief, /low confidence/i)
  assert.match(brief, /typed tool args/i)
  assert.match(brief, /count_policy/i)
  assert.match(brief, /bounded repair/i)
  assert.match(brief, /specific_products/i)
  assert.match(brief, /category_education/i)
  assert.match(brief, /Welche Spülung passt zu feinem Haar/i)
  assert.match(brief, /Welche Art von Spülung passt zu feinem Haar/i)
  assert.match(brief, /routine_intent/i)
  assert.match(brief, /routine exit/i)
})
