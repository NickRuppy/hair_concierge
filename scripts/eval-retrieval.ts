/**
 * Phase 1 Retrieval Evaluation Script
 *
 * Computes nDCG@10, Recall@20, MRR@10 for the retrieval gold set.
 * Runs both dense-only (baseline) and hybrid retrieval for comparison.
 *
 * Usage:
 *   npx tsx scripts/eval-retrieval.ts
 *   npx tsx scripts/eval-retrieval.ts --hybrid-only
 *   npx tsx scripts/eval-retrieval.ts --dense-only
 *
 * Requirements:
 *   - .env.local with OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
 *   - Gold set at tests/fixtures/retrieval-gold-set.json
 *
 * Ref: PRD Section 2, 10, 11
 */

import fs from "fs"
import path from "path"

// Load .env.local
const envPath = path.join(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").replace(/\r/g, "").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim()
    }
  }
}

import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"

// ── Gold set types ───────────────────────────────────────────────────────────

interface GoldSetEntry {
  query: string
  intent?: string
  relevant_chunk_ids: string[]
  metadata_filter?: Record<string, string>
  source_types?: string[]
}

// ── Metric computation ───────────────────────────────────────────────────────

function dcg(relevances: number[], k: number): number {
  let score = 0
  for (let i = 0; i < Math.min(relevances.length, k); i++) {
    score += relevances[i] / Math.log2(i + 2) // i+2 because log2(1)=0
  }
  return score
}

function ndcg(retrievedIds: string[], relevantIds: Set<string>, k: number): number {
  const relevances = retrievedIds.slice(0, k).map((id) => (relevantIds.has(id) ? 1 : 0))
  const idealRelevances = Array(Math.min(relevantIds.size, k)).fill(1)
  const idealDcg = dcg(idealRelevances, k)
  if (idealDcg === 0) return 0
  return dcg(relevances, k) / idealDcg
}

function recall(retrievedIds: string[], relevantIds: Set<string>, k: number): number {
  const hits = retrievedIds.slice(0, k).filter((id) => relevantIds.has(id)).length
  return relevantIds.size > 0 ? hits / relevantIds.size : 0
}

function mrr(retrievedIds: string[], relevantIds: Set<string>, k: number): number {
  for (let i = 0; i < Math.min(retrievedIds.length, k); i++) {
    if (relevantIds.has(retrievedIds[i])) {
      return 1 / (i + 1)
    }
  }
  return 0
}

// ── Retrieval functions ──────────────────────────────────────────────────────

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function retrieveDense(
  query: string,
  metadataFilter?: Record<string, string>,
  sourceTypes?: string[],
): Promise<string[]> {
  const embeddingRes = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: query,
    dimensions: 384,
  })
  const embedding = embeddingRes.data[0].embedding

  const { data, error } = await supabase.rpc("match_content_chunks", {
    query_embedding: embedding,
    match_count: 20,
    match_threshold: 0.65,
    source_filter: null,
    metadata_filter: metadataFilter ?? null,
    source_types: sourceTypes ?? null,
  })

  if (error) {
    console.error("Dense retrieval error:", error)
    return []
  }

  return (data ?? []).map((d: { id: string }) => d.id)
}

