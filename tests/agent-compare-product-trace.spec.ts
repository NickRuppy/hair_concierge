import assert from "node:assert/strict"
import test from "node:test"

import {
  AGENT_COMPARE_MULTI_TURN_CHAINS,
  AGENT_COMPARE_PROMPT_TEMPLATES,
  AGENT_V2_QUALITY_REVIEW_PROMPT_TEMPLATES,
  CONDITIONER_EDGE_PROMPT_TEMPLATES,
  CONDITIONER_QA_PROMPT_TEMPLATES,
  LEAVE_IN_EDGE_PROMPT_TEMPLATES,
  LEAVE_IN_QA_PROMPT_TEMPLATES,
  SHAMPOO_QA_PROMPT_TEMPLATES,
} from "../src/lib/agent/compare/prompt-packs"

const mutableEnv = process.env as Record<string, string | undefined>

async function importCompareRoute() {
  return import("../src/app/api/labs/agent-compare/route")
}

async function importJudgmentRoute() {
  return import("../src/app/api/labs/agent-compare/judgments/route")
}

async function importCompareLab() {
  return import("../src/components/labs/agent-compare-lab")
}

function withNodeEnv(value: string, run: () => Promise<void>) {
  const previous = mutableEnv.NODE_ENV
  mutableEnv.NODE_ENV = value

  return run().finally(() => {
    mutableEnv.NODE_ENV = previous
  })
}

test("shampoo QA prompt pack covers pick, symptom, wrong-lever, compare, and usage prompts", () => {
  assert.deepEqual(
    SHAMPOO_QA_PROMPT_TEMPLATES.map((template) => template.id),
    [
      "shampoo-best-pick",
      "shampoo-oily-roots",
      "shampoo-dry-lengths",
      "shampoo-compare",
      "shampoo-usage",
    ],
  )
  assert.ok(
    SHAMPOO_QA_PROMPT_TEMPLATES.every((template) =>
      template.prompt.toLowerCase().includes("shampoo"),
    ),
  )
})

test("conditioner QA prompt pack mirrors the documented conditioner prompt bank", () => {
  assert.deepEqual(
    CONDITIONER_QA_PROMPT_TEMPLATES.map((template) => template.id),
    [
      "conditioner-light-fine-hair",
      "conditioner-dry-strawlike",
      "conditioner-protein-or-moisture",
      "conditioner-colored-damaged",
      "conditioner-curls-frizz",
      "conditioner-oily-roots-usage",
      "conditioner-compare-fine-hair",
      "conditioner-flattening",
      "conditioner-split-ends",
      "conditioner-overconditioned-cadence",
    ],
  )
  assert.equal(CONDITIONER_QA_PROMPT_TEMPLATES.length, 10)
  assert.ok(
    CONDITIONER_QA_PROMPT_TEMPLATES.every((template) =>
      /conditioner|spülung/i.test(template.prompt),
    ),
  )
})

test("conditioner edge prompt pack covers unsupported ingredients and scalp redirects", () => {
  assert.deepEqual(
    CONDITIONER_EDGE_PROMPT_TEMPLATES.map((template) => template.id),
    ["conditioner-ingredient-unsupported", "conditioner-scalp-redirect"],
  )
})

test("leave-in prompt packs cover Agent v1 heat, styling prep, booster, and unsupported-claim paths", () => {
  assert.deepEqual(
    LEAVE_IN_QA_PROMPT_TEMPLATES.map((template) => template.id),
    [
      "leave-in-light-fine-hair",
      "leave-in-high-heat-protection",
      "leave-in-blow-dry-moderate",
      "leave-in-curls-definition",
      "leave-in-replacement-vs-booster",
      "leave-in-compare",
    ],
  )
  assert.deepEqual(
    LEAVE_IN_EDGE_PROMPT_TEMPLATES.map((template) => template.id),
    ["leave-in-ingredient-unsupported", "leave-in-exact-heat-temperature"],
  )
  assert.ok(LEAVE_IN_QA_PROMPT_TEMPLATES.every((template) => /leave-in/i.test(template.prompt)))
  assert.equal(
    AGENT_COMPARE_PROMPT_TEMPLATES.filter((template) => template.id.startsWith("leave-in-")).length,
    8,
  )
})

