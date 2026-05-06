import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { ChatMessage } from "@/components/chat/chat-message"
import type { Message, Product } from "@/lib/types"

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
  assert.match(html, /<strong>[\s\S]*Silky Leave-in[\s\S]*<\/strong>/)
})
