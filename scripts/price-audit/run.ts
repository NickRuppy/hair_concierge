import * as Sentry from "@sentry/node"
import { spawn } from "node:child_process"
import { config as loadEnv } from "dotenv"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { writeCsv, type CsvRow } from "../../src/lib/affiliate-research/csv"
import { createDmMcpClient } from "../../src/lib/scan/enrichment/dm-mcp-client"
import {
  adapterHostFor,
  hasAdapter,
  hostAutoWriteEnabled,
  observeCandidate,
} from "../../src/lib/price-audit/adapters"
import type {
  AuditDecision,
  PriceAuditCandidate,
  RetailerObservation,
} from "../../src/lib/price-audit/contracts"
import { observeViaLlm } from "../../src/lib/price-audit/adapters/llm"
import { decide } from "../../src/lib/price-audit/decide"
import { orderAuditCandidates } from "../../src/lib/price-audit/select"
import {
  buildRunSummary,
  groupCandidatesByHost,
  isSystemicFailure,
  neutralizeCsvCell,
  selectLlmEscalations,
  type AuditResult,
} from "../../src/lib/price-audit/run-support"

/**
 * Recurring price-audit runner (plans/price-audit-lane.md).
 *
 * Dry-run by default: observations and decisions are computed and written to
 * artifacts, the database is untouched. `--apply` performs the id-based
 * updates for `auto_write` decisions. `--limit N` bounds the run, `--host h`
 * restricts it to one retailer. `price_checked_at` is only ever stamped
 * through an `auto_write` whose adapter actually read the current price.
 *
 * Hosts without a reviewed passing probe are not fetched at all — their rows
 * become `host_not_enabled` review proposals without network traffic — except
 * with `--probe-hosts`, which lets a supervised run observe (never write) a
 * host that is not enabled yet.
 */

const PER_REQUEST_DELAY_MS = 2_000
const DM_MCP_DEADLINE_MS = 20_000
const SENTRY_MONITOR_SLUG = "price-audit-weekly"
const SENTRY_MONITOR_CONFIG = {
  schedule: { type: "crontab", value: "30 4 * * 1" },
  checkinMargin: 120,
  maxRuntime: 180,
  timezone: "Europe/Berlin",
  failureIssueThreshold: 1,
  recoveryThreshold: 1,
} as const

type CliOptions = {
  apply: boolean
  limit: number | null
  host: string | null
  probeHosts: boolean
  llm: boolean
  llmBudget: number
}

const DEFAULT_LLM_BUDGET = 40

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    apply: false,
    limit: null,
    host: null,
    probeHosts: false,
    llm: false,
    llmBudget: DEFAULT_LLM_BUDGET,
  }
  let noLlm = false
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === "--apply") options.apply = true
    else if (arg === "--probe-hosts") options.probeHosts = true
    else if (arg === "--llm") options.llm = true
    else if (arg === "--no-llm") noLlm = true
    else if (arg === "--llm-budget")
      options.llmBudget = Number.parseInt(argv[++index] ?? "", 10) || DEFAULT_LLM_BUDGET
    else if (arg === "--limit") options.limit = Number.parseInt(argv[++index] ?? "", 10) || null
    else if (arg === "--host") options.host = argv[++index] ?? null
    else throw new Error(`Unknown argument: ${arg}`)
  }
  if (options.apply && options.probeHosts) {
    throw new Error("--probe-hosts is observation-only and cannot be combined with --apply")
  }
  // The GPT fallback costs real research per product, so it runs by default
  // only in apply mode (the weekly cron); a dry-run opts in with --llm.
  if (noLlm) options.llm = false
  else if (options.apply) options.llm = true
  return options
}