test("AgentV2 review prompt pack covers the prioritized manual QA prompts", () => {
  assert.deepEqual(
    AGENT_V2_QUALITY_REVIEW_PROMPT_TEMPLATES.map((template) => template.id),
    [
      "agent-v2-review-bondbuilder-protocol",
      "agent-v2-review-bondbuilder-routine-placement",
      "agent-v2-review-bondbuilder-brand-comparison",
      "agent-v2-review-deep-cleansing-products",
      "agent-v2-review-deep-cleansing-detail",
      "agent-v2-review-deep-cleansing-vs-peeling",
      "agent-v2-review-oil-heat-claim",
      "agent-v2-review-mild-scalp-cosmetic",
    ],
  )
  assert.ok(
    AGENT_COMPARE_MULTI_TURN_CHAINS.some(
      (chain) => chain.id === "agent-v2-review-routine-first-extra-product",
    ),
  )
  assert.ok(
    AGENT_COMPARE_MULTI_TURN_CHAINS.some(
      (chain) => chain.id === "agent-v2-review-previous-offer-reference",
    ),
  )
  assert.equal(
    AGENT_COMPARE_PROMPT_TEMPLATES.filter((template) => template.id.startsWith("agent-v2-review-"))
      .length,
    8,
  )
})

test("compare route preserves the agent product trace for lab debugging", async () =>
  withNodeEnv("development", async () => {
    const { handleAgentCompareRequest } = await importCompareRoute()
    const response = await handleAgentCompareRequest(
      {
        userId: "user-42",
        prompt: "Welches Shampoo passt am besten zu mir?",
        systems: ["current", "agent"],
      },
      {
        listEligibleCompareUsers: async () => [],
        loadCompareUserSnapshot: async () => {
          throw new Error("not used")
        },
        runCurrentComparisonForUser: async () => ({
          system: "current",
          answer: "Aktuelles System",
          latency_ms: 120,
          debug_lines: [],
          matched_products: [],
          product_trace: null,
          route_trace: null,
          error: null,
        }),
        runShadowComparisonForUser: async () => ({
          system: "tool_loop",
          answer: "Neuer Agent",
          latency_ms: 90,
          debug_lines: [
            "decision: recommended",
            "product_policy: recommend",
            "policy_reason: Shampoo wird primaer ueber Kopfhaut-Fokus und Haardicke entschieden.",
          ],
          matched_products: [{ name: "Light Shampoo", category: "shampoo" }],
          tool_loop_trace: {
            model_steps: 2,
            tool_calls: [{ name: "select_products", input: { category: "shampoo" } }],
          },
          route_trace: {
            user_job: "product_pick",
            product_category: "shampoo",
            requested_overlay_ids: [],
            requested_topic_ids: [],
            requested_routine_id: null,
            concerns: [],
            active_profile_signals: [],
            confidence: 0.94,
            evidence: ["User asks for shampoo."],
            ambiguity: null,
            required_playbook_id: "playbook:recommend_products",
            guidance_ids: ["playbook:recommend_products", "overlay:fine_hair"],
            tool_plan: ["select_products"],
            routine_objective: null,
            validation_warnings: [],
          },
          product_trace: {
            category: "shampoo",
            decision: "recommended",
            product_response_policy: "recommend",
            policy_reason: "Shampoo wird primaer ueber Kopfhaut-Fokus und Haardicke entschieden.",
            profile_basis: ["Haardicke: Fein", "Kopfhaut: Schnell fettend"],
            category_guidance:
              "Shampoo ist hier der richtige Hebel, gesteuert ueber Kopfhaut-Fokus und Haardicke.",
            products: [
              {
                rank: 1,
                product_id: "product-1",
                name: "Light Shampoo",
                brand: "Testmarke",
                price_eur: null,
                currency: null,
                fit_reason: "Passt zum fettigen Ansatz",
                caveat: null,
                supported_claims: [],
                unsupported_requested_signals: [],
              },
            ],
            comparison_facts: null,
            missing_info: [],
            unsupported_requested_signals: [],
          },
          error: null,
        }),
      },
    )

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.results[1].product_trace.decision, "recommended")
    assert.deepEqual(body.results[1].product_trace.profile_basis, [
      "Haardicke: Fein",
      "Kopfhaut: Schnell fettend",
    ])
    assert.equal(body.results[1].route_trace.user_job, "product_pick")
    assert.deepEqual(body.results[1].route_trace.guidance_ids, [
      "playbook:recommend_products",
      "overlay:fine_hair",
    ])
    assert.equal(body.results[1].product_trace.products[0].fit_reason, "Passt zum fettigen Ansatz")
    assert.equal(body.results[1].product_trace.product_response_policy, "recommend")
    assert.match(body.results[1].product_trace.policy_reason, /Kopfhaut-Fokus/)
    assert.ok(body.results[1].debug_lines.includes("product_policy: recommend"))
    assert.equal(body.results[1].tool_loop_trace.model_steps, 2)
    assert.equal(body.results[1].tool_loop_trace.tool_calls[0].name, "select_products")
  }))

