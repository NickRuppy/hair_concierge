import type { MaskFunction } from "@langfuse/otel"

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const PHONE_REGEX = /(?:\+?\d{1,3}[\s./-]?)?(?:\(?\d{2,4}\)?[\s./-]?)?\d{3,4}[\s./-]?\d{3,4}\b/g

const REDACTED = "[redacted]"
const REDACTED_TEXT = "[redacted_sensitive_text]"

const IDENTIFIER_KEYS = new Set([
  "email",
  "full_name",
  "name",
  "first_name",
  "last_name",
  "phone",
  "telephone",
])

const SENSITIVE_TEXT_KEYS = new Set([
  "additional_notes",
  "memory_context",
  "conversation_memory",
  "notes",
  "free_text",
])

function maskString(value: string): string {
  return value.replace(EMAIL_REGEX, REDACTED).replace(PHONE_REGEX, REDACTED)
}

function maskValue(value: unknown, key?: string): unknown {
  if (typeof value === "string") {
    if (key && IDENTIFIER_KEYS.has(key)) return REDACTED
    if (key && SENSITIVE_TEXT_KEYS.has(key)) return REDACTED_TEXT
    return maskString(value)
  }

  if (Array.isArray(value)) {
    return value.map((entry) => maskValue(entry, key))
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        maskValue(entryValue, entryKey),
      ]),
    )
  }

  return value
}

export const maskLangfuseExport: MaskFunction = ({ data }) => maskValue(data)

export function sanitizeLangfuseText(value: string | null | undefined): string | null {
  if (!value) return null
  return maskString(value)
}
