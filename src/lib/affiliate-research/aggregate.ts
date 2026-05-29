import { isAllowedHost, passesBrandDirect, urlGate } from "./url-gate"

export type Confidence = "high" | "medium" | "none"

export type ResultRow = {
  id: string
  brand: string
  name: string
  chosen_url: string
  host: string
  confidence: Confidence | string
  matched_tokens: string
  notes: string
}

const CONFIDENCE_RANK: Record<string, number> = { high: 3, medium: 2, none: 1 }

function hostRank(row: ResultRow): number {
  if (!row.host) return 0
  if (isAllowedHost(row.host)) return 3
  if (passesBrandDirect(row.host, row.brand)) return 2
  return 1
}

export function dedupeByConfidence(rows: ResultRow[]): ResultRow[] {
  const best = new Map<string, ResultRow>()
  for (const r of rows) {
    const existing = best.get(r.id)
    if (!existing) {
      best.set(r.id, r)
      continue
    }
    const a = CONFIDENCE_RANK[r.confidence] ?? 0
    const b = CONFIDENCE_RANK[existing.confidence] ?? 0
    if (a > b || (a === b && hostRank(r) > hostRank(existing))) {
      best.set(r.id, r)
    }
  }
  return [...best.values()]
}

export type ClassifyResult =
  | { bucket: "approved"; reason: "" }
  | { bucket: "review"; reason: string }

export function classifyForOutput(row: ResultRow): ClassifyResult {
  if (row.confidence !== "high") {
    return { bucket: "review", reason: `confidence is '${row.confidence}', not 'high'` }
  }
  if (!row.matched_tokens || row.matched_tokens.trim() === "") {
    return { bucket: "review", reason: "matched_tokens is empty" }
  }
  const gate = urlGate({ chosen_url: row.chosen_url, brand: row.brand })
  if (gate.pass === false) {
    return { bucket: "review", reason: gate.reason }
  }
  return { bucket: "approved", reason: "" }
}
