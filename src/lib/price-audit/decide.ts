import type {
  AuditDecision,
  DecideOptions,
  PriceAuditCandidate,
  RetailerObservation,
} from "./contracts"

/** Observed prices outside (0, MAX_SANE_PRICE_EUR] are anomalies, never auto-written. */
const MAX_SANE_PRICE_EUR = 500
/** A confirmed price differing from the stored one by more than this goes to review. */
const MAX_PRICE_DELTA_RATIO = 0.3

export function decide(
  candidate: PriceAuditCandidate,
  observation: RetailerObservation,
  options: DecideOptions,
): AuditDecision {
  if (observation.kind === "failed") {
    return { action: "recheck_failed", reason: observation.reason }
  }

  if (observation.kind === "mismatch") {
    return {
      action: "review_proposal",
      reason: `${observation.reason}: beobachtet ${observation.observedName ?? "unbekannt"} @ ${observation.evidenceUrl ?? "keine URL"}`,
    }
  }

  // GPT fallback lane (identity `llm_research`): runs exactly where no probed
  // adapter could confirm, so the host probe gate does not apply. It may write
  // the price and its stamp only — a link-status claim from an LLM goes to
  // review instead of touching the buy CTA (Nick, 2026-09-30).
  if (observation.identity === "llm_research") {
    if (!observation.buyable) {
      return {
        action: "review_proposal",
        reason: `llm_reports_unavailable: ${observation.priceEur} EUR @ ${observation.evidenceUrl} — verify link status manually`,
      }
    }
    const llmAnomaly = priceAnomaly(candidate, observation.priceEur)
    if (llmAnomaly) {
      return { action: "review_proposal", reason: llmAnomaly }
    }
    return {
      action: "auto_write",
      write: { priceEur: observation.priceEur, priceCheckedAt: options.now },
    }
  }

  if (!options.hostAutoWriteEnabled) {
    return {
      action: "review_proposal",
      reason: `host probe missing or failed: confirmed ${observation.priceEur} EUR (${observation.identity}) requires manual apply`,
    }
  }

  if (!observation.buyable) {
    // Writing `unavailable` hides the buy CTA on several surfaces, so it needs
    // structured retailer evidence; a text-classifier hit alone goes to review.
    if (observation.buyableSource !== "structured") {
      return {
        action: "review_proposal",
        reason:
          "unstructured unavailability signal: needs manual confirmation before hiding the buy link",
      }
    }
    // Unavailable pages often show a stale last-known price, so only the link
    // status is written; the stored price keeps its old stamp and stays hidden.
    return {
      action: "auto_write",
      write: {
        purchaseLinkStatus: "unavailable",
        purchaseLinkCheckedAt: options.now,
      },
    }
  }

  const anomaly = priceAnomaly(candidate, observation.priceEur)
  if (anomaly) {
    return { action: "review_proposal", reason: anomaly }
  }

  return {
    action: "auto_write",
    write: {
      priceEur: observation.priceEur,
      priceCheckedAt: options.now,
      purchaseLinkStatus: "available",
      purchaseLinkCheckedAt: options.now,
    },
  }
}

function priceAnomaly(candidate: PriceAuditCandidate, observedPriceEur: number): string | null {
  if (!Number.isFinite(observedPriceEur) || observedPriceEur <= 0) {
    return `non-positive observed price: ${observedPriceEur}`
  }
  if (observedPriceEur > MAX_SANE_PRICE_EUR) {
    return `implausible observed price: ${observedPriceEur} EUR`
  }
  const stored = candidate.priceEur
  if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) {
    const delta = Math.abs(observedPriceEur - stored) / stored
    // Cent prices hit the ratio boundary with float noise; a delta of exactly 30% stays in.
    if (delta > MAX_PRICE_DELTA_RATIO + 1e-9) {
      return `price delta ${(delta * 100).toFixed(0)}% (${stored} -> ${observedPriceEur} EUR) exceeds ${MAX_PRICE_DELTA_RATIO * 100}%`
    }
  }
  return null
}
