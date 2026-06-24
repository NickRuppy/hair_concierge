import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, join } from "node:path"

const batchDir =
  process.argv.find((arg) => arg.startsWith("--batch-dir="))?.slice("--batch-dir=".length) ??
  "data/product-images/pilot-2026-06-10"
const reviewStatePath = join(batchDir, "review-state.json")
const candidatesPath = join(batchDir, "image-candidates.json")
const selectedDir = join(batchDir, "selected")
const decisionsPath = join(batchDir, "review-decisions.json")
const followUpPath = join(batchDir, "follow-up-products.csv")

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
  score: number
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

interface Decision {
  product_id: string
  product: string
  status: "approved" | "needs_selection_fix" | "needs_manual_search" | "rejected"
  selected_local_path: string
  selected_image_url: string
  selected_source: string
  selected_file: string
  comment: string
  reason: string
}

function csvCell(value: unknown): string {
  const text = String(value ?? "")
  return `"${text.replace(/"/g, '""')}"`
}

function usableCandidates(result: CandidateResult): Candidate[] {
  return result.candidates.filter((candidate) => candidate.localPath && !candidate.error)
}

function candidateForReviewId(result: CandidateResult, candidateId: string): Candidate | undefined {
  const index = Number(candidateId.split(":").at(-1))
  if (!Number.isFinite(index)) return undefined
  return usableCandidates(result)[index]
}

function inferGoodCandidate(row: ReviewRow, result: CandidateResult): Candidate | undefined {
  const goodIds = Object.entries(row.candidate_ratings ?? {})
    .filter(([, rating]) => rating === "good")
    .map(([candidateId]) => candidateId)

  const usable = usableCandidates(result)
  if (row.product_rating === "approved" && usable.length === 1) {
    return usable[0]
  }

  if (goodIds.length !== 1) return undefined
  return candidateForReviewId(result, goodIds[0])
}

function main(): void {
  const reviews = JSON.parse(readFileSync(reviewStatePath, "utf8")) as ReviewRow[]
  const candidateResults = JSON.parse(readFileSync(candidatesPath, "utf8")) as CandidateResult[]
  const candidatesByProductId = new Map(
    candidateResults.map((result) => [result.product.id, result]),
  )
  const decisions: Decision[] = []

  mkdirSync(selectedDir, { recursive: true })

  for (const row of reviews) {
    const result = candidatesByProductId.get(row.product_id)
    const inferred = result ? inferGoodCandidate(row, result) : undefined
    const selectedLocalPath = row.selected_local_path || inferred?.localPath || ""
    const selectedImageUrl = row.selected_image_url || inferred?.url || ""
    const selectedSource = row.selected_source || inferred?.source || ""
    const selectedFile = selectedLocalPath
      ? `${String(decisions.length + 1).padStart(2, "0")}-${row.product_id}-${basename(selectedLocalPath)}`
      : ""

    let status: Decision["status"] = "needs_manual_search"
    let reason = "No approved selected image"

    if (row.product_rating === "reject") {
      status = "rejected"
      reason = "Reviewer rejected product image candidates"
    } else if (row.product_rating === "approved" && selectedLocalPath) {
      status = "approved"
      reason = row.selected_local_path
        ? "Reviewer selected approved image"
        : "Inferred from single good candidate"
      copyFileSync(selectedLocalPath, join(selectedDir, selectedFile))
    } else if (row.product_rating === "approved") {
      status = "needs_selection_fix"
      reason = "Product approved but no selected/good candidate could be resolved"
    } else if (inferred?.localPath) {
      status = "needs_manual_search"
      reason = "Has a maybe/good candidate but product was not approved"
    }

    decisions.push({
      product_id: row.product_id,
      product: row.product,
      status,
      selected_local_path: selectedLocalPath,
      selected_image_url: selectedImageUrl,
      selected_source: selectedSource,
      selected_file: selectedFile,
      comment: row.comment,
      reason,
    })
  }

  writeFileSync(decisionsPath, `${JSON.stringify(decisions, null, 2)}\n`)

  const followUps = decisions.filter((decision) => decision.status !== "approved")
  const csv = [
    ["product_id", "product", "status", "reason", "comment"].join(","),
    ...followUps.map((decision) =>
      [decision.product_id, decision.product, decision.status, decision.reason, decision.comment]
        .map(csvCell)
        .join(","),
    ),
  ].join("\n")
  writeFileSync(followUpPath, `${csv}\n`)

  const counts = decisions.reduce<Record<string, number>>((acc, decision) => {
    acc[decision.status] = (acc[decision.status] ?? 0) + 1
    return acc
  }, {})

  console.log(JSON.stringify({ counts, decisionsPath, followUpPath, selectedDir }, null, 2))
}

main()
