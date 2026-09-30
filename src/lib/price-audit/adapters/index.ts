import { readFileSync } from "node:fs"
import { join } from "node:path"

import type { PriceAuditCandidate, RetailerObservation } from "../contracts"
import { observeViaDm, type DmSearch } from "./dm"
import { observeViaJsonLd, type JsonLdFetch } from "./json-ld"

/**
 * Host → adapter registry with the probe gate. A host may auto-write only when
 * `data/price-audit/probes/<host>.json` records a passing live probe that Nick
 * has reviewed (`enabledForAutoWrite: true` plus `reviewedBy`, written by
 * `scripts/price-audit/probe.ts` and reviewed against the live pages) and the
 * probe is younger than the expiry window. Hosts without an adapter, and
 * adapter results on unprobed hosts, end in the review lane — the registry
 * itself never writes anything.
 */

export const PROBE_DIR = "data/price-audit/probes"
/** A probe older than this no longer authorizes auto-writes; re-probe the host. */
export const PROBE_MAX_AGE_DAYS = 60

const JSON_LD_HOSTS = new Set(["rossmann.de", "mueller.de", "douglas.de"])

export type AdapterDeps = {
  dmSearch?: DmSearch
  jsonLdFetch?: JsonLdFetch
}

export function adapterHostFor(candidate: PriceAuditCandidate): string | null {
  if (!candidate.affiliateLink) return null
  try {
    return new URL(candidate.affiliateLink).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return null
  }
}

export function hasAdapter(host: string | null): boolean {
  return host === "dm.de" || (host !== null && JSON_LD_HOSTS.has(host))
}

export async function observeCandidate(
  candidate: PriceAuditCandidate,
  deps: AdapterDeps = {},
): Promise<{ host: string | null; observation: RetailerObservation }> {
  const host = adapterHostFor(candidate)
  if (host === "dm.de") {
    if (!deps.dmSearch) {
      return { host, observation: { kind: "failed", reason: "adapter_unavailable" } }
    }
    return { host, observation: await observeViaDm(candidate, { search: deps.dmSearch }) }
  }
  if (host && JSON_LD_HOSTS.has(host)) {
    return { host, observation: await observeViaJsonLd(candidate, { fetch: deps.jsonLdFetch }) }
  }
  return { host, observation: { kind: "failed", reason: "adapter_unavailable" } }
}

export type ProbeRecord = {
  host: string
  probedAt: string
  enabledForAutoWrite: boolean
  /** Set by Nick after comparing the probe samples to the live pages. */
  reviewedBy: string | null
  reviewedAt: string | null
  samples?: unknown[]
}

export function readProbeRecord(
  host: string,
  baseDir: string = process.cwd(),
): Partial<ProbeRecord> | null {
  try {
    const raw = readFileSync(join(baseDir, PROBE_DIR, `${host}.json`), "utf-8")
    return JSON.parse(raw) as Partial<ProbeRecord>
  } catch {
    return null
  }
}

export function hostAutoWriteEnabled(
  host: string | null,
  baseDir: string = process.cwd(),
  now: number = Date.now(),
): boolean {
  if (!host) return false
  const record = readProbeRecord(host, baseDir)
  if (!record || record.enabledForAutoWrite !== true) return false
  if (record.host !== host) return false
  if (typeof record.reviewedBy !== "string" || record.reviewedBy.trim() === "") return false
  // The flag alone is not evidence: the recorded samples themselves must be
  // non-empty and all confirmed, or the record does not authorize writes.
  if (!Array.isArray(record.samples) || record.samples.length === 0) return false
  const allConfirmed = record.samples.every((sample) => {
    if (typeof sample !== "object" || sample === null) return false
    const observation = (sample as { observation?: { kind?: unknown } }).observation
    return observation?.kind === "confirmed"
  })
  if (!allConfirmed) return false
  const probedAt = typeof record.probedAt === "string" ? Date.parse(record.probedAt) : Number.NaN
  if (!Number.isFinite(probedAt)) return false
  return now - probedAt <= PROBE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
}
