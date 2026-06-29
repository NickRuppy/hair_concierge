import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import test from "node:test"

import {
  AGENT_V2_GUIDANCE_PACKAGE_IDS,
  getAgentV2GuidancePackageEntry,
} from "../src/lib/agent-v2/guidance/package-index"
import { loadAgentV2GuidancePackages } from "../src/lib/agent-v2/guidance/compiler"
import { selectGuidancePackageIds } from "../src/lib/agent-v2/tools/guidance-tool"

function listMarkdownSources(directory: string): string[] {
  return readdirSync(directory)
    .flatMap((entry) => {
      const path = `${directory}/${entry}`
      const stat = statSync(path)

      if (stat.isDirectory()) return listMarkdownSources(path)
      return path.endsWith(".md") ? [path] : []
    })
    .sort()
}

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

test("AgentV2 category metadata declares grounding and ask policies", () => {
  for (const path of listMarkdownSources("data/agent-v2/guidance/categories")) {
    const metadataPath = path.replace(/\.md$/, ".json")
    const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as {
      hard_rules: Array<{ source?: string }>
      soft_rubrics: Array<{ source?: string }>
      required_grounding: unknown[]
      ask_when: unknown[]
      markdown_path: string
    }

    assert.ok(metadata.hard_rules.length > 0, `${metadataPath} missing hard rules`)
    assert.ok(metadata.soft_rubrics.length > 0, `${metadataPath} missing soft rubrics`)
    assert.ok(metadata.required_grounding.length > 0, `${metadataPath} missing grounding policy`)
    assert.ok(metadata.ask_when.length > 0, `${metadataPath} missing ask policy`)
    assert.equal(metadata.markdown_path, path.replace("data/agent-v2/guidance/", ""))

    for (const entry of [...metadata.hard_rules, ...metadata.soft_rubrics]) {
      assert.ok(entry.source?.startsWith("categories/"), `${metadataPath} has unanchored rule`)
    }
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

test("base guidance exposes conversation closure policy through existing rubrics", async () => {
  const result = await loadAgentV2GuidancePackages([
    "base.tone_and_format.v1",
    "base.general_advice.v1",
  ])

  const rubricMessages = result.soft_rubrics
    .filter((rubric) =>
      ["tone.feasible_cta", "tone.non_redundant_ending", "advice.feasible_next_step"].includes(
        rubric.rubric_id,
      ),
    )
    .map((rubric) => rubric.message)
    .join("\n")

  assert.match(rubricMessages, /clean stop|complete answer|not force/i)
  assert.match(rubricMessages, /INCI|ingredient/i)
  assert.match(rubricMessages, /one material question/i)
})

test("product guidance exposes grounded next-add-on rationale rubric", async () => {
  const result = await loadAgentV2GuidancePackages(["base.product_recommendation.v1"])

  const rubric = result.soft_rubrics.find(
    (entry) => entry.rubric_id === "product.next_add_on_grounded_rationale",
  )

  assert.ok(rubric)
  assert.match(rubric.message, /product to add next|routine add-on/i)
  assert.match(rubric.message, /current routine inventory|CareBalance/i)
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

test("safety boundary answer mode hint loads safety guidance in normal safety mode", () => {
  const ids = selectGuidancePackageIds({
    answer_mode_hint: "safety_boundary",
    categories: [],
    routine_layer: null,
    safety_mode: "normal",
  })

  assert.ok(ids.includes("base.safety_boundaries.v1"))
})

test("broad general advice loads for advice, product, and routine turns", () => {
  for (const answer_mode_hint of ["general_advice", "product_recommendation", "routine"] as const) {
    const ids = selectGuidancePackageIds({
      answer_mode_hint,
      categories: [],
      routine_layer: null,
      safety_mode: "normal",
    })

    assert.ok(
      ids.includes("base.general_advice.v1"),
      `${answer_mode_hint} should load base.general_advice.v1`,
    )
  }
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

test("shampoo cadence context guidance stays soft and category-specific", async () => {
  const result = await loadAgentV2GuidancePackages([
    "base.routine_building.v1",
    "category.shampoo.v1",
    "category.dry_shampoo.v1",
    "category.deep_cleansing_shampoo.v1",
  ])
  const brief = result.markdown_brief
  const shampooMetadata = JSON.parse(
    readFileSync("data/agent-v2/guidance/categories/shampoo.json", "utf8"),
  ) as {
    soft_rubrics: Array<{ rubric_id: string; message: string }>
  }

  assert.match(brief, /care_balance_context\.shampoo_cadence/i)
  assert.match(brief, /current rhythm versus target orientation/i)
  assert.match(brief, /target_preferred/i)
  assert.match(brief, /2-3 weeks/i)
  assert.match(brief, /within range, but at the low edge/i)
  assert.match(brief, /not automatically wrong if the scalp is calm/i)
  assert.match(brief, /caveat_codes/i)
  assert.match(brief, /modifier_down_stacked_fiber_fragility/i)
  assert.match(brief, /does not replace wet scalp cleansing/i)
  assert.match(brief, /do not turn every reset answer into a wash-frequency lecture/i)
  assert.ok(
    shampooMetadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "category.shampoo.cadence_context_delta",
    ),
  )
})

test("product guidance frames ranked products as tradeoff options", async () => {
  const result = await loadAgentV2GuidancePackages(["base.product_recommendation.v1"])
  const brief = result.markdown_brief

  assert.match(brief, /options with tradeoffs/i)
  assert.match(brief, /cleanest fit/i)
  assert.match(brief, /profile\/tool facts/i)
  assert.match(brief, /one natural fit sentence/i)
  assert.match(brief, /Do not show raw property bullets/i)
  assert.match(brief, /product_request_kind: specific_products/i)
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

test("tone guidance defines natural openings and feasible non-redundant CTAs", async () => {
  const result = await loadAgentV2GuidancePackages([
    "base.tone_and_format.v1",
    "base.general_advice.v1",
    "base.product_recommendation.v1",
  ])
  const brief = result.markdown_brief
  const toneMetadata = JSON.parse(
    readFileSync("data/agent-v2/guidance/base/tone-and-format.json", "utf8"),
  ) as {
    soft_rubrics: Array<{ rubric_id: string; message: string }>
  }

  assert.match(brief, /Natural Conversation Frame/i)
  assert.match(brief, /mirror the user's exact wording/i)
  assert.match(brief, /Do not start with bare `Ja -`, `Ja —`, `Ja,`/i)
  assert.match(brief, /unless the latest user message explicitly confirmed/i)
  assert.match(brief, /Goals.*problems.*deep_dive.*next_layer_options.*routine_layer/i)
  assert.match(brief, /useful, feasible, and non-redundant/i)
  assert.match(brief, /must not offer a product, property, action, photo, link, claim, protocol/i)
  assert.match(brief, /ingredient\/INCI-list check/i)
  assert.match(brief, /current tools cannot answer/i)
  assert.match(brief, /ask one material question/i)
  assert.match(brief, /offer a grounded next action/i)
  assert.match(brief, /bridge back to the routine/i)
  assert.match(brief, /repeat the answered decision/i)
  assert.ok(toneMetadata.soft_rubrics.some((rubric) => rubric.rubric_id === "tone.natural_opening"))
  assert.ok(
    toneMetadata.soft_rubrics.some((rubric) => /explicitly confirmed/i.test(rubric.message)),
  )
  assert.ok(toneMetadata.soft_rubrics.some((rubric) => rubric.rubric_id === "tone.feasible_cta"))
  assert.ok(
    toneMetadata.soft_rubrics.some((rubric) => rubric.rubric_id === "tone.non_redundant_ending"),
  )
})

test("product guidance phrases catalog metadata as practical implications", async () => {
  const result = await loadAgentV2GuidancePackages(["base.product_recommendation.v1"])
  const brief = result.markdown_brief
  const productMetadata = JSON.parse(
    readFileSync("data/agent-v2/guidance/base/product-recommendation.json", "utf8"),
  ) as {
    soft_rubrics: Array<{ rubric_id: string; message: string }>
  }

  assert.match(brief, /tied product metadata axes/i)
  assert.match(brief, /practical implications/i)
  assert.match(brief, /eingestuft.*klassifiziert.*im Katalog.*Claim hinterlegt/i)
  assert.match(brief, /current product metadata contract/i)
  assert.match(brief, /Do not offer to check photos, external links, reviews, ingredient lists/i)
  assert.ok(
    productMetadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "product.metadata_as_practical_implication",
    ),
  )
})

test("AgentV2 base guidance preserves profile grounding and calm structure guidance", () => {
  const tone = readFileSync("data/agent-v2/guidance/base/tone-and-format.md", "utf8")
  const routine = readFileSync("data/agent-v2/guidance/base/routine-building.md", "utf8")
  const product = readFileSync("data/agent-v2/guidance/base/product-recommendation.md", "utf8")

  assert.match(tone, /Do not invent a user preference/)
  assert.match(tone, /Avoid stacking many bold subheaders/)
  assert.match(routine, /profile facts/)
  assert.match(routine, /drying method/)
  assert.match(product, /wash rhythm/)
  assert.match(product, /usage cadence/)
})

test("Bondbuilder guidance preserves full old topic folder", () => {
  const markdown = readFileSync("data/agent-v2/guidance/categories/bondbuilder.md", "utf8")
  const metadata = JSON.parse(
    readFileSync("data/agent-v2/guidance/categories/bondbuilder.json", "utf8"),
  ) as {
    hard_rules: Array<{ rule_id: string; message: string; validator_id?: string }>
    soft_rubrics: Array<{ rubric_id: string; message: string }>
    required_grounding: Array<{ grounding_id: string; tool: string; when: string }>
    ask_when: Array<{ condition: string; question_policy: string }>
  }

  assert.match(markdown, /structural-repair treatments/i)
  assert.match(markdown, /bleach, highlights, oxidative color, perms, relaxers, keratin/i)
  assert.match(markdown, /mushy.*overly elastic when wet/i)
  assert.match(markdown, /in-service bond repair/i)
  assert.match(markdown, /partial and incremental/i)
  assert.match(markdown, /OLAPLEX\/Epres/i)
  assert.match(markdown, /K18/i)
  assert.match(markdown, /peptide-chain leave-in lane/i)
  assert.match(markdown, /OLAPLEX No\.0/i)
  assert.match(markdown, /No\.3PLUS/i)
  assert.match(markdown, /Epres.*easier spray route/i)
  assert.match(
    markdown,
    /Do not recommend, rank, compare, show cards for, or make product-specific claims/i,
  )
  assert.match(
    markdown,
    /category membership, lifecycle status, technology lane, and usage protocol/i,
  )
  assert.match(markdown, /Agent Interpretation Hooks/i)
  assert.match(markdown, /primary_intent: category_education/i)
  assert.match(markdown, /product_request_kind: specific_products/i)
  assert.match(markdown, /product_request_kind: compare_products/i)
  assert.match(markdown, /do_not_show_unasked_product_cards: true/i)
  assert.match(markdown, /primary_intent: safety_boundary/i)
  assert.match(markdown, /two-lane phase/i)
  assert.match(markdown, /must not recommend layering multiple bondbuilders by default/i)
  assert.match(markdown, /When catalog metadata supports it/i)
  assert.match(markdown, /Do not infer a product's lane from brand name alone/i)
  assert.match(markdown, /product-specific usage protocol/i)
  assert.match(markdown, /do not replace conditioner/i)
  assert.match(markdown, /mechanism-plausible/i)
  assert.match(markdown, /limited independent peer-reviewed/i)
  assert.match(markdown, /at-home stretch test/i)
  assert.match(markdown, /deep-cleanse before every bondbuilder use/i)
  assert.match(markdown, /## Do Not/i)
  assert.match(markdown, /targeted structural-repair treatments/i)
  assert.match(
    markdown,
    /route those cases toward moisture, conditioning, frizz control, or routine-balancing guidance/i,
  )
  assert.match(markdown, /stronger, more resilient lengths and reduced breakage/i)
  assert.match(markdown, /require curated product\/category metadata for each specific product/i)
  assert.match(markdown, /use product-specific usage protocol metadata/i)
  assert.match(markdown, /scalp pain|patchy hair loss|unusual shedding/i)
  assert.match(markdown, /generic .*bond/i)
  assert.match(markdown, /shampoo/i)
  assert.match(markdown, /conditioner/i)
  assert.match(markdown, /chelating|chelation|detox/i)
  assert.match(markdown, /acidic|low-PH|low-pH|low pH/i)
  assert.match(markdown, /not automatically true Bondbuilders/i)
  assert.match(markdown, /true Bondbuilder treatments versus look-alike repair marketing/i)
  assert.match(markdown, /rinse-out or pre-shampoo bond-repair treatments/i)
  assert.match(markdown, /leave-in structural care/i)
  assert.match(markdown, /system-specific exceptions/i)
  assert.match(markdown, /not as a standard third consumer type/i)
  assert.ok(
    metadata.hard_rules.some(
      (rule) => rule.rule_id === "category.bondbuilder.no_generic_bond_labels",
    ),
  )
  assert.ok(
    metadata.hard_rules.some(
      (rule) => rule.rule_id === "category.bondbuilder.no_brand_line_generalization",
    ),
  )
  assert.ok(
    metadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "category.bondbuilder.lookalike_clarity",
    ),
  )
  assert.ok(
    metadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "category.bondbuilder.no_standard_booster_type",
    ),
  )
  assert.ok(
    metadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "category.bondbuilder.lane_decision_clarity",
    ),
  )
  assert.ok(
    metadata.hard_rules.some(
      (rule) => rule.rule_id === "category.bondbuilder.no_unrealistic_repair_claims",
    ),
  )
  assert.ok(
    metadata.required_grounding.some(
      (grounding) =>
        grounding.grounding_id === "category.bondbuilder.product_and_protocol_claims" &&
        grounding.tool === "select_products",
    ),
  )
  assert.ok(metadata.ask_when.some((entry) => /chemical service/.test(entry.condition)))
  assert.equal(
    metadata.hard_rules.some((rule) => rule.validator_id === "category_claim_boundary"),
    false,
  )
})

test("Deep cleansing guidance preserves reset lanes and conservative boundaries", () => {
  const markdown = readFileSync(
    "data/agent-v2/guidance/categories/deep-cleansing-shampoo.md",
    "utf8",
  )
  const metadata = JSON.parse(
    readFileSync("data/agent-v2/guidance/categories/deep-cleansing-shampoo.json", "utf8"),
  ) as {
    hard_rules: Array<{ rule_id: string; message: string; validator_id?: string }>
    soft_rubrics: Array<{ rubric_id: string; message: string }>
  }

  assert.match(markdown, /clarifying/i)
  assert.match(markdown, /chelating/i)
  assert.match(markdown, /scalp exfoliation/i)
  assert.match(markdown, /hard-water|pool|metal/i)
  assert.match(markdown, /co-washing|CWC|OWC|oiling/i)
  assert.match(markdown, /daily cleansing|baseline shampoo replacement/i)
  assert.match(markdown, /structural repair|hair-loss|color fade/i)
  assert.match(markdown, /Rückstands-Reset/)
  assert.ok(
    metadata.hard_rules.some(
      (rule) => rule.rule_id === "category.deep_cleansing.keep_reset_lanes_separate",
    ),
  )
  assert.ok(
    metadata.hard_rules.some(
      (rule) => rule.rule_id === "category.deep_cleansing.no_medical_or_repair_claims",
    ),
  )
  assert.ok(
    metadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "category.deep_cleansing.variant_fit",
    ),
  )
  assert.equal(
    metadata.hard_rules.some((rule) => rule.validator_id === "category_claim_boundary"),
    false,
  )
})

test("Dry shampoo guidance preserves bridge role and scalp-boundary context", () => {
  const markdown = readFileSync("data/agent-v2/guidance/categories/dry-shampoo.md", "utf8")
  const metadata = JSON.parse(
    readFileSync("data/agent-v2/guidance/categories/dry-shampoo.json", "utf8"),
  ) as {
    hard_rules: Array<{ rule_id: string; message: string; validator_id?: string }>
    soft_rubrics: Array<{ rubric_id: string; message: string }>
  }

  assert.match(markdown, /temporary cosmetic freshness bridge/i)
  assert.match(markdown, /does not clean the scalp/i)
  assert.match(markdown, /oily roots/i)
  assert.match(markdown, /post-workout|schedule-constrained/i)
  assert.match(markdown, /itchy, burning, inflamed, painful/i)
  assert.match(markdown, /heavy buildup|residue|scalp congestion/i)
  assert.match(markdown, /brief bridge|short-term freshness|repeated layering/i)
  assert.match(markdown, /Frische-Bridge/)
  assert.ok(
    metadata.hard_rules.some(
      (rule) => rule.rule_id === "category.dry_shampoo.no_scalp_treatment_claims",
    ),
  )
  assert.ok(
    metadata.hard_rules.some(
      (rule) => rule.rule_id === "category.dry_shampoo.no_indefinite_layering",
    ),
  )
  assert.ok(
    metadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "category.dry_shampoo.scalp_comfort_gate",
    ),
  )
  assert.equal(
    metadata.hard_rules.some((rule) => rule.validator_id === "category_claim_boundary"),
    false,
  )
})

test("core wash care category guidance preserves old fit boundaries", () => {
  const shampoo = readFileSync("data/agent-v2/guidance/categories/shampoo.md", "utf8")
  const shampooMetadata = JSON.parse(
    readFileSync("data/agent-v2/guidance/categories/shampoo.json", "utf8"),
  ) as {
    hard_rules: Array<{ rule_id: string; message: string; validator_id?: string }>
    soft_rubrics: Array<{ rubric_id: string; message: string }>
  }
  const conditioner = readFileSync("data/agent-v2/guidance/categories/conditioner.md", "utf8")
  const conditionerMetadata = JSON.parse(
    readFileSync("data/agent-v2/guidance/categories/conditioner.json", "utf8"),
  ) as {
    hard_rules: Array<{ rule_id: string; message: string; validator_id?: string }>
    soft_rubrics: Array<{ rubric_id: string; message: string }>
  }
  const leaveIn = readFileSync("data/agent-v2/guidance/categories/leave-in.md", "utf8")
  const leaveInMetadata = JSON.parse(
    readFileSync("data/agent-v2/guidance/categories/leave-in.json", "utf8"),
  ) as {
    hard_rules: Array<{ rule_id: string; message: string; validator_id?: string }>
    soft_rubrics: Array<{ rubric_id: string; message: string }>
  }

  assert.match(shampoo, /scalp and root cleansing/i)
  assert.match(shampoo, /rinse-down/i)
  assert.match(shampoo, /dry lengths, frizz, shine/i)
  assert.match(shampoo, /Wash less.*not a universal goal/i)
  assert.ok(
    shampooMetadata.hard_rules.some(
      (rule) => rule.rule_id === "category.shampoo.no_medical_scalp_promises",
    ),
  )
  assert.ok(
    shampooMetadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "category.shampoo.length_goal_steering",
    ),
  )

  assert.match(conditioner, /rinse-out baseline and length-care anchor/i)
  assert.match(conditioner, /lengths and ends, not scalp/i)
  assert.match(conditioner, /permanently repair split ends/i)
  assert.match(conditioner, /Leave-in is a booster or simplification candidate/i)
  assert.match(conditioner, /hair thickness.*protein\/moisture balance/i)
  assert.match(conditioner, /light-to-medium support/i)
  assert.match(conditioner, /do not skip conditioner automatically/i)
  assert.match(conditioner, /dry lengths are not automatically dry scalp/i)
  assert.match(conditioner, /conditioner can provide slip for detangling/i)
  assert.match(conditioner, /CWC\/OWC/i)
  assert.match(conditioner, /CWC heißt Conditioner-Shampoo-Conditioner/i)
  assert.match(conditioner, /conditioner before shampoo/i)
  assert.match(conditioner, /OWC is the heavier oil-wash-conditioner route/i)
  assert.match(conditioner, /Balanced category comparisons/i)
  assert.match(conditioner, /care_category: none/i)
  assert.ok(
    conditionerMetadata.hard_rules.some(
      (rule) => rule.rule_id === "category.conditioner.no_scalp_treatment",
    ),
  )
  assert.ok(
    conditionerMetadata.hard_rules.some(
      (rule) => rule.rule_id === "category.conditioner.no_ungrounded_balance_claims",
    ),
  )
  assert.ok(
    conditionerMetadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "category.conditioner.baseline_before_boosters",
    ),
  )
  assert.ok(
    conditionerMetadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "category.conditioner.cwc_owc_length_protection",
    ),
  )
  assert.ok(
    conditionerMetadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "category.conditioner.owc_weight_caution",
    ),
  )

  assert.match(leaveIn, /leave-on booster/i)
  assert.match(leaveIn, /not a mandatory third step/i)
  assert.match(leaveIn, /Heat-protection consolidation/i)
  assert.match(leaveIn, /replacing conditioner only when selected product data/i)
  assert.match(leaveIn, /Routine beim Lufttrocknen/i)
  assert.ok(
    leaveInMetadata.hard_rules.some(
      (rule) => rule.rule_id === "category.leave_in.no_unsupported_heat_protection",
    ),
  )
  assert.ok(
    leaveInMetadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "category.leave_in.simplification_clarity",
    ),
  )
})

