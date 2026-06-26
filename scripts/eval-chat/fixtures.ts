/**
 * Chat Evaluation Harness — Test Scenario Fixtures
 */

import type { EvalScenario, HairProfileOverrides, RoutineInventorySeed } from "./types"

const FULL_PROFILE: HairProfileOverrides = {
  hair_texture: "wavy",
  thickness: "fine",
  density: "medium",
  concerns: ["frizz"],
  protein_moisture_balance: "stretches_bounces",
  cuticle_condition: "slightly_rough",
  scalp_type: "balanced",
  scalp_condition: "none",
  chemical_treatment: ["colored"],
  heat_styling: "rarely",
  drying_method: "air_dry",
  towel_technique: "rough_rubbing",
  brush_type: ["paddle"],
  night_protection: [],
  goals: ["shine"],
  onboarding_completed: true,
}

const FULL_ROUTINE_INVENTORY: RoutineInventorySeed[] = [
  {
    category: "shampoo",
    product_name: "Eval Shampoo",
    frequency_range: "weekly_3_4x",
  },
  {
    category: "conditioner",
    product_name: "Eval Conditioner",
    frequency_range: "weekly_3_4x",
  },
]

export const SCENARIOS: EvalScenario[] = [
  // ── Regression: ÖWC follow-up ──────────────────────────────────────────
  {
    id: "owc-followup",
    name: "ÖWC follow-up (regression)",
    description:
      "Multi-turn: context-setting message then short follow-up 'und owc testen?' — must not misclassify as product query",
    ci_smoke: true,
    hair_profile: { ...FULL_PROFILE },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Welche Pflegeroutine empfiehlst du für welliges Haar?",
      },
      {
        message: "und owc testen?",
        metadata: {
          intent: ["hair_care_advice", "followup", "routine_help", "product_recommendation"],
          policy_overrides_exclude: ["category_product_mode"],
        },
        content: {
          must_be_german: true,
        },
        judge: {
          expected_behavior:
            "Should explain the OWC (Öl-Wasser-Conditioner) method as a pre-wash protection technique. Must NOT describe it as a post-wash layering method. Must not be classified as a product recommendation.",
        },
      },
    ],
  },

  // ── CWC/OWC comparison ──────────────────────────────────────────────────
  {
    id: "cwc-owc-comparison",
    name: "CWC vs OWC comparison",
    description: "Direct comparison question — should discuss both methods",
    hair_profile: { ...FULL_PROFILE },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Was ist der Unterschied zwischen CWC und OWC?",
        metadata: {
          intent: ["hair_care_advice", "routine_help", "product_recommendation"],
        },
        content: {
          must_be_german: true,
          required_keywords: ["CWC", "OWC"],
        },
        judge: {
          expected_behavior:
            "Should explain both CWC (Conditioner-Wash-Conditioner) and OWC (Öl-Wasser-Conditioner) methods, highlighting differences in application order and suitability by hair type.",
        },
      },
    ],
  },

  // ── Mandatory profile gates ─────────────────────────────────────────────
  {
    id: "shampoo-missing-profile",
    name: "Shampoo request with missing thickness",
    description: "Profile lacks thickness — must trigger clarification",
    ci_smoke: true,
    hair_profile: { ...FULL_PROFILE, thickness: null, scalp_type: null },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Welches Shampoo empfiehlst du mir?",
        metadata: {
          response_mode: "clarify_only",
          policy_overrides_include: ["missing_shampoo_profile"],
        },
        content: {
          must_be_german: true,
        },
        judge: {
          expected_behavior:
            "Must NOT recommend specific shampoo products. Must ask clarifying questions about hair thickness or scalp type since the profile is incomplete.",
        },
      },
    ],
  },

  {
    id: "conditioner-missing-profile",
    name: "Conditioner request with missing protein/moisture balance",
    description: "Profile lacks protein_moisture_balance — must trigger clarification",
    hair_profile: { ...FULL_PROFILE, protein_moisture_balance: null },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Kannst du mir einen guten Conditioner empfehlen?",
        metadata: {
          response_mode: "clarify_only",
          policy_overrides_include: ["missing_conditioner_profile"],
        },
        content: { must_be_german: true },
        judge: {
          expected_behavior:
            "Must NOT recommend specific conditioner products. Must ask about the user's protein/moisture balance (e.g. Zugtest) since the profile is incomplete.",
        },
      },
    ],
  },

  {
    id: "leave-in-missing-profile",
    name: "Leave-in request with missing fields",
    description: "Profile lacks texture + density — must trigger clarification",
    hair_profile: { ...FULL_PROFILE, hair_texture: null, density: null },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Ich suche ein Leave-in Produkt",
        metadata: {
          response_mode: "clarify_only",
          policy_overrides_include: ["missing_leave_in_profile"],
        },
        content: { must_be_german: true },
        judge: {
          expected_behavior:
            "Must NOT recommend leave-in products. Must ask about missing profile fields (hair texture, density).",
        },
      },
    ],
  },

  {
    id: "oil-missing-profile",
    name: "Oil request with missing thickness",
    description: "Profile lacks thickness — must trigger clarification",
    hair_profile: { ...FULL_PROFILE, thickness: null },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Welches Haaröl passt zu mir?",
        metadata: {
          response_mode: "clarify_only",
          policy_overrides_include: ["missing_oil_profile"],
        },
        content: { must_be_german: true },
        judge: {
          expected_behavior:
            "Must NOT recommend oil products. Must ask about hair thickness since the profile is incomplete.",
        },
      },
    ],
  },

  // ── Vague first message ──────────────────────────────────────────────────
  {
    id: "vague-first-message",
    name: "Vague opening message",
    description: "Underdefined message should trigger clarification",
    hair_profile: { ...FULL_PROFILE },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Meine Haare sind trocken",
        metadata: {
          response_mode: ["recommend_and_refine", "answer_direct"],
        },
        content: {
          must_be_german: true,
          min_length: 50,
        },
        judge: {
          expected_behavior:
            "Should give a substantive answer. If products are available, may include tentative recommendations alongside follow-up questions.",
        },
      },
    ],
  },

  // ── FAQ-style direct answer ──────────────────────────────────────────────
  {
    id: "simple-faq",
    name: "Simple FAQ question",
    description: "Straightforward question — should answer directly",
    hair_profile: { ...FULL_PROFILE },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Wie oft sollte ich meine Haare waschen?",
        metadata: {
          retrieval_mode: ["agent_v2_responses", "faq", "hybrid"],
        },
        content: {
          must_be_german: true,
          min_length: 100,
        },
        judge: {
          expected_behavior:
            "Should give a direct answer about wash frequency. May mention it depends on hair/scalp type.",
        },
      },
    ],
  },

  // ── Medical redirect ─────────────────────────────────────────────────────
  {
    id: "medical-redirect",
    name: "Medical concern redirect",
    description: "Severe hair loss should mention dermatologist",
    ci_smoke: true,
    hair_profile: { ...FULL_PROFILE },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Ich verliere extrem viele Haare seit Wochen und es wird nicht besser",
        content: {
          must_be_german: true,
        },
        judge: {
          expected_behavior:
            "MUST recommend consulting a dermatologist (Hautarzt/Dermatologe) for extreme hair loss. Should NOT recommend products as the primary solution. If asking clarifying questions first, must still flag that professional medical evaluation is recommended.",
        },
      },
    ],
  },

  // ── Bond builder for damage ──────────────────────────────────────────────
  {
    id: "bond-builder-damage",
    name: "Bond builder for damaged hair",
    description: "Damage profile should lead to bond builder discussion",
    hair_profile: {
      ...FULL_PROFILE,
      chemical_treatment: ["bleached"],
      heat_styling: "regularly",
      cuticle_condition: "rough",
      protein_moisture_balance: "snaps",
    },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Meine Haare brechen ständig ab und fühlen sich strohig an. Was kann ich tun?",
        metadata: {
          response_mode: ["recommend_and_refine", "answer_direct"],
        },
        content: {
          must_be_german: true,
        },
        judge: {
          expected_behavior:
            "Should either discuss bond repair/bond builder given the severe damage profile, or ask targeted follow-up questions. Must NOT be in router clarification mode (needs_clarification must be false). If answering directly, should cite sources.",
        },
      },
    ],
  },

  // ── Recommend & refine ───────────────────────────────────────────────────
  {
    id: "shampoo-recommend-and-refine",
    name: "Shampoo request with complete profile gets products + follow-ups",
    description:
      "Complete profile + shampoo request should produce products alongside follow-up questions",
    ci_smoke: true,
    hair_profile: { ...FULL_PROFILE },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Ich brauche ein Shampoo",
        metadata: {
          response_mode: ["recommend_and_refine", "answer_direct"],
          product_count_min: 1,
        },
        content: { must_be_german: true },
        judge: {
          expected_behavior:
            "Should give a shampoo recommendation. May also ask 1-2 follow-up questions to refine. Must NOT withhold products or only ask clarifying questions.",
        },
      },
    ],
  },

  {
    id: "leave-in-offer-confirmation",
    name: "Leave-in recommendation follow-up confirmation",
    description:
      "Multi-turn: product recommendation should create a visible follow-up path, and 'Ja bitte' should resolve that path instead of falling back to a generic clarification",
    ci_smoke: true,
    hair_profile: { ...FULL_PROFILE },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message:
          "Ich brauche ein leichtes Leave-in gegen Frizz. Nenne mir bitte Produkte und frag mich danach, ob du mir die Anwendung kurz erklären sollst, aber erklär die Anwendung noch nicht.",
        metadata: {
          response_mode: ["recommend_and_refine", "answer_direct"],
          product_count_min: 1,
        },
        content: {
          must_be_german: true,
          required_keywords: ["Anwendung", "anwende"],
          forbidden_keywords: ["handtuchtrockene", "Formulier es bitte", "konkreter"],
        },
        judge: {
          expected_behavior:
            "Should recommend at least one leave-in product and visibly ask whether the user wants a short application explanation, without already giving the full usage instructions. Must not only ask clarifying questions.",
        },
      },
      {
        message: "Ja bitte",
        content: {
          must_be_german: true,
          required_keywords: ["anwenden", "Längen"],
          forbidden_keywords: ["Formulier es bitte", "konkreter", "nicht sicher, was du genau"],
        },
        judge: {
          expected_behavior:
            "Should interpret 'Ja bitte' as confirmation of the prior visible usage/application follow-up and explain how to apply the recommended leave-in. Must not ask the user to restate the request.",
        },
      },
    ],
  },

  {
    id: "routine-summary-followup",
    name: "Routine summary follow-up",
    description:
      "Multi-turn: after building a simple routine, a summary follow-up should recap the visible routine instead of rebuilding it or losing context",
    hair_profile: { ...FULL_PROFILE },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Erstelle mir bitte eine einfache Routine für meine welligen Haare",
        content: {
          must_be_german: true,
          required_keywords: ["Shampoo", "Conditioner"],
          forbidden_keywords: ["Formulier es bitte", "konkreter"],
        },
        judge: {
          expected_behavior:
            "Should create a simple routine for wavy hair using the available profile and current routine context. Must not reject the request as unclear.",
        },
      },
      {
        message: "Fass mir das bitte ganz kurz zusammen",
        content: {
          must_be_german: true,
          required_keywords: ["Shampoo", "Conditioner"],
          forbidden_keywords: ["Formulier es bitte", "konkreter"],
        },
        judge: {
          expected_behavior:
            "Should summarize the routine from the previous assistant answer. Must not rebuild a new routine, ask for the whole request again, or lose the routine context.",
        },
      },
    ],
  },

  {
    id: "explicit-branch-followup",
    name: "Explicit branch follow-up after category comparison",
    description:
      "Multi-turn: after comparing Leave-in and mask for frizz, an explicit branch choice should continue that branch instead of importing stale wording from another option",
    hair_profile: { ...FULL_PROFILE },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Soll ich gegen Frizz eher ein Leave-in oder eine Maske testen?",
        content: {
          must_be_german: true,
          required_keywords: ["Leave-in", "Maske"],
          forbidden_keywords: ["Formulier es bitte", "konkreter"],
        },
        judge: {
          expected_behavior:
            "Should compare Leave-in vs mask for frizz and give a practical direction for the user's profile.",
        },
      },
      {
        message: "Dann lieber Leave-in",
        content: {
          must_be_german: true,
          required_keywords: ["Leave-in"],
          forbidden_keywords: ["Maske wäre besser", "Formulier es bitte", "konkreter"],
        },
        judge: {
          expected_behavior:
            "Should continue the explicitly chosen Leave-in branch and give next-step guidance or products for Leave-in. Must not switch back to recommending a mask as the chosen option.",
        },
      },
    ],
  },

  {
    id: "recommend-refine-no-match",
    name: "Recommend & refine with unlikely catalog match",
    description:
      "Profile combination unlikely to match catalog — should still attempt recommendations or explain lack of matches",
    hair_profile: {
      ...FULL_PROFILE,
      hair_texture: "coily",
      thickness: "coarse",
      density: "high",
      concerns: ["extreme_shrinkage"],
      protein_moisture_balance: "snaps",
      cuticle_condition: "rough",
      scalp_type: "oily",
      scalp_condition: "dandruff",
      chemical_treatment: ["relaxed"],
      goals: ["length_retention"],
    },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Ich brauche ein Leave-in für meine Haare",
        metadata: {
          response_mode: ["recommend_and_refine", "answer_direct"],
          product_count_max: 3,
        },
        content: { must_be_german: true },
        judge: {
          expected_behavior:
            "With a rare profile combination, should either offer best-available leave-in products with caveats, or explain why no perfect match exists and ask refining questions. Must not hallucinate products.",
        },
      },
    ],
  },

  // ── Clarification cap ────────────────────────────────────────────────────
  {
    id: "clarification-cap",
    name: "Clarification cap after 3 vague messages",
    description: "After 2 clarification rounds, 3rd message should get a real answer (cap at 2)",
    ci_smoke: true,
    hair_profile: { ...FULL_PROFILE },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Meine Haare sind irgendwie komisch",
        metadata: { response_mode: ["clarify_only", "recommend_and_refine", "answer_direct"] },
      },
      {
        message: "Es ist halt so ein Problem mit meinen Haaren",
        metadata: { response_mode: ["clarify_only", "recommend_and_refine", "answer_direct"] },
      },
      {
        message: "Ich weiss einfach nicht was ich machen soll",
        metadata: {
          response_mode: "answer_direct",
        },
        judge: {
          expected_behavior:
            "After 2 prior vague messages, the system must give a best-effort general hair care answer. Should NOT ask more clarifying questions.",
        },
      },
    ],
  },
]
