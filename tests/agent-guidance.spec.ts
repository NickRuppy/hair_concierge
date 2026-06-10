import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"

import { loadGuidance } from "@/lib/agent/guidance/load-guidance"
import {
  loadAdvisorGuidance,
  normalizeAdvisorGuidanceCategories,
  resolveAdvisorGuidanceIds,
} from "@/lib/agent/tools/load-advisor-guidance"
import { GUIDANCE_IDS, type GuidanceId, type GuidanceKind } from "@/lib/agent/contracts"
import type { UserContextProjection } from "@/lib/agent/tools/get-user-context"
import type { HairProfile } from "@/lib/types"

const REQUIRED_OVERLAY_SECTIONS = [
  "Use when:",
  "Advisor interpretation:",
  "Category implications:",
  "- Shampoo:",
  "- Conditioner:",
  "- Leave-in:",
  "- Mask:",
  "- Oil:",
  "- Bondbuilder / repair:",
  "Routine implications:",
  "Avoid:",
  "Ask only if:",
  "Proactive next step:",
] as const

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function createUserContext(overrides: Partial<UserContextProjection> = {}): UserContextProjection {
  return {
    profile: null,
    routine_inventory: [],
    relevant_memory: [],
    derived_signals: [],
    suggested_overlays: [],
    missing_profile: [],
    ...overrides,
  }
}

function createHairProfile(overrides: Partial<HairProfile>): HairProfile {
  return {
    id: "profile-1",
    user_id: "user-1",
    hair_texture: null,
    thickness: null,
    density: null,
    concerns: [],
    products_used: null,
    shampoo_frequency: null,
    heat_styling: null,
    styling_tools: null,
    goals: [],
    cuticle_condition: null,
    protein_moisture_balance: null,
    scalp_type: null,
    scalp_condition: null,
    chemical_treatment: ["natural"],
    desired_volume: null,
    routine_preference: null,
    current_routine_products: null,
    towel_material: null,
    towel_technique: null,
    drying_method: null,
    brush_type: null,
    night_protection: null,
    uses_heat_protection: false,
    additional_notes: null,
    conversation_memory: null,
    created_at: "2026-05-11T00:00:00.000Z",
    updated_at: "2026-05-11T00:00:00.000Z",
    ...overrides,
  }
}

test("loadGuidance returns named playbooks and overlays", async () => {
  const result = await loadGuidance(["playbook:recommend_products", "overlay:fine_hair"])

  assert.deepEqual(
    result.items.map((item) => item.id),
    ["playbook:recommend_products", "overlay:fine_hair"],
  )
  assert.equal(result.items[0].kind, "playbook")
  assert.equal(result.items[1].kind, "overlay")
  assert.match(result.items[0].content, /When to use/i)
  assert.match(result.items[1].content, /fine/i)
})

test("loadAdvisorGuidance resolves semantic usage input to normalized topic and overlay guidance", async () => {
  const userContext: UserContextProjection = {
    profile: null,
    routine_inventory: [],
    relevant_memory: [],
    derived_signals: ["Haardicke: fein"],
    suggested_overlays: ["overlay:fine_hair"],
    missing_profile: [],
  }

  const guidance = await loadAdvisorGuidance({
    intent: "usage",
    category: "leave_in",
    categories: [],
    profileFocus: ["dry_lengths", "fine_hair"],
    message: "wann wuerde ich leave-in verwenden?",
    userContext,
    conversationState: null,
  })

  assert.deepEqual(guidance.loaded_guidance_ids, [
    "playbook:usage_and_application",
    "topic:leave_in",
    "overlay:dry_lengths",
    "overlay:fine_hair",
  ])
  assert.match(guidance.direct_answer_frame, /when and how leave in fits/i)
  assert.ok(guidance.key_advice_points.length > 0)
  assert.ok(guidance.profile_interpretation.length > 0)
  assert.ok(guidance.proactive_next_step_options.some((item) => /product picks/i.test(item)))
})

