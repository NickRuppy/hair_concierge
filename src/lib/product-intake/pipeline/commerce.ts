import { urlGate } from "../../affiliate-research/url-gate"
import {
  adapterHostFor,
  hasAdapter,
  hostAutoWriteEnabled as priceAuditHostAutoWriteEnabled,
  observeCandidate,
} from "../../price-audit/adapters"
import type { DmSearch } from "../../price-audit/adapters/dm"
import type { PriceAuditCandidate, RetailerObservation } from "../../price-audit/contracts"
import { canonicalizeGtin } from "../../product-identity/normalize"
import type { JsonRecord } from "../repository-types"

export type CommerceStageDeps = {
  dmSearch?: DmSearch
  jsonLdFetch?: typeof fetch
  hostAutoWriteEnabled?: (host: string | null) => boolean
  now: () => Date
}

export type CommerceStageResult = {
  artifact: {
    kind: "commerce_check"
    status: "confirmed" | "unconfirmed" | "conflict"
    payload: JsonRecord
  }
  writes: {
    price_eur?: number
    price_checked_at?: string
  }
  blockers: string[]
}

export async function runCommerceStage(input: {
  submissionId: string
  final: JsonRecord
  deps: CommerceStageDeps
}): Promise<CommerceStageResult> {
  const { submissionId, final, deps } = input
  const product = record(final.product)
  const canonicalGtin14s = new Set<string>()
  for (const entry of Array.isArray(final.identifiers) ? final.identifiers : []) {
    const identifier = record(entry)
    if (identifier.type !== "barcode" && identifier.type !== "gtin" && identifier.type !== "ean")
      continue
    if (typeof identifier.value !== "string") continue
    const gtin = canonicalizeGtin(identifier.value)
    if (gtin) canonicalGtin14s.add(gtin)
  }
  const candidate: PriceAuditCandidate = {
    id: submissionId,
    name: text(product.clean_name) ?? "",
    brand: text(product.canonical_brand),
    affiliateLink: text(product.affiliate_link),
    priceEur:
      typeof product.price_eur === "number" && Number.isFinite(product.price_eur)
        ? product.price_eur
        : null,
    priceCheckedAt: text(product.price_checked_at),
    purchaseLinkStatus:
      product.purchase_link_status === "available" || product.purchase_link_status === "unavailable"
        ? product.purchase_link_status
        : null,
    isChaarlieRecommended: false,
    canonicalGtin14s: [...canonicalGtin14s],
  }
  const host = adapterHostFor(candidate)
  const writes: CommerceStageResult["writes"] = {}
  const blockers: string[] = []
  let adapterFetched = false
  let observation: RetailerObservation | null = null
  let modelPriceDeltaPct: number | null = null
  const result = (status: CommerceStageResult["artifact"]["status"]): CommerceStageResult => ({
    artifact: {
      kind: "commerce_check",
      status,
      payload: {
        stage: "commerce",
        host,
        adapter_fetched: adapterFetched,
        observation,
        model_values: {
          affiliate_link: candidate.affiliateLink,
          price_eur: candidate.priceEur,
          purchase_link_status: candidate.purchaseLinkStatus,
        },
        writes,
        model_price_delta_pct: modelPriceDeltaPct,
        link_gate: gate,
      },
    },
    writes,
    blockers,
  })

  // The affiliate gate is advisory for intake; retain model values on an unconfirmed link.
  const gate = urlGate({ chosen_url: candidate.affiliateLink, brand: candidate.brand })
  if (!gate.pass) {
    return result("unconfirmed")
  }

  // Unsupported and unprobed hosts keep model values, without fetching or blocking.
  if (!hasAdapter(host)) return result("unconfirmed")
  const now = deps.now()
  const enabled = deps.hostAutoWriteEnabled
    ? deps.hostAutoWriteEnabled(host)
    : priceAuditHostAutoWriteEnabled(host, process.cwd(), now.getTime())
  if (!enabled) return result("unconfirmed")

  // Adapter failures (including unexpected crashes) are unconfirmed, never evidence of absence.
  adapterFetched = true
  try {
    observation = (
      await observeCandidate(candidate, {
        dmSearch: deps.dmSearch,
        jsonLdFetch: deps.jsonLdFetch,
      })
    ).observation
  } catch {
    observation = { kind: "failed", reason: "adapter_unavailable" }
  }
  if (observation.kind === "failed") return result("unconfirmed")

  // Identity/link conflicts require review and cannot replace model commerce fields.
  if (observation.kind === "mismatch") {
    blockers.push(`commerce_link_mismatch: ${observation.reason} (${observation.evidenceUrl})`)
    return result("conflict")
  }
  if (observation.identity !== "gtin_match" && observation.identity !== "exact_stored_pdp") {
    return result("unconfirmed")
  }

  // Record absolute model-relative delta as evidence, never a 30% intake write gate.
  if (
    candidate.priceEur !== null &&
    candidate.priceEur > 0 &&
    Number.isFinite(observation.priceEur)
  ) {
    modelPriceDeltaPct =
      (Math.abs(observation.priceEur - candidate.priceEur) / candidate.priceEur) * 100
  }

  // Structured unavailability contradicting the model blocks review readiness, not price confirmation.
  if (
    !observation.buyable &&
    observation.buyableSource === "structured" &&
    candidate.purchaseLinkStatus === "available"
  ) {
    blockers.push("commerce_availability_conflict: shop reports not buyable")
  }

  // Anomalous prices never write; sane adapter-confirmed prices replace only the price pair.
  if (
    !Number.isFinite(observation.priceEur) ||
    observation.priceEur <= 0 ||
    observation.priceEur > 500
  ) {
    blockers.push(`commerce_price_anomaly: ${observation.priceEur}`)
    return result("conflict")
  }
  writes.price_eur = observation.priceEur
  writes.price_checked_at = now.toISOString()
  return result("confirmed")
}

export function applyCommerceWrites(
  final: JsonRecord,
  writes: CommerceStageResult["writes"],
): void {
  const product = record(final.product)
  if (writes.price_eur !== undefined) product.price_eur = writes.price_eur
  if (writes.price_checked_at !== undefined) product.price_checked_at = writes.price_checked_at
}

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {}
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}
