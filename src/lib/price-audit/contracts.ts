/**
 * Contracts of the recurring price-audit lane (plans/price-audit-lane.md).
 *
 * The lane's honesty rule lives in these shapes: `price_checked_at` may only be
 * written through an `auto_write` decision whose observation actually read the
 * current price at the retailer. Observations and decisions are pure data so
 * the write policy is unit-testable without any network.
 */

export type PriceAuditCandidate = {
  id: string
  name: string
  brand: string | null
  affiliateLink: string | null
  priceEur: number | null
  priceCheckedAt: string | null
  purchaseLinkStatus: "available" | "unavailable" | null
  isChaarlieRecommended: boolean
  canonicalGtin14s: string[]
}

export type RetailerObservation =
  | {
      kind: "confirmed"
      /** How product identity was established at the retailer. */
      identity: "gtin_match" | "exact_stored_pdp"
      priceEur: number
      buyable: boolean
      /**
       * Where the buyability signal came from. Only `structured` evidence
       * (JSON-LD availability, dm `purchasable`/`sellout`) may auto-write
       * `unavailable`; text-classifier signals go to review instead.
       */
      buyableSource: "structured" | "text"
      evidenceUrl: string
      observedName: string | null
    }
  | {
      kind: "mismatch"
      reason:
        | "gtin_mismatch"
        | "name_mismatch"
        | "redirected"
        | "no_price_found"
        | "availability_unknown"
        | "ambiguous_offer"
        | "stored_link_mismatch"
        | "not_found"
      evidenceUrl: string | null
      observedName: string | null
      observedPriceEur: number | null
    }
  | {
      kind: "failed"
      reason: "http_error" | "timeout" | "bot_wall" | "adapter_unavailable"
    }

export type PriceAuditWrite = {
  priceEur?: number
  priceCheckedAt?: string
  purchaseLinkStatus: "available" | "unavailable"
  purchaseLinkCheckedAt: string
}

export type AuditDecision =
  | { action: "auto_write"; write: PriceAuditWrite }
  | { action: "review_proposal"; reason: string }
  | { action: "recheck_failed"; reason: string }

export type DecideOptions = {
  /** False until the host's recorded live probe passed; downgrades auto-writes. */
  hostAutoWriteEnabled: boolean
  /** ISO timestamp used for every stamp this run writes. */
  now: string
}