test("loadAdvisorGuidance loads explicitly compared categories and comparison playbook", async () => {
  const guidance = await loadAdvisorGuidance({
    intent: "compare_or_decide",
    category: null,
    categories: ["mask"],
    profileFocus: ["dry_lengths", "fine_hair"],
    message: "Ist bei trockenen Spitzen eine Maske oder Oel sinnvoller?",
    userContext: createUserContext({
      profile: createHairProfile({
        hair_texture: "straight",
        thickness: "fine",
        concerns: ["dryness"],
        scalp_type: "balanced",
      }),
    }),
    conversationState: null,
  })

  // Prefix assertion is intentional: profile overlays are appended after playbooks/topics.
  assert.deepEqual(guidance.loaded_guidance_ids.slice(0, 4), [
    "playbook:compare_or_decide",
    "playbook:category_comparison",
    "topic:mask",
    "topic:hair_oiling",
  ])
  assert.ok(guidance.loaded_guidance_ids.includes("overlay:dry_lengths"))
  assert.ok(guidance.loaded_guidance_ids.includes("overlay:fine_hair"))
  assert.ok(guidance.key_advice_points.some((point) => /First compare category roles/i.test(point)))
  assert.ok(guidance.avoid.some((point) => /oils moisturize hair/i.test(point)))
  assert.ok(guidance.avoid.some((point) => /regrowth/i.test(point)))
  assert.ok(guidance.category_sections.some((section) => section.category === "mask"))
  assert.ok(guidance.category_sections.some((section) => section.category === "oil"))
  assert.ok(
    guidance.category_sections.every(
      (section) => !section.key_points.some((point) => point === "Runtime Variables"),
    ),
  )
  assert.equal(guidance.category_implications.length, 0)
  assert.match(guidance.direct_answer_frame, /Compare the practical roles first/i)
})

test("loadAdvisorGuidance infers compared categories without falling back to general guidance", async () => {
  const guidance = await loadAdvisorGuidance({
    intent: "compare_or_decide",
    category: null,
    categories: [],
    profileFocus: [],
    message: "Maske oder Oel fuer trockene Spitzen?",
    userContext: createUserContext(),
    conversationState: null,
  })

  assert.ok(guidance.loaded_guidance_ids.includes("playbook:category_comparison"))
  assert.ok(guidance.loaded_guidance_ids.includes("topic:mask"))
  assert.ok(guidance.loaded_guidance_ids.includes("topic:hair_oiling"))
  assert.ok(!guidance.loaded_guidance_ids.includes("topic:general_haircare"))
})

test("loadAdvisorGuidance loads dry shampoo topic guidance from named prompts", async () => {
  const guidance = await loadAdvisorGuidance({
    intent: "usage",
    category: null,
    categories: [],
    profileFocus: [],
    message: "Wie nutze ich Trockenshampoo zwischen zwei Waeschen?",
    userContext: createUserContext(),
    conversationState: null,
  })

  assert.deepEqual(guidance.loaded_guidance_ids.slice(0, 2), [
    "playbook:usage_and_application",
    "topic:dry_shampoo",
  ])
  assert.ok(!guidance.loaded_guidance_ids.includes("topic:general_haircare"))
  assert.ok(guidance.category_sections.some((section) => section.category === "dry_shampoo"))
  assert.ok(
    guidance.category_sections.some((section) =>
      section.key_points.some((point) => /does not clean the scalp/i.test(point)),
    ),
  )
})

test("loadAdvisorGuidance loads peeling topic guidance from named prompts", async () => {
  const guidance = await loadAdvisorGuidance({
    intent: "category_explanation",
    category: null,
    categories: [],
    profileFocus: [],
    message: "Brauche ich ein Kopfhautpeeling oder scalp scrub gegen Rueckstaende?",
    userContext: createUserContext(),
    conversationState: null,
  })

  assert.deepEqual(guidance.loaded_guidance_ids, ["topic:peeling"])
  assert.ok(!guidance.loaded_guidance_ids.includes("topic:general_haircare"))
  assert.ok(guidance.category_sections.some((section) => section.category === "peeling"))
  assert.ok(guidance.avoid.some((point) => /irritated|inflamed|painful|sensitive/i.test(point)))
})

