import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { ChatMessage } from "@/components/chat/chat-message"
import {
  ProductIntakeCard,
  ProductIntakeSubmittedState,
} from "@/components/chat/product-intake-card"
import { ProductLookupClarificationCard } from "@/components/chat/product-lookup-clarification-card"
import { hasExistingProductSelectionMessage, readChatStreamErrorMessage } from "@/hooks/use-chat"
import { findResolvedProductLookupSelectionForMessage } from "@/lib/chat/product-lookup-selection-ui"
import type { Message, Product, ProductIntakeOffer, ProductLookupClarification } from "@/lib/types"

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

function createProductLookupClarificationWithTwoCandidates(): ProductLookupClarification {
  const clarification = createProductLookupClarification()

  return {
    ...clarification,
    candidates: [
      ...clarification.candidates,
      {
        product_id: "product-syoss-volume-lift",
        name: "Syoss Volume Lift",
        category: "shampoo",
        category_label_de: "Shampoo",
        reason: "same_brand_same_category",
      },
    ],
  }
}

type ClientStateHarness = {
  render: () => ReactElement
}

type ReactDispatcherInternals = {
  H: unknown
}

type ButtonElementProps = {
  children?: ReactNode
  disabled?: boolean
  onClick: () => Promise<void> | void
}

type ButtonElement = ReactElement<ButtonElementProps>

function createClientStateHarness(renderComponent: () => ReactElement): ClientStateHarness {
  const reactInternals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactDispatcherInternals
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const previousDispatcher = reactInternals.H
  const stateValues: unknown[] = []
  let cursor = 0

  const dispatcher = {
    useState<T>(initialState: T | (() => T)): [T, (nextState: T | ((previous: T) => T)) => void] {
      const stateIndex = cursor
      cursor += 1

      if (stateValues.length <= stateIndex) {
        stateValues[stateIndex] =
          typeof initialState === "function" ? (initialState as () => T)() : initialState
      }

      return [
        stateValues[stateIndex] as T,
        (nextState) => {
          stateValues[stateIndex] =
            typeof nextState === "function"
              ? (nextState as (previous: T) => T)(stateValues[stateIndex] as T)
              : nextState
        },
      ]
    },
  }

  return {
    render() {
      cursor = 0
      reactInternals.H = dispatcher
      try {
        return renderComponent()
      } finally {
        reactInternals.H = previousDispatcher
      }
    },
  }
}

function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (!React.isValidElement(node)) return ""

  const element = node as ReactElement<{ children?: ReactNode }>

  return React.Children.toArray(element.props.children)
    .map((child) => textContent(child))
    .join("")
}

function findButtons(node: ReactNode): ButtonElement[] {
  if (!React.isValidElement(node)) return []
  const element = node as ReactElement<{ children?: ReactNode } & Partial<ButtonElementProps>>

  return [
    "disabled" in element.props && "onClick" in element.props ? (element as ButtonElement) : null,
    ...React.Children.toArray(element.props.children).flatMap((child) => findButtons(child)),
  ].filter((button): button is ButtonElement => Boolean(button))
}

