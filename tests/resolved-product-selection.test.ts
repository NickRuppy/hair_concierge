import assert from "node:assert/strict"
import test from "node:test"

import {
  buildResolvedProductSelection,
  getResolvedProductSelectionStableKeyParts,
  productLookupSelectionResolvesSourceCard,
  toProductLookupSelectionContext,
} from "../src/lib/product-intake/resolved-product-selection"
import type {
  ProductLookupClarification,
  ProductLookupClarificationCandidate,
} from "../src/lib/types"

function createClarification(
  overrides: Partial<ProductLookupClarification> = {},
): ProductLookupClarification {
  return {
    id: "clarification-syoss-intense",
    kind: "variant_selection",
    source: "chat",
    original_user_message: "Ist Syoss Intense gut fuer meine Locken?",
    query: {
      brand_text: "Syoss",
      product_name_text: "Intense",
      category: "shampoo",
    },
    copy: {
      prompt_de: "Welches Syoss Intense meinst du?",
    },
    candidates: [
      {
        product_id: "syoss-intense-curls-shampoo",
        name: "Syoss Intense Curls Shampoo",
        category: "shampoo",
        category_label_de: "Shampoo",
        reason: "same_brand_same_category",
      },
    ],
    none_action: {
      label_de: "Keines davon",
      product_intake_offer: {
        id: "offer-syoss-intense",
        source: "chat",
        reason: "needs_more_info",
        category: "shampoo",
      },
    },
    ...overrides,
  }
}

test("builds a product-domain resolved selection from a persisted clarification card", () => {
  const clarification = createClarification()
  const selectedCandidate = clarification.candidates[0]

  const selection = buildResolvedProductSelection({
    clarification,
    selectedCandidate,
    selectedProduct: {
      id: "syoss-intense-curls-shampoo",
      name: "Syoss Intense Curls Shampoo Row",
      category: "legacy-shampoo",
      category_key: "shampoo",
    },
    sourceAssistantMessageId: "assistant-message-1",
  })

  assert.deepEqual(selection, {
    source: "product_lookup_clarification",
    clarificationId: "clarification-syoss-intense",
    sourceAssistantMessageId: "assistant-message-1",
    originalUserMessage: "Ist Syoss Intense gut fuer meine Locken?",
    selectedProduct: {
      id: "syoss-intense-curls-shampoo",
      name: "Syoss Intense Curls Shampoo Row",
      category: "shampoo",
    },
    lookupIdentity: {
      category: "shampoo",
      brandText: "Syoss",
      productNameText: "Intense",
      evidenceQuote: "Syoss Intense",
    },
  })
})

test("falls back to candidate name, category, and continuity message when source data is sparse", () => {
  const selectedCandidate: ProductLookupClarificationCandidate = {
    product_id: "syoss-intense-curls-shampoo",
    name: "Syoss Intense Curls Shampoo Candidate",
    category: "shampoo",
    category_label_de: "Shampoo",
    reason: "same_brand_same_category",
  }

  const selection = buildResolvedProductSelection({
    clarification: createClarification({
      original_user_message: "   ",
      query: {
        brand_text: null,
        product_name_text: null,
        category: "shampoo",
      },
    }),
    selectedCandidate,
    selectedProduct: {
      id: "syoss-intense-curls-shampoo",
      name: "   ",
      category: null,
      category_key: null,
    },
    sourceAssistantMessageId: "assistant-message-1",
  })

  assert.equal(
    selection.originalUserMessage,
    "Ich meine Syoss Intense Curls Shampoo Candidate. Kannst du dieses Produkt bewerten?",
  )
  assert.deepEqual(selection.selectedProduct, {
    id: "syoss-intense-curls-shampoo",
    name: "Syoss Intense Curls Shampoo Candidate",
    category: "shampoo",
  })
  assert.deepEqual(selection.lookupIdentity, {
    category: "shampoo",
    brandText: null,
    productNameText: null,
    evidenceQuote: "Syoss Intense Curls Shampoo Candidate",
  })
})

test("converts a resolved selection to persisted message selection context", () => {
  const clarification = createClarification()
  const selection = buildResolvedProductSelection({
    clarification,
    selectedCandidate: clarification.candidates[0],
    selectedProduct: {
      id: "syoss-intense-curls-shampoo",
      name: "Syoss Intense Curls Shampoo",
      category: "shampoo",
      category_key: null,
    },
    sourceAssistantMessageId: "assistant-message-1",
  })

  assert.deepEqual(toProductLookupSelectionContext(selection), {
    source: "product_lookup_clarification",
    clarification_id: "clarification-syoss-intense",
    source_assistant_message_id: "assistant-message-1",
    selected_product_id: "syoss-intense-curls-shampoo",
    selected_product_name: "Syoss Intense Curls Shampoo",
  })
})

test("matches persisted selections by source card and optionally selected product id", () => {
  const selection = {
    source: "product_lookup_clarification" as const,
    clarificationId: "clarification-syoss-intense",
    sourceAssistantMessageId: "assistant-message-1",
    selectedProductId: "syoss-intense-curls-shampoo",
  }
  const sourceCard = {
    clarificationId: selection.clarificationId,
    sourceAssistantMessageId: selection.sourceAssistantMessageId,
  }

  assert.equal(
    productLookupSelectionResolvesSourceCard(
      {
        source: "product_lookup_clarification",
        clarification_id: "clarification-syoss-intense",
        source_assistant_message_id: "assistant-message-1",
        selected_product_id: "different-product",
        selected_product_name: "Different Product",
      },
      sourceCard,
    ),
    true,
  )
  assert.equal(
    productLookupSelectionResolvesSourceCard(
      {
        source: "product_lookup_clarification",
        clarification_id: "clarification-syoss-intense",
        source_assistant_message_id: "assistant-message-1",
        selected_product_id: "different-product",
        selected_product_name: "Different Product",
      },
      {
        clarificationId: selection.clarificationId,
        sourceAssistantMessageId: selection.sourceAssistantMessageId,
        selectedProductId: selection.selectedProductId,
      },
    ),
    false,
  )
  assert.equal(
    productLookupSelectionResolvesSourceCard(
      {
        source: "product_lookup_clarification",
        clarification_id: "clarification-syoss-intense",
        source_assistant_message_id: "different-assistant-message",
        selected_product_id: "syoss-intense-curls-shampoo",
        selected_product_name: "Syoss Intense Curls Shampoo",
      },
      sourceCard,
    ),
    false,
  )
})

test("uses stable key parts scoped to the selected product", () => {
  assert.deepEqual(
    getResolvedProductSelectionStableKeyParts({
      conversationId: "conversation-1",
      clarificationId: "clarification-syoss-intense",
      sourceAssistantMessageId: "assistant-message-1",
      selectedProductId: "syoss-intense-curls-shampoo",
    }),
    [
      "product_lookup_selection",
      "conversation-1",
      "assistant-message-1",
      "clarification-syoss-intense",
      "syoss-intense-curls-shampoo",
    ],
  )
})
