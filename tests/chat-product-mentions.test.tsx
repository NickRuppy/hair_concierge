import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { ChatMessage } from "@/components/chat/chat-message"
import { hasExistingProductSelectionMessage } from "@/hooks/use-chat"
import type { Message, Product, ProductLookupClarification } from "@/lib/types"

function createProduct(name: string): Product {
  return {
    id: "product-1",
    name,
    brand: "Test Brand",
    description: null,
    short_description: null,
    category: "Leave-in",
    affiliate_link: null,
    image_url: null,
    price_eur: 18,
    currency: "EUR",
    tags: [],
    suitable_thicknesses: [],
    suitable_concerns: [],
    is_active: true,
    lifecycle_status: "active",
    sort_order: 0,
    recommendation_meta: null,
    created_at: "2026-05-06T00:00:00.000Z",
    updated_at: "2026-05-06T00:00:00.000Z",
  }
}

function createAssistantMessage(content: string, products: Product[]): Message {
  return {
    id: "message-1",
    conversation_id: "conversation-1",
    role: "assistant",
    content,
    product_recommendations: products,
    rag_context: null,
    token_usage: null,
    langfuse_trace_id: null,
    langfuse_trace_url: null,
    user_feedback_score: null,
    user_feedback_at: null,
    created_at: "2026-05-06T00:00:00.000Z",
  }
}

function createProductLookupClarification(): ProductLookupClarification {
  return {
    id: "clarification-1",
    kind: "variant_selection",
    source: "chat",
    query: {
      brand_text: "Syoss",
      product_name_text: "Intense Volume Shampoo",
      category: "shampoo",
    },
    copy: {
      prompt_de:
        "Ich finde Syoss Intense Volume Shampoo nicht eindeutig, aber ich habe dieses Syoss Shampoo gefunden.",
    },
    candidates: [
      {
        product_id: "product-syoss-intense-curls",
        name: "Syoss Intense Curls",
        category: "shampoo",
        category_label_de: "Shampoo",
        reason: "same_brand_same_category",
      },
    ],
    none_action: {
      label_de: "Nein, mein Produkt hinzufügen",
      product_intake_offer: {
        id: "offer-1",
        source: "chat",
        reason: "product_lookup_not_found",
        category: "shampoo",
        intake_method: "manual",
        missing_fields: [],
        extracted_identity: {
          brand_text: "Syoss",
          product_name_text: "Intense Volume Shampoo",
        },
      },
    },
  }
}

function hasNestedButton(html: string) {
  let depth = 0
  const buttonTagPattern = /<\/?button\b[^>]*>/g
  let match: RegExpExecArray | null

  while ((match = buttonTagPattern.exec(html)) !== null) {
    const tag = match[0]

    if (tag.startsWith("</")) {
      depth = Math.max(0, depth - 1)
      continue
    }

    if (depth > 0) {
      return true
    }
    depth += 1
  }

  return false
}

test("bold inline product mentions render one clickable trigger without nested buttons", () => {
  const product = createProduct("Silky Leave-in")
  const html = renderToStaticMarkup(
    <ChatMessage
      message={createAssistantMessage("Nimm **Silky Leave-in** nur in den Längen.", [product])}
      hairProfile={null}
      onProductClick={() => {}}
    />,
  )

  const buttonCount = (html.match(/<button\b/g) ?? []).length

  assert.equal(buttonCount, 2)
  assert.equal(hasNestedButton(html), false)
  assert.match(html, /<strong\b[^>]*>[\s\S]*Silky Leave-in[\s\S]*<\/strong>/)
})

test("assistant inline numbered steps render as a real ordered list", () => {
  const html = renderToStaticMarkup(
    <ChatMessage
      message={createAssistantMessage(
        "Ja - schlicht halten: 1. **Shampoo:** nur fuer die Kopfhaut. 2. **Conditioner:** in die Laengen. 3. **Leave-in:** sparsam.",
        [],
      )}
      hairProfile={null}
    />,
  )

  assert.match(html, /<ol\b/)
  assert.equal((html.match(/<li\b/g) ?? []).length, 3)
  assert.match(html, /<strong[^>]*>Shampoo:/)
  assert.match(html, /<strong[^>]*>Conditioner:/)
  assert.match(html, /<strong[^>]*>Leave-in:/)
})

test("assistant product lookup clarification renders an enabled structured selection action", () => {
  const message = createAssistantMessage("Meinst du dieses Produkt?", [])
  message.rag_context = {
    sources: [],
    product_lookup_clarification: createProductLookupClarification(),
  }

  const html = renderToStaticMarkup(
    <ChatMessage message={message} hairProfile={null} onSelectProductCandidate={() => {}} />,
  )

  assert.match(html, /Syoss Intense Curls/)
  assert.match(html, /Auswählen/)
  assert.doesNotMatch(html, /<button[^>]*\sdisabled(?:=""|>| )[^>]*>[\s\S]*Auswählen/)
})

test("assistant product lookup clarification disables selection on the streaming message", () => {
  const message = createAssistantMessage("Meinst du dieses Produkt?", [])
  message.rag_context = {
    sources: [],
    product_lookup_clarification: createProductLookupClarification(),
  }

  const html = renderToStaticMarkup(
    <ChatMessage message={message} hairProfile={null} isStreamingMessage />,
  )

  assert.match(html, /Syoss Intense Curls/)
  assert.match(html, /<button[^>]*\sdisabled(?:=""|>| )[^>]*>[\s\S]*Auswählen/)
})

test("assistant product lookup clarification suppresses recommendation cards", () => {
  const message = createAssistantMessage("Meinst du dieses Produkt?", [
    createProduct("Balea Professional Ultimate Volume"),
  ])
  message.rag_context = {
    sources: [],
    product_lookup_clarification: createProductLookupClarification(),
  }

  const html = renderToStaticMarkup(
    <ChatMessage message={message} hairProfile={null} onProductClick={() => {}} />,
  )

  assert.match(html, /Syoss Intense Curls/)
  assert.doesNotMatch(html, /Balea Professional Ultimate Volume/)
})

test("product selection helper detects already streamed selection messages", () => {
  const message = createAssistantMessage("Alles klar, ich bewerte Syoss Intense Curls.", [])
  message.rag_context = {
    sources: [],
    product_lookup_selection: {
      source: "product_lookup_clarification",
      clarification_id: "clarification-1",
      source_assistant_message_id: "message-clarification-1",
      selected_product_id: "product-syoss-intense-curls",
      selected_product_name: "Syoss Intense Curls",
    },
  }

  assert.equal(
    hasExistingProductSelectionMessage([message], {
      conversationId: "conversation-1",
      assistantMessageId: "message-clarification-1",
      clarificationId: "clarification-1",
      selectedProductId: "product-syoss-intense-curls",
    }),
    true,
  )
  assert.equal(
    hasExistingProductSelectionMessage([message], {
      conversationId: "conversation-1",
      assistantMessageId: "message-clarification-1",
      clarificationId: "clarification-1",
      selectedProductId: "another-product",
    }),
    true,
  )
})