test("judgment route accepts compare records with a product trace", async () =>
  withNodeEnv("development", async () => {
    const { handleAgentCompareJudgmentRequest } = await importJudgmentRoute()
    let appendedRecord: unknown = null

    const response = await handleAgentCompareJudgmentRequest(
      {
        createdAt: "2026-04-27T10:00:00.000Z",
        user: {
          id: "user-42",
          label: "Lea · fine",
          full_name: "Lea",
        },
        prompt: "Welches Shampoo passt am besten zu mir?",
        context: {
          user_id: "user-42",
          derived_signals: ["Haardicke: Fein"],
          routine_inventory: [],
          relevant_memory: [],
        },
        results: {
          current: {
            system: "current",
            answer: "A",
            latency_ms: 100,
            debug_lines: [],
            matched_products: [],
            product_trace: null,
            route_trace: null,
            error: null,
          },
          agent: {
            system: "agent",
            answer: "B",
            latency_ms: 90,
            debug_lines: [
              "decision: recommended",
              "product_policy: recommend",
              "policy_reason: Shampoo wird primaer ueber Kopfhaut-Fokus und Haardicke entschieden.",
            ],
            matched_products: [{ name: "Light Shampoo", category: "shampoo" }],
            route_trace: {
              user_job: "product_pick",
              product_category: "shampoo",
              requested_overlay_ids: [],
              requested_topic_ids: [],
              requested_routine_id: null,
              concerns: [],
              active_profile_signals: [],
              confidence: 0.94,
              evidence: ["User asks for shampoo."],
              ambiguity: null,
              required_playbook_id: "playbook:recommend_products",
              guidance_ids: ["playbook:recommend_products"],
              tool_plan: ["select_products"],
              routine_objective: null,
              validation_warnings: [],
            },
            product_trace: {
              category: "shampoo",
              decision: "recommended",
              product_response_policy: "recommend",
              policy_reason: "Shampoo wird primaer ueber Kopfhaut-Fokus und Haardicke entschieden.",
              profile_basis: ["Haardicke: Fein"],
              category_guidance: "Shampoo ist hier der richtige Hebel.",
              products: [
                {
                  rank: 1,
                  product_id: "product-1",
                  name: "Light Shampoo",
                  brand: null,
                  price_eur: null,
                  currency: null,
                  fit_reason: "Passt zum Profil",
                  caveat: null,
                  supported_claims: [],
                  unsupported_requested_signals: [],
                },
              ],
              comparison_facts: null,
              missing_info: [],
              unsupported_requested_signals: [],
            },
            error: null,
          },
        },
        judgment: {
          winner: "agent",
          primary_reason: "personalisierter",
          note: "Trace macht die Entscheidung nachvollziehbar.",
        },
      },
      {
        appendJudgmentLog: async (record) => {
          appendedRecord = record
        },
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true })
    assert.equal(
      (appendedRecord as { results?: { agent?: { route_trace?: { user_job?: string } } } }).results
        ?.agent?.route_trace?.user_job,
      "product_pick",
    )
  }))

