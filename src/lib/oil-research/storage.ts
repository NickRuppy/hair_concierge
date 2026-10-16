import { isDeepStrictEqual } from "node:util"
import { OIL_INTAKE_METHOD } from "./registry"

import { OilResearchEnvelopeSchema, sha256Utf8, type OilResearchEnvelope } from "./contracts"

export const OIL_STORAGE_VERSION = "oil-research-storage-v1" as const

export type OilStorage = {
  oil_storage_version: typeof OIL_STORAGE_VERSION
  /** Readable JSONB mirror for ordinary inspection and SQL filtering. */
  oil_research_envelope: OilResearchEnvelope
  /** Exact UTF-8 source used by provenance and receipt verification. */
  oil_research_envelope_json: string
  oil_research_envelope_sha256: string
}

export type ResolveOilStorageOptions = { requireFresh?: boolean; requireCurrent?: boolean }

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson)
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(object)
        .sort()
        .map((key) => [key, canonicalJson(object[key])]),
    )
  }
  return value
}

function freshEnvelopeOrThrow(envelope: OilResearchEnvelope): OilResearchEnvelope {
  if (
    envelope.research_method.purpose !== "intake_research" ||
    envelope.provenance.import_kind !== "current" ||
    envelope.submission_id === null
  )
    throw new Error("Oil storage requires a current intake-bound research envelope")
  return envelope
}

/** Serializes once and stores both the exact body and a structurally readable mirror. */
export function createOilStorage(input: unknown): OilStorage {
  const envelope = OilResearchEnvelopeSchema.parse(input)
  const exactBody = JSON.stringify(envelope)
  return {
    oil_storage_version: OIL_STORAGE_VERSION,
    oil_research_envelope: structuredClone(envelope),
    oil_research_envelope_json: exactBody,
    oil_research_envelope_sha256: sha256Utf8(exactBody),
  }
}

/**
 * Resolves database JSONB-shaped data without reserializing the mirror. The
 * exact body is authoritative for byte digests; key order in JSONB is ignored
 * only for the mirror equality check.
 */
export function resolveOilStorage(
  payload: unknown,
  options: ResolveOilStorageOptions = {},
): OilResearchEnvelope {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("Oil storage payload must be an object")
  const value = payload as Partial<OilStorage>
  if (value.oil_storage_version !== OIL_STORAGE_VERSION)
    throw new Error("Unsupported oil storage version")
  if (typeof value.oil_research_envelope_json !== "string")
    throw new Error("Oil storage exact body is missing")
  if (
    typeof value.oil_research_envelope_sha256 !== "string" ||
    value.oil_research_envelope_sha256 !== sha256Utf8(value.oil_research_envelope_json)
  )
    throw new Error("Oil storage exact body digest mismatch")

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(value.oil_research_envelope_json)
  } catch {
    throw new Error("Oil storage exact body is not JSON")
  }
  const envelope = OilResearchEnvelopeSchema.parse(parsedJson)
  if (!isDeepStrictEqual(canonicalJson(envelope), canonicalJson(value.oil_research_envelope)))
    throw new Error("Oil storage mirror differs from exact body")
  if (options.requireFresh || options.requireCurrent) freshEnvelopeOrThrow(envelope)
  if (
    options.requireCurrent &&
    (envelope.version !== "oil-research-envelope-v2" ||
      !isDeepStrictEqual(envelope.research_method, OIL_INTAKE_METHOD))
  )
    throw new Error("Oil storage requires the exact current v0.10 intake method")
  return envelope
}