test("wash length category guidance encodes product detail and routine boundaries", () => {
  const shampoo = readFileSync("data/agent-v2/guidance/categories/shampoo.md", "utf8")
  const conditioner = readFileSync("data/agent-v2/guidance/categories/conditioner.md", "utf8")
  const leaveIn = readFileSync("data/agent-v2/guidance/categories/leave-in.md", "utf8")
  const mask = readFileSync("data/agent-v2/guidance/categories/mask.md", "utf8")

  for (const [label, markdown] of [
    ["shampoo", shampoo],
    ["conditioner", conditioner],
    ["leave-in", leaveIn],
    ["mask", mask],
  ] as const) {
    assert.match(markdown, /product_request_kind: product_detail/i, label)
    assert.match(markdown, /primary_intent: routine_explanation/i, label)
    assert.match(markdown, /primary_intent: routine_mutation/i, label)
    assert.match(markdown, /care_category: none/i, label)
    assert.match(markdown, /current routine context|routine tooling|current routine state/i, label)
  }

  assert.match(shampoo, /Everyday Residue vs Reset Boundary/i)
  assert.match(shampoo, /stubborn buildup|waxy\/coated|hard-water|nothing gets.*clean/i)
  assert.match(shampoo, /Scalp Symptom Threshold/i)

  assert.match(conditioner, /Welche Art von Spülung/i)
  assert.match(conditioner, /Welche Spülung passt/i)
  assert.match(conditioner, /raw CWC\/OWC|CWC\/OWC acronyms/i)

  assert.match(leaveIn, /Heat Protection Boundary/i)
  assert.match(leaveIn, /main goal is heat protection/i)
  assert.match(leaveIn, /fragrance|fragrance-free/i)

  assert.match(mask, /Structural Repair And Bondbuilder Boundary/i)
  assert.match(mask, /Exact timing and cadence require product metadata/i)
  assert.match(mask, /Do not ask about protein\/moisture direction by default/i)
})