test("judgment route accepts conditioner trace fields and unsupported ingredient signals", async () =>
  withNodeEnv("development", async () => {
    const { handleAgentCompareJudgmentRequest } = await importJudgmentRoute()

    const response = await handleAgentCompareJudgmentRequest(
      {
        createdAt: "2026-04-29T10:00:00.000Z",
        user: {
          id: "user-42",
          label: "Lea · fine",
          full_name: "Lea",
        },
        prompt: "Welchen silikonfreien Conditioner empfiehlst du mir?",
        context: {
          user_id: "user-42",
          derived_signals: ["Haardicke: Fein", "Haardichte: Wenig Haare"],
          routine_inventory: [],
          relevant_memory: [],
        },
        results: {
          current: {
            system: "current",
            answer: "A",
            latency_ms: 100,
            debug_lines: [],
            matched_products: [],
            product_trace: null,
            route_trace: null,
            error: null,
          },
          agent: {
            system: "agent",
            answer: "B",
            latency_ms: 90,
            debug_lines: ["unsupported_signals: ingredient_preference=silicone_free"],
            matched_products: [{ name: "Light Conditioner", category: "conditioner" }],
            route_trace: null,
            product_trace: {
              category: "conditioner",
              decision: "recommended",
              product_response_policy: "recommend",
              policy_reason:
                "Conditioner wird ueber Haardicke, Haardichte, Gewicht, Protein-/Feuchtigkeitsbalance und Pflegeintensitaet entschieden.",
              profile_basis: ["Haardicke: Fein", "Haardichte: Wenig Haare"],
              category_guidance: "Conditioner ist hier ein Laengenhebel.",
              products: [
                {
                  rank: 1,
                  product_id: "product-1",
                  name: "Light Conditioner",
                  brand: null,
                  price_eur: null,
                  currency: null,
                  fit_reason: "Idealer Treffer; Gewicht: Leicht.",
                  caveat: null,
                  supported_claims: [
                    {
                      field: "weight",
                      value: "light",
                      evidence: "product_spec",
                      label: "Gewicht: Leicht",
                    },
                    {
                      field: "balance_direction",
                      value: "moisture",
                      evidence: "product_spec",
                      label: "Balance: Feuchtigkeit",
                    },
                    {
                      field: "repair_level",
                      value: "medium",
                      evidence: "product_spec",
                      label: "Pflegeintensitaet: Mittel",
                    },
                    {
                      field: "fit_status",
                      value: "ideal",
                      evidence: "category_decision",
                      label: "Fit: idealer Treffer",
                    },
                  ],
                  unsupported_requested_signals: [
                    {
                      field: "ingredient_preference",
                      value: "silicone_free",
                      reason: "no_structured_product_data",
                      user_message: "Ingredient-Wunsch noch nicht sicher operationalisiert.",
                    },
                  ],
                },
              ],
              comparison_facts: null,
              missing_info: [],
              unsupported_requested_signals: [
                {
                  field: "ingredient_preference",
                  value: "silicone_free",
                  reason: "no_structured_product_data",
                  user_message: "Ingredient-Wunsch noch nicht sicher operationalisiert.",
                },
              ],
            },
            error: null,
          },
        },
        judgment: {
          winner: "agent",
          primary_reason: "vorsichtiger",
          note: "Ingredient caveat bleibt sichtbar.",
        },
      },
      {
        appendJudgmentLog: async () => {},
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true })
  }))

