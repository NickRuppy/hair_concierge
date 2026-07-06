import assert from "node:assert/strict"
import test from "node:test"

import {
  buildActiveResolvedProductContext,
  buildActiveResolvedProductContextFromLookup,
  buildNextActiveResolvedProductContext,
  buildPrimaryResolvedProductContext,
  buildStoredProjectionForTrustedSelectedProduct,
  buildTrustedSelectedProductContext,
  buildTrustedSelectedProductLookupResult,
  buildTrustedSelectedProductProjection,
  mergeActiveProductContexts,
  type AgentV2ActiveProductContext,
} from "../src/lib/agent-v2/resolved-product-selection-adapter"
import type { ResolvedProductSelection } from "../src/lib/product-intake/resolved-product-selection"

const trustedContext = {
  source: "product_lookup_clarification" as const,
  original_user_message: "Passt Syoss Intense Volume Shampoo zu mir?",
  selected_product: {
    id: "syoss-intense-volume-shampoo",
    name: "Syoss Intense Volume Shampoo",
    category: "shampoo",
  },
  lookup_identity: {
    category: "shampoo",
    brand_text: "Syoss",
    product_name_text: "Intense Volume Shampoo",
    evidence_quote: "Syoss Intense Volume Shampoo",
  },
}

test("adapts product-domain resolved selection into AgentV2 trusted context", () => {
  const selection: ResolvedProductSelection = {
    source: "product_lookup_clarification",
    clarificationId: "clarification-1",
    sourceAssistantMessageId: "assistant-message-1",
    originalUserMessage: trustedContext.original_user_message,
    selectedProduct: {
      id: trustedContext.selected_product.id,
      name: trustedContext.selected_product.name,
      category: trustedContext.selected_product.category,
    },
    lookupIdentity: {
      category: trustedContext.lookup_identity.category,
      brandText: trustedContext.lookup_identity.brand_text,
      productNameText: trustedContext.lookup_identity.product_name_text,
      evidenceQuote: trustedContext.lookup_identity.evidence_quote,
    },
  }

  assert.deepEqual(buildTrustedSelectedProductContext(selection), trustedContext)
})

test("builds the trusted found-exact lookup validation result", () => {
  assert.deepEqual(buildTrustedSelectedProductLookupResult(trustedContext), {
    status: "found_exact",
    category: "shampoo",
    input_identity: {
      category: "shampoo",
      brand_text: "Syoss",
      product_name_text: "Intense Volume Shampoo",
      evidence_quote: "Syoss Intense Volume Shampoo",
    },
    product: {
      id: "syoss-intense-volume-shampoo",
      name: "Syoss Intense Volume Shampoo",
    },
  })
})

test("builds the trusted selected-product projection with selected-product caveat policy", () => {
  assert.deepEqual(buildTrustedSelectedProductProjection(trustedContext), {
    tool_name: "select_products",
    category: "shampoo",
    decision: "recommended",
    product_response_policy: "recommend_with_caveat",
    policy_reason:
      "User selected this verified catalog product from a clarification card; treat it as the resolved product identity, while avoiding unsupported product-specific claims.",
    valid_product_ids: ["syoss-intense-volume-shampoo"],
    products: [
      {
        product_id: "syoss-intense-volume-shampoo",
        rank: 1,
        name: "Syoss Intense Volume Shampoo",
        brand: null,
        price_eur: null,
        currency: null,
        fit_reason:
          "Vom Nutzer aus der Produktklärung ausgewählt und als Katalogprodukt bestätigt.",
        caveat: null,
        supported_claims: [],
        unsupported_requested_signals: [],
      },
    ],
    missing_required_data: [],
    constraint_blockers: [],
    comparison_facts: null,
    allowed_claim_sources: ["selected_products.name", "product_lookup_selection"],
    trace: {
      profile_basis: [],
      category_guidance: "",
    },
  })
})

