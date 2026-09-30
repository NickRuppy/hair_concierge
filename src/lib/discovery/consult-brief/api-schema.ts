import type { ConsultInput } from "./input"

/**
 * The API-facing brief schema (consult-brief-hardening T3): a strict Structured Outputs
 * `json_schema`, built per request. Strict mode cannot express a free-key record, so
 * `swapReasons` travels as an array of `{ key, reason }` with `key` limited to this input's
 * allowed decision keys; `toConsultBriefSections` turns it back into the stored record shape.
 */

export const CONSULT_BRIEF_HEBEL_MIN = 3
export const CONSULT_BRIEF_HEBEL_MAX = 5
export const CONSULT_BRIEF_CALL_FRAGEN_MIN = 3
export const CONSULT_BRIEF_CALL_FRAGEN_MAX = 5
export const CONSULT_BRIEF_POINTS_MIN = 0.5
export const CONSULT_BRIEF_POINTS_MAX = 2

/** The swapReasons keys the model may use — the same set `buildConsultBriefPrompt` names. */
export function consultBriefSwapKeys(input: ConsultInput): string[] {
  return [
    ...new Set(
      input.products
        .filter((product) => product.decisionKey !== null && product.bucket === "tauschenOderNeu")
        .map((product) => product.decisionKey as string),
    ),
  ]
}

export type ConsultBriefJsonSchemaFormat = {
  type: "json_schema"
  name: string
  strict: true
  schema: Record<string, unknown>
}

const stringArray = (bounds: { minItems?: number; maxItems?: number } = {}) => ({
  type: "array",
  items: { type: "string" },
  ...bounds,
})

export function consultBriefJsonSchemaFormat(
  swapKeys: readonly string[],
): ConsultBriefJsonSchemaFormat {
  // An empty `enum` is not a valid strict schema; with no allowed keys the array is capped at
  // zero items instead, so the key's type never matters.
  const key = swapKeys.length > 0 ? { type: "string", enum: [...swapKeys] } : { type: "string" }
  return {
    type: "json_schema",
    name: "consult_brief",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["mechanik", "diagnose", "hebel", "swapReasons", "callFragen", "erwartungen"],
      properties: {
        mechanik: { type: "string" },
        diagnose: { type: "string" },
        hebel: {
          type: "array",
          minItems: CONSULT_BRIEF_HEBEL_MIN,
          maxItems: CONSULT_BRIEF_HEBEL_MAX,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "note", "points", "bucket"],
            properties: {
              title: { type: "string" },
              note: { type: "string" },
              points: {
                type: ["number", "null"],
                minimum: CONSULT_BRIEF_POINTS_MIN,
                maximum: CONSULT_BRIEF_POINTS_MAX,
              },
              bucket: { type: "string", enum: ["produkt", "umgang"] },
            },
          },
        },
        swapReasons: {
          type: "array",
          maxItems: swapKeys.length,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["key", "reason"],
            properties: { key, reason: { type: "string" } },
          },
        },
        callFragen: stringArray({
          minItems: CONSULT_BRIEF_CALL_FRAGEN_MIN,
          maxItems: CONSULT_BRIEF_CALL_FRAGEN_MAX,
        }),
        erwartungen: stringArray(),
      },
    },
  }
}

/**
 * The API answer → the stored sections shape: `swapReasons` array → record. Anything else —
 * including a duplicated key, which would silently eat another step's slot under `maxItems` —
 * passes through unchanged, so the storage schema still rejects it as `invalid_schema`.
 */
export function toConsultBriefSections(json: unknown): unknown {
  if (typeof json !== "object" || json === null || Array.isArray(json)) return json
  const { swapReasons } = json as { swapReasons?: unknown }
  if (!Array.isArray(swapReasons)) return json
  const record: Record<string, string> = {}
  for (const entry of swapReasons) {
    if (typeof entry !== "object" || entry === null) return json
    const { key, reason } = entry as { key?: unknown; reason?: unknown }
    if (typeof key !== "string" || typeof reason !== "string") return json
    if (Object.hasOwn(record, key)) return json
    record[key] = reason
  }
  return { ...json, swapReasons: record }
}