test("judgment route accepts newer leave-in and mask supported claim fields", async () =>
  withNodeEnv("development", async () => {
    const { handleAgentCompareJudgmentRequest } = await importJudgmentRoute()

    async function submitTrace(
      category: "leave_in" | "mask",
      supportedClaims: Array<{
        field: string
        value: string
        evidence: "product_spec" | "category_decision" | "profile_match"
        label: string
      }>,
    ) {
      return handleAgentCompareJudgmentRequest(
        {
          createdAt: "2026-04-29T10:00:00.000Z",
          user: {
            id: "user-42",
            label: "Lea · fine",
            full_name: "Lea",
          },
          prompt:
            category === "leave_in"
              ? "Welches Leave-in passt mit Hitzeschutz?"
              : "Welche Maske passt zu meinem Haar?",
          context: {
            user_id: "user-42",
            derived_signals: ["Haardicke: Fein"],
            routine_inventory: [],
            relevant_memory: [],
          },
          results: {
            current: {
              system: "current",
              answer: "A",
              latency_ms: 100,
              debug_lines: [],
              matched_products: [],
              product_trace: null,
              route_trace: null,
              error: null,
            },
            agent: {
              system: "agent",
              answer: "B",
              latency_ms: 90,
              debug_lines: ["decision: recommended"],
              matched_products: [{ name: "Fit Product", category }],
              route_trace: null,
              product_trace: {
                category,
                decision: "recommended",
                product_response_policy: "recommend",
                policy_reason: "Produkt-Fit wird ueber strukturierte Kategorieachsen bewertet.",
                profile_basis: ["Haardicke: Fein"],
                category_guidance: "Kategorie ist fuer die Anfrage passend.",
                products: [
                  {
                    rank: 1,
                    product_id: `product-${category}`,
                    name: "Fit Product",
                    brand: null,
                    price_eur: null,
                    currency: null,
                    fit_reason: "Passt zum Profil.",
                    caveat: null,
                    supported_claims: supportedClaims,
                    unsupported_requested_signals: [],
                  },
                ],
                comparison_facts: null,
                missing_info: [],
                unsupported_requested_signals: [],
              },
              error: null,
            },
          },
          judgment: {
            winner: "agent",
            primary_reason: "personalisierter",
            note: "Trace-Felder werden akzeptiert.",
          },
        },
        {
          appendJudgmentLog: async () => {},
        },
      )
    }

    const leaveInResponse = await submitTrace("leave_in", [
      {
        field: "heat_protection",
        value: "true",
        evidence: "product_spec",
        label: "Hitzeschutz: ja",
      },
      {
        field: "conditioner_relationship",
        value: "replacement_capable",
        evidence: "product_spec",
        label: "Conditioner-Bezug: kann ersetzen",
      },
      {
        field: "leave_in_role",
        value: "styling_prep",
        evidence: "product_spec",
        label: "Rolle: Styling-Vorbereitung",
      },
      {
        field: "care_benefit",
        value: "anti_frizz",
        evidence: "product_spec",
        label: "Pflegefokus: Anti-Frizz",
      },
    ])
    const maskResponse = await submitTrace("mask", [
      {
        field: "concentration",
        value: "medium",
        evidence: "product_spec",
        label: "Intensitaet: Mittel",
      },
    ])

    assert.equal(leaveInResponse.status, 200)
    assert.equal(maskResponse.status, 200)
    assert.deepEqual(await leaveInResponse.json(), { ok: true })
    assert.deepEqual(await maskResponse.json(), { ok: true })
  }))