test("preserves active and stored projection conversion shapes", () => {
  assert.deepEqual(buildActiveResolvedProductContext(trustedContext), {
    source: "product_lookup_selection",
    product_id: "syoss-intense-volume-shampoo",
    name: "Syoss Intense Volume Shampoo",
    category: "shampoo",
    original_user_message: "Passt Syoss Intense Volume Shampoo zu mir?",
  })

  assert.deepEqual(buildStoredProjectionForTrustedSelectedProduct(trustedContext), {
    tool_name: "select_products",
    category: "shampoo",
    valid_product_ids: ["syoss-intense-volume-shampoo"],
    products: [
      {
        product_id: "syoss-intense-volume-shampoo",
        rank: 1,
        name: "Syoss Intense Volume Shampoo",
        brand: null,
        price_eur: null,
        currency: null,
        fit_reason: "Vom Nutzer aus der Produktklärung ausgewählt.",
        caveat: null,
        supported_claims: [],
        unsupported_requested_signals: [],
      },
    ],
  })
})

test("preserves routine inventory provenance when deriving resolved context", () => {
  const routineContext: AgentV2ActiveProductContext = {
    status: "resolved",
    product_id: "routine-shampoo",
    submission_id: null,
    category: "shampoo",
    brand_text: "Syoss",
    product_name_text: "Intense Volume Shampoo",
    display_name: "Syoss Intense Volume Shampoo",
    original_user_message: "Weißt du welches Shampoo ich gerade benutze?",
    source: "routine_inventory",
    updated_at: "2026-07-05T12:00:00.000Z",
  }

  assert.deepEqual(buildPrimaryResolvedProductContext([routineContext]), {
    source: "routine_inventory",
    product_id: "routine-shampoo",
    name: "Syoss Intense Volume Shampoo",
    category: "shampoo",
    original_user_message: "Weißt du welches Shampoo ich gerade benutze?",
  })
})

test("builds active context from found-exact lookup result without trusting unknown results", () => {
  assert.deepEqual(
    buildActiveResolvedProductContextFromLookup({
      result: {
        status: "found_exact",
        product: {
          id: "syoss-intense-volume-shampoo",
          name: "Syoss Intense Volume Shampoo",
          category_key: "shampoo",
        },
      },
      inputCategory: "conditioner",
      originalUserMessage: "Passt Syoss Intense Volume?",
      displayName: "Syoss Intense Volume",
    }),
    {
      source: "product_lookup_selection",
      product_id: "syoss-intense-volume-shampoo",
      name: "Syoss Intense Volume",
      category: "shampoo",
      original_user_message: "Passt Syoss Intense Volume?",
    },
  )

  assert.equal(
    buildActiveResolvedProductContextFromLookup({
      result: { status: "not_found" },
      inputCategory: "shampoo",
      originalUserMessage: "Passt das?",
      displayName: null,
    }),
    null,
  )
})

test("chooses the next active resolved product context by explicit precedence", () => {
  const previous = {
    source: "product_lookup_selection" as const,
    product_id: "previous-product",
    name: "Previous Product",
    category: "conditioner",
    original_user_message: "Und wie oft?",
  }
  const deterministic = {
    source: "product_lookup_selection" as const,
    product_id: "deterministic-product",
    name: "Deterministic Product",
    category: "shampoo",
    original_user_message: "Passt das Shampoo?",
  }

  assert.deepEqual(
    buildNextActiveResolvedProductContext({
      previous,
      trustedSelectedProductContext: trustedContext,
      deterministicResolvedProductContext: deterministic,
      latestMessageNamesActionableProduct: true,
    }),
    {
      source: "product_lookup_selection",
      product_id: "syoss-intense-volume-shampoo",
      name: "Syoss Intense Volume Shampoo",
      category: "shampoo",
      original_user_message: "Passt Syoss Intense Volume Shampoo zu mir?",
    },
  )

  assert.equal(
    buildNextActiveResolvedProductContext({
      previous,
      trustedSelectedProductContext: null,
      deterministicResolvedProductContext: deterministic,
      latestMessageNamesActionableProduct: true,
    }),
    deterministic,
  )

  assert.equal(
    buildNextActiveResolvedProductContext({
      previous,
      trustedSelectedProductContext: null,
      deterministicResolvedProductContext: null,
      latestMessageNamesActionableProduct: true,
    }),
    null,
  )

  assert.equal(
    buildNextActiveResolvedProductContext({
      previous,
      trustedSelectedProductContext: null,
      deterministicResolvedProductContext: null,
      latestMessageNamesActionableProduct: false,
    }),
    previous,
  )
})