test("loadAdvisorGuidance normalizes deep cleansing shampoo aliases to deep cleansing topic", async () => {
  const explicitAlias = await loadAdvisorGuidance({
    intent: "category_explanation",
    category: "deep_cleansing_shampoo",
    categories: [],
    profileFocus: [],
    message: "Ist das sinnvoll?",
    userContext: createUserContext(),
    conversationState: null,
  })

  const inferredAlias = await loadAdvisorGuidance({
    intent: "category_explanation",
    category: null,
    categories: [],
    profileFocus: [],
    message: "Was bringt ein Tiefenreinigungsshampoo oder Reinigungsshampoo?",
    userContext: createUserContext(),
    conversationState: null,
  })

  const inferredClarifyingAlias = await loadAdvisorGuidance({
    intent: "category_explanation",
    category: null,
    categories: [],
    profileFocus: [],
    message: "Was bringt ein clarifying shampoo gegen Build-up?",
    userContext: createUserContext(),
    conversationState: null,
  })

  assert.deepEqual(explicitAlias.loaded_guidance_ids, ["topic:deep_cleansing"])
  assert.deepEqual(inferredAlias.loaded_guidance_ids, ["topic:deep_cleansing"])
  assert.deepEqual(inferredClarifyingAlias.loaded_guidance_ids, ["topic:deep_cleansing"])
  assert.ok(!inferredAlias.loaded_guidance_ids.includes("topic:shampoo"))
  assert.ok(!inferredClarifyingAlias.loaded_guidance_ids.includes("topic:shampoo"))
  assert.ok(!inferredAlias.loaded_guidance_ids.includes("topic:general_haircare"))
  assert.ok(
    inferredAlias.category_sections.some((section) => section.category === "deep_cleansing"),
  )
})

test("loadAdvisorGuidance prioritizes mentioned categories over noisy model categories", async () => {
  const guidance = await loadAdvisorGuidance({
    intent: "compare_or_decide",
    category: "deep_cleansing",
    categories: ["shampoo", "conditioner", "leave_in"],
    profileFocus: [],
    message: "Maske oder Oel fuer trockene Spitzen?",
    userContext: createUserContext(),
    conversationState: null,
  })

  assert.deepEqual(guidance.loaded_guidance_ids.slice(0, 5), [
    "playbook:compare_or_decide",
    "playbook:category_comparison",
    "topic:mask",
    "topic:hair_oiling",
    "topic:deep_cleansing",
  ])
  assert.ok(!guidance.loaded_guidance_ids.includes("topic:shampoo"))
})

test("normalizeAdvisorGuidanceCategories canonicalizes, deduplicates, and caps categories", () => {
  assert.deepEqual(
    normalizeAdvisorGuidanceCategories([
      "mask",
      "oil",
      "conditioner",
      "mask",
      "bondbuilder",
      "unknown",
    ]),
    ["mask", "oil", "conditioner"],
  )

  assert.deepEqual(normalizeAdvisorGuidanceCategories(["bondbuilder"]), ["bond_builder"])
  assert.deepEqual(
    normalizeAdvisorGuidanceCategories(["deep_cleansing_shampoo", "dry_shampoo", "peeling"]),
    ["deep_cleansing", "dry_shampoo", "peeling"],
  )
})

test("polished category guidance exposes comparable markdown headings", async () => {
  const requiredHeadings = [
    "## Runtime Variables",
    "## Category Role",
    "## Best Fit",
    "## Weak Fit",
    "## Decision Axes",
    "## Profile Interplay",
    "## Compare Against Other Categories",
    "## Answer Guidance",
    "## Guardrails",
  ]

  for (const id of [
    "topic:shampoo",
    "topic:conditioner",
    "topic:leave_in",
    "topic:mask",
    "topic:hair_oiling",
    "topic:deep_cleansing",
    "topic:dry_shampoo",
    "topic:peeling",
  ] as const) {
    const result = await loadGuidance([id])
    const content = result.items[0]?.content ?? ""
    for (const heading of requiredHeadings) {
      assert.match(content, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), id)
    }
  }
})

test("resolveAdvisorGuidanceIds ignores incompatible model-requested overlays", () => {
  const userContext = createUserContext({
    profile: createHairProfile({
      hair_texture: "straight",
      thickness: "coarse",
      protein_moisture_balance: "stretches_bounces",
      scalp_type: "balanced",
      heat_styling: "daily",
      chemical_treatment: ["natural"],
      concerns: [],
    }),
    suggested_overlays: ["overlay:fine_hair", "overlay:minimal_routine", "overlay:buildup_risk"],
  })

  const ids = resolveAdvisorGuidanceIds({
    intent: "usage",
    category: "conditioner",
    categories: [],
    profileFocus: ["fine_hair", "oily_scalp", "dry_lengths", "heat_styling", "damage_repair"],
    message: "wie nutze ich conditioner?",
    userContext,
    conversationState: null,
  })

  assert.deepEqual(ids.slice(0, 2), ["playbook:usage_and_application", "topic:conditioner"])
  assert.deepEqual(ids.slice(2), [
    "overlay:heat_styling",
    "overlay:mechanical_stress",
    "overlay:protein_moisture_balance",
  ])
  assert.ok(!ids.includes("overlay:fine_hair"))
  assert.ok(!ids.includes("overlay:damage_repair"))
})