test("real-user current comparison is marked ephemeral in debug output", async () => {
  const { buildCurrentDebugLines } = await import("../src/lib/agent/compare/current-disabled")

  const lines = buildCurrentDebugLines(
    {
      sources: [],
      matchedProducts: [],
      routerDecision: {
        retrieval_mode: "hybrid",
        response_mode: "answer_direct",
      },
    } as never,
    { ephemeral: true },
  )

  assert.ok(lines.includes("ephemeral: yes"))
})

test("compare runner projects full CareBalance context for product traces", async () => {
  const {
    buildRoutineToolInputForCompare,
    projectFullCareBalanceContextForCompare,
    resolveCareBalanceTraceForCompare,
  } = await import("../src/lib/agent/compare/run-agentic-tool-loop")

  const context = projectFullCareBalanceContextForCompare({
    careBalance: {
      rows: [
        {
          category: "oil",
          recommendation: "decrease_frequency",
          primaryStatus: "overuse",
          recommendationStrength: "strong",
          currentFrequency: "daily_1x",
          cadencePolicy: { kind: "need_based_support", suggestedBand: "less_than_monthly" },
          decisiveReasonCodes: ["daily_oil_use"],
          contextReasonCodes: ["flat_hair", "buildup_pressure"],
          selectionHints: [{ code: "prefer_light_oil" }],
        },
        {
          category: "conditioner",
          recommendation: "add",
          primaryStatus: "gap",
          recommendationStrength: "moderate",
          currentFrequency: null,
          cadencePolicy: { kind: "match_wash_frequency", expected: "weekly_3_4x" },
          decisiveReasonCodes: ["conditioner_missing"],
          contextReasonCodes: ["dry_lengths"],
          selectionHints: [{ code: "prefer_detangling" }],
        },
      ],
    },
    legacyPlanComparison: {
      differences: [{ category: "oil" }, { category: "conditioner" }],
    },
    effectiveContext: {
      currentTurnFacts: [
        {
          kind: "routine_inventory",
          evidenceQuote: "Ich nutze Oel taeglich.",
        },
      ],
      conflicts: [
        {
          fieldPath: "profile.thickness",
          savedValue: "coarse",
          currentTurnValue: "fine",
          evidenceQuote: "Korrektur: eigentlich fein.",
        },
      ],
    },
  } as never)

  assert.equal(context?.mode, "production_decision_context")
  assert.deepEqual(
    context?.rows.map((row) => row.category),
    ["oil", "conditioner"],
  )
  assert.deepEqual(context?.rows[0]?.selection_hint_codes, ["prefer_light_oil"])
  assert.deepEqual(context?.rows[1]?.selection_hint_codes, ["prefer_detangling"])
  assert.equal(context?.comparison?.differences.length, 2)
  assert.equal(context?.current_turn_facts[0]?.evidence_quote, "Ich nutze Oel taeglich.")
  assert.deepEqual(context?.conflicts[0], {
    field_path: "profile.thickness",
    saved_value: "coarse",
    current_turn_value: "fine",
    evidence_quote: "Korrektur: eigentlich fein.",
  })

  assert.equal(
    resolveCareBalanceTraceForCompare({
      selectedProducts: null,
      toolCareBalanceTrace: null,
    }),
    null,
  )

  const routineInput = buildRoutineToolInputForCompare({
    input: {
      objective: "fix_routine",
      layer: "basics",
    },
    message: "Bewerte meine Routine neu.",
    context: {
      profile: null,
      routine_inventory: [
        {
          category: "oil",
          product_name: "Glanz Oel",
          frequency_range: "daily_1x",
        },
      ],
    } as never,
  })

  assert.equal(routineInput.routineItems?.[0]?.category, "oil")
  assert.equal(routineInput.routineItems?.[0]?.frequency_range, "daily_1x")
})