test("Mask guidance preserves old length-care and cadence boundaries", () => {
  const markdown = readFileSync("data/agent-v2/guidance/categories/mask.md", "utf8")
  const metadata = JSON.parse(
    readFileSync("data/agent-v2/guidance/categories/mask.json", "utf8"),
  ) as {
    hard_rules: Array<{ rule_id: string; message: string }>
    soft_rubrics: Array<{ rubric_id: string; message: string }>
    required_grounding: Array<{ grounding_id: string; tool: string; when: string }>
  }

  assert.match(markdown, /periodic extra care/i)
  assert.match(markdown, /lengths and ends/i)
  assert.match(markdown, /conditioner is usually the everyday/i)
  assert.match(markdown, /protein\/moisture/i)
  assert.match(markdown, /gelegentlich|alle paar Wäschen|bei Bedarf|flexible starting point/i)
  assert.match(markdown, /permanently repair split ends|permanent split-end repair/i)
  assert.ok(
    metadata.hard_rules.some(
      (rule) => rule.rule_id === "category.mask.no_scalp_or_repair_overclaim",
    ),
  )
  assert.ok(
    metadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "category.mask.cadence_and_placement",
    ),
  )
  assert.ok(
    metadata.required_grounding.some(
      (grounding) =>
        grounding.grounding_id === "category.mask.product_claims" &&
        grounding.tool === "select_products",
    ),
  )
})

