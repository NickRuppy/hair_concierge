import { expect, test } from "@playwright/test"
import {
  activateRoutineTopics,
  buildRoutinePlan,
  buildRoutineRetrievalSubqueries,
  deriveRoutineContext,
  detectStylingProductKind,
  getRoutineAutofillSlots,
} from "../src/lib/routines/planner"
import { evaluateRoute } from "../src/lib/rag/router"
import { buildSystemPrompt } from "../src/lib/rag/synthesizer"
import type { ClassificationResult, ContentChunk, HairProfile } from "../src/lib/types"

function createProfile(overrides: Partial<HairProfile> = {}): HairProfile {
  return {
    id: "profile-1",
    user_id: "user-1",
    hair_texture: "wavy",
    thickness: "fine",
    density: "medium",
    concerns: [],
    products_used: null,
    wash_frequency: "every_2_3_days",
    heat_styling: "never",
    styling_tools: [],
    goals: [],
    cuticle_condition: "smooth",
    protein_moisture_balance: "stretches_bounces",
    scalp_type: "balanced",
    scalp_condition: "none",
    chemical_treatment: ["natural"],
    desired_volume: "balanced",
    post_wash_actions: ["air_dry"],
    routine_preference: "advanced",
    current_routine_products: ["shampoo", "conditioner"],
    mechanical_stress_factors: [],
    towel_material: null,
    towel_technique: null,
    drying_method: [],
    brush_type: null,
    night_protection: [],
    uses_heat_protection: false,
    additional_notes: null,
    conversation_memory: null,
    created_at: "2026-04-09T00:00:00.000Z",
    updated_at: "2026-04-09T00:00:00.000Z",
    ...overrides,
  }
}

function createRoutineClassification(
  overrides: Partial<ClassificationResult> = {}
): ClassificationResult {
  return {
    intent: "routine_help",
    product_category: "routine",
    complexity: "multi_constraint",
    needs_clarification: false,
    retrieval_mode: "hybrid",
    normalized_filters: {
      problem: null,
      duration: null,
      products_tried: null,
      routine: null,
      special_circumstances: null,
    },
    router_confidence: 0.92,
    ...overrides,
  }
}

function createChunk(overrides: Partial<ContentChunk> = {}): ContentChunk {
  return {
    id: "chunk-1",
    source_type: "book",
    source_name: "Routine Basics",
    chunk_index: 0,
    content: "Routine content",
    token_count: 12,
    metadata: {},
    created_at: "2026-04-09T00:00:00.000Z",
    ...overrides,
  }
}