test("compare analysis snapshot surfaces compact CareBalance trace details", async () => {
  const { buildCareBalanceTraceDisplayData, buildCompareAnalysisSnapshot } =
    await importCompareLab()
  const careBalanceContext = {
    mode: "production_decision_context",
    authority: {
      product_truth: false,
      persistent_routine_storage: false,
      current_turn_category_decision: true,
      soft_product_ranking_hints: true,
    },
    rows: [
      {
        category: "oil",
        action: "decrease_frequency",
        status: "overuse",
        strength: "strong",
        current_frequency: "daily_1x",
        cadence_policy: { kind: "need_based_support", suggestedBand: "less_than_monthly" },
        reason_codes: ["daily_oil_use"],
        context_reason_codes: ["flat_hair", "buildup_pressure"],
        selection_hint_codes: ["prefer_light_oil"],
        usage_hint: "need_based_support:daily_1x:less_than_monthly",
        caveats: ["current_turn_category_decision"],
        authority: {
          product_truth: false,
          persistent_routine_storage: false,
          current_turn_category_decision: true,
          soft_product_ranking_hints: true,
        },
      },
    ],
    comparison: {
      differences: [{ category: "oil" }, { category: "conditioner" }],
    },
    current_turn_facts: [
      {
        kind: "routine_inventory",
        evidence_quote: "Ich nutze Oel taeglich.",
        source: "current_turn",
      },
    ],
    conflicts: [
      {
        field_path: "profile.thickness",
        saved_value: "coarse",
        current_turn_value: "fine",
        evidence_quote: "Korrektur: eigentlich fein.",
      },
    ],
  }

  const display = buildCareBalanceTraceDisplayData(careBalanceContext as never)
  assert.deepEqual(display.rows, [
    "oil: decrease_frequency | status=overuse | current=daily_1x | reasons=daily_oil_use | hints=prefer_light_oil",
  ])
  assert.equal(display.comparison, "old_vs_new: 2 Unterschiede")
  assert.deepEqual(display.currentTurnFacts, ["routine_inventory: Ich nutze Oel taeglich."])
  assert.deepEqual(display.conflicts, [
    "profile.thickness: saved=coarse -> current=fine (Korrektur: eigentlich fein.)",
  ])

  const snapshot = buildCompareAnalysisSnapshot({
    userLabel: "Lea",
    includeSystem: true,
    result: {
      prompt: "Welches Oel passt?",
      results: [
        {
          system: "tool_loop",
          answer: "Antwort",
          latency_ms: 10,
          debug_lines: [],
          matched_products: [],
          product_trace: {
            category: "oil",
            decision: "recommended",
            product_response_policy: "recommend",
            policy_reason: "Oel wird ueber Laengenbedarf und Gewicht entschieden.",
            profile_basis: [],
            category_guidance: "Oel ist hier ein Laengenhebel.",
            products: [],
            comparison_facts: null,
            care_balance_context: careBalanceContext as never,
            missing_info: [],
            unsupported_requested_signals: [],
          },
          route_trace: null,
          error: null,
        },
      ],
    },
  })

  assert.deepEqual(snapshot.results[0]?.care_balance, [
    "rows=1",
    "oil: decrease_frequency | status=overuse | current=daily_1x | reasons=daily_oil_use | hints=prefer_light_oil",
    "old_vs_new: 2 Unterschiede",
    "fact: routine_inventory: Ich nutze Oel taeglich.",
    "conflict: profile.thickness: saved=coarse -> current=fine (Korrektur: eigentlich fein.)",
  ])
})