test("Oil guidance preserves role separation and scalp/growth guardrails", () => {
  const markdown = readFileSync("data/agent-v2/guidance/categories/oil.md", "utf8")
  const metadata = JSON.parse(
    readFileSync("data/agent-v2/guidance/categories/oil.json", "utf8"),
  ) as {
    hard_rules: Array<{ rule_id: string; message: string }>
    soft_rubrics: Array<{ rubric_id: string; message: string }>
    ask_when: Array<{ condition: string; question_policy: string }>
  }

  assert.match(markdown, /finish\/tips/i)
  assert.match(markdown, /pre-wash length protection/i)
  assert.match(markdown, /Silicone finishing serums/i)
  assert.match(markdown, /not pre-wash oiling/i)
  assert.match(markdown, /emulsify shampoo into the oil/i)
  assert.match(markdown, /finish versus pre-wash education/i)
  assert.match(markdown, /shine, surface frizz, smoother tips/i)
  assert.match(markdown, /not scalp oiling by default/i)
  assert.match(markdown, /Do not promise regrowth/i)
  assert.ok(
    metadata.hard_rules.some((rule) => rule.rule_id === "category.oil.no_growth_or_repair_claims"),
  )
  assert.ok(
    metadata.hard_rules.some((rule) => rule.rule_id === "category.oil.keep_product_types_separate"),
  )
  assert.ok(
    metadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "category.oil.weight_and_buildup_caution",
    ),
  )
  assert.ok(
    metadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "category.oil.finish_vs_prewash_goal_anchor",
    ),
  )
  assert.ok(metadata.ask_when.some((entry) => /finish, pre-wash/.test(entry.condition)))
})