function createSupabaseClientFromEnv(): SupabaseClient {
  loadEnv({ path: ".env.local" })
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

type ProductRow = {
  id: string
  name: string | null
  brand: string | null
  affiliate_link: string | null
  price_eur: number | string | null
  price_checked_at: string | null
  purchase_link_status: "available" | "unavailable" | null
  is_chaarlie_recommended: boolean | null
}

// Mirrors identifier-lookup.ts / search-retailer: only barcode-family
// identifiers carry canonical GTINs, and a GTIN mapped to more than one
// product is ambiguous and fails closed (never used for identity).
const BARCODE_IDENTIFIER_TYPES = ["ean", "gtin", "barcode"] as const

function numberOrNull(value: number | string | null): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export async function fetchCandidates(supabase: SupabaseClient): Promise<PriceAuditCandidate[]> {
  const pageSize = 1000
  let from = 0
  const rows: ProductRow[] = []
  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, brand, affiliate_link, price_eur, price_checked_at, purchase_link_status, is_chaarlie_recommended",
      )
      .eq("is_active", true)
      .eq("lifecycle_status", "active")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...(data as unknown as ProductRow[]))
    if (data.length < pageSize) break
    from += pageSize
  }

  const gtinsByProduct = await fetchUnambiguousGtins(
    supabase,
    rows.map((row) => row.id),
  )

  return rows.map((row) => ({
    id: row.id,
    name: row.name ?? row.id,
    brand: row.brand,
    affiliateLink: row.affiliate_link,
    priceEur: numberOrNull(row.price_eur),
    priceCheckedAt: row.price_checked_at,
    purchaseLinkStatus: row.purchase_link_status,
    isChaarlieRecommended: row.is_chaarlie_recommended === true,
    canonicalGtin14s: gtinsByProduct.get(row.id) ?? [],
  }))
}

export async function fetchUnambiguousGtins(
  supabase: SupabaseClient,
  productIds: string[],
): Promise<Map<string, string[]>> {
  const rows: Array<{ product_id: string; canonical_gtin14: string | null }> = []
  const pageSize = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from("product_identifiers")
      .select("product_id, canonical_gtin14")
      .in("identifier_type", BARCODE_IDENTIFIER_TYPES)
      .not("canonical_gtin14", "is", null)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...(data as Array<{ product_id: string; canonical_gtin14: string | null }>))
    if (data.length < pageSize) break
    from += pageSize
  }

  const productsByGtin = new Map<string, Set<string>>()
  for (const row of rows) {
    if (!row.canonical_gtin14) continue
    const set = productsByGtin.get(row.canonical_gtin14) ?? new Set<string>()
    set.add(row.product_id)
    productsByGtin.set(row.canonical_gtin14, set)
  }

  const wanted = new Set(productIds)
  const gtinsByProduct = new Map<string, string[]>()
  for (const [gtin, products] of productsByGtin) {
    if (products.size !== 1) continue
    const productId = [...products][0]
    if (!wanted.has(productId)) continue
    const list = gtinsByProduct.get(productId) ?? []
    list.push(gtin)
    gtinsByProduct.set(productId, list)
  }
  return gtinsByProduct
}

/**
 * Id-based update, guarded against concurrent edits (F6): the row must still
 * carry the link, price stamp AND price the observation was made against (an
 * admin edit changes `price_eur` without touching the stamp), and exactly one
 * row must match, or nothing is written. A guard miss is `benign` — someone
 * legitimately edited the row mid-run — while a database error is not.
 */
async function applyWrite(
  supabase: SupabaseClient,
  result: AuditResult,
): Promise<{ ok: boolean; error?: string; benign?: boolean }> {
  if (result.decision.action !== "auto_write") return { ok: true }
  const write = result.decision.write
  const update: Record<string, unknown> = {}
  if (write.purchaseLinkStatus !== undefined) update.purchase_link_status = write.purchaseLinkStatus
  if (write.purchaseLinkCheckedAt !== undefined)
    update.purchase_link_checked_at = write.purchaseLinkCheckedAt
  if (write.priceEur !== undefined) update.price_eur = write.priceEur
  if (write.priceCheckedAt !== undefined) update.price_checked_at = write.priceCheckedAt
  if (Object.keys(update).length === 0) return { ok: true }

  let query = supabase.from("products").update(update).eq("id", result.candidate.id)
  query =
    result.candidate.affiliateLink === null
      ? query.is("affiliate_link", null)
      : query.eq("affiliate_link", result.candidate.affiliateLink)
  query =
    result.candidate.priceCheckedAt === null
      ? query.is("price_checked_at", null)
      : query.eq("price_checked_at", result.candidate.priceCheckedAt)
  query =
    result.candidate.priceEur === null
      ? query.is("price_eur", null)
      : query.eq("price_eur", result.candidate.priceEur)

  const { data, error } = await query.select("id")
  if (error) return { ok: false, error: error.message }
  if (!data || data.length !== 1) return { ok: false, error: "concurrent_change", benign: true }
  return { ok: true }
}