function createProductIntakeOffer(overrides: Partial<ProductIntakeOffer> = {}): ProductIntakeOffer {
  return {
    id: "offer-1",
    source: "chat",
    reason: "product_lookup_not_found",
    category: "shampoo",
    frequency_range: "weekly_1x",
    intake_method: "manual",
    missing_fields: [],
    extracted_identity: {
      brand_text: "Jean & Len",
      product_name_text: "Conditioner Granatapfel",
    },
    ...overrides,
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

test("assistant product lookup clarification locks after a later matching selection", () => {
  const clarificationMessage = createAssistantMessage("Meinst du dieses Produkt?", [])
  clarificationMessage.id = "message-clarification-1"
  clarificationMessage.rag_context = {
    sources: [],
    product_lookup_clarification: createProductLookupClarification(),
  }

  const selectionMessage = createAssistantMessage(
    "Alles klar, ich bewerte Syoss Intense Curls.",
    [],
  )
  selectionMessage.id = "message-selection-1"
  selectionMessage.rag_context = {
    sources: [],
    product_lookup_selection: {
      source: "product_lookup_clarification",
      clarification_id: "clarification-1",
      source_assistant_message_id: "message-clarification-1",
      selected_product_id: "product-syoss-intense-curls",
      selected_product_name: "Syoss Intense Curls",
    },
  }

  const resolvedSelection = findResolvedProductLookupSelectionForMessage(
    [clarificationMessage, selectionMessage],
    clarificationMessage,
  )

  const html = renderToStaticMarkup(
    <ChatMessage
      message={clarificationMessage}
      hairProfile={null}
      onSelectProductCandidate={() => {}}
      resolvedProductLookupSelection={resolvedSelection}
    />,
  )

  assert.match(html, /Syoss Intense Curls/)
  assert.match(html, /Ausgewählt/)
  assert.match(html, /<button[^>]*\sdisabled(?:=""|>| )[^>]*>[\s\S]*Ausgewählt/)
  assert.doesNotMatch(html, /Nein, mein Produkt hinzufügen/)
})

test("assistant product lookup clarification keeps candidate actions locked while waiting for resolved selection", async () => {
  const selectedProductIds: string[] = []
  const harness = createClientStateHarness(
    () =>
      ProductLookupClarificationCard({
        clarification: createProductLookupClarificationWithTwoCandidates(),
        conversationId: "conversation-1",
        assistantMessageId: "message-clarification-1",
        onSelectProduct: async ({ selectedProductId }) => {
          selectedProductIds.push(selectedProductId)
        },
      }) as ReactElement,
  )

  const firstRenderButtons = findButtons(harness.render())
  const firstCandidateButton = firstRenderButtons.find((button) =>
    textContent(button).includes("Auswählen"),
  )
  assert.ok(firstCandidateButton)

  await firstCandidateButton.props.onClick()

  const buttonsAfterResolvedRequest = findButtons(harness.render())
  const secondCandidateButton = buttonsAfterResolvedRequest.at(1)
  assert.ok(secondCandidateButton)

  assert.equal(textContent(secondCandidateButton), "Auswählen")
  assert.equal(secondCandidateButton.props.disabled, true)
  await secondCandidateButton.props.onClick()
  assert.deepEqual(selectedProductIds, ["product-syoss-intense-curls"])
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

test("normal product intake offers render as an action card without duplicate helper copy", () => {
  const html = renderToStaticMarkup(
    <ProductIntakeCard offer={createProductIntakeOffer()} conversationId="conversation-1" />,
  )

  assert.match(html, /Foto hochladen/)
  assert.match(html, /Daten eingeben/)
  assert.doesNotMatch(html, /Danke für dein Produkt/)
  assert.doesNotMatch(html, /Wir haben es noch nicht sicher in unserer Datenbank/)
})

test("needs-more-info product intake offers keep explicit repair guidance", () => {
  const html = renderToStaticMarkup(
    <ProductIntakeCard
      offer={createProductIntakeOffer({
        reason: "needs_more_info",
        missing_fields: ["Vorderseitenfoto", "Produktname"],
      })}
      conversationId="conversation-1"
    />,
  )

  assert.match(html, /Wir brauchen noch eine Ergänzung/)
  assert.match(html, /Ergänze bitte: Vorderseitenfoto, Produktname/)
})

test("pending product intake submitted state collapses the editable form", () => {
  const html = renderToStaticMarkup(<ProductIntakeSubmittedState status="pending_review" />)

  assert.match(html, /role="status"/)
  assert.match(html, /aria-live="polite"/)
  assert.match(html, /Danke, wir prüfen dein Produkt\./)
  assert.match(html, /Wir melden uns hier im Chat/)
  assert.doesNotMatch(html, /Foto hochladen/)
  assert.doesNotMatch(html, /Daten eingeben/)
  assert.doesNotMatch(html, /Kategorie/)
  assert.doesNotMatch(html, /Häufigkeit/)
  assert.doesNotMatch(html, /Jean &amp; Len/)
  assert.doesNotMatch(html, /Produkt einreichen/)
})

test("matched product intake submitted state renders compact saved copy", () => {
  const html = renderToStaticMarkup(<ProductIntakeSubmittedState status="matched" />)

  assert.match(html, /Produkt gespeichert\./)
  assert.match(html, /Du kannst dazu jetzt direkt weiterfragen\./)
  assert.doesNotMatch(html, /Foto hochladen/)
  assert.doesNotMatch(html, /Produkt einreichen/)
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

test("chat stream error helper preserves structured server error messages", () => {
  assert.equal(
    readChatStreamErrorMessage({ message: "Dieses Produkt wurde bereits ausgewählt." }),
    "Dieses Produkt wurde bereits ausgewählt.",
  )
  assert.equal(
    readChatStreamErrorMessage({ error: "Produkt konnte nicht ausgewählt werden." }),
    "Produkt konnte nicht ausgewählt werden.",
  )
  assert.equal(
    readChatStreamErrorMessage({ detail: "not user-facing" }),
    "Das Produkt konnte nicht ausgewählt werden. Bitte versuche es erneut.",
  )
})