test("compare analysis snapshot uses top-level CareBalance trace when no product trace exists", async () => {
  const { buildCompareAnalysisSnapshot } = await importCompareLab()
  const careBalanceContext = {
    mode: "production_decision_context",
    authority: {
      product_truth: false,
      persistent_routine_storage: false,
      current_turn_category_decision: true,
      soft_product_ranking_hints: true,
    },
    rows: [
      {
        category: "conditioner",
        action: "add",
        status: "missing_needed",
        strength: "high",
        current_frequency: null,
        cadence_policy: { kind: "match_wash_frequency", expected: "after_every_wash" },
        reason_codes: ["conditioner_missing"],
        context_reason_codes: ["dry_lengths"],
        selection_hint_codes: ["prefer_detangling"],
        usage_hint: "match_wash_frequency:after_every_wash",
        caveats: ["current_turn_category_decision"],
        authority: {
          product_truth: false,
          persistent_routine_storage: false,
          current_turn_category_decision: true,
          soft_product_ranking_hints: true,
        },
      },
    ],
    comparison: {
      differences: [{ category: "conditioner" }],
    },
    current_turn_facts: [],
    conflicts: [],
  }

  const snapshot = buildCompareAnalysisSnapshot({
    userLabel: "Lea",
    includeSystem: true,
    result: {
      prompt: "Bewerte meine Routine neu.",
      results: [
        {
          system: "tool_loop",
          answer: "Antwort",
          latency_ms: 10,
          debug_lines: [],
          matched_products: [],
          product_trace: null,
          care_balance_trace: careBalanceContext as never,
          route_trace: null,
          error: null,
        },
      ],
    },
  })

  assert.deepEqual(snapshot.results[0]?.care_balance, [
    "rows=1",
    "conditioner: add | status=missing_needed | current=none | reasons=conditioner_missing | hints=prefer_detangling",
    "old_vs_new: 1 Unterschiede",
  ])
})

test("compare analysis snapshot keeps turn CareBalance separate from final result", async () => {
  const { buildCompareAnalysisSnapshot } = await importCompareLab()
  const careBalanceContext = {
    mode: "production_decision_context",
    authority: {
      product_truth: false,
      persistent_routine_storage: false,
      current_turn_category_decision: true,
      soft_product_ranking_hints: true,
    },
    rows: [
      {
        category: "oil",
        action: "decrease_frequency",
        status: "overused",
        strength: "high",
        current_frequency: "daily_1x",
        cadence_policy: { kind: "need_based_support", suggestedBand: "less_than_monthly" },
        reason_codes: ["daily_oil_use"],
        context_reason_codes: [],
        selection_hint_codes: ["prefer_light_oil"],
        usage_hint: "need_based_support:daily_1x:less_than_monthly",
        caveats: ["current_turn_category_decision"],
        authority: {
          product_truth: false,
          persistent_routine_storage: false,
          current_turn_category_decision: true,
          soft_product_ranking_hints: true,
        },
      },
    ],
    comparison: null,
    current_turn_facts: [],
    conflicts: [],
  }

  const snapshot = buildCompareAnalysisSnapshot({
    userLabel: "Lea",
    includeSystem: true,
    result: {
      prompt: "Mehrturn",
      turns: ["Turn 1", "Turn 2"],
      results: [
        {
          system: "tool_loop",
          answer: "Finale Antwort ohne neues Tool",
          latency_ms: 10,
          debug_lines: [],
          matched_products: [],
          product_trace: null,
          care_balance_trace: null,
          route_trace: null,
          error: null,
          turns: [
            {
              turn: 1,
              prompt: "Turn 1",
              answer: "Antwort 1",
              latency_ms: 5,
              debug_lines: [],
              matched_products: [],
              product_trace: null,
              care_balance_trace: careBalanceContext as never,
              error: null,
            },
            {
              turn: 2,
              prompt: "Turn 2",
              answer: "Antwort 2",
              latency_ms: 5,
              debug_lines: [],
              matched_products: [],
              product_trace: null,
              care_balance_trace: null,
              error: null,
            },
          ],
        },
      ],
    },
  })

  assert.deepEqual(snapshot.results[0]?.care_balance, [])
  assert.deepEqual(snapshot.results[0]?.turns[0]?.care_balance, [
    "rows=1",
    "oil: decrease_frequency | status=overused | current=daily_1x | reasons=daily_oil_use | hints=prefer_light_oil",
  ])
  assert.deepEqual(snapshot.results[0]?.turns[1]?.care_balance, [])
})