test("resolveAdvisorGuidanceIds keeps matching suggested and derived overlays before requested extras", () => {
  const userContext = createUserContext({
    profile: createHairProfile({
      hair_texture: "wavy",
      thickness: "normal",
      scalp_type: "balanced",
      concerns: ["dryness", "frizz"],
      chemical_treatment: ["colored"],
    }),
    suggested_overlays: ["overlay:dry_lengths"],
  })

  assert.deepEqual(
    resolveAdvisorGuidanceIds({
      intent: "category_explanation",
      category: "conditioner",
      categories: [],
      profileFocus: ["fine_hair", "dry_lengths", "damage_repair"],
      message: "brauche ich conditioner?",
      userContext,
      conversationState: null,
    }),
    [
      "topic:conditioner",
      "overlay:dry_lengths",
      "overlay:frizz_control",
      "overlay:chemical_or_color_treated",
      "overlay:damage_repair",
    ],
  )
})

test("resolveAdvisorGuidanceIds caps overlays and falls back to general guidance", () => {
  const emptyContext: UserContextProjection = {
    profile: null,
    routine_inventory: [],
    relevant_memory: [],
    derived_signals: [],
    suggested_overlays: [],
    missing_profile: [],
  }
  const denseContext: UserContextProjection = {
    ...emptyContext,
    suggested_overlays: [
      "overlay:fine_hair",
      "overlay:dry_lengths",
      "overlay:curly_hair",
      "overlay:heat_styling",
    ],
  }

  assert.deepEqual(
    resolveAdvisorGuidanceIds({
      intent: "category_explanation",
      category: null,
      categories: [],
      profileFocus: [],
      message: "was ist sinnvoll?",
      userContext: emptyContext,
      conversationState: null,
    }),
    ["topic:general_haircare"],
  )

  assert.deepEqual(
    resolveAdvisorGuidanceIds({
      intent: "category_explanation",
      category: "mask",
      categories: [],
      profileFocus: [],
      message: "brauche ich eine maske?",
      userContext: denseContext,
      conversationState: null,
    }),
    [
      "topic:mask",
      "overlay:dry_lengths",
      "overlay:fine_hair",
      "overlay:curly_hair",
      "overlay:heat_styling",
    ],
  )
})

test("loadGuidance returns intent playbooks salvaged from chat-response review", async () => {
  const result = await loadGuidance([
    "playbook:troubleshoot_hair_issue",
    "playbook:compare_or_decide",
    "playbook:usage_and_application",
  ])

  assert.deepEqual(
    result.items.map((item) => item.id),
    [
      "playbook:troubleshoot_hair_issue",
      "playbook:compare_or_decide",
      "playbook:usage_and_application",
    ],
  )
  assert.deepEqual(
    result.items.map((item) => item.kind),
    ["playbook", "playbook", "playbook"],
  )
  assert.match(result.items[0].content, /troubleshoot/i)
  assert.match(result.items[1].content, /compare/i)
  assert.match(result.items[2].content, /application/i)
})

