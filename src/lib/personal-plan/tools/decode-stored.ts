import { z } from "zod"

import {
  toolAssetSchema,
  toolGuidanceSchema,
  toolOccurrenceSchema,
  type ToolAsset,
  type ToolDayAnchor,
  type ToolGuidance,
  type ToolOccurrence,
} from "./contracts"

/**
 * Read-time compatibility decoders for stored Tool rows. Nothing here rewrites a
 * row; each rule only changes what the application reads out of one.
 *
 * The branch persisted Tool occurrences and guidance under the pre-`D7` anchor
 * contract — the five-slot `{ kind, phase }` union, and no `sessionKey` at all.
 * `D7` replaced that with the shared eleven-position day graph
 * (`{ position, relativeToStep }`) and `A09` added `sessionKey`. Those rows are
 * real (dev and labs owners hold them), and today's strict schema rejects them,
 * so every Routine read boundary maps the old shape forward before it parses.
 *
 * The mapping is the `D7` derivation table read backwards:
 *
 * | Stored anchor | Decoded position | `relativeToStep` |
 * | --- | --- | --- |
 * | `{ kind: "wash_day", phase: "wash" }` | `wet_cleanse` | `null` |
 * | `{ kind: "wash_day", phase: "post_wash" }` | `post_rinse_towel_dry` | `null` |
 * | `{ kind: "wash_day", phase: "drying" }` | `dry_pre_heat` | `null` |
 * | `{ kind: "wash_day", phase: "styling" }` | `styling_session` | `null` |
 * | `{ kind: "after_step", stepKey }` | `post_rinse_towel_dry` | `{ side: "after", stepKey }` |
 * | `{ kind: "before_step", stepKey }` | `post_rinse_towel_dry` | `{ side: "before", stepKey }` |
 * | `{ kind: "nightly" }` | `nightly` | `null` |
 * | `{ kind: "styling_session" }` | `styling_session` | `null` |
 *
 * A step-relative anchor decodes into the post-rinse position because that is
 * the only position the old contract could express one against: it was a phase
 * of its own, and the product steps it named live in the post-wash block.
 */
const LEGACY_WASH_DAY_POSITIONS: Record<string, ToolDayAnchor> = {
  wash: "wet_cleanse",
  post_wash: "post_rinse_towel_dry",
  drying: "dry_pre_heat",
  styling: "styling_session",
}

/** The position a step-relative anchor had no way to name before `D7`. */
const LEGACY_STEP_RELATIVE_POSITION: ToolDayAnchor = "post_rinse_towel_dry"

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

/**
 * Maps one stored anchor forward. An anchor already written in the `D7` shape,
 * or one this decoder does not recognise, is returned untouched — validation,
 * not the decoder, decides whether it is legal.
 */
export function decodeStoredToolOccurrenceAnchor(raw: unknown): unknown {
  if (!isRecord(raw) || !("kind" in raw)) return raw
  switch (raw.kind) {
    case "wash_day": {
      const position = LEGACY_WASH_DAY_POSITIONS[String(raw.phase)]
      return position ? { position, relativeToStep: null } : raw
    }
    case "after_step":
    case "before_step":
      return typeof raw.stepKey === "string"
        ? {
            position: LEGACY_STEP_RELATIVE_POSITION,
            relativeToStep: {
              side: raw.kind === "after_step" ? "after" : "before",
              stepKey: raw.stepKey,
            },
          }
        : raw
    case "nightly":
      return { position: "nightly", relativeToStep: null }
    case "styling_session":
      return { position: "styling_session", relativeToStep: null }
    default:
      return raw
  }
}

function decodeStoredToolOccurrence(raw: unknown): unknown {
  if (!isRecord(raw)) return raw
  const occurrence: Record<string, unknown> = { ...raw }
  if ("anchor" in occurrence) {
    occurrence.anchor = decodeStoredToolOccurrenceAnchor(occurrence.anchor)
  }
  // `A09` added the session key. A row written before it simply had no linked
  // parent session, which is exactly what `null` means.
  if (occurrence.sessionKey === undefined) occurrence.sessionKey = null
  return occurrence
}

function decodeStoredToolGuidance(raw: unknown): unknown {
  if (!isRecord(raw)) return raw
  if (!("anchor" in raw)) return raw
  return { ...raw, anchor: decodeStoredToolOccurrenceAnchor(raw.anchor) }
}

function decodeList(raw: unknown, decode: (entry: unknown) => unknown): unknown {
  return Array.isArray(raw) ? raw.map(decode) : raw
}

/** The three Tool arrays a Routine V2 payload or a plan Tool plan carries. */
export type StoredToolRows = {
  assets: ToolAsset[]
  occurrences: ToolOccurrence[]
  guidance: ToolGuidance[]
}

const storedToolRowsSchema = z
  .object({
    assets: z.array(toolAssetSchema).max(32),
    occurrences: z.array(toolOccurrenceSchema).max(64),
    guidance: z.array(toolGuidanceSchema).max(32),
  })
  .strict()

/**
 * Decodes the Tool arrays of a stored payload without validating them. The
 * caller decides what an invalid slice means for its own boundary.
 */
export function decodeStoredToolRows(input: {
  assets: unknown
  occurrences: unknown
  guidance: unknown
}): { assets: unknown; occurrences: unknown; guidance: unknown } {
  return {
    assets: input.assets,
    occurrences: decodeList(input.occurrences, decodeStoredToolOccurrence),
    guidance: decodeList(input.guidance, decodeStoredToolGuidance),
  }
}

/**
 * Decodes and validates the Tool slice of a stored refined-need snapshot.
 *
 * Returns `null` when there is nothing to copy, or when the slice is still
 * invalid after decoding: a compiled Routine must never embed Tool rows that
 * its own readers would reject, and a product-only V1 Routine is the honest
 * fallback.
 */
export function decodeStoredPlanToolRows(raw: unknown): StoredToolRows | null {
  if (!isRecord(raw)) return null
  const decoded = decodeStoredToolRows({
    assets: raw.assets,
    occurrences: raw.occurrences,
    guidance: raw.guidance,
  })
  const parsed = storedToolRowsSchema.safeParse(decoded)
  if (parsed.success) return parsed.data
  console.warn("personal_plan_tool_plan_slice_dropped", {
    schemaVersion: raw.schemaVersion ?? null,
    issue: parsed.error.issues[0]?.message ?? "invalid_tool_slice",
  })
  return null
}