async function retrieveHybrid(
  query: string,
  metadataFilter?: Record<string, string>,
  sourceTypes?: string[],
): Promise<string[]> {
  // Dense retrieval
  const embeddingRes = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: query,
    dimensions: 384,
  })
  const embedding = embeddingRes.data[0].embedding

  const [denseResult, lexicalResult] = await Promise.all([
    supabase.rpc("match_content_chunks", {
      query_embedding: embedding,
      match_count: 20,
      match_threshold: 0.65,
      source_filter: null,
      metadata_filter: metadataFilter ?? null,
      source_types: sourceTypes ?? null,
    }),
    supabase.rpc("match_content_chunks_lexical", {
      query_text: query,
      match_count: 20,
      source_filter: null,
      metadata_filter: metadataFilter ?? null,
      source_types: sourceTypes ?? null,
    }),
  ])

  if (denseResult.error) console.error("Dense error:", denseResult.error)
  if (lexicalResult.error) console.error("Lexical error:", lexicalResult.error)

  const denseIds = (denseResult.data ?? []).map((d: { id: string }) => d.id)
  const lexicalIds = (lexicalResult.data ?? []).map((d: { id: string }) => d.id)

  // RRF fusion (k=60)
  const K = 60
  const scores = new Map<string, number>()

  for (let i = 0; i < denseIds.length; i++) {
    scores.set(denseIds[i], (scores.get(denseIds[i]) ?? 0) + 1 / (K + i + 1))
  }
  for (let i = 0; i < lexicalIds.length; i++) {
    scores.set(lexicalIds[i], (scores.get(lexicalIds[i]) ?? 0) + 1 / (K + i + 1))
  }

  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const hybridOnly = args.includes("--hybrid-only")
  const denseOnly = args.includes("--dense-only")

  // Load gold set
  const goldSetPath = path.join(process.cwd(), "tests/fixtures/retrieval-gold-set.json")
  if (!fs.existsSync(goldSetPath)) {
    console.error(`Gold set not found at ${goldSetPath}`)
    console.error("Create it first (see tests/fixtures/retrieval-gold-set.json)")
    process.exit(1)
  }

  const goldSet: GoldSetEntry[] = JSON.parse(fs.readFileSync(goldSetPath, "utf-8"))
  console.log(`\nLoaded ${goldSet.length} gold set queries\n`)

  const results: {
    query: string
    dense: { ndcg10: number; recall20: number; mrr10: number } | null
    hybrid: { ndcg10: number; recall20: number; mrr10: number } | null
  }[] = []

  for (let i = 0; i < goldSet.length; i++) {
    const entry = goldSet[i]
    const relevantSet = new Set(entry.relevant_chunk_ids)
    console.log(`[${i + 1}/${goldSet.length}] "${entry.query.slice(0, 60)}..."`)

    let denseMetrics = null
    let hybridMetrics = null

    if (!hybridOnly) {
      const denseIds = await retrieveDense(entry.query, entry.metadata_filter, entry.source_types)
      denseMetrics = {
        ndcg10: ndcg(denseIds, relevantSet, 10),
        recall20: recall(denseIds, relevantSet, 20),
        mrr10: mrr(denseIds, relevantSet, 10),
      }
    }

    if (!denseOnly) {
      const hybridIds = await retrieveHybrid(entry.query, entry.metadata_filter, entry.source_types)
      hybridMetrics = {
        ndcg10: ndcg(hybridIds, relevantSet, 10),
        recall20: recall(hybridIds, relevantSet, 20),
        mrr10: mrr(hybridIds, relevantSet, 10),
      }
    }

    results.push({ query: entry.query, dense: denseMetrics, hybrid: hybridMetrics })
  }

  // Aggregate
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length

  console.log("\n" + "=".repeat(60))
  console.log("RETRIEVAL EVALUATION REPORT")
  console.log("=".repeat(60))

  if (!hybridOnly) {
    const denseNdcg = avg(results.map((r) => r.dense?.ndcg10 ?? 0))
    const denseRecall = avg(results.map((r) => r.dense?.recall20 ?? 0))
    const denseMrr = avg(results.map((r) => r.dense?.mrr10 ?? 0))
    console.log(`\nDense-only (baseline):`)
    console.log(`  nDCG@10:   ${denseNdcg.toFixed(4)}  (target >= 0.72)`)
    console.log(`  Recall@20: ${denseRecall.toFixed(4)}  (target >= 0.88)`)
    console.log(`  MRR@10:    ${denseMrr.toFixed(4)}`)
  }

  if (!denseOnly) {
    const hybridNdcg = avg(results.map((r) => r.hybrid?.ndcg10 ?? 0))
    const hybridRecall = avg(results.map((r) => r.hybrid?.recall20 ?? 0))
    const hybridMrr = avg(results.map((r) => r.hybrid?.mrr10 ?? 0))
    console.log(`\nHybrid (dense + lexical + RRF):`)
    console.log(`  nDCG@10:   ${hybridNdcg.toFixed(4)}  (target >= 0.72)`)
    console.log(`  Recall@20: ${hybridRecall.toFixed(4)}  (target >= 0.88)`)
    console.log(`  MRR@10:    ${hybridMrr.toFixed(4)}`)
  }

  if (!hybridOnly && !denseOnly) {
    console.log(`\nDelta (hybrid - dense):`)
    const dNdcg = avg(results.map((r) => (r.hybrid?.ndcg10 ?? 0) - (r.dense?.ndcg10 ?? 0)))
    const dRecall = avg(results.map((r) => (r.hybrid?.recall20 ?? 0) - (r.dense?.recall20 ?? 0)))
    const dMrr = avg(results.map((r) => (r.hybrid?.mrr10 ?? 0) - (r.dense?.mrr10 ?? 0)))
    console.log(`  nDCG@10:   ${dNdcg >= 0 ? "+" : ""}${dNdcg.toFixed(4)}`)
    console.log(`  Recall@20: ${dRecall >= 0 ? "+" : ""}${dRecall.toFixed(4)}`)
    console.log(`  MRR@10:    ${dMrr >= 0 ? "+" : ""}${dMrr.toFixed(4)}`)
  }

  // Save results
  const reportPath = path.join(
    process.cwd(),
    "test-results",
    "retrieval",
    `retrieval-eval-${new Date().toISOString().slice(0, 10)}.json`,
  )
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2))
  console.log(`\nDetailed results saved to: ${reportPath}`)
}

main().catch(console.error)