test("skips pending entries when selecting the primary resolved product context", () => {
  const contexts: AgentV2ActiveProductContext[] = [
    {
      status: "resolved",
      product_id: "syoss-intense-curls-shampoo",
      submission_id: null,
      category: "shampoo",
      brand_text: "Syoss",
      product_name_text: "Intense Curls Shampoo",
      display_name: "Syoss Intense Curls Shampoo",
      original_user_message: "Passt Syoss Intense Curls Shampoo zu mir?",
      source: "lookup_exact",
      updated_at: "2026-06-28T10:00:00.000Z",
    },
    {
      status: "pending_review",
      product_id: null,
      submission_id: null,
      category: "shampoo",
      brand_text: "Syoss",
      product_name_text: "Intense Volume Shampoo",
      display_name: "Syoss Intense Volume Shampoo",
      original_user_message: "Passt Syoss Intense Volume Shampoo zu mir?",
      source: "product_intake_submission",
      updated_at: "2026-06-28T10:01:00.000Z",
    },
  ]

  assert.deepEqual(buildPrimaryResolvedProductContext(contexts), {
    source: "lookup_exact",
    product_id: "syoss-intense-curls-shampoo",
    name: "Syoss Intense Curls Shampoo",
    category: "shampoo",
    original_user_message: "Passt Syoss Intense Curls Shampoo zu mir?",
  })
})

test("replaces a pending intake offer context with the submitted pending product context", () => {
  const previous: AgentV2ActiveProductContext[] = [
    {
      status: "pending_review",
      product_id: null,
      submission_id: null,
      category: "conditioner",
      brand_text: "Jean & Lean",
      product_name_text: "Mystery Rose",
      display_name: "Jean & Lean Mystery Rose",
      original_user_message: "Was hältst du von meinem Jean & Lean Conditioner Mystery Rose?",
      source: "product_intake_submission",
      updated_at: "2026-06-28T10:00:00.000Z",
    },
  ]
  const submitted: AgentV2ActiveProductContext = {
    status: "pending_review",
    product_id: null,
    submission_id: "submission-jean-lean-mystery-rose",
    category: "conditioner",
    brand_text: "Jean & Lean",
    product_name_text: "Mystery Rose",
    display_name: "Jean & Lean Mystery Rose",
    original_user_message: "Ich habe Jean & Lean Mystery Rose eingereicht.",
    source: "product_intake_submission",
    updated_at: "2026-06-28T10:01:00.000Z",
  }

  assert.deepEqual(
    mergeActiveProductContexts({
      previous,
      next: [submitted],
      latestMessageNamesActionableProduct: true,
    }),
    [submitted],
  )
})

test("replaces a pending product context when the same identity becomes resolved", () => {
  const pending: AgentV2ActiveProductContext = {
    status: "pending_review",
    product_id: null,
    submission_id: "submission-jean-lean-mystery-rose",
    category: "conditioner",
    brand_text: "Jean & Lean",
    product_name_text: "Mystery Rose",
    display_name: "Jean & Lean Mystery Rose",
    original_user_message: "Ich habe Jean & Lean Mystery Rose eingereicht.",
    source: "product_intake_submission",
    updated_at: "2026-06-28T10:01:00.000Z",
  }
  const resolved: AgentV2ActiveProductContext = {
    status: "resolved",
    product_id: "jean-lean-mystery-rose",
    submission_id: "submission-jean-lean-mystery-rose",
    category: "conditioner",
    brand_text: "Jean & Lean",
    product_name_text: "Mystery Rose",
    display_name: "Jean & Lean Mystery Rose",
    original_user_message: "Jean & Lean Mystery Rose ist jetzt geprüft.",
    source: "product_intake_submission",
    updated_at: "2026-06-28T10:02:00.000Z",
  }

  assert.deepEqual(
    mergeActiveProductContexts({
      previous: [pending],
      next: [resolved],
      latestMessageNamesActionableProduct: true,
    }),
    [resolved],
  )
})
