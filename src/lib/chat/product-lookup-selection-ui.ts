import type { Message, ProductLookupSelectionContext } from "@/lib/types"

export function buildResolvedProductLookupSelectionByMessageId(
  messages: Message[],
): Map<string, ProductLookupSelectionContext> {
  const sourceCards = new Map<
    string,
    {
      sourceMessageId: string
      candidateProductIds: Set<string>
    }
  >()

  for (const message of messages) {
    const clarification = message.rag_context?.product_lookup_clarification
    if (!clarification || message.role !== "assistant") {
      continue
    }

    sourceCards.set(`${message.id}:${clarification.id}`, {
      sourceMessageId: message.id,
      candidateProductIds: new Set(
        clarification.candidates.map((candidate) => candidate.product_id),
      ),
    })
  }

  const resolvedSelections = new Map<string, ProductLookupSelectionContext>()
  for (const message of [...messages].reverse()) {
    const selection = message.rag_context?.product_lookup_selection
    if (selection?.source !== "product_lookup_clarification") {
      continue
    }

    const sourceCard = sourceCards.get(
      `${selection.source_assistant_message_id}:${selection.clarification_id}`,
    )
    if (
      sourceCard &&
      !resolvedSelections.has(sourceCard.sourceMessageId) &&
      sourceCard.candidateProductIds.has(selection.selected_product_id)
    ) {
      resolvedSelections.set(sourceCard.sourceMessageId, selection)
    }
  }

  return resolvedSelections
}

export function findResolvedProductLookupSelectionForMessage(
  messages: Message[],
  sourceMessage: Message,
): ProductLookupSelectionContext | null {
  return buildResolvedProductLookupSelectionByMessageId(messages).get(sourceMessage.id) ?? null
}