test("finish repair category guidance uses supported hook values and grounding boundaries", () => {
  const categories = [
    {
      label: "oil",
      markdownPath: "data/agent-v2/guidance/categories/oil.md",
      metadataPath: "data/agent-v2/guidance/categories/oil.json",
      category: "oil",
      detailGrounding: "category.oil.product_detail_claims",
      routineGrounding: "category.oil.routine_mutation",
    },
    {
      label: "bondbuilder",
      markdownPath: "data/agent-v2/guidance/categories/bondbuilder.md",
      metadataPath: "data/agent-v2/guidance/categories/bondbuilder.json",
      category: "bondbuilder",
      detailGrounding: "category.bondbuilder.product_detail_claims",
      routineGrounding: "category.bondbuilder.routine_mutation",
    },
  ] as const
  const unsupportedHookTerms = [
    "category_assessment",
    "category_comparison",
    "product_comparison",
    "routine_guidance",
    "routine_intent: add_step",
    "routine_intent: replace_step",
    "routine_intent: change_step",
    "suspected_trigger_category",
  ]

  for (const entry of categories) {
    const markdown = readFileSync(entry.markdownPath, "utf8")
    const metadata = JSON.parse(readFileSync(entry.metadataPath, "utf8")) as {
      hard_rules: Array<{ rule_id: string; message: string }>
      required_grounding: Array<{ grounding_id: string; tool: string; when: string }>
      ask_when: Array<{ condition: string; question_policy: string }>
    }

    for (const term of unsupportedHookTerms) {
      assert.doesNotMatch(markdown, new RegExp(term, "i"), `${entry.label}: ${term}`)
    }

    assert.match(markdown, /product_request_kind: product_detail/i, entry.label)
    assert.match(markdown, /primary_intent: routine_explanation/i, entry.label)
    assert.match(markdown, /routine_intent: none/i, entry.label)
    assert.match(markdown, /primary_intent: routine_mutation/i, entry.label)
    assert.match(markdown, /routine_intent: modify, remove_step, or replace_product/i, entry.label)
    assert.match(markdown, /care_category: none/i, entry.label)
    assert.match(markdown, new RegExp(`care_category: ${entry.category}`, "i"), entry.label)
    assert.match(markdown, /do_not_show_unasked_product_cards: true/i, entry.label)

    assert.ok(
      metadata.hard_rules.some((rule) => /product_detail/.test(rule.rule_id)),
      `${entry.label}: product detail hard rule`,
    )
    assert.ok(
      metadata.hard_rules.some((rule) => /routine/.test(rule.rule_id)),
      `${entry.label}: routine hard rule`,
    )
    assert.ok(
      metadata.required_grounding.some(
        (grounding) => grounding.grounding_id === entry.detailGrounding,
      ),
      `${entry.label}: product detail grounding`,
    )
    assert.ok(
      metadata.required_grounding.some(
        (grounding) => grounding.grounding_id === entry.routineGrounding,
      ),
      `${entry.label}: routine mutation grounding`,
    )
    assert.ok(
      metadata.ask_when.some((policy) => /product_detail/.test(policy.condition)),
      `${entry.label}: product detail ask policy`,
    )
  }
})

test("Peeling guidance preserves buildup versus symptom routing", () => {
  const markdown = readFileSync("data/agent-v2/guidance/categories/peeling.md", "utf8")
  const metadata = JSON.parse(
    readFileSync("data/agent-v2/guidance/categories/peeling.json", "utf8"),
  ) as {
    hard_rules: Array<{ rule_id: string; message: string }>
    soft_rubrics: Array<{ rubric_id: string; message: string }>
    ask_when: Array<{ condition: string; question_policy: string }>
  }

  assert.match(markdown, /tolerant scalp/i)
  assert.match(markdown, /oily roots/i)
  assert.match(markdown, /persistent flakes/i)
  assert.match(markdown, /not cosmetic peeling problems/i)
  assert.match(markdown, /Deep-cleansing shampoo may be a better reset/i)
  assert.match(markdown, /burning, soreness, redness, or irritation|bei Brennen stoppen/i)
  assert.ok(
    metadata.hard_rules.some((rule) => rule.rule_id === "category.peeling.no_treatment_claims"),
  )
  assert.ok(
    metadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "category.peeling.buildup_vs_symptom",
    ),
  )
  assert.ok(metadata.ask_when.some((entry) => /Irritation, pain/.test(entry.condition)))
})

test("reset scalp category guidance uses supported hook values and grounding boundaries", () => {
  const categories = [
    {
      label: "deep cleansing",
      markdownPath: "data/agent-v2/guidance/categories/deep-cleansing-shampoo.md",
      metadataPath: "data/agent-v2/guidance/categories/deep-cleansing-shampoo.json",
      category: "deep_cleansing_shampoo",
      detailGrounding: "category.deep_cleansing.product_detail_claims",
      routineGrounding: "category.deep_cleansing.routine_mutation",
    },
    {
      label: "dry shampoo",
      markdownPath: "data/agent-v2/guidance/categories/dry-shampoo.md",
      metadataPath: "data/agent-v2/guidance/categories/dry-shampoo.json",
      category: "dry_shampoo",
      detailGrounding: "category.dry_shampoo.product_detail_claims",
      routineGrounding: "category.dry_shampoo.routine_mutation",
    },
    {
      label: "peeling",
      markdownPath: "data/agent-v2/guidance/categories/peeling.md",
      metadataPath: "data/agent-v2/guidance/categories/peeling.json",
      category: "peeling",
      detailGrounding: "category.peeling.product_detail_claims",
      routineGrounding: "category.peeling.routine_mutation",
    },
  ] as const
  const unsupportedHookTerms = [
    "category_assessment",
    "category_comparison",
    "product_comparison",
    "routine_guidance",
    "routine_intent: add_step",
    "routine_intent: replace_step",
    "routine_intent: change_step",
    "suspected_trigger_category",
  ]

  for (const entry of categories) {
    const markdown = readFileSync(entry.markdownPath, "utf8")
    const metadata = JSON.parse(readFileSync(entry.metadataPath, "utf8")) as {
      hard_rules: Array<{ rule_id: string; message: string }>
      soft_rubrics: Array<{ rubric_id: string; message: string }>
      required_grounding: Array<{ grounding_id: string; tool: string; when: string }>
      ask_when: Array<{ condition: string; question_policy: string }>
    }

    for (const term of unsupportedHookTerms) {
      assert.doesNotMatch(markdown, new RegExp(term, "i"), `${entry.label}: ${term}`)
    }

    assert.match(markdown, /product_request_kind: product_detail/i, entry.label)
    assert.match(markdown, /primary_intent: routine_explanation/i, entry.label)
    assert.match(markdown, /routine_intent: none/i, entry.label)
    assert.match(markdown, /primary_intent: routine_mutation/i, entry.label)
    assert.match(markdown, /routine_intent: modify, remove_step, or replace_product/i, entry.label)
    assert.match(markdown, /care_category: none/i, entry.label)
    assert.match(markdown, new RegExp(`care_category: ${entry.category}`, "i"), entry.label)
    assert.match(markdown, /do_not_show_unasked_product_cards: true/i, entry.label)
    assert.match(
      markdown,
      /do not infer from product name, brand line, marketing family, or category guidance alone/i,
      entry.label,
    )

    assert.ok(
      metadata.hard_rules.some((rule) => /product_detail/.test(rule.rule_id)),
      `${entry.label}: product detail hard rule`,
    )
    assert.ok(
      metadata.hard_rules.some((rule) => /routine/.test(rule.rule_id)),
      `${entry.label}: routine hard rule`,
    )
    assert.ok(
      metadata.required_grounding.some(
        (grounding) => grounding.grounding_id === entry.detailGrounding,
      ),
      `${entry.label}: product detail grounding`,
    )
    assert.ok(
      metadata.required_grounding.some(
        (grounding) => grounding.grounding_id === entry.routineGrounding,
      ),
      `${entry.label}: routine mutation grounding`,
    )
    assert.ok(
      metadata.ask_when.some((policy) => /product_detail/.test(policy.condition)),
      `${entry.label}: product detail ask policy`,
    )
    assert.ok(
      metadata.soft_rubrics.some((rubric) => /type_vs_product/.test(rubric.rubric_id)),
      `${entry.label}: type-vs-product rubric`,
    )
  }
})

