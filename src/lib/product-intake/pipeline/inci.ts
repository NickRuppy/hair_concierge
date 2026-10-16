import { createHash } from "node:crypto"
import { OIL_INTAKE_METHOD } from "@/lib/oil-research/registry"
import type { JsonRecord, ProductIntakeArtifactKind } from "@chaarlie/product-intake-core"

type Artifact = { kind: ProductIntakeArtifactKind; status?: string; payload: JsonRecord }
type InciSource =
  | "conditioner_envelope"
  | "leave_in_envelope"
  | "bondbuilder_envelope"
  | "mask_envelope"
  | "oil_envelope"
  | "model_formula"
  | "retailer_packet"
export type CanonicalInci = {
  status: "present" | "missing"
  source: InciSource | null
  raw_inci: string | null
  normalized_ingredients: string[]
  fingerprint_sha256: string | null
}
export type InciStageOptions = {
  retailerPacket?: { ingredients_text: string | null } | null
  inciRetryAttempted?: boolean
  oilAdmission?: {
    raw_inci: string
    normalized_ingredients: string[]
    normalized_sha256: string
  } | null
}

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null
}
function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

/** Fallback fingerprint is SHA-256 of uppercase INCI, punctuation replaced by spaces, and collapsed whitespace. */
function normalizedInciText(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/\p{Punctuation}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function present(raw: string, source: InciSource, formula?: JsonRecord): CanonicalInci {
  const normalized = formula?.normalizedIngredients ?? formula?.normalized_ingredients
  return {
    status: "present",
    source,
    raw_inci: raw,
    normalized_ingredients:
      Array.isArray(normalized) && normalized.every((item) => typeof item === "string")
        ? (normalized as string[])
        : raw.split(/[,;]+/).map(normalizedInciText).filter(Boolean),
    fingerprint_sha256: formula
      ? text(formula.formulaFingerprintSha256 ?? formula.normalized_sha256)
      : createHash("sha256").update(normalizedInciText(raw)).digest("hex"),
  }
}

export function extractCanonicalInci(
  artifacts: readonly { kind: string; payload: JsonRecord }[],
  retailerPacket?: { ingredients_text: string | null } | null,
  oilAdmission?: InciStageOptions["oilAdmission"],
): CanonicalInci {
  // Oil never falls back to comma splitting: literal numeric commas are a
  // valid portion of an INCI token. Only the server admission can supply it.
  if (oilAdmission) {
    return {
      status: "present",
      source: "oil_envelope",
      raw_inci: oilAdmission.raw_inci,
      normalized_ingredients: [...oilAdmission.normalized_ingredients],
      fingerprint_sha256: oilAdmission.normalized_sha256,
    }
  }
  for (const artifact of artifacts) {
    if (artifact.kind !== "property_synthesis") continue
    for (const category of ["conditioner", "leave_in", "bondbuilder", "mask"] as const) {
      const envelope = record(artifact.payload[`${category}_research_envelope`])
      const formula = record(
        category === "bondbuilder" ? record(envelope?.profile)?.formula : envelope?.formula,
      )
      const raw = text(formula?.rawInci ?? formula?.raw_inci)
      if (raw) return present(raw, `${category}_envelope`, formula!)
    }
  }
  for (const artifact of artifacts) {
    if (artifact.kind !== "formula" || artifact.payload.stage === "inci") continue
    const formula = record(artifact.payload.formula) ?? artifact.payload
    const raw = text(formula.raw_inci)
    if (raw) return present(raw, "model_formula")
  }
  const raw = text(retailerPacket?.ingredients_text)
  if (raw) return present(raw, "retailer_packet")
  return {
    status: "missing",
    source: null,
    raw_inci: null,
    normalized_ingredients: [],
    fingerprint_sha256: null,
  }
}

export function applyInciStage(
  payload: JsonRecord | null | undefined,
  artifacts: Artifact[],
  engine: { state: string; engineId: string | null },
  options: InciStageOptions,
): string | null {
  const draft = record(payload?.draft)
  const modelFormula = record(draft?.formula)
  const oilEngine = engine.engineId === OIL_INTAKE_METHOD.engine_id
  const result = extractCanonicalInci(
    oilEngine
      ? []
      : [...artifacts, ...(modelFormula ? [{ kind: "formula", payload: modelFormula }] : [])],
    oilEngine ? null : options.retailerPacket,
    options.oilAdmission,
  )
  if (payload) payload.draft = { ...draft, formula: { ...modelFormula, ...result } }
  for (let index = artifacts.length - 1; index >= 0; index--) {
    if (artifacts[index]!.kind === "formula" && artifacts[index]!.payload.stage === "inci")
      artifacts.splice(index, 1)
  }
  artifacts.push({ kind: "formula", status: result.status, payload: { stage: "inci", ...result } })
  if (!record(payload?.final) || engine.state !== "active" || result.status === "present")
    return null
  if (oilEngine)
    return "oil_admission_missing: current oil research did not produce server admission"
  return options.inciRetryAttempted === true
    ? `inci_unavailable: canonical INCI not found after targeted retry for ${engine.engineId}`
    : `inci_missing_first_pass: canonical INCI missing for ${engine.engineId}`
}
