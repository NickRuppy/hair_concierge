import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { basename, join } from "node:path"

const batchDir =
  process.argv.find((arg) => arg.startsWith("--batch-dir="))?.slice("--batch-dir=".length) ??
  "data/product-images/pilot-2026-06-10"
const selectedDir = join(batchDir, "selected")
const mergedPath = join(batchDir, "merged-review-decisions.json")
interface ReviewSource {
  name: string
  state: string
  candidates: string
}

const configuredReviewSources = process.argv
  .filter((arg) => arg.startsWith("--review-source="))
  .map((arg): ReviewSource => {
    const value = arg.slice("--review-source=".length)
    const [name, state, candidates] = value.split(":")
    if (!name || !state || !candidates) {
      throw new Error("--review-source must use name:review-state-path:image-candidates-path")
    }
    return {
      name,
      state: join(batchDir, state),
      candidates: join(batchDir, candidates),
    }
  })

const reviewSources: ReviewSource[] = configuredReviewSources.length
  ? configuredReviewSources
  : [
      {
        name: "main",
        state: join(batchDir, "review-state.json"),
        candidates: join(batchDir, "image-candidates.json"),
      },
      {
        name: "fallback",
        state: join(batchDir, "fallback/review-state.json"),
        candidates: join(batchDir, "fallback/image-candidates.json"),
      },
      {
        name: "fallback2",
        state: join(batchDir, "fallback2/review-state.json"),
        candidates: join(batchDir, "fallback2/image-candidates.json"),
      },
      {
        name: "fallback3",
        state: join(batchDir, "fallback3/review-state.json"),
        candidates: join(batchDir, "fallback3/image-candidates.json"),
      },
    ]

interface ReviewRow {
  product_id: string
  product: string
  product_rating: string
  selected_candidate_id: string
  selected_image_url: string
  selected_local_path: string
  selected_source: string
  candidate_ratings: Record<string, "good" | "maybe" | "bad">
  comment: string
}

interface Candidate {
  url: string
  source: string
  localPath?: string
  error?: string
}

interface CandidateResult {
  product: {
    id: string
    brand: string
    name: string
    category: string
    affiliate_link: string
  }
  candidates: Candidate[]
}

interface MergedDecision {
  product_id: string
  product: string
  status: "approved" | "needs_manual_search" | "rejected"
  source_round: string
  selected_local_path: string
  selected_image_url: string
  selected_source: string
  selected_file: string
  comment: string
}

function usableCandidates(result: CandidateResult): Candidate[] {
  return result.candidates.filter((candidate) => candidate.localPath && !candidate.error)
}

function candidateForReviewId(result: CandidateResult, candidateId: string): Candidate | undefined {
  const index = Number(candidateId.split(":").at(-1))
  if (!Number.isFinite(index)) return undefined
  return usableCandidates(result)[index]
}

function inferredCandidate(row: ReviewRow, result?: CandidateResult): Candidate | undefined {
  if (!result) return undefined
  const selected = row.selected_candidate_id
    ? candidateForReviewId(result, row.selected_candidate_id)
    : undefined
  if (selected) return selected

  const goodIds = Object.entries(row.candidate_ratings ?? {})
    .filter(([, rating]) => rating === "good")
    .map(([candidateId]) => candidateId)
  if (row.product_rating === "approved" && usableCandidates(result).length === 1) {
    return usableCandidates(result)[0]
  }
  if (goodIds.length === 1) return candidateForReviewId(result, goodIds[0])
  return undefined
}

function loadSource(source: ReviewSource): MergedDecision[] {
  if (!existsSync(source.state) || !existsSync(source.candidates)) return []

  const reviews = JSON.parse(readFileSync(source.state, "utf8")) as ReviewRow[]
  const candidateResults = JSON.parse(readFileSync(source.candidates, "utf8")) as CandidateResult[]
  const candidatesByProductId = new Map(
    candidateResults.map((result) => [result.product.id, result]),
  )

  return reviews.map((row) => {
    const candidate = inferredCandidate(row, candidatesByProductId.get(row.product_id))
    const selectedLocalPath = row.selected_local_path || candidate?.localPath || ""
    const selectedImageUrl = row.selected_image_url || candidate?.url || ""
    const selectedSource = row.selected_source || candidate?.source || ""
    const status =
      row.product_rating === "approved" && selectedLocalPath
        ? "approved"
        : row.product_rating === "reject"
          ? "rejected"
          : "needs_manual_search"

    return {
      product_id: row.product_id,
      product: row.product,
      status,
      source_round: source.name,
      selected_local_path: selectedLocalPath,
      selected_image_url: selectedImageUrl,
      selected_source: selectedSource,
      selected_file: "",
      comment: row.comment,
    }
  })
}

function main(): void {
  const byProduct = new Map<string, MergedDecision>()
  for (const source of reviewSources) {
    for (const decision of loadSource(source)) {
      const previous = byProduct.get(decision.product_id)
      if (!previous || previous.status !== "approved" || decision.status === "approved") {
        byProduct.set(decision.product_id, decision)
      }
    }
  }

  const decisions = [...byProduct.values()].sort((a, b) => a.product.localeCompare(b.product))

  rmSync(selectedDir, { recursive: true, force: true })
  mkdirSync(selectedDir, { recursive: true })

  let approvedIndex = 0
  for (const decision of decisions) {
    if (decision.status !== "approved") continue
    approvedIndex += 1
    decision.selected_file = `${String(approvedIndex).padStart(2, "0")}-${decision.product_id}-${basename(decision.selected_local_path)}`
    copyFileSync(decision.selected_local_path, join(selectedDir, decision.selected_file))
  }

  writeFileSync(mergedPath, `${JSON.stringify(decisions, null, 2)}\n`)

  const counts = decisions.reduce<Record<string, number>>((acc, decision) => {
    acc[decision.status] = (acc[decision.status] ?? 0) + 1
    return acc
  }, {})

  console.log(JSON.stringify({ counts, selectedDir, mergedPath }, null, 2))
}

main()
