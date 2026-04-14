/**
 * Chat Evaluation Harness — Test Scenario Fixtures
 */

import type { EvalScenario, HairProfileOverrides } from "./types"

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
  wash_frequency: "every_2_3_days",
  heat_styling: "rarely",
  goals: ["shine"],
  mechanical_stress_factors: ["towel_rubbing", "rough_brushing"],
  current_routine_products: ["shampoo", "conditioner"],
  onboarding_completed: true,
}

export const SCENARIOS: EvalScenario[] = [
  // ── Regression: ÖWC follow-up ──────────────────────────────────────────
  {
    id: "owc-followup",
    name: "ÖWC follow-up (regression)",
    description:
      "Multi-turn: context-setting message then short follow-up 'und owc testen?' — must not misclassify as product query",
    hair_profile: { ...FULL_PROFILE },
    turns: [
      {
        message: "Welche Pflegeroutine empfiehlst du für welliges Haar?",
      },
      {
        message: "und owc testen?",
        metadata: {
          intent: ["hair_care_advice", "followup", "routine_help"],
          policy_overrides_exclude: ["category_product_mode"],
          source_count_min: 1,
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
    turns: [
      {
        message: "Was ist der Unterschied zwischen CWC und OWC?",
        metadata: {
          intent: ["hair_care_advice", "routine_help"],
          source_count_min: 1,
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
    hair_profile: { ...FULL_PROFILE, thickness: null, scalp_type: null },
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

  // ── FAQ shortcut ─────────────────────────────────────────────────────────
  {
    id: "simple-faq",
    name: "Simple FAQ question",
    description: "Straightforward question — should use FAQ shortcut",
    hair_profile: { ...FULL_PROFILE },
    turns: [
      {
        message: "Wie oft sollte ich meine Haare waschen?",
        metadata: {
          retrieval_mode: ["faq", "hybrid"],
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
    hair_profile: { ...FULL_PROFILE },
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
    turns: [
      {
        message: "Meine Haare brechen ständig ab und fühlen sich strohig an. Was kann ich tun?",
        metadata: {
          response_mode: ["recommend_and_refine", "answer_direct"],
          source_count_min: 1,
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
    hair_profile: { ...FULL_PROFILE },
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
    hair_profile: { ...FULL_PROFILE },
    turns: [
      {
        message: "Meine Haare sind irgendwie komisch",
        metadata: { response_mode: "recommend_and_refine" },
      },
      {
        message: "Es ist halt so ein Problem mit meinen Haaren",
        metadata: { response_mode: "recommend_and_refine" },
      },
      {
        message: "Ich weiss einfach nicht was ich machen soll",
        metadata: {
          response_mode: "answer_direct",
          policy_overrides_include: ["clarification_cap_reached"],
        },
        judge: {
          expected_behavior:
            "After 2 rounds of clarification, the system must give a best-effort general hair care answer. Should NOT ask more clarifying questions.",
        },
      },
    ],
  },
]