/** A status-only write that would not change anything is skipped (F9). */
function isNoOpWrite(result: AuditResult): boolean {
  if (result.decision.action !== "auto_write") return false
  const write = result.decision.write
  return (
    write.priceCheckedAt === undefined &&
    result.candidate.purchaseLinkStatus === write.purchaseLinkStatus
  )
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Codex CLI research call — the same binary the intake worker uses on the
 * server. stdin must be closed ("ignore"): with an open pipe, `codex exec`
 * waits for additional input instead of answering the prompt argument.
 */
function runCodexResearch(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("codex", ["exec", "--sandbox", "read-only", prompt], {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 240_000,
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length < 16 * 1024 * 1024) stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 1024 * 1024) stderr += chunk.toString()
    })
    child.on("error", reject)
    child.on("close", (code, signal) => {
      // A failed or killed research must never authorize a write, whatever it
      // printed; only the stdout answer channel is parsed, never stderr.
      if (code !== 0)
        reject(
          new Error(`codex exec exited ${code ?? `signal ${signal}`}: ${stderr.slice(0, 300)}`),
        )
      else resolve(stdout)
    })
  })
}

function initSentry(): boolean {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()
  if (!dsn) return false
  try {
    Sentry.init({ dsn, environment: process.env.NODE_ENV ?? "production", sendDefaultPii: false })
    return true
  } catch {
    return false
  }
}

function sentryCheckIn(
  enabled: boolean,
  checkIn:
    | { monitorSlug: string; status: "in_progress" }
    | { monitorSlug: string; status: "ok" | "error"; checkInId?: string },
): string | undefined {
  if (!enabled) return undefined
  try {
    return Sentry.captureCheckIn(
      checkIn,
      checkIn.status === "in_progress" ? SENTRY_MONITOR_CONFIG : undefined,
    )
  } catch {
    return undefined
  }
}

async function flushSentry(enabled: boolean): Promise<void> {
  if (!enabled) return
  try {
    await Sentry.flush(5_000)
  } catch {
    // The dead-man switch must never break the audit itself.
  }
}

function neutralizeRow(row: CsvRow): CsvRow {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, neutralizeCsvCell(value)]),
  )
}

function reviewProposalCsvRow(result: AuditResult, reason: string): CsvRow {
  const observation = result.observation
  return neutralizeRow({
    id: result.candidate.id,
    name: result.candidate.name,
    brand: result.candidate.brand ?? "",
    affiliate_link: result.candidate.affiliateLink ?? "",
    stored_price_eur: result.candidate.priceEur == null ? "" : String(result.candidate.priceEur),
    stored_price_checked_at: result.candidate.priceCheckedAt ?? "",
    reason,
    observed_name: observation.kind === "failed" ? "" : (observation.observedName ?? ""),
    observed_price_eur:
      observation.kind === "confirmed"
        ? String(observation.priceEur)
        : observation.kind === "mismatch" && observation.observedPriceEur != null
          ? String(observation.observedPriceEur)
          : "",
    evidence_url: observation.kind === "failed" ? "" : (observation.evidenceUrl ?? ""),
    review_action: "manual_review",
  })
}

