import type { JsonRecord } from "@chaarlie/product-intake-core"

export type CodexResearchRuntimeConfig = {
  model: string
  reasoningEffort: string
  serviceTier: string | null
}

export function normalizeRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null
}

export function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

export function errorMessage(error: unknown): string {
  return truncateDiagnostic(
    error instanceof Error ? error.message : "Unknown model evaluation failure.",
  )
}

export function truncateDiagnostic(message: string): string {
  return message.length <= 4_000 ? message : `${message.slice(0, 3_997)}...`
}

export function nonBlankString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string.`)
  }
  return value.trim()
}

export function optionalNonBlankString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

export function nonBlankEnv(value: string | undefined, fallback: string): string {
  const normalized = value?.trim()
  return normalized ? normalized : fallback
}

export function optionalServiceTier(value: string | undefined): string | null {
  const normalized = value?.trim()
  return normalized && normalized !== "standard" ? normalized : null
}

export function boundedNumber(value: unknown, min: number, max: number, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Model judge verdict has invalid ${field}.`)
  }
  return value
}

export function parseJsonObject(raw: string): JsonRecord {
  try {
    const record = normalizeRecord(JSON.parse(raw) as unknown)
    if (record) return record
  } catch {
    // Fall through to scanning for the first complete top-level object.
  }

  const stack: string[] = []
  const firstBrace = raw.indexOf("{")
  let firstBraceInCompleteArray = false
  let start = -1
  let inString = false
  let escaped = false

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index]
    if (inString) {
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === "{" || char === "[") {
      if (stack.length === 0) start = index
      stack.push(char)
      continue
    }
    if ((char !== "}" && char !== "]") || stack.length === 0) continue
    const opening = stack.pop()
    if ((opening === "{" && char !== "}") || (opening === "[" && char !== "]")) break
    if (stack.length > 0) continue
    if (raw[start] !== "{") {
      if (firstBrace >= start && firstBrace <= index) firstBraceInCompleteArray = true
      continue
    }

    try {
      const record = normalizeRecord(JSON.parse(raw.slice(start, index + 1)) as unknown)
      if (record) return record
    } catch {
      // Skip malformed complete candidates, never promote their nested objects.
    }
  }

  // Preserve the slice fallback for stray prose delimiters, without extracting array elements.
  if (!firstBraceInCompleteArray) {
    const lastBrace = raw.lastIndexOf("}")
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        const record = normalizeRecord(JSON.parse(raw.slice(firstBrace, lastBrace + 1)) as unknown)
        if (record) return record
      } catch {
        // The compatibility slice must also be a complete object.
      }
    }
  }
  throw new Error("Codex output contained no complete top-level JSON object.")
}

export function hasFinalResearchPayload(value: JsonRecord | null | undefined): value is JsonRecord {
  return Boolean(normalizeRecord(value)?.final && normalizeRecord(normalizeRecord(value)?.final))
}

export function assertAllowedProductIntakeModel(model: string, lane: string): void {
  if (model.trim().toLowerCase().startsWith("gpt-6-astra")) {
    throw new Error(`GPT-6 Astra is disabled for Product Intake (${lane}).`)
  }
}