test("routine guidance routes concrete product asks through product recommendations with routine context", async () => {
  const result = await loadAgentV2GuidancePackages(["base.routine_building.v1"])
  const brief = result.markdown_brief

  assert.match(brief, /concrete product ask inside an active routine/i)
  assert.match(brief, /product_request_kind: specific_products/i)
  assert.match(brief, /routine_context\.active: true/i)
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

test("product guidance preserves old claim boundaries and comparison fallback rules", async () => {
  const result = await loadAgentV2GuidancePackages(["base.product_recommendation.v1"])
  const brief = result.markdown_brief
  const metadata = JSON.parse(
    readFileSync("data/agent-v2/guidance/base/product-recommendation.json", "utf8"),
  ) as {
    hard_rules: Array<{ rule_id: string; validator_id: string; message: string }>
    soft_rubrics: Array<{ rubric_id: string; message: string }>
  }

  assert.match(brief, /Product names are names only/i)
  assert.match(brief, /Named-product detail checks are product-grounded turns/i)
  assert.match(brief, /Start with `lookup_product_candidate`/i)
  assert.match(brief, /not necessarily visible recommendation-card turns/i)
  assert.match(
    brief,
    /use `answer_mode: product_assessment` when the answer assesses named resolved products/i,
  )
  assert.match(brief, /may reuse `select_products` or product projection data internally/i)
  assert.doesNotMatch(brief, /call `select_products` before the terminal answer/i)
  assert.match(brief, /product_request_kind: product_detail/i)
  assert.match(brief, /request_interpretation still uses `product_detail` or `compare_products`/i)
  assert.match(brief, /unsupported_requested_signals/i)
  assert.match(brief, /comparison_facts/i)
  assert.match(brief, /caveated fallback/i)
  assert.match(brief, /not_recommended.*no_catalog_match/i)
  assert.match(brief, /effectively equivalent/i)
  assert.match(brief, /named_product_context/i)
  assert.match(brief, /do not ask for the exact name again/i)
  assert.match(brief, /do not substitute unrelated catalog recommendations/i)
  assert.ok(
    metadata.hard_rules.some(
      (rule) =>
        rule.rule_id === "product.named_detail_requires_verified_identity" &&
        rule.validator_id === "product_assessment_grounding",
    ),
  )
  assert.ok(
    metadata.soft_rubrics.some((rubric) => rubric.rubric_id === "product.no_claims_from_names"),
  )
  assert.ok(
    metadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "product.compare_with_supported_facts",
    ),
  )
  assert.ok(
    metadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "product.detail_check_after_lookup",
    ),
  )
})

test("named-product assessment guidance does not force visible recommendation cards", async () => {
  const result = await loadAgentV2GuidancePackages([
    "base.answer_contract.v1",
    "base.product_recommendation.v1",
    "category.shampoo.v1",
  ])
  const brief = result.markdown_brief
  const answerContract = JSON.parse(
    readFileSync("data/agent-v2/guidance/base/answer-contract.json", "utf8"),
  ) as {
    scope: { answer_modes: string[] }
    soft_rubrics: Array<{ rubric_id: string; message: string }>
  }

  assert.match(brief, /Named-Product Assessment/i)
  assert.match(brief, /lookup_product_candidate/i)
  assert.match(brief, /answer_mode: product_assessment/i)
  assert.match(brief, /assessment_kind/i)
  assert.match(brief, /assessed_product_ids/i)
  assert.match(brief, /Do not use product-recommendation payload fields in `product_assessment`/i)
  assert.match(brief, /visible recommendation cards require/i)
  assert.match(brief, /explicit request for product recommendations/i)
  assert.doesNotMatch(brief, /named-product detail checks.*answer_mode: product_recommendation/i)
  assert.ok(answerContract.scope.answer_modes.includes("product_assessment"))
  assert.ok(
    answerContract.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "answer.product_assessment_payload_shape",
    ),
  )
})

test("compiled product-detail guidance uses user-facing unsupported-claim fallbacks", async () => {
  const result = await loadAgentV2GuidancePackages([
    "base.product_recommendation.v1",
    "category.deep_cleansing_shampoo.v1",
    "category.dry_shampoo.v1",
    "category.oil.v1",
  ])
  const brief = result.markdown_brief

  assert.match(
    brief,
    /Never expose raw\/internal phrases such as `Im Katalog ist kein Claim hinterlegt`/i,
  )
  assert.match(brief, /translate missing metadata into user-facing language/i)
  assert.match(brief, /Das kann ich für diese Variante nicht sicher versprechen/i)
  assert.match(brief, /Sicher berücksichtigen kann ich aktuell/i)
  assert.match(brief, /ask for the exact variant only if the user has not already provided/i)
  assert.match(brief, /do not invite photo or link checks/i)
  assert.match(brief, /current tooling can actually process and ground them/i)
  assert.match(brief, /only confirmed color, format, or product facts/i)
  assert.match(brief, /plain oil is not heat protection/i)
  assert.match(brief, /recommend a real heat protectant before heat/i)
  assert.match(brief, /chelating and color-safe claims need product metadata/i)
})

test("reset peeling oil and dry shampoo guidance preserves evidence boundaries", async () => {
  const result = await loadAgentV2GuidancePackages([
    "base.general_advice.v1",
    "category.deep_cleansing_shampoo.v1",
    "category.peeling.v1",
    "category.oil.v1",
    "category.dry_shampoo.v1",
  ])
  const brief = result.markdown_brief

  assert.match(brief, /product\/mineral film through (the )?lengths/i)
  assert.match(brief, /hard-water feel/i)
  assert.match(brief, /reset\/clarifying\/chelating shampoo/i)
  assert.match(brief, /scalp-local residue|scalp-only residue/i)
  assert.match(brief, /gentle occasional scalp peeling/i)
  assert.match(brief, /persistent itch, redness, burning, pain, repeated flakes, or shedding/i)
  assert.match(brief, /safety boundary, not stronger peeling/i)
  assert.match(brief, /deep-cleansing shampoo is not conceptually scalp-only/i)
  assert.match(brief, /plain oil is not a heat protectant without product-specific support/i)
  assert.match(brief, /product with explicit heat-protectant claim before heat/i)
  assert.match(brief, /oil can be used sparingly after styling/i)
  assert.match(brief, /pre-wash length protection/i)
  assert.match(brief, /absorbs oil between washes/i)
  assert.match(brief, /does not replace cleansing/i)
  assert.match(brief, /bridge or sign to adjust wash rhythm\/root routine/i)
})