function autoWriteCsvRow(result: AuditResult, note: string): CsvRow {
  if (result.decision.action !== "auto_write") throw new Error("not an auto_write result")
  const write = result.decision.write
  return neutralizeRow({
    id: result.candidate.id,
    name: result.candidate.name,
    old_price_eur: result.candidate.priceEur == null ? "" : String(result.candidate.priceEur),
    new_price_eur: write.priceEur === undefined ? "" : String(write.priceEur),
    old_purchase_link_status: result.candidate.purchaseLinkStatus ?? "",
    new_purchase_link_status: write.purchaseLinkStatus ?? "",
    price_checked_at: write.priceCheckedAt ?? "",
    purchase_link_checked_at: write.purchaseLinkCheckedAt ?? "",
    applied: result.applied ? "true" : "false",
    note,
  })
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  loadEnv({ path: ".env.local" })
  const sentryEnabled = initSentry()
  const startedAt = new Date().toISOString()
  const checkInId = sentryCheckIn(sentryEnabled, {
    monitorSlug: SENTRY_MONITOR_SLUG,
    status: "in_progress",
  })

  const supabase = createSupabaseClientFromEnv()
  const dmClient = createDmMcpClient({ deadlineMs: DM_MCP_DEADLINE_MS })

  let candidates = orderAuditCandidates(await fetchCandidates(supabase))
  if (options.host) {
    candidates = candidates.filter((candidate) => adapterHostFor(candidate) === options.host)
  }
  if (options.limit !== null) candidates = candidates.slice(0, options.limit)

  console.log(
    `Price audit: ${candidates.length} candidates, mode=${options.apply ? "APPLY" : "dry-run"}${options.probeHosts ? " (+probe-hosts)" : ""}`,
  )

  const groups = groupCandidatesByHost(candidates)
  const results: AuditResult[] = []
  const notes = new Map<string, string>()
  // Non-benign database write errors: any one of these fails the run loudly —
  // a run whose writes silently fail must never check in "ok".
  const dbWriteFailures: string[] = []
  await Promise.all(
    [...groups.entries()].map(async ([groupHost, hostCandidates]) => {
      const host = groupHost === "(no-host)" ? null : groupHost
      const autoWriteEnabled = hostAutoWriteEnabled(host)
      // Hosts without a reviewed probe (or any adapter) are not fetched at all
      // (F16) unless a supervised run passes --probe-hosts for observation.
      const fetchHost = hasAdapter(host) && (autoWriteEnabled || options.probeHosts)
      for (const candidate of hostCandidates) {
        // Any per-candidate crash (adapter bug, unexpected shape) is that
        // candidate's failure — it must never reject the whole run and leave
        // earlier database writes without artifacts.
        try {
          let observation: RetailerObservation
          let decision: AuditDecision
          if (fetchHost) {
            observation = (
              await observeCandidate(candidate, {
                dmSearch: (query) => dmClient.searchProducts(query),
              })
            ).observation
            decision = decide(candidate, observation, {
              hostAutoWriteEnabled: autoWriteEnabled,
              now: new Date().toISOString(),
            })
          } else {
            observation = { kind: "failed", reason: "adapter_unavailable" }
            decision = {
              action: "review_proposal",
              reason: hasAdapter(host) ? "host_not_enabled" : "no_adapter_for_host",
            }
          }

          const result: AuditResult = { candidate, host, observation, decision, applied: false }
          if (decision.action === "auto_write") {
            if (isNoOpWrite(result)) {
              notes.set(candidate.id, "noop_unchanged_status")
            } else if (options.apply) {
              const applied = await applyWrite(supabase, result)
              result.applied = applied.ok
              if (!applied.ok) {
                notes.set(candidate.id, `apply_failed:${applied.error}`)
                if (!applied.benign) dbWriteFailures.push(`${candidate.id}: ${applied.error}`)
                console.error(`write failed for ${candidate.id}: ${applied.error}`)
              }
            }
          }
          results.push(result)
        } catch (error) {
          results.push({
            candidate,
            host,
            observation: { kind: "failed", reason: "adapter_unavailable" },
            decision: {
              action: "recheck_failed",
              reason: `unexpected_error: ${error instanceof Error ? error.message : String(error)}`,
            },
            applied: false,
          })
        }
        if (fetchHost) await delay(PER_REQUEST_DELAY_MS)
      }
    }),
  )

  // GPT fallback phase (Nick, 2026-09-30): after the deterministic pass,
  // unconfirmed rows escalate to Codex research in GLOBAL audit priority
  // (recommendation-surfaced first, oldest first) under the run budget, one
  // research at a time.
  let llmResearches = 0
  if (options.llm) {
    const escalations = selectLlmEscalations(results, options.llmBudget)
    for (const result of escalations) {
      llmResearches++
      try {
        const llmObservation = await observeViaLlm(result.candidate, {
          runResearch: runCodexResearch,
        })
        // A failed or empty research keeps the (more specific) deterministic reason.
        if (llmObservation.kind === "failed") continue
        const llmDecision = decide(result.candidate, llmObservation, {
          hostAutoWriteEnabled: false,
          now: new Date().toISOString(),
        })
        result.observation = llmObservation
        result.decision = llmDecision
        notes.set(result.candidate.id, "source:llm_research")
        if (llmDecision.action === "auto_write" && options.apply && !isNoOpWrite(result)) {
          const applied = await applyWrite(supabase, result)
          result.applied = applied.ok
          if (!applied.ok) {
            notes.set(result.candidate.id, `apply_failed:${applied.error}`)
            if (!applied.benign) dbWriteFailures.push(`${result.candidate.id}: ${applied.error}`)
            console.error(`write failed for ${result.candidate.id}: ${applied.error}`)
          }
        }
      } catch (error) {
        console.error(
          `llm research failed for ${result.candidate.id}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  }

  const finishedAt = new Date().toISOString()
  const summary = buildRunSummary(results, { startedAt, finishedAt, apply: options.apply })
  // The dead-man rule only judges hosts the run actually fetched (F16).
  const fetchedResults = results.filter(
    (result) =>
      result.decision.action !== "review_proposal" ||
      (result.decision.reason !== "host_not_enabled" &&
        result.decision.reason !== "no_adapter_for_host"),
  )
  const fetchedSummary = buildRunSummary(fetchedResults, {
    startedAt,
    finishedAt,
    apply: options.apply,
  })

  const outBase = process.env.PRICE_AUDIT_OUT_DIR ?? "tmp/price-audit"
  const outDir = join(outBase, startedAt.replace(/[:]/g, "-"))
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf-8")

  const reviewRows: CsvRow[] = []
  for (const result of results) {
    if (result.decision.action === "review_proposal") {
      reviewRows.push(reviewProposalCsvRow(result, result.decision.reason))
    } else if (
      result.decision.action === "auto_write" &&
      result.decision.write.purchaseLinkStatus === "unavailable" &&
      !notes.get(result.candidate.id)?.startsWith("noop")
    ) {
      // Every auto-written `unavailable` also asks for a replacement review
      // (HAI-124: search favored shops, propose, never auto-replace).
      reviewRows.push(reviewProposalCsvRow(result, "link_unavailable_needs_replacement"))
    }
  }
  writeCsv(
    join(outDir, "review-proposals.csv"),
    [
      "id",
      "name",
      "brand",
      "affiliate_link",
      "stored_price_eur",
      "stored_price_checked_at",
      "reason",
      "observed_name",
      "observed_price_eur",
      "evidence_url",
      "review_action",
    ],
    reviewRows,
  )
  const autoRows = results.filter((result) => result.decision.action === "auto_write")
  writeCsv(
    join(outDir, "auto-writes.csv"),
    [
      "id",
      "name",
      "old_price_eur",
      "new_price_eur",
      "old_purchase_link_status",
      "new_purchase_link_status",
      "price_checked_at",
      "purchase_link_checked_at",
      "applied",
      "note",
    ],
    autoRows.map((result) => autoWriteCsvRow(result, notes.get(result.candidate.id) ?? "")),
  )

  console.log(JSON.stringify({ ...summary.byAction, llm_researches: llmResearches }))
  console.log(
    `Artifacts in ${outDir}. ${options.apply ? "Writes applied." : "No writes performed."}`,
  )

  if (dbWriteFailures.length > 0) {
    sentryCheckIn(sentryEnabled, { monitorSlug: SENTRY_MONITOR_SLUG, status: "error", checkInId })
    await flushSentry(sentryEnabled)
    console.error(`Database write failures (${dbWriteFailures.length}):`)
    for (const failure of dbWriteFailures) console.error(`  ${failure}`)
    process.exit(2)
  }
  if (isSystemicFailure(fetchedSummary)) {
    sentryCheckIn(sentryEnabled, { monitorSlug: SENTRY_MONITOR_SLUG, status: "error", checkInId })
    await flushSentry(sentryEnabled)
    console.error("Systemic failure: majority of fetched re-checks failed.")
    process.exit(2)
  }
  sentryCheckIn(sentryEnabled, { monitorSlug: SENTRY_MONITOR_SLUG, status: "ok", checkInId })
  await flushSentry(sentryEnabled)
}

const scriptPath = process.argv[1] ?? ""
if (scriptPath.endsWith("run.ts") || scriptPath.endsWith("run.js")) {
  main().catch(async (error) => {
    const sentryEnabled = initSentry()
    sentryCheckIn(sentryEnabled, { monitorSlug: SENTRY_MONITOR_SLUG, status: "error" })
    await flushSentry(sentryEnabled)
    console.error(error)
    process.exit(1)
  })
}
