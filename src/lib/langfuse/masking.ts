import type { MaskFunction } from "@langfuse/otel"

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const PHONE_REGEX = /(?:\+?\d{1,3}[\s./-]?)?(?:\(?\d{2,4}\)?[\s./-]?)?\d{3,4}[\s./-]?\d{3,4}\b/g
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const REDACTED = "[redacted]"
const REDACTED_TEXT = "[redacted_sensitive_text]"
const REDACTED_AGENT_V2_CONTEXT = "[redacted_agent_v2_context]"
const REDACTED_RECENT_MESSAGE = "[redacted_recent_message]"
const REDACTED_REASONING = "[redacted_reasoning]"

const IDENTIFIER_KEYS = new Set([
  "email",
  "full_name",
  "first_name",
  "last_name",
  "phone",
  "telephone",
])

const SAFE_OBSERVABILITY_NAMES = new Set([
  "load_advisor_guidance",
  "select_products",
  "build_or_fix_routine",
  "set_current_care_context",
  "submit_final_answer",
  "production-chat-turn",
  "agent-v2-responses-step",
])

const SENSITIVE_TEXT_KEYS = new Set([
  "additional_notes",
  "memory_context",
  "conversation_memory",
  "notes",
  "free_text",
  "hairProfile",
  "routineInventory",
  "derivedSignals",
  "relevantMemory",
  "sessionMemory",
  "careBalanceContext",
  "routineThreadContext",
  "priorSelectedProductProjections",
  "recentMessages",
])

const AGENT_V2_HIDDEN_CONTEXT_PREFIXES = [
  "Loaded Chaarlie user context.",
  "CareBalance product-usage context.",
  "Active AgentV2 routine thread context,",
  "Surfaced product facts from earlier turns",
  "Conversation-scoped AgentV2 working memory.",
]

function maskString(value: string): string {
  if (UUID_REGEX.test(value)) return value.replace(EMAIL_REGEX, REDACTED)
  return value.replace(EMAIL_REGEX, REDACTED).replace(PHONE_REGEX, REDACTED)
}

function parseJsonString(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

function isAgentV2HiddenContextMessage(value: string): boolean {
  return AGENT_V2_HIDDEN_CONTEXT_PREFIXES.some((prefix) => value.startsWith(prefix))
}

function isSafeObservabilityName(value: string): boolean {
  return (
    SAFE_OBSERVABILITY_NAMES.has(value) ||
    value.startsWith("agent-v2-tool:") ||
    value.startsWith("chaarlie-")
  )
}

function maskOpenAIMessage(value: Record<string, unknown>): Record<string, unknown> {
  const role = value.role
  const content = value.content
  if (typeof content !== "string") return value

  if (typeof role === "string" && isAgentV2HiddenContextMessage(content)) {
    return { ...value, content: REDACTED_AGENT_V2_CONTEXT }
  }

  if (role === "user" || role === "assistant") {
    // Root chat observations are canonical for current-turn text; generation inputs redact duplicated conversation messages.
    return { ...value, content: REDACTED_RECENT_MESSAGE }
  }

  return { ...value, content: maskString(content) }
}

function maskResponsesOutputItem(value: Record<string, unknown>): Record<string, unknown> {
  if (value.type === "reasoning") {
    return { type: "reasoning", content: REDACTED_REASONING }
  }

  return value
}

function maskValue(value: unknown, key?: string): unknown {
  if (typeof value === "string") {
    if (key === "name") return isSafeObservabilityName(value) ? maskString(value) : REDACTED
    if (key && IDENTIFIER_KEYS.has(key)) return REDACTED
    if (key && SENSITIVE_TEXT_KEYS.has(key)) return REDACTED_TEXT
    return maskString(value)
  }

  if (Array.isArray(value)) {
    return value.map((entry) => maskValue(entry, key))
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    if (typeof record.role === "string" && Object.hasOwn(record, "content")) {
      return maskOpenAIMessage(record)
    }
    if (record.type === "reasoning") {
      return maskResponsesOutputItem(record)
    }

    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        maskValue(entryValue, entryKey),
      ]),
    )
  }

  return value
}

export const maskLangfuseExport: MaskFunction = ({ data }) => {
  if (typeof data === "string") {
    const parsed = parseJsonString(data)
    if (parsed !== undefined) {
      return JSON.stringify(maskValue(parsed))
    }
  }

  return maskValue(data)
}

export function sanitizeLangfuseText(value: string | null | undefined): string | null {
  if (!value) return null
  return maskString(value)
}
