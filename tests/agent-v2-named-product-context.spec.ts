import assert from "node:assert/strict"
import test from "node:test"

import {
  buildAgentV2NamedProductContext,
  normalizeNamedProductForComparison,
} from "../src/lib/agent-v2/named-product-context"

test("detects exact Urban Alchemy conditioner name from latest user message", () => {
  const context = buildAgentV2NamedProductContext({
    latestMessage: "Moisture Mist Conditioner von Urban Alchemy",
    recentMessages: [],
  })

  assert.equal(context?.plausible_exact_name, true)
  assert.equal(context?.category, "conditioner")
  assert.equal(context?.display_name, "Urban Alchemy Moisture Mist Conditioner")
  assert.equal(context?.named_product_intent, "background")
})

test("detects named product from a fuller product-detail question", () => {
  const context = buildAgentV2NamedProductContext({
    latestMessage:
      "Ich nutze gerade von Urban Alchemy den Conditioner Moisture Mist, was haelst du von dem fuer meine Haare?",
    recentMessages: [],
  })

  assert.equal(context?.plausible_exact_name, true)
  assert.equal(context?.category, "conditioner")
  assert.equal(context?.display_name, "Urban Alchemy Moisture Mist Conditioner")
  assert.equal(context?.named_product_intent, "evaluation")
})

test("detects named product from common what-do-you-think wording", () => {
  const context = buildAgentV2NamedProductContext({
    latestMessage: "Was haelst du von Urban Alchemy Moisture Mist Conditioner?",
    recentMessages: [],
  })

  assert.equal(context?.plausible_exact_name, true)
  assert.equal(context?.category, "conditioner")
  assert.equal(context?.display_name, "Urban Alchemy Moisture Mist Conditioner")
  assert.equal(context?.named_product_intent, "evaluation")
})

test("detects unquoted named product from add-to-routine wording", () => {
  const context = buildAgentV2NamedProductContext({
    latestMessage: "Füge Pantene Pro-V Repair & Care Shampoo zu meiner Routine hinzu.",
    recentMessages: [],
  })

  assert.equal(context?.plausible_exact_name, true)
  assert.equal(context?.category, "shampoo")
  assert.equal(context?.display_name, "Pantene Pro-V Repair & Care Shampoo")
  assert.equal(context?.named_product_intent, "routine_add")
})

test("detects common own-product suitability and routine-add phrasing", () => {
  assert.deepEqual(
    buildAgentV2NamedProductContext({
      latestMessage: "Okay passt das Syoss Volume Shampoo zu mir?",
      recentMessages: [],
    }),
    {
      display_name: "Syoss Volume Shampoo",
      category: "shampoo",
      plausible_exact_name: true,
      named_product_intent: "current_use_product_question",
    },
  )

  assert.deepEqual(
    buildAgentV2NamedProductContext({
      latestMessage: "Ich benutze Pantene Pro-V Volume Pur Shampoo. Passt das zu mir?",
      recentMessages: [],
    }),
    {
      display_name: "Pantene Pro-V Volume Pur Shampoo",
      category: "shampoo",
      plausible_exact_name: true,
      named_product_intent: "current_use_product_question",
    },
  )

  assert.deepEqual(
    buildAgentV2NamedProductContext({
      latestMessage: "Was hältst du von meinem Pantene Pro-V Leave-in?",
      recentMessages: [],
    }),
    {
      display_name: "Pantene Pro-V Leave-in",
      category: "leave_in",
      plausible_exact_name: true,
      named_product_intent: "evaluation",
    },
  )

  assert.deepEqual(
    buildAgentV2NamedProductContext({
      latestMessage: "Ich möchte Pantene Pro-V Repair & Care Shampoo in meine Routine aufnehmen.",
      recentMessages: [],
    }),
    {
      display_name: "Pantene Pro-V Repair & Care Shampoo",
      category: "shampoo",
      plausible_exact_name: true,
      named_product_intent: "routine_add",
    },
  )
})

test("detects lowercase own-product mentions from natural chat wording", () => {
  assert.deepEqual(
    buildAgentV2NamedProductContext({
      latestMessage: "kannst du mir sagen, was du von meinem jean & lean conditioner hältst",
      recentMessages: [],
    }),
    {
      display_name: "jean & lean Conditioner",
      category: "conditioner",
      plausible_exact_name: true,
      named_product_intent: "evaluation",
    },
  )

  assert.deepEqual(
    buildAgentV2NamedProductContext({
      latestMessage: "ich benutze pantene pro-v volume pur shampoo, passt das zu mir?",
      recentMessages: [],
    }),
    {
      display_name: "pantene pro-v volume pur Shampoo",
      category: "shampoo",
      plausible_exact_name: true,
      named_product_intent: "current_use_product_question",
    },
  )

  assert.deepEqual(
    buildAgentV2NamedProductContext({
      latestMessage: "was hältst du von urban alchemy moisture mist conditioner?",
      recentMessages: [],
    }),
    {
      display_name: "urban alchemy moisture mist Conditioner",
      category: "conditioner",
      plausible_exact_name: true,
      named_product_intent: "evaluation",
    },
  )
})