test("loadGuidance loads every callable v1 guidance kind", async () => {
  const cases: Array<{ id: GuidanceId; kind: GuidanceKind; marker: RegExp }> = [
    { id: "overlay:curly_hair", kind: "overlay", marker: /Curly Hair/i },
    { id: "overlay:coily_hair", kind: "overlay", marker: /Coily Hair/i },
    { id: "overlay:heat_styling", kind: "overlay", marker: /Heat Styling/i },
    { id: "overlay:mechanical_stress", kind: "overlay", marker: /Mechanical Stress/i },
    { id: "overlay:buildup_risk", kind: "overlay", marker: /Buildup Risk/i },
    { id: "overlay:damage_repair", kind: "overlay", marker: /Damage Repair/i },
    { id: "overlay:sensitive_scalp", kind: "overlay", marker: /Sensitive Scalp/i },
    { id: "overlay:dandruff_scalp", kind: "overlay", marker: /Dandruff Scalp/i },
    {
      id: "overlay:low_density_weight_sensitive",
      kind: "overlay",
      marker: /Low Density \/ Weight Sensitive/i,
    },
    { id: "overlay:frizz_control", kind: "overlay", marker: /Frizz Control/i },
    {
      id: "overlay:tangling_detangling",
      kind: "overlay",
      marker: /Tangling \/ Detangling/i,
    },
    {
      id: "overlay:protein_moisture_balance",
      kind: "overlay",
      marker: /Protein \/ Moisture Balance/i,
    },
    {
      id: "overlay:chemical_or_color_treated",
      kind: "overlay",
      marker: /Chemical Or Color Treated/i,
    },
    {
      id: "overlay:hair_loss_or_thinning_guardrail",
      kind: "overlay",
      marker: /Hair Loss Or Thinning Guardrail/i,
    },
    { id: "routine:curl_definition", kind: "routine", marker: /Core Fit[\s\S]*Assembly Rules/ },
    {
      id: "routine:straight_low_definition",
      kind: "routine",
      marker: /Core Fit[\s\S]*Assembly Rules/,
    },
    { id: "topic:bond_builder", kind: "topic", marker: /Core Fit[\s\S]*Response Playbook/ },
    { id: "topic:cwc_owc", kind: "topic", marker: /Core Fit[\s\S]*Response Playbook/ },
    { id: "topic:deep_cleansing", kind: "topic", marker: /Core Fit[\s\S]*Response Playbook/ },
    { id: "topic:dry_shampoo", kind: "topic", marker: /Core Fit[\s\S]*Response Playbook/ },
    { id: "topic:peeling", kind: "topic", marker: /Core Fit[\s\S]*Response Playbook/ },
    { id: "topic:general_haircare", kind: "topic", marker: /Core Fit[\s\S]*Response Playbook/ },
    { id: "topic:hair_oiling", kind: "topic", marker: /Core Fit[\s\S]*Response Playbook/ },
  ]

  const result = await loadGuidance(cases.map((item) => item.id))

  assert.deepEqual(
    result.items.map((item) => [item.id, item.kind]),
    cases.map((item) => [item.id, item.kind]),
  )

  for (const [index, item] of result.items.entries()) {
    assert.match(item.content, cases[index].marker, item.id)
  }
})

