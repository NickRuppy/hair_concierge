import type { ProductLookupStatus } from "@/lib/product-intake/product-lookup"

export type AgentV2ProductLookupPendingUiAction =
  | "none"
  | "product_intake_card"
  | "product_lookup_clarification_card"

export type AgentV2ProductLookupAssistantGuidance = {
  pending_ui_action: AgentV2ProductLookupPendingUiAction
  assistant_instruction_de: string
}

export type AgentV2ProductLookupPolicy = AgentV2ProductLookupAssistantGuidance & {
  unresolved: boolean
  blocks_product_specific_answer: boolean
}

const DEFAULT_PRODUCT_LOOKUP_POLICY: AgentV2ProductLookupPolicy = {
  pending_ui_action: "none",
  assistant_instruction_de:
    "Nutze den Lookup-Status vorsichtig. Wenn das Produkt nicht sicher geklärt ist, bewerte es nicht fachlich.",
  unresolved: true,
  blocks_product_specific_answer: true,
}

const PRODUCT_LOOKUP_POLICIES: Record<ProductLookupStatus, AgentV2ProductLookupPolicy> = {
  found_exact: {
    pending_ui_action: "none",
    assistant_instruction_de:
      "Das Produkt wurde eindeutig in der Datenbank gefunden. Du darfst es anhand der hinterlegten Produkteigenschaften beantworten.",
    unresolved: false,
    blocks_product_specific_answer: false,
  },
  found_linkable_existing: {
    pending_ui_action: "product_lookup_clarification_card",
    assistant_instruction_de:
      "Das Produkt ist als geprüfter Datensatz bekannt, aber noch nicht für diese Nutzerin verknüpft und nicht als Chaarlie-Empfehlung gelistet. Bitte nicht fachlich bewerten, sondern kurz erklären, dass sie es über die Karte zu ihrer Routine hinzufügen kann.",
    unresolved: true,
    blocks_product_specific_answer: true,
  },
  not_found: {
    pending_ui_action: "product_intake_card",
    assistant_instruction_de:
      "Dieses Produkt ist noch nicht in der Datenbank. Erkläre kurz und natürlich, dass es zur Prüfung hinzugefügt werden kann, ohne es fachlich zu bewerten.",
    unresolved: true,
    blocks_product_specific_answer: true,
  },
  ambiguous: {
    pending_ui_action: "product_lookup_clarification_card",
    assistant_instruction_de:
      "Es gibt mehrere mögliche Treffer. Bitte den Nutzer kurz bitten, die passende Variante in der Karte auszuwählen; die ursprüngliche Produktfrage noch nicht beantworten.",
    unresolved: true,
    blocks_product_specific_answer: true,
  },
  needs_variant_selection: {
    pending_ui_action: "product_lookup_clarification_card",
    assistant_instruction_de:
      "Es gibt mehrere mögliche Treffer. Bitte den Nutzer kurz bitten, die passende Variante in der Karte auszuwählen; die ursprüngliche Produktfrage noch nicht beantworten.",
    unresolved: true,
    blocks_product_specific_answer: true,
  },
  category_mismatch: {
    pending_ui_action: "product_lookup_clarification_card",
    assistant_instruction_de:
      "Das Produkt wurde nur in einer anderen Kategorie gefunden. Bitte den Nutzer kurz bitten, die Variante in der Karte zu bestätigen oder das eigene Produkt hinzuzufügen; die ursprüngliche Produktfrage noch nicht beantworten.",
    unresolved: true,
    blocks_product_specific_answer: true,
  },
  insufficient_identity: {
    pending_ui_action: "none",
    assistant_instruction_de:
      "Es fehlen noch Angaben, um das Produkt sicher zu suchen. Frage kurz nach der fehlenden Kategorie, Marke oder Produktvariante.",
    unresolved: true,
    blocks_product_specific_answer: true,
  },
  unsupported_category: {
    pending_ui_action: "none",
    assistant_instruction_de:
      "Diese Produktkategorie kann aktuell noch nicht hinzugefügt werden. Erkläre das freundlich und frage höchstens nach einer unterstützten Kategorie.",
    unresolved: true,
    blocks_product_specific_answer: true,
  },
}

function isProductLookupStatus(value: string): value is ProductLookupStatus {
  return Object.prototype.hasOwnProperty.call(PRODUCT_LOOKUP_POLICIES, value)
}

export function getAgentV2ProductLookupPolicy(status: string): AgentV2ProductLookupPolicy {
  return isProductLookupStatus(status)
    ? PRODUCT_LOOKUP_POLICIES[status]
    : DEFAULT_PRODUCT_LOOKUP_POLICY
}

export function getAgentV2ProductLookupAssistantGuidance(
  status: string,
): AgentV2ProductLookupAssistantGuidance {
  const policy = getAgentV2ProductLookupPolicy(status)
  return {
    pending_ui_action: policy.pending_ui_action,
    assistant_instruction_de: policy.assistant_instruction_de,
  }
}

export function isAgentV2ProductLookupUnresolvedStatus(status: string): boolean {
  return getAgentV2ProductLookupPolicy(status).unresolved
}

export function agentV2ProductLookupStatusBlocksProductSpecificAnswer(status: string): boolean {
  return getAgentV2ProductLookupPolicy(status).blocks_product_specific_answer
}

export function agentV2ProductLookupStatusHasPendingCard(status: string): boolean {
  return getAgentV2ProductLookupPolicy(status).pending_ui_action !== "none"
}

export function agentV2ProductLookupStatusHasClarificationCard(status: string): boolean {
  return (
    getAgentV2ProductLookupPolicy(status).pending_ui_action === "product_lookup_clarification_card"
  )
}

export function enrichAgentV2ProductLookupResultForAssistant(output: unknown): unknown {
  if (!output || typeof output !== "object" || Array.isArray(output)) return output

  const record = output as Record<string, unknown>
  if (typeof record.status !== "string") return output

  return {
    ...record,
    assistant_guidance: getAgentV2ProductLookupAssistantGuidance(record.status),
  }
}