test("marks named current-use products as background when the question is category-level", () => {
  assert.deepEqual(
    buildAgentV2NamedProductContext({
      latestMessage: "Ich benutze Pantene Pro-V Shampoo. Wie oft sollte ich meine Haare waschen?",
      recentMessages: [],
    }),
    {
      display_name: "Pantene Pro-V Shampoo",
      category: "shampoo",
      plausible_exact_name: true,
      named_product_intent: "background",
    },
  )

  assert.deepEqual(
    buildAgentV2NamedProductContext({
      latestMessage: "Ich benutze Pantene Pro-V Shampoo. Welche Maske passt zu mir?",
      recentMessages: [],
    }),
    {
      display_name: "Pantene Pro-V Shampoo",
      category: "shampoo",
      plausible_exact_name: true,
      named_product_intent: "background",
    },
  )

  assert.deepEqual(
    buildAgentV2NamedProductContext({
      latestMessage: "Ich benutze Pantene Pro-V Shampoo. Passt eine Maske zu mir?",
      recentMessages: [],
    }),
    {
      display_name: "Pantene Pro-V Shampoo",
      category: "shampoo",
      plausible_exact_name: true,
      named_product_intent: "background",
    },
  )

  assert.equal(
    buildAgentV2NamedProductContext({
      latestMessage: "Ich verwende Pantene Pro-V Shampoo. Welcher Leave-in passt zu mir?",
      recentMessages: [],
    }),
    null,
  )
})

test("detects quoted named product with category signal", () => {
  const context = buildAgentV2NamedProductContext({
    latestMessage: 'Was haelst du vom Conditioner "Moisture Mist" von Urban Alchemy?',
    recentMessages: [],
  })

  assert.equal(context?.display_name, "Urban Alchemy Moisture Mist Conditioner")
  assert.equal(context?.named_product_intent, "evaluation")
})

test("does not classify generic category asks as named products", () => {
  const context = buildAgentV2NamedProductContext({
    latestMessage: "Welcher Conditioner passt gerade am besten zu meinem Haar?",
    recentMessages: [],
  })

  assert.equal(context, null)
})

test("does not include sentence-initial question words in noisy named product asks", () => {
  const context = buildAgentV2NamedProductContext({
    latestMessage: "Welche Moisture Mist Conditioner von Urban Alchemy passt?",
    recentMessages: [],
  })

  assert.equal(context, null)
})

test("does not classify generic product recommendation asks as named products", () => {
  const context = buildAgentV2NamedProductContext({
    latestMessage: "Kannst du mir einen leichten Conditioner empfehlen?",
    recentMessages: [],
  })

  assert.equal(context, null)
})

test("does not classify lowercase generic category descriptions as named products", () => {
  assert.equal(
    buildAgentV2NamedProductContext({
      latestMessage: "ich benutze ein mildes shampoo, passt das zu mir?",
      recentMessages: [],
    }),
    null,
  )

  assert.equal(
    buildAgentV2NamedProductContext({
      latestMessage: "kannst du mir sagen, was du von meinem leichten conditioner hältst",
      recentMessages: [],
    }),
    null,
  )
})

test("does not classify broad category or brand-family asks as intake candidates", () => {
  assert.equal(
    buildAgentV2NamedProductContext({
      latestMessage: "Welcher Leave-in passt?",
      recentMessages: [],
    }),
    null,
  )
  assert.equal(
    buildAgentV2NamedProductContext({
      latestMessage: "Welche Pantene Produkte empfiehlst du?",
      recentMessages: [],
    }),
    null,
  )
})

test("does not classify generic routine planning requests as exact product identities", () => {
  const genericRoutineRequests = [
    "Ich möchte eine Routine mit Conditioner",
    "Ich möchte eine Pflege mit Shampoo",
    "Ich möchte einen Plan mit Leave-in",
    "Ich möchte meine Routine mit Maske ergänzen",
    "Ich möchte meine Pflege mit Haaröl aufbauen",
  ]

  for (const latestMessage of genericRoutineRequests) {
    assert.equal(
      buildAgentV2NamedProductContext({
        latestMessage,
        recentMessages: [],
      }),
      null,
      latestMessage,
    )
  }
})

test("does not infer categories from aliases embedded inside product tokens", () => {
  assert.equal(
    buildAgentV2NamedProductContext({
      latestMessage: "Was haelst du von Olaplex No. 3?",
      recentMessages: [],
    }),
    null,
  )
  assert.equal(
    buildAgentV2NamedProductContext({
      latestMessage: "Was haelst du von Moroccanoil Treatment?",
      recentMessages: [],
    }),
    null,
  )
})

test("normalizes product names for overlap comparison", () => {
  assert.equal(
    normalizeNamedProductForComparison("Urban Alchemy Moisture Mist Conditioner"),
    "urban alchemy moisture mist conditioner",
  )
  assert.equal(
    normalizeNamedProductForComparison("Moisture Mist Conditioner von Urban Alchemy"),
    "moisture mist conditioner urban alchemy",
  )
})