test("overlay guidance uses normalized advisor sections", async () => {
  const overlayIds = GUIDANCE_IDS.filter((id): id is GuidanceId => id.startsWith("overlay:"))
  const result = await loadGuidance(overlayIds)

  assert.equal(result.items.length, overlayIds.length)

  for (const item of result.items) {
    assert.equal(item.kind, "overlay", item.id)
    assert.match(item.content, /^# \S.+/m, item.id)

    for (const section of REQUIRED_OVERLAY_SECTIONS) {
      assert.match(item.content, new RegExp(`^${escapeRegExp(section)}`, "m"), item.id)
    }
  }
})

test("loadAdvisorGuidance derives harmonized overlays from profile signals", async () => {
  const guidance = await loadAdvisorGuidance({
    intent: "category_explanation",
    category: "conditioner",
    categories: [],
    profileFocus: [],
    message: "was brauche ich gegen frizz und trockene laengen?",
    userContext: createUserContext({
      profile: createHairProfile({
        hair_texture: "wavy",
        thickness: "fine",
        density: "low",
        concerns: ["dryness", "frizz", "tangling"],
        goals: ["less_frizz"],
        protein_moisture_balance: "stretches_stays",
        chemical_treatment: ["colored"],
        scalp_type: "balanced",
      }),
    }),
    conversationState: null,
  })

  assert.ok(guidance.loaded_guidance_ids.includes("overlay:dry_lengths"))
  assert.ok(guidance.loaded_guidance_ids.includes("overlay:frizz_control"))
  assert.ok(guidance.loaded_guidance_ids.includes("overlay:fine_hair"))
  assert.ok(guidance.loaded_guidance_ids.length <= 1 + 4)
})

test("hair loss guardrail overlay is prioritized over cosmetic overlays", async () => {
  const guidance = await loadAdvisorGuidance({
    intent: "problem_context",
    category: "general_haircare",
    categories: [],
    profileFocus: ["hair_loss_or_thinning_guardrail", "frizz_control", "dry_lengths"],
    message: "ich habe ploetzlich haarausfall und frizz, was tun?",
    userContext: createUserContext({
      profile: createHairProfile({
        thickness: "fine",
        density: "low",
        concerns: ["hair_loss", "dryness", "frizz", "tangling"],
        scalp_condition: "irritated",
      }),
    }),
    conversationState: null,
  })

  assert.ok(guidance.loaded_guidance_ids.includes("overlay:hair_loss_or_thinning_guardrail"))
  assert.ok(guidance.avoid.some((line) => /diagnose|regrowth|hair-loss/i.test(line)))
})

test("current-turn hair loss wording can load safety overlay without saved profile concern", async () => {
  const guidance = await loadAdvisorGuidance({
    intent: "problem_context",
    category: "general_haircare",
    categories: [],
    profileFocus: ["hair_loss_or_thinning_guardrail", "frizz_control", "dry_lengths"],
    message: "ich habe ploetzlich haarausfall und frizz, welches oel hilft?",
    userContext: createUserContext({
      profile: createHairProfile({
        thickness: "fine",
        density: "low",
        concerns: ["dryness", "frizz"],
      }),
    }),
    conversationState: null,
  })

  const hairLossIndex = guidance.loaded_guidance_ids.indexOf(
    "overlay:hair_loss_or_thinning_guardrail",
  )
  const dryLengthsIndex = guidance.loaded_guidance_ids.indexOf("overlay:dry_lengths")

  assert.ok(hairLossIndex >= 0)
  assert.ok(dryLengthsIndex === -1 || hairLossIndex < dryLengthsIndex)
  assert.ok(guidance.avoid.some((line) => /diagnose|regrowth|hair-loss/i.test(line)))
})

test("current-turn separated hair-loss wording can load safety overlay", async () => {
  const guidance = await loadAdvisorGuidance({
    intent: "problem_context",
    category: "general_haircare",
    categories: [],
    profileFocus: ["hair_loss_or_thinning_guardrail", "dry_lengths"],
    message: "mir fallen seit kurzem viele Haare aus, kann ein Oel helfen?",
    userContext: createUserContext({
      profile: createHairProfile({
        thickness: "normal",
        concerns: ["dryness"],
      }),
    }),
    conversationState: null,
  })

  assert.ok(guidance.loaded_guidance_ids.includes("overlay:hair_loss_or_thinning_guardrail"))
  assert.ok(guidance.avoid.some((line) => /diagnose|regrowth|hair-loss/i.test(line)))
})

test("current-turn separated hair-loss wording loads safety overlay without model focus", async () => {
  const guidance = await loadAdvisorGuidance({
    intent: "problem_context",
    category: "general_haircare",
    categories: [],
    profileFocus: [],
    message: "Mir fallen seit kurzem viele Haare aus. Kann ein Haaroel helfen?",
    userContext: createUserContext({
      profile: createHairProfile({
        thickness: "normal",
        concerns: ["dryness"],
        scalp_condition: null,
      }),
    }),
    conversationState: null,
  })

  assert.ok(guidance.loaded_guidance_ids.includes("overlay:hair_loss_or_thinning_guardrail"))
  assert.ok(guidance.avoid.some((line) => /diagnose|regrowth|hair-loss/i.test(line)))
})

test("current-turn itchy burning scalp wording loads safety overlay without model focus", async () => {
  const guidance = await loadAdvisorGuidance({
    intent: "problem_context",
    category: "general_haircare",
    categories: [],
    profileFocus: [],
    message: "Meine Kopfhaut juckt und brennt. Was soll ich nehmen?",
    userContext: createUserContext({
      profile: createHairProfile({
        thickness: "normal",
        concerns: ["dryness"],
        scalp_condition: null,
      }),
    }),
    conversationState: null,
  })

  assert.ok(guidance.loaded_guidance_ids.includes("overlay:sensitive_scalp"))
})

test("current-turn dandruff wording loads safety overlay without model focus", async () => {
  const guidance = await loadAdvisorGuidance({
    intent: "compare_or_decide",
    category: null,
    categories: [],
    profileFocus: [],
    message: "Ich habe Schuppen und trockene Laengen. Maske oder Oel?",
    userContext: createUserContext({
      profile: createHairProfile({
        thickness: "normal",
        concerns: ["dryness"],
        scalp_condition: null,
      }),
    }),
    conversationState: null,
  })

  const dandruffIndex = guidance.loaded_guidance_ids.indexOf("overlay:dandruff_scalp")
  const dryLengthsIndex = guidance.loaded_guidance_ids.indexOf("overlay:dry_lengths")

  assert.ok(dandruffIndex >= 0)
  assert.ok(dryLengthsIndex === -1 || dandruffIndex < dryLengthsIndex)
})

test("loadGuidance returns core product category topics for the agentic consultation brief", async () => {
  const result = await loadGuidance([
    "topic:shampoo",
    "topic:conditioner",
    "topic:leave_in",
    "topic:mask",
  ])

  assert.deepEqual(
    result.items.map((item) => [item.id, item.kind]),
    [
      ["topic:shampoo", "topic"],
      ["topic:conditioner", "topic"],
      ["topic:leave_in", "topic"],
      ["topic:mask", "topic"],
    ],
  )
  assert.match(
    result.items[0]?.content ?? "",
    /Shampoo: Core Fit[\s\S]*Shampoo: Response Playbook/i,
  )
  assert.match(
    result.items[1]?.content ?? "",
    /Conditioner: Core Fit[\s\S]*Conditioner: Response Playbook/i,
  )
  assert.match(
    result.items[2]?.content ?? "",
    /Leave-in: Core Fit[\s\S]*Leave-in: Response Playbook/i,
  )
  assert.match(result.items[3]?.content ?? "", /Mask: Core Fit[\s\S]*Mask: Response Playbook/i)
})

test("category response playbooks carry advisor rendering guidance", async () => {
  const result = await loadGuidance([
    "topic:leave_in",
    "topic:conditioner",
    "topic:mask",
    "topic:shampoo",
  ])
  const content = result.items.map((item) => item.content).join("\n")

  assert.match(content, /advisor|Berater|praktische|Unterschied|Option/i)
  assert.match(content, /no product names unless|keine Produktnamen/i)
  assert.match(content, /explicit product ask|konkrete Produkt/i)
})

test("conditioner vs leave-in guidance preserves replacement nuance", async () => {
  const result = await loadGuidance([
    "topic:conditioner",
    "topic:leave_in",
    "playbook:category_comparison",
  ])
  const content = result.items.map((item) => item.content).join("\n")

  assert.match(content, /default rinse-out baseline/i)
  assert.match(content, /booster\/simplification candidate/i)
  assert.match(content, /can sometimes replace conditioner/i)
  assert.match(content, /product data\/context supports replacement/i)
  assert.match(content, /Do not make leave-in an automatic conditioner replacement/i)
})

test("playbooks keep the five user-job boundaries explicit", async () => {
  const result = await loadGuidance([
    "playbook:recommend_products",
    "playbook:compare_or_decide",
    "playbook:build_or_fix_routine",
    "playbook:troubleshoot_hair_issue",
    "playbook:usage_and_application",
  ])
  const contentById = Object.fromEntries(result.items.map((item) => [item.id, item.content]))

  assert.match(contentById["playbook:recommend_products"], /product pick/i)
  assert.doesNotMatch(contentById["playbook:recommend_products"], /comparisons/i)
  assert.match(contentById["playbook:compare_or_decide"], /compare\/decide/i)
  assert.match(contentById["playbook:build_or_fix_routine"], /routine structure/i)
  assert.doesNotMatch(contentById["playbook:build_or_fix_routine"], /debug/i)
  assert.match(contentById["playbook:troubleshoot_hair_issue"], /troubleshoot/i)
  assert.match(contentById["playbook:usage_and_application"], /usage/i)
})

test("dandruff overlay preserves dry-flakes and length-protection decisions", async () => {
  const result = await loadGuidance(["overlay:dandruff_scalp"])
  const content = result.items[0]?.content ?? ""

  assert.match(content, /Do not load this from dry flakes alone/i)
  assert.match(content, /CWC\/OWC/i)
  assert.match(content, /optional/i)
  assert.match(content, /length/i)
})

test("loadGuidance rejects unknown ids", async () => {
  await assert.rejects(
    () => loadGuidance(["overlay:not-real"]),
    /Unknown guidance id: overlay:not-real/,
  )
})

test("loadGuidance works when cwd is outside the repo root", async () => {
  const originalCwd = process.cwd()
  const tempDir = await mkdtemp(join(tmpdir(), "hair-guidance-"))

  try {
    process.chdir(tempDir)

    const result = await loadGuidance(["overlay:fine_hair"])

    assert.equal(result.items[0].id, "overlay:fine_hair")
    assert.match(result.items[0].content, /fine/i)
  } finally {
    process.chdir(originalCwd)
  }
})