test("guidance migration regression criteria cover task 6 factual boundaries", () => {
  const regression = JSON.parse(
    readFileSync("data/agent-v2/evals/guidance-migration-regression.json", "utf8"),
  ) as {
    cases: Array<{ id: string; quality_criteria: string[] }>
  }
  const criteriaFor = (id: string) =>
    regression.cases.find((entry) => entry.id === id)?.quality_criteria.join("\n") ?? ""

  assert.match(criteriaFor("deep-cleansing-vs-peeling-comparison"), /length.*reset/i)
  assert.match(criteriaFor("deep-cleansing-vs-peeling-comparison"), /scalp.*peeling/i)
  assert.match(
    criteriaFor("deep-cleansing-vs-peeling-comparison"),
    /safety.*not.*stronger peeling/i,
  )
  assert.match(criteriaFor("peeling-type-vs-product"), /type\/kind education/i)
  assert.match(criteriaFor("peeling-type-vs-product"), /tolerant scalp/i)
  assert.match(criteriaFor("peeling-type-vs-product"), /persistent.*safety/i)
  assert.match(criteriaFor("dry-shampoo-bridge"), /absorbs oil between washes/i)
  assert.match(criteriaFor("dry-shampoo-bridge"), /does not replace cleansing/i)
  assert.match(criteriaFor("dry-shampoo-bridge"), /adjust wash rhythm\/root routine/i)
  assert.match(criteriaFor("oil-product-detail-heat-claim"), /plain oil is not a heat protectant/i)
  assert.match(
    criteriaFor("oil-product-detail-heat-claim"),
    /explicit heat-protectant claim before heat/i,
  )
  assert.match(criteriaFor("oil-product-detail-heat-claim"), /sparingly after styling/i)
})

test("guidance migration regression criteria cover task 9 manual copy notes", () => {
  const regression = JSON.parse(
    readFileSync("data/agent-v2/evals/guidance-migration-regression.json", "utf8"),
  ) as {
    cases: Array<{ id: string; quality_criteria: string[]; must_not_contain?: string[] }>
  }
  const caseById = (id: string) => {
    const found = regression.cases.find((entry) => entry.id === id)
    assert.ok(found, `Missing regression case ${id}`)
    return found
  }
  const criteriaFor = (id: string) => caseById(id).quality_criteria.join("\n")
  const disallowedFor = (id: string) => caseById(id).must_not_contain?.join("\n") ?? ""

  assert.match(
    criteriaFor("conditioner-cwc-owc-length-protection"),
    /Conditioner-Shampoo-Conditioner/i,
  )
  assert.match(criteriaFor("conditioner-cwc-owc-length-protection"), /protects lengths/i)
  assert.match(
    criteriaFor("bondbuilder-types-no-hallucinated-product-forms"),
    /lookalike repair marketing/i,
  )
  assert.match(
    criteriaFor("bondbuilder-types-no-hallucinated-product-forms"),
    /normal consumer-facing third type/i,
  )
  assert.match(
    disallowedFor("bondbuilder-types-no-hallucinated-product-forms"),
    /Booster \/ Service-Pflege/i,
  )
  assert.match(
    criteriaFor("oil-education-finish-vs-prewash"),
    /shine, surface frizz, or smoother tips/i,
  )
  assert.match(
    criteriaFor("oil-education-finish-vs-prewash"),
    /not route to scalp oiling by default/i,
  )
  assert.match(criteriaFor("frizz-color-damage-routine"), /structural repair or bondbuilder/i)
  assert.match(disallowedFor("frizz-color-damage-routine"), /starkes Schnappen/i)
  assert.match(disallowedFor("frizz-color-damage-routine"), /Air-Dry-Routine/i)
  assert.match(disallowedFor("frizz-color-damage-routine"), /Actives stapeln/i)
})

test("general advice preserves usage, troubleshooting, and CWC/OWC context", async () => {
  const result = await loadAgentV2GuidancePackages(["base.general_advice.v1"])
  const brief = result.markdown_brief
  const metadata = JSON.parse(
    readFileSync("data/agent-v2/guidance/base/general-advice.json", "utf8"),
  ) as {
    soft_rubrics: Array<{ rubric_id: string; message: string }>
  }

  assert.match(brief, /Concern Logic/i)
  assert.match(brief, /Goal Logic/i)
  assert.match(brief, /dryness, frizz, tangling, breakage, oily roots, buildup/i)
  assert.match(brief, /shine, softness, definition, volume, lower maintenance/i)
  assert.match(brief, /Usage And Application/i)
  assert.match(brief, /steps before shopping/i)
  assert.match(brief, /scalp\/roots from lengths\/ends/i)
  assert.match(brief, /optional second wash/i)
  assert.match(brief, /keep the wording flexible/i)
  assert.match(brief, /alle paar Wäschen/i)
  assert.match(brief, /Exact timing, product order, and protocol still require product metadata/i)
  assert.match(brief, /Troubleshooting Before Shopping/i)
  assert.match(brief, /root care from length care/i)
  assert.match(brief, /CWC and OWC are wash techniques/i)
  assert.match(brief, /CWC heißt Conditioner-Shampoo-Conditioner/i)
  assert.match(brief, /OWC is the heavier oil-wash-conditioner route/i)
  assert.match(brief, /German Copy Fit/i)
  assert.match(brief, /starkes Brechen/i)
  assert.match(brief, /Routine beim Lufttrocknen/i)
  assert.match(brief, /nicht zu viele starke Kopfhaut-Wirkstoffe kombinieren/i)
  assert.match(brief, /color-treated, dry, frizzy routine-change questions/i)
  assert.match(brief, /both still include a real shampoo step/i)
  assert.match(brief, /Detangling And Texture Handling/i)
  assert.match(brief, /conditioner or leave-in slip/i)
  assert.match(brief, /work in sections/i)
  assert.match(brief, /start at the ends/i)
  assert.ok(metadata.soft_rubrics.some((rubric) => rubric.rubric_id === "advice.usage_first"))
  assert.ok(
    metadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "advice.troubleshoot_before_products",
    ),
  )
  assert.ok(
    metadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "advice.detangling_texture_handling",
    ),
  )
  assert.ok(metadata.soft_rubrics.some((rubric) => rubric.rubric_id === "advice.german_copy_fit"))
  assert.ok(
    metadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "advice.color_treated_dry_frizzy_structural_check",
    ),
  )
})