test.describe("Routine planner", () => {
  test("wavy frizz routine stays structure-first and adds one lightweight finish slot", () => {
    const profile = createProfile({
      concerns: ["frizz"],
      goals: ["less_frizz"],
      current_routine_products: ["shampoo", "conditioner"],
    })

    const plan = buildRoutinePlan(profile, "Welche Routine empfiehlst du gegen Frizz?")
    const activeTopics = plan.active_topics.map((topic) => topic.label)
    const baseSlots = plan.sections.find((section) => section.phase === "base_wash")?.slots ?? []
    const maintenanceSlots = plan.sections.find((section) => section.phase === "maintenance")?.slots ?? []

    expect(activeTopics).toContain("Locken & Wellen")
    expect(activeTopics).toContain("Lockenrefresh")
    expect(activeTopics).not.toContain("Tiefenreinigung")
    expect(activeTopics).not.toContain("Hair Oiling")

    expect(baseSlots.find((slot) => slot.label === "Shampoo")?.action).toBe("keep")
    expect(baseSlots.find((slot) => slot.label === "Conditioner")?.action).toBe("keep")

    const leaveInSlot = maintenanceSlots.find((slot) => slot.label === "Leave-in / Finish")
    expect(leaveInSlot?.action).toBe("add")
    expect(leaveInSlot?.product_linkable).toBe(true)
  })

  test("curly hair with between-wash days activates routine locken and lockenrefresh", () => {
    const topics = activateRoutineTopics(
      createProfile({
        hair_texture: "curly",
        current_routine_products: ["shampoo", "conditioner", "leave_in"],
      }),
      "Meine Locken sehen am naechsten Tag schnell platt aus."
    )

    expect(topics.map((topic) => topic.id)).toEqual(
      expect.arrayContaining(["routine_locken", "lockenrefresh"])
    )
  })

  test("oily scalp or heavy inventory activates tiefenreinigung", () => {
    const topics = activateRoutineTopics(
      createProfile({
        scalp_type: "oily",
        current_routine_products: ["shampoo", "conditioner", "leave_in", "oil"],
      }),
      "Meine Routine fuehlt sich schnell beschwert an."
    )

    expect(topics.map((topic) => topic.id)).toContain("tiefenreinigung")
  })

  test("heavy styling or volume signals can proactively surface tiefenreinigung", () => {
    const topics = activateRoutineTopics(
      createProfile({
        scalp_type: "balanced",
        goals: ["volume"],
        current_routine_products: ["shampoo", "conditioner"],
        products_used: "Ich nutze oft Trockenshampoo, Gel und ein Silikon-Serum.",
      }),
      "Meine Haare fuehlen sich schnell ueberlagert an und ich will mehr Volumen."
    )

    expect(topics.map((topic) => topic.id)).toContain("tiefenreinigung")
  })

  test("damage signals activate bond builder and upgrade the conditioner slot", () => {
    const profile = createProfile({
      concerns: ["hair_damage"],
      cuticle_condition: "rough",
      chemical_treatment: ["bleached"],
      current_routine_products: ["shampoo", "conditioner"],
      protein_moisture_balance: "stretches_stays",
    })

    const plan = buildRoutinePlan(profile, "Meine Haare sind blondiert und brechen schnell.")
    const activeTopicIds = plan.active_topics.map((topic) => topic.id)
    const conditionerSlot = plan.sections
      .flatMap((section) => section.slots)
      .find((slot) => slot.label === "Conditioner")

    expect(activeTopicIds).toContain("bond_builder")
    expect(conditionerSlot?.action).toBe("upgrade")
  })

  test("existing leave-in can be adjusted instead of added", () => {
    const profile = createProfile({
      concerns: ["frizz"],
      current_routine_products: ["shampoo", "conditioner", "leave_in"],
    })

    const plan = buildRoutinePlan(profile, "Ich brauche eine Routine fuer weniger Frizz.")
    const leaveInSlot = plan.sections
      .flatMap((section) => section.slots)
      .find((slot) => slot.label === "Leave-in / Finish")

    expect(leaveInSlot?.action).toBe("adjust")
  })

  test("dryness with low oil-risk activates hair oiling", () => {
    const topics = activateRoutineTopics(
      createProfile({
        hair_texture: "straight",
        thickness: "normal",
        density: "low",
        concerns: ["dryness"],
        cuticle_condition: "rough",
        current_routine_products: ["shampoo", "conditioner"],
      }),
      "Ich suche eine Routine fuer trockene Laengen."
    )

    expect(topics.map((topic) => topic.id)).toContain("hair_oiling")
  })

  test("oily scalp does not activate hair oiling", () => {
    const profile = createProfile({
      scalp_type: "oily",
      concerns: ["oily_scalp"],
      current_routine_products: ["shampoo", "conditioner"],
    })

    const topics = activateRoutineTopics(
      profile,
      "Meine Kopfhaut fettet schnell nach. Welche Routine passt?"
    )
    expect(topics.map((topic) => topic.id)).not.toContain("hair_oiling")

    const plan = buildRoutinePlan(profile, "Meine Kopfhaut fettet schnell nach. Welche Routine passt?")
    const oilSlot = plan.sections
      .flatMap((section) => section.slots)
      .find((slot) => slot.id === "occasional-oil")
    expect(oilSlot).toBeUndefined()
  })

  test("healthy_scalp goal alone does not activate hair oiling", () => {
    const topics = activateRoutineTopics(
      createProfile({
        scalp_type: "oily",
        goals: ["healthy_scalp"],
        current_routine_products: ["shampoo", "conditioner"],
      }),
      "Welche Routine passt zu mir?"
    )

    expect(topics.map((topic) => topic.id)).not.toContain("hair_oiling")
  })

  test("dandruff still activates hair oiling via scalp fit", () => {
    const topics = activateRoutineTopics(
      createProfile({
        scalp_condition: "dandruff",
        current_routine_products: ["shampoo", "conditioner"],
      }),
      "Welche Routine passt zu mir?"
    )

    expect(topics.map((topic) => topic.id)).toContain("hair_oiling")
  })

  test("active oiling slot includes wash-out rationale and essential oil caveat", () => {
    const plan = buildRoutinePlan(
      createProfile({
        thickness: "normal",
        density: "low",
        concerns: ["dryness"],
        cuticle_condition: "rough",
        current_routine_products: ["shampoo", "conditioner"],
      }),
      "Ich suche eine Routine fuer trockene Laengen."
    )

    const oilSlot = plan.sections
      .flatMap((section) => section.slots)
      .find((slot) => slot.id === "occasional-oil")

    expect(oilSlot?.action).toBe("add")
    expect(oilSlot?.rationale.some((line) => line.includes("Shampoo zuerst auf trockenes Haar"))).toBe(true)
    expect(oilSlot?.caveats).toContain("Aetherische Oele (z.B. Rosmarin, Teebaum) nie pur auftragen — immer mit einem Basisoel verduennen.")
  })

  test("avoid oiling slot does not include wash-out rationale or essential oil caveat", () => {
    const plan = buildRoutinePlan(
      createProfile({
        current_routine_products: ["shampoo", "conditioner", "oil"],
      }),
      "Welche Routine passt zu mir?"
    )

    const oilSlot = plan.sections
      .flatMap((section) => section.slots)
      .find((slot) => slot.id === "occasional-oil")

    expect(oilSlot?.action).toBe("avoid")
    expect(oilSlot?.rationale.every((line) => !line.includes("Shampoo zuerst auf trockenes Haar"))).toBe(true)
    expect(oilSlot?.caveats).not.toContain("Aetherische Oele (z.B. Rosmarin, Teebaum) nie pur auftragen — immer mit einem Basisoel verduennen.")
  })

  test("irritated scalp gets both irritation caveat and essential oil caveat on active oiling", () => {
    const plan = buildRoutinePlan(
      createProfile({
        thickness: "normal",
        density: "low",
        scalp_type: "dry",
        scalp_condition: "irritated",
        concerns: ["dryness"],
        cuticle_condition: "rough",
        current_routine_products: ["shampoo", "conditioner"],
      }),
      "Ich suche eine Routine fuer trockene Laengen."
    )

    const oilSlot = plan.sections
      .flatMap((section) => section.slots)
      .find((slot) => slot.id === "occasional-oil")

    expect(oilSlot?.caveats).toHaveLength(2)
    expect(oilSlot?.caveats).toContain("Bei stark gereizter Kopfhaut eher sanft bleiben und die Routine nicht ueberladen.")
    expect(oilSlot?.caveats).toContain("Aetherische Oele (z.B. Rosmarin, Teebaum) nie pur auftragen — immer mit einem Basisoel verduennen.")
  })

  test("leave-in activates independently of hair oiling", () => {
    const plan = buildRoutinePlan(
      createProfile({
        concerns: ["frizz"],
        goals: ["less_frizz"],
        scalp_type: "balanced",
        current_routine_products: ["shampoo", "conditioner"],
      }),
      "Welche Routine passt zu mir?"
    )

    const leaveInSlot = plan.sections
      .flatMap((section) => section.slots)
      .find((slot) => slot.label === "Leave-in / Finish")

    expect(leaveInSlot).toBeDefined()
    expect(leaveInSlot?.action).toBe("add")
    expect(plan.active_topics.map((topic) => topic.id)).not.toContain("hair_oiling")
  })

  test("unnecessary mask steps can still be deprioritized", () => {
    const maskPlan = buildRoutinePlan(
      createProfile({
        current_routine_products: ["shampoo", "conditioner", "mask"],
      }),
      "Welche Routine passt zu mir?"
    )
    const maskSlot = maskPlan.sections
      .flatMap((section) => section.slots)
      .find((slot) => slot.label === "Maske / Kur")

    expect(maskSlot?.action).toBe("avoid")
  })

  test("router clarifies when the routine frame is still missing", () => {
    const routerDecision = evaluateRoute(
      createRoutineClassification({ router_confidence: 0.91 }),
      [],
      createProfile({
        hair_texture: null,
        concerns: [],
        goals: [],
        wash_frequency: null,
        scalp_type: null,
        current_routine_products: [],
      }),
      "Welche Routine passt zu mir?"
    )

    expect(routerDecision.needs_clarification).toBe(true)
    expect(routerDecision.policy_overrides).toContain("missing_routine_frame")
  })

  test("router still clarifies when organizer and cadence exist but inventory is missing", () => {
    const routerDecision = evaluateRoute(
      createRoutineClassification(),
      [],
      createProfile({
        concerns: ["frizz"],
        goals: ["less_frizz"],
        wash_frequency: "every_2_3_days",
        current_routine_products: [],
        products_used: null,
      }),
      "Welche Routine passt zu mir?"
    )

    expect(routerDecision.needs_clarification).toBe(true)
    expect(routerDecision.policy_overrides).toContain("missing_routine_frame")
  })

  test("router can proceed once organizer, cadence, and inventory are available from the profile", () => {
    const routerDecision = evaluateRoute(
      createRoutineClassification(),
      [],
      createProfile({
        concerns: ["frizz"],
        goals: ["less_frizz"],
        wash_frequency: "every_2_3_days",
        current_routine_products: ["shampoo", "conditioner"],
      }),
      "Welche Routine passt zu mir?"
    )

    expect(routerDecision.needs_clarification).toBe(false)
    expect(routerDecision.policy_overrides).not.toContain("missing_routine_frame")
  })

  test("retrieval hints keep exact topic names and autofill only add or upgrade slots", () => {
    const plan = buildRoutinePlan(
      createProfile({
        concerns: ["frizz"],
        goals: ["less_frizz"],
        current_routine_products: ["shampoo", "conditioner"],
      }),
      "Welche Routine empfiehlst du fuer welliges Haar mit Frizz?"
    )

    const subqueries = buildRoutineRetrievalSubqueries(
      "Welche Routine empfiehlst du fuer welliges Haar mit Frizz?",
      plan
    )
    const autofillSlots = getRoutineAutofillSlots(plan)

    expect(subqueries.some((query) => query.includes("Locken & Wellen"))).toBe(true)
    expect(autofillSlots.length).toBeGreaterThan(0)
    expect(autofillSlots.every((slot) => slot.action === "add" || slot.action === "upgrade")).toBe(true)
  })

  test("routine context keeps organizer and cadence signals independent from routine_preference", () => {
    const context = deriveRoutineContext(
      createProfile({
        concerns: ["frizz"],
        goals: ["less_frizz"],
        routine_preference: "minimal",
      }),
      "Welche Routine passt zu mir?"
    )

    expect(context.organizer_complete).toBe(true)
    expect(context.cadence_complete).toBe(true)
    expect(context.primary_focuses.map((focus) => focus.label)).not.toContain("minimal")
  })

  test.describe("detectStylingProductKind", () => {
    test("detects Gel from free text", () => {
      expect(detectStylingProductKind("Balea Styling Gel")).toBe("Gel")
    })

    test("detects Mousse/Schaum", () => {
      expect(detectStylingProductKind("Ich nutze einen Locken-Schaum von Schwarzkopf")).toBe("Mousse")
      expect(detectStylingProductKind("Mousse von Cantu")).toBe("Mousse")
    })

    test("detects Lockencreme before generic Creme", () => {
      expect(detectStylingProductKind("Lockencreme von Cantu und Gel")).toBe("Lockencreme")
      expect(detectStylingProductKind("Curl Cream plus Gel")).toBe("Lockencreme")
    })

    test("detects generic Stylingcreme", () => {
      expect(detectStylingProductKind("eine Creme fuer die Haare")).toBe("Stylingcreme")
    })

    test("returns null for empty or no-match input", () => {
      expect(detectStylingProductKind(null)).toBeNull()
      expect(detectStylingProductKind("")).toBeNull()
      expect(detectStylingProductKind("ich benutze nichts besonderes")).toBeNull()
    })

    test("handles mixed casing and diacritics", () => {
      expect(detectStylingProductKind("STYLING GEL von Wella")).toBe("Gel")
      expect(detectStylingProductKind("Schäum-Mousse")).toBe("Mousse")
    })

    test("matches German compound words", () => {
      expect(detectStylingProductKind("Stylinggel von dm")).toBe("Gel")
      expect(detectStylingProductKind("Lockenschaum")).toBe("Mousse")
    })

    test("does not match gel inside gelb", () => {
      expect(detectStylingProductKind("gelbliches Serum")).toBeNull()
    })
  })

  test("refresh slot echoes product kind from products_used", () => {
    const plan = buildRoutinePlan(
      createProfile({
        hair_texture: "curly",
        products_used: "Balea Styling Gel",
        current_routine_products: ["shampoo", "conditioner", "leave_in"],
      }),
      "Welche Routine passt zu mir?"
    )

    const refreshSlot = plan.sections
      .flatMap((section) => section.slots)
      .find((slot) => slot.id === "maintenance-refresh")

    expect(refreshSlot).toBeDefined()
    expect(refreshSlot?.rationale.some((line) => line.includes("dein Gel vom letzten Waschtag"))).toBe(true)
  })

  test("refresh slot uses generic product echo when products_used has no styling match", () => {
    const plan = buildRoutinePlan(
      createProfile({
        hair_texture: "curly",
        products_used: null,
        current_routine_products: ["shampoo", "conditioner", "leave_in"],
      }),
      "Welche Routine passt zu mir?"
    )

    const refreshSlot = plan.sections
      .flatMap((section) => section.slots)
      .find((slot) => slot.id === "maintenance-refresh")

    expect(refreshSlot?.rationale.some((line) => line.includes("dasselbe Styling-Produkt vom letzten Waschtag"))).toBe(true)
  })

  test("refresh slot adds leave-in cross-reference for dry/damaged hair", () => {
    const plan = buildRoutinePlan(
      createProfile({
        hair_texture: "curly",
        concerns: ["dryness"],
        cuticle_condition: "rough",
        current_routine_products: ["shampoo", "conditioner", "leave_in"],
      }),
      "Welche Routine passt zu mir?"
    )

    const refreshSlot = plan.sections
      .flatMap((section) => section.slots)
      .find((slot) => slot.id === "maintenance-refresh")

    expect(refreshSlot?.rationale.some((line) => line.includes("Leave-In"))).toBe(true)
    expect(refreshSlot?.rationale.some((line) => line.includes("trainiert langfristig"))).toBe(true)
  })

  test("refresh slot adds fine-hair caveat when thickness is fine and dryness signals present", () => {
    const plan = buildRoutinePlan(
      createProfile({
        hair_texture: "curly",
        thickness: "fine",
        concerns: ["dryness"],
        current_routine_products: ["shampoo", "conditioner", "leave_in"],
      }),
      "Welche Routine passt zu mir?"
    )

    const refreshSlot = plan.sections
      .flatMap((section) => section.slots)
      .find((slot) => slot.id === "maintenance-refresh")

    expect(refreshSlot?.caveats.some((line) => line.includes("feinem Haar"))).toBe(true)
  })

  test("refresh slot has no leave-in cross-reference when no dryness signals", () => {
    const plan = buildRoutinePlan(
      createProfile({
        hair_texture: "curly",
        concerns: [],
        goals: [],
        cuticle_condition: "smooth",
        chemical_treatment: ["natural"],
        current_routine_products: ["shampoo", "conditioner", "leave_in"],
      }),
      "Welche Routine passt zu mir?"
    )

    const refreshSlot = plan.sections
      .flatMap((section) => section.slots)
      .find((slot) => slot.id === "maintenance-refresh")

    expect(refreshSlot?.rationale.every((line) => !line.includes("Leave-In"))).toBe(true)
    expect(refreshSlot?.caveats).toHaveLength(0)
  })

  test("refresh slot includes duration in cadence", () => {
    const plan = buildRoutinePlan(
      createProfile({
        hair_texture: "curly",
        current_routine_products: ["shampoo", "conditioner", "leave_in"],
      }),
      "Welche Routine passt zu mir?"
    )

    const refreshSlot = plan.sections
      .flatMap((section) => section.slots)
      .find((slot) => slot.id === "maintenance-refresh")

    expect(refreshSlot?.cadence).toContain("ca. 10 Min.")
  })

  test("chemical treatment alone triggers leave-in cross-reference on refresh", () => {
    const plan = buildRoutinePlan(
      createProfile({
        hair_texture: "curly",
        thickness: "normal",
        chemical_treatment: ["colored"],
        cuticle_condition: "smooth",
        concerns: [],
        goals: [],
        current_routine_products: ["shampoo", "conditioner", "leave_in"],
      }),
      "Welche Routine passt zu mir?"
    )

    const refreshSlot = plan.sections
      .flatMap((section) => section.slots)
      .find((slot) => slot.id === "maintenance-refresh")

    expect(refreshSlot?.rationale.some((line) => line.includes("Leave-In"))).toBe(true)
    expect(refreshSlot?.caveats).toHaveLength(0)
  })

  test("routine system prompt includes the plan, softer avoid wording, and reasoning-first product instructions", () => {
    const profile = createProfile({
      current_routine_products: ["shampoo", "conditioner", "mask"],
      routine_preference: "advanced",
    })
    const routinePlan = buildRoutinePlan(profile, "Welche Routine passt zu mir?")

    const prompt = buildSystemPrompt(
      profile,
      [createChunk()],
      [],
      "routine",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      routinePlan,
      null,
      undefined,
    )

    expect(prompt).toContain("Routine-Plan:")
    expect(prompt).toContain("Maske / Kur: gerade eher weniger geeignet")
    expect(prompt).toContain("Begruende pro relevantem Slot erst kurz den Fit zum Profil")
    expect(prompt).toContain("ordne sie direkt dem gerade erklaerten Slot")
    expect(prompt).not.toContain("Routine-Detailgrad")
  })

  test.describe("Bond builder logic", () => {
    test("colored alone does NOT activate bond builder", () => {
      const topics = activateRoutineTopics(
        createProfile({
          chemical_treatment: ["colored"],
          cuticle_condition: "smooth",
          concerns: [],
        }),
        "Welche Routine passt zu mir?"
      )

      expect(topics.map((topic) => topic.id)).not.toContain("bond_builder")
    })

    test("colored + rough cuticle activates bond builder", () => {
      const topics = activateRoutineTopics(
        createProfile({
          chemical_treatment: ["colored"],
          cuticle_condition: "rough",
          concerns: [],
        }),
        "Welche Routine passt zu mir?"
      )

      expect(topics.map((topic) => topic.id)).toContain("bond_builder")
    })

    test("heat damage without protection activates bond builder", () => {
      const topics = activateRoutineTopics(
        createProfile({
          heat_styling: "daily",
          uses_heat_protection: false,
          cuticle_condition: "smooth",
          concerns: [],
          chemical_treatment: ["natural"],
        }),
        "Welche Routine passt zu mir?"
      )

      expect(topics.map((topic) => topic.id)).toContain("bond_builder")
    })

    test("explicit request without damage signals adds optional caveat", () => {
      const plan = buildRoutinePlan(
        createProfile({
          cuticle_condition: "smooth",
          chemical_treatment: ["natural"],
          concerns: [],
          heat_styling: "never",
        }),
        "Was ist ein Bond Builder?"
      )

      const bondSlot = plan.sections
        .flatMap((section) => section.slots)
        .find((slot) => slot.id === "occasional-bond-builder")

      expect(bondSlot).toBeDefined()
      expect(bondSlot?.caveats.some((line) => line.includes("eher optional"))).toBe(true)
    })

    test("snaps = severe tier with pro note", () => {
      const plan = buildRoutinePlan(
        createProfile({
          protein_moisture_balance: "snaps",
          chemical_treatment: ["bleached"],
          cuticle_condition: "rough",
          concerns: ["hair_damage"],
        }),
        "Welche Routine passt zu mir?"
      )

      const bondSlot = plan.sections
        .flatMap((section) => section.slots)
        .find((slot) => slot.id === "occasional-bond-builder")

      expect(bondSlot?.rationale.some((line) => line.includes("Kombination aus K18 und Olaplex"))).toBe(true)
      expect(bondSlot?.caveats.some((line) => line.includes("professionelles Beratungsgespraech"))).toBe(true)
    })

    test("moderate + chemical treatment leans Olaplex", () => {
      const plan = buildRoutinePlan(
        createProfile({
          chemical_treatment: ["colored"],
          cuticle_condition: "rough",
          concerns: [],
          protein_moisture_balance: "stretches_bounces",
        }),
        "Welche Routine passt zu mir?"
      )

      const bondSlot = plan.sections
        .flatMap((section) => section.slots)
        .find((slot) => slot.id === "occasional-bond-builder")

      expect(bondSlot?.rationale.some((line) => line.includes("Olaplex (Querverbindungen)"))).toBe(true)
    })

    test("moderate + no chemical treatment leans K18", () => {
      const plan = buildRoutinePlan(
        createProfile({
          chemical_treatment: ["natural"],
          cuticle_condition: "rough",
          concerns: ["hair_damage"],
          protein_moisture_balance: "stretches_bounces",
        }),
        "Welche Routine passt zu mir?"
      )

      const bondSlot = plan.sections
        .flatMap((section) => section.slots)
        .find((slot) => slot.id === "occasional-bond-builder")

      expect(bondSlot?.rationale.some((line) => line.includes("K18 (Laengsverbindungen)"))).toBe(true)
    })

    test("bond builder co-activates tiefenreinigung", () => {
      const topics = activateRoutineTopics(
        createProfile({
          cuticle_condition: "rough",
          concerns: ["hair_damage"],
          chemical_treatment: ["bleached"],
        }),
        "Welche Routine passt zu mir?"
      )

      const topicIds = topics.map((topic) => topic.id)
      expect(topicIds).toContain("bond_builder")
      expect(topicIds).toContain("tiefenreinigung")

      const tiefenreinigung = topics.find((topic) => topic.id === "tiefenreinigung")
      expect(tiefenreinigung?.reason).toContain("Rueckstaende")
    })

    test("repair fatigue caveat is always present on bond builder slot", () => {
      const plan = buildRoutinePlan(
        createProfile({
          cuticle_condition: "rough",
          concerns: ["hair_damage"],
        }),
        "Welche Routine passt zu mir?"
      )

      const bondSlot = plan.sections
        .flatMap((section) => section.slots)
        .find((slot) => slot.id === "occasional-bond-builder")

      expect(bondSlot?.caveats.some((line) => line.includes("steif und sproede"))).toBe(true)
    })

    test("protein interaction caveat varies by balance", () => {
      const stretchesPlan = buildRoutinePlan(
        createProfile({
          cuticle_condition: "rough",
          concerns: ["hair_damage"],
          protein_moisture_balance: "stretches_stays",
        }),
        "Welche Routine passt zu mir?"
      )

      const stretchesSlot = stretchesPlan.sections
        .flatMap((section) => section.slots)
        .find((slot) => slot.id === "occasional-bond-builder")

      expect(stretchesSlot?.caveats.some((line) => line.includes("parallel laufen"))).toBe(true)

      const balancedPlan = buildRoutinePlan(
        createProfile({
          cuticle_condition: "rough",
          concerns: ["hair_damage"],
          protein_moisture_balance: "stretches_bounces",
        }),
        "Welche Routine passt zu mir?"
      )

      const balancedSlot = balancedPlan.sections
        .flatMap((section) => section.slots)
        .find((slot) => slot.id === "occasional-bond-builder")

      expect(balancedSlot?.caveats.some((line) => line.includes("Feuchtigkeit reicht"))).toBe(true)
    })

    test("system prompt includes bond builder synth rules when bond_builder is active", () => {
      const profile = createProfile({
        cuticle_condition: "rough",
        concerns: ["hair_damage"],
        chemical_treatment: ["bleached"],
      })
      const routinePlan = buildRoutinePlan(profile, "Welche Routine passt zu mir?")

      const prompt = buildSystemPrompt(
        profile,
        [createChunk()],
        [],
        "routine",
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        routinePlan,
        null,
        undefined,
      )

      expect(prompt).toContain("nachgewiesener Bond-Technologie")
      expect(prompt).toContain("Laengs- und Querverbindungen")
    })
  })
})
