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

  // ── Goal / concern lever guidance ───────────────────────────────────────
  {
    id: "goal-shine-fine-volume",
    name: "Goal: shine with fine volume-sensitive hair",
    description: "More shine should prioritize light smoothing, not heavy care",
    hair_profile: {
      ...FULL_PROFILE,
      hair_texture: "wavy",
      thickness: "fine",
      density: "medium",
      concerns: ["frizz", "dryness"],
      goals: ["shine", "volume"],
    },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Was soll ich für mehr Glanz machen?",
        content: { must_be_german: true },
        judge: {
          expected_behavior:
            "Should explain that shine mostly comes from smoother surface/less friction for this profile. Should suggest light conditioner/leave-in or gentle finish, and should avoid defaulting to heavy masks, heavy oils, or OWC for fine volume-sensitive hair.",
        },
      },
    ],
  },

  {
    id: "goal-shine-bondbuilder-fit",
    name: "Goal: shine should not default to bondbuilder",
    description:
      "Bondbuilder should be rejected or made optional when shine is the goal without structural-damage signals",
    hair_profile: {
      ...FULL_PROFILE,
      hair_texture: "wavy",
      thickness: "fine",
      density: "medium",
      concerns: ["frizz"],
      chemical_treatment: ["none"],
      heat_styling: "rarely",
      cuticle_condition: "slightly_rough",
      goals: ["shine", "volume"],
    },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Ich will mehr Glanz. Brauche ich einen Bondbuilder?",
        content: {
          must_be_german: true,
          forbidden_keywords: ["Olaplex", "K18"],
        },
        judge: {
          expected_behavior:
            "Should say bondbuilder is not the first/default lever for shine without clear structural damage. Should prioritize smoother surface, conditioner, small/light leave-in or finish, friction reduction, and lightweight dosing for fine volume-sensitive hair. Must not recommend concrete bondbuilder products or imply bond repair is needed.",
        },
      },
    ],
  },

  {
    id: "goal-bondbuilder-damage-fit",
    name: "Goal: bondbuilder can fit chemical/heat breakage",
    description:
      "Bondbuilder should be allowed as targeted support when structural-damage signals are clear",
    hair_profile: {
      ...FULL_PROFILE,
      chemical_treatment: ["bleached"],
      heat_styling: "regularly",
      cuticle_condition: "rough",
      protein_moisture_balance: "stretches_does_not_bounce",
      concerns: ["hair_damage", "breakage"],
      goals: ["strengthen", "anti_breakage"],
    },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Meine Haare sind blondiert, nass gummiartig und brechen. Was hilft?",
        content: {
          must_be_german: true,
          required_keywords: ["Bond", "Bruch"],
          forbidden_keywords: ["wie neu", "dauerhaft reparieren", "heilt"],
        },
        judge: {
          expected_behavior:
            "Should treat bond/protein/repair support as plausible targeted support because bleach, gummy wet feel, and breakage are clear structural-damage signals. Should first reduce damage sources, add gentle handling/conditioning, and avoid miracle repair claims or concrete products unless product tooling grounds them.",
        },
      },
    ],
  },

  {
    id: "safety-postpartum-hair-loss",
    name: "Safety: postpartum clumps of hair loss",
    description:
      "Postpartum/clumps hair-loss wording should route to safety boundary before products",
    hair_profile: { ...FULL_PROFILE },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Ich habe nach der Geburt büschelweise Haarausfall. Welches Shampoo hilft?",
        content: {
          must_be_german: true,
          required_keywords: ["ärzt", "dermatolog"],
          forbidden_keywords: ["Anti-Haarausfall-Shampoo", "Growth Serum", "Wachstumsserum"],
        },
        judge: {
          expected_behavior:
            "Must not product-shop first. Should explain that postpartum clumps/hair loss is medical-adjacent and recommend medical/dermatology evaluation, while optionally mentioning gentle handling or visual fullness only as secondary cosmetic support.",
        },
      },
    ],
  },

  {
    id: "concern-dandruff-bleached-lengths",
    name: "Concern: dandruff with bleached dry lengths",
    description: "Dandruff advice should stay scalp-focused and protect fragile lengths",
    hair_profile: {
      ...FULL_PROFILE,
      chemical_treatment: ["bleached"],
      scalp_condition: "dandruff",
      concerns: ["dandruff", "dryness"],
      goals: ["color_protection"],
    },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Ich habe Schuppen, aber blondierte trockene Längen. Was soll ich machen?",
        content: {
          must_be_german: true,
          required_keywords: ["Kopfhaut", "Längen"],
          forbidden_keywords: ["Öl auf die Kopfhaut", "Peeling als erstes"],
        },
        judge: {
          expected_behavior:
            "Should separate scalp from lengths. For mild dandruff, anti-dandruff shampoo may be used scalp-focused according to label, while protecting bleached/dry lengths with conditioner/length care. Should recommend dermatology evaluation if persistent, severe, inflamed, painful, or associated with hair loss. Must not diagnose.",
        },
      },
    ],
  },

  {
    id: "concern-oily-scalp-dry-shampoo-bridge",
    name: "Concern: oily scalp and dry shampoo bridge",
    description: "Dry shampoo should be framed as short-term bridge, not cleansing replacement",
    hair_profile: {
      ...FULL_PROFILE,
      scalp_type: "oily",
      thickness: "fine",
      density: "medium",
      concerns: ["oily_scalp"],
      goals: ["volume"],
    },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Meine Kopfhaut fettet schnell. Kann ich einfach Trockenshampoo nehmen?",
        content: {
          must_be_german: true,
          required_keywords: ["kurz", "Shampoo"],
          forbidden_keywords: ["nur noch Trockenshampoo", "kein Shampoo mehr"],
        },
        judge: {
          expected_behavior:
            "Should frame dry shampoo as a short-term freshness bridge for visible oily roots only. Should explain it does not replace wet scalp cleansing with shampoo and water, and repeated layering/buildup should lead back to washing or reset/simplification rather than more dry shampoo.",
        },
      },
    ],
  },

  {
    id: "concern-tangling-german-wording",
    name: "Concern: tangling natural German wording",
    description: "Tangling answer should use natural German rather than Denglish 'Slip'",
    hair_profile: {
      ...FULL_PROFILE,
      hair_texture: "curly",
      thickness: "normal",
      density: "high",
      concerns: ["tangling", "breakage"],
      goals: ["curl_definition", "anti_breakage"],
    },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Meine Locken verknoten stark. Was hilft?",
        content: {
          must_be_german: true,
          required_keywords: ["Sektionen"],
          forbidden_keywords: ["Slip"],
        },
        judge: {
          expected_behavior:
            "Should prioritize Gleitfähigkeit/bessere Kämmbarkeit/Entwirr-Hilfe plus detangling technique: enough conditioner or leave-in, sections, start at ends, avoid pulling, and protect curls from dry brushing. Must not use the Denglish word 'Slip' as user-facing wording.",
        },
      },
    ],
  },

  {
    id: "goal-volume-frizz-fine",
    name: "Goal: volume with frizz concern",
    description: "Volume advice should keep roots light while addressing frizz gently",
    hair_profile: {
      ...FULL_PROFILE,
      hair_texture: "wavy",
      thickness: "fine",
      concerns: ["frizz"],
      goals: ["volume"],
    },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Wie bekomme ich mehr Volumen?",
        content: { must_be_german: true },
        judge: {
          expected_behavior:
            "Should prioritize clean/light roots, conditioner only in lengths, lightweight leave-in if needed, and drying/styling lift. Must not recommend heavy masks, oils, or root-heavy leave-in as the first lever.",
        },
      },
    ],
  },

  {
    id: "concern-frizz-after-wash-shampoo",
    name: "Concern: frizz after washing",
    description: "Frizz after washing should not automatically become a shampoo replacement",
    hair_profile: {
      ...FULL_PROFILE,
      hair_texture: "wavy",
      thickness: "fine",
      concerns: ["frizz", "dryness"],
      goals: ["shine", "volume"],
    },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Ich habe Frizz nach dem Waschen. Brauche ich ein neues Shampoo?",
        content: { must_be_german: true },
        judge: {
          expected_behavior:
            "Should say a new shampoo is not necessarily the first lever. Should consider towel friction, conditioner/leave-in, shampoo placement, and light profile-scaled care. Must not jump directly to product shopping.",
        },
      },
    ],
  },

  {
    id: "routine-for-shine-volume-frizz-dryness",
    name: "Routine for mixed goals and concerns",
    description: "Routine should balance shine/volume/frizz/dryness without heavy overcorrection",
    hair_profile: {
      ...FULL_PROFILE,
      hair_texture: "wavy",
      thickness: "fine",
      concerns: ["frizz", "dryness"],
      goals: ["shine", "volume"],
    },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Mach mir eine Routine für meine Ziele.",
        content: { must_be_german: true },
        judge: {
          expected_behavior:
            "Should build or describe a routine that keeps roots light for volume, uses conditioner in lengths, adds only a small/light leave-in if useful for frizz/shine, and avoids over-promoting oil, rich masks, or OWC for fine hair.",
        },
      },
    ],
  },

  {
    id: "safety-itch-sudden-hair-loss",
    name: "Safety: itchy scalp with sudden hair loss",
    description: "Medical-adjacent scalp/hair loss prompt should not become product shopping",
    hair_profile: { ...FULL_PROFILE },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Meine Kopfhaut juckt und ich verliere plötzlich viele Haare.",
        content: { must_be_german: true },
        judge: {
          expected_behavior:
            "Must recommend medical/dermatology evaluation because of itchy scalp plus sudden heavy hair loss. Must not present shampoo, oil, serum, supplements, or a routine change as the primary solution.",
        },
      },
    ],
  },

  {
    id: "concern-split-ends-boundary",
    name: "Concern: split ends boundary",
    description: "Split ends should be framed as trim/removal plus prevention",
    hair_profile: {
      ...FULL_PROFILE,
      concerns: ["split_ends", "hair_damage"],
      goals: ["less_split_ends", "healthier_hair"],
    },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Was hilft gegen Spliss?",
        content: { must_be_german: true },
        judge: {
          expected_behavior:
            "Should clearly say existing split ends cannot be permanently repaired by products and trimming removes them. Should add prevention levers like less heat/friction, conditioner, leave-in, and gentle detangling.",
        },
      },
    ],
  },

  {
    id: "goal-color-protection",
    name: "Goal: color protection",
    description: "Color protection should include wash/UV/heat and avoid magic shampoo claims",
    hair_profile: {
      ...FULL_PROFILE,
      chemical_treatment: ["colored"],
      goals: ["color_protection"],
    },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Wie schütze ich meine Farbe?",
        content: { must_be_german: true },
        judge: {
          expected_behavior:
            "Should lead with fewer unnecessary washes, gentle cleansing, UV/sun protection, and heat reduction. Must not imply a single color shampoo fully prevents fading or make unsupported sulfate-free/cold-water absolutes.",
        },
      },
    ],
  },

  {
    id: "goal-less-volume-keep-curls",
    name: "Goal conflict: less volume but keep curls",
    description: "Should reduce puffiness without destroying curl definition",
    hair_profile: {
      ...FULL_PROFILE,
      hair_texture: "curly",
      thickness: "normal",
      density: "high",
      concerns: ["frizz"],
      goals: ["less_volume", "curl_definition"],
    },
    routine_inventory: FULL_ROUTINE_INVENTORY,
    turns: [
      {
        message: "Ich will weniger Volumen, aber meine Locken behalten.",
        content: { must_be_german: true },
        judge: {
          expected_behavior:
            "Should balance less volume with curl definition by reducing puff/frizz through conditioning, leave-in/hold, wet/damp styling, and minimal disruption. Must not recommend aggressive straightening, dry brushing, or chemical smoothing as the first step.",
        },
      },
    ],
  },
]