test("routine guidance preserves lean assembly and life-fit rules", async () => {
  const result = await loadAgentV2GuidancePackages(["base.routine_building.v1"])
  const brief = result.markdown_brief
  const metadata = JSON.parse(
    readFileSync("data/agent-v2/guidance/base/routine-building.json", "utf8"),
  ) as {
    hard_rules: Array<{ rule_id: string; message: string }>
    soft_rubrics: Array<{ rubric_id: string; message: string }>
    required_grounding: Array<{ grounding_id: string; tool: string; when: string }>
  }

  assert.match(brief, /scalp state drives the wash step/i)
  assert.match(brief, /fibre state drives conditioner, mask, and leave-in/i)
  assert.match(brief, /thickness drives product count and product weight/i)
  assert.match(brief, /fewest steps needed/i)
  assert.match(brief, /change one product at a time/i)
  assert.match(brief, /real life, not the ideal version/i)
  assert.match(brief, /Routine Tool Threshold/i)
  assert.match(brief, /Routine einfacher machen/i)
  assert.match(brief, /what to do next/i)
  assert.match(brief, /pure placement, order, usage/i)
  assert.match(brief, /rebalance, or make a routine lighter\/easier/i)
  assert.match(brief, /füge \.\.\. ein/i)
  assert.match(brief, /do not hand-roll a multi-step routine/i)
  assert.match(brief, /Broad education remains general advice/i)
  assert.ok(
    metadata.hard_rules.some((rule) => rule.rule_id === "routine.change_requests_require_tool"),
  )
  assert.ok(
    metadata.soft_rubrics.some((rubric) => rubric.rubric_id === "routine.lean_life_fit_assembly"),
  )
  assert.ok(
    metadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "routine.threshold_change_vs_explain",
    ),
  )
  assert.ok(
    metadata.required_grounding.some(
      (grounding) =>
        grounding.grounding_id === "routine.change_requests_build_or_fix" &&
        grounding.tool === "build_or_fix_routine",
    ),
  )
})

test("safety guidance preserves scalp and hair-loss guardrails", async () => {
  const result = await loadAgentV2GuidancePackages(["base.safety_boundaries.v1"])
  const brief = result.markdown_brief
  const metadata = JSON.parse(
    readFileSync("data/agent-v2/guidance/base/safety-boundaries.json", "utf8"),
  ) as {
    soft_rubrics: Array<{ rubric_id: string; message: string }>
  }

  assert.match(brief, /pause oils, scrubs, aggressive exfoliation/i)
  assert.match(brief, /dandruff is not generic dryness or oiling/i)
  assert.match(brief, /breakage from shedding or true thinning/i)
  assert.match(brief, /do not promise regrowth/i)
  assert.match(brief, /sudden, patchy, persistent, painful/i)
  assert.ok(
    metadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "safety.separate_breakage_from_loss",
    ),
  )
})

test("general advice keeps routine changes out of hand-rolled advice", async () => {
  const result = await loadAgentV2GuidancePackages(["base.general_advice.v1"])
  const brief = result.markdown_brief
  const metadata = JSON.parse(
    readFileSync("data/agent-v2/guidance/base/general-advice.json", "utf8"),
  ) as {
    soft_rubrics: Array<{ rubric_id: string; message: string }>
  }

  assert.match(brief, /Routine Boundary/i)
  assert.match(brief, /placement\/order questions/i)
  assert.match(brief, /must not present a changed multi-step user routine/i)
  assert.match(brief, /Use `build_or_fix_routine` for that/i)
  assert.ok(
    metadata.soft_rubrics.some((rubric) => rubric.rubric_id === "general_advice.routine_boundary"),
  )
})

test("routine-first category steering preserves placement and lightweight add-on boundaries", () => {
  const deepCleansing = readFileSync(
    "data/agent-v2/guidance/categories/deep-cleansing-shampoo.md",
    "utf8",
  )
  const deepCleansingMetadata = JSON.parse(
    readFileSync("data/agent-v2/guidance/categories/deep-cleansing-shampoo.json", "utf8"),
  ) as { hard_rules: Array<{ rule_id: string; message: string }> }
  const dryShampoo = readFileSync("data/agent-v2/guidance/categories/dry-shampoo.md", "utf8")
  const dryShampooMetadata = JSON.parse(
    readFileSync("data/agent-v2/guidance/categories/dry-shampoo.json", "utf8"),
  ) as { hard_rules: Array<{ rule_id: string; message: string }> }
  const mask = readFileSync("data/agent-v2/guidance/categories/mask.md", "utf8")
  const maskMetadata = JSON.parse(
    readFileSync("data/agent-v2/guidance/categories/mask.json", "utf8"),
  ) as { soft_rubrics: Array<{ rubric_id: string; message: string }> }
  const oil = readFileSync("data/agent-v2/guidance/categories/oil.md", "utf8")
  const oilMetadata = JSON.parse(
    readFileSync("data/agent-v2/guidance/categories/oil.json", "utf8"),
  ) as {
    hard_rules: Array<{ rule_id: string; message: string }>
    soft_rubrics: Array<{ rubric_id: string; message: string }>
  }

  assert.match(deepCleansing, /add, remove, replace, or change a reset step/i)
  assert.match(deepCleansing, /Shampoo and Conditioner remain the routine spine/i)
  assert.match(deepCleansing, /Reset is occasional and not a daily replacement/i)
  assert.ok(
    deepCleansingMetadata.hard_rules.some(
      (rule) => rule.rule_id === "category.deep_cleansing.mutation_preserve_baseline",
    ),
  )

  assert.match(dryShampoo, /Wo kommt Trockenshampoo in der Routine hin\?/i)
  assert.match(dryShampoo, /routine_explanation, not routine_mutation/i)
  assert.ok(
    dryShampooMetadata.hard_rules.some(
      (rule) => rule.rule_id === "category.dry_shampoo.routine_explanation_vs_mutation",
    ),
  )

  assert.match(mask, /dry\/frizzy lengths inside a lightweight-routine decision/i)
  assert.match(mask, /Oil may be mentioned only as a tiny finish/i)
  assert.ok(
    maskMetadata.soft_rubrics.some(
      (rubric) => rubric.rubric_id === "category.mask.lightweight_dry_frizzy_addon",
    ),
  )

  assert.match(oil, /Maske oder Öl\?/i)
  assert.match(oil, /do not make oil the main care add-on/i)
  assert.ok(
    oilMetadata.hard_rules.some(
      (rule) => rule.rule_id === "category.oil.lightweight_mask_over_oil",
    ) ||
      oilMetadata.soft_rubrics.some(
        (rubric) => rubric.rubric_id === "category.oil.lightweight_mask_over_oil",
      ),
  )
})
