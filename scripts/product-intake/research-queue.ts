import { relative } from "node:path"

import { createSupabaseClientFromEnv, flag, flagBool, flagInt, hashUserId, parseArgs } from "./cli"
import { loadQueueRows } from "./queue"
import type { ProductIntakeQueueRow } from "./queue-reporting"
import { prepareResearchPackagesFromQueue } from "./prepare-research"
import {
  classifyReviewPackageState,
  listReviewPackages,
  readReviewPackage,
  requestReplacementImageSearch,
  type ReviewPackageState,
  type ReviewPackageSummary,
} from "./review-app"

export type ProductIntakeResearchQueueImageSearch = {
  package_path: string
  submission_id: string | null
  status: "candidate_found" | "no_candidate_found" | "skipped" | "failed"
  message: string
  local_file: string | null
  source_image_url: string | null
}

export type ProductIntakeResearchQueueItem = {
  submission_id: string
  user: string
  source: string
  category: string
  brand_text: string | null
  product_name_text: string | null
  package_path: string | null
  package_state: ReviewPackageState
  package_state_reason: string
  image_candidate_status: string | null
  created_package: boolean
  next_step: string
  commands: string[]
}

export type ProductIntakeResearchQueueResult = {
  total_pending: number
  created_packages: number
  existing_packages: number
  image_searches: ProductIntakeResearchQueueImageSearch[]
  items: ProductIntakeResearchQueueItem[]
}

function latestPackageBySubmissionId(
  packages: ReviewPackageSummary[],
): Map<string, ReviewPackageSummary> {
  const byId = new Map<string, ReviewPackageSummary>()
  for (const pack of packages) {
    if (!pack.submission_id || byId.has(pack.submission_id)) continue
    byId.set(pack.submission_id, pack)
  }
  return byId
}

function nextStepForState(state: ReviewPackageState, reason: string): string {
  if (state === "package_needs_research") {
    if (reason.includes("image candidate")) {
      return "Add a package-local image candidate before Nick review"
    }
    return "Codex research needed before Nick review"
  }
  if (state === "package_in_progress") {
    return "Finish payload validation and image finalization"
  }
  if (state === "package_rework_requested") {
    return "Apply Nick's property-review comments to payload and sources"
  }
  if (state === "package_ready_for_review") {
    return "Open in review app and run approve-package dry-run after Nick review"
  }
  return "Repair package files before research can continue"
}

function commandsForItem(pack: ReviewPackageSummary | null, row: ProductIntakeQueueRow): string[] {
  if (!pack) {
    return ["Re-run: npm run products:intake:research-queue -- --limit=5"]
  }

  const packagePath = pack.package_path
  const commands = [
    `npm run products:intake:review -- --submission-id ${row.id}`,
    `npm run products:intake:research -- --submission-id ${row.id} --payload-file ${packagePath}/payload.json`,
  ]

  if (pack.package_state === "package_ready_for_review") {
    commands.push(
      `npm run products:intake:approve-package -- --package ${packagePath} --reviewed-by nick`,
    )
  }

  return commands
}

export function buildResearchQueueResult(params: {
  rows: ProductIntakeQueueRow[]
  packages: ReviewPackageSummary[]
  createdPackageIds: ReadonlySet<string>
  imageSearches?: ProductIntakeResearchQueueImageSearch[]
  hashUser?: (userId: string) => string
}): ProductIntakeResearchQueueResult {
  const packagesBySubmissionId = latestPackageBySubmissionId(params.packages)
  const hashUser = params.hashUser ?? hashUserId

  const items = params.rows.map((row): ProductIntakeResearchQueueItem => {
    const pack = packagesBySubmissionId.get(row.id) ?? null
    const fallback = classifyReviewPackageState({
      payload: row.researched_payload,
      validation: null,
      imageFinalization: null,
    })
    const packageState = pack?.package_state ?? fallback.package_state
    return {
      submission_id: row.id,
      user: hashUser(row.user_id),
      source: row.source,
      category: row.category,
      brand_text: row.brand_text,
      product_name_text: row.product_name_text,
      package_path: pack?.package_path ?? null,
      package_state: packageState,
      package_state_reason: pack?.package_state_reason ?? fallback.package_state_reason,
      image_candidate_status: pack?.image_candidate_status ?? null,
      created_package: params.createdPackageIds.has(row.id),
      next_step: nextStepForState(
        packageState,
        pack?.package_state_reason ?? fallback.package_state_reason,
      ),
      commands: commandsForItem(pack, row),
    }
  })

  return {
    total_pending: params.rows.length,
    created_packages: [...params.createdPackageIds].length,
    existing_packages: items.filter((item) => item.package_path && !item.created_package).length,
    image_searches: params.imageSearches ?? [],
    items,
  }
}

function packageCanUseAutomatedImageSearch(pack: ReviewPackageSummary): boolean {
  return ["missing", "remote_only", "broken"].includes(pack.image_candidate_status)
}

export async function runAutomatedImageSearchesForPackages(params: {
  rootDir: string
  packages: ReviewPackageSummary[]
  now: Date
  limit?: number
  force?: boolean
  requestedBy?: string
}): Promise<ProductIntakeResearchQueueImageSearch[]> {
  const max = params.limit ?? params.packages.length
  let started = 0
  const results: ProductIntakeResearchQueueImageSearch[] = []

  for (const pack of params.packages) {
    if (!packageCanUseAutomatedImageSearch(pack)) continue

    try {
      const detail = await readReviewPackage({
        rootDir: params.rootDir,
        packagePath: pack.package_path,
      })
      const priorStatus =
        typeof detail.image_search_result?.status === "string"
          ? detail.image_search_result.status
          : null
      if (
        !params.force &&
        (priorStatus === "candidate_found" || priorStatus === "no_candidate_found")
      ) {
        results.push({
          package_path: pack.package_path,
          submission_id: pack.submission_id,
          status: "skipped",
          message: `Image search already completed with status ${priorStatus}.`,
          local_file:
            typeof detail.image_search_result?.local_file === "string"
              ? detail.image_search_result.local_file
              : null,
          source_image_url:
            typeof detail.image_search_result?.source_image_url === "string"
              ? detail.image_search_result.source_image_url
              : null,
        })
        continue
      }

      if (started >= max) break
      started += 1
      const result = await requestReplacementImageSearch({
        rootDir: params.rootDir,
        packagePath: pack.package_path,
        notes:
          "Automatische Bildsuche aus dem Research-Queue-Runner. Ziel: exakter frontaler Produkt-Packshot fuer die Review.",
        requestedBy: params.requestedBy ?? "codex-research-queue",
        requestedAt: params.now.toISOString(),
      })
      results.push({
        package_path: pack.package_path,
        submission_id: pack.submission_id,
        status: result.image_search_result.status,
        message: result.image_search_result.message,
        local_file: result.image_search_result.local_file,
        source_image_url: result.image_search_result.source_image_url,
      })
    } catch (error) {
      results.push({
        package_path: pack.package_path,
        submission_id: pack.submission_id,
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
        local_file: null,
        source_image_url: null,
      })
    }
  }

  return results
}

function renderTable(result: ProductIntakeResearchQueueResult, rootDir: string) {
  console.table(
    result.items.map((item) => ({
      id: item.submission_id,
      user: item.user,
      category: item.category,
      brand: item.brand_text ?? "",
      name: item.product_name_text ?? "",
      package_state: item.package_state,
      image_candidate: item.image_candidate_status ?? "",
      created: item.created_package ? "yes" : "",
      package:
        item.package_path === null ? "" : relative(rootDir, item.package_path) || item.package_path,
      next_step: item.next_step,
    })),
  )

  console.log(
    JSON.stringify(
      {
        total_pending: result.total_pending,
        created_packages: result.created_packages,
        existing_packages: result.existing_packages,
        image_searches: result.image_searches.map((item) => ({
          submission_id: item.submission_id,
          status: item.status,
          message: item.message,
          local_file: item.local_file,
          source_image_url: item.source_image_url,
          package: relative(rootDir, item.package_path) || item.package_path,
        })),
        next_commands_by_submission: Object.fromEntries(
          result.items.map((item) => [item.submission_id, item.commands]),
        ),
      },
      null,
      2,
    ),
  )
}

async function main() {
  const args = parseArgs()
  const supabase = createSupabaseClientFromEnv()
  const limit = flagInt(args, "limit", 5)
  const format = flag(args, "format") ?? "table"
  const rootDir = process.cwd()
  const now = new Date()
  const skipImageSearch = flagBool(args, "skip-image-search")
  const forceImageSearch = flagBool(args, "force-image-search")
  const imageSearchLimit = flagInt(args, "image-search-limit", limit)
  const existingPackages = await listReviewPackages({ rootDir })
  const existingSubmissionIds = new Set(
    existingPackages.map((pack) => pack.submission_id).filter((id): id is string => Boolean(id)),
  )
  const rows = await loadQueueRows({
    supabase,
    statusFilter: "pending_review",
    categoryFilter: flag(args, "category"),
    sourceFilter: flag(args, "source"),
    includeClosed: false,
    minAgeDays: null,
    maxAgeDays: null,
    resultLimit: limit,
    now,
  })
  const rowsNeedingPackage = rows.filter((row) => !existingSubmissionIds.has(row.id))
  const prepared = await prepareResearchPackagesFromQueue({
    supabase,
    rootDir,
    now,
    limit,
    loadRows: async () => rowsNeedingPackage,
  })
  const packages = await listReviewPackages({ rootDir })
  const rowSubmissionIds = new Set(rows.map((row) => row.id))
  const latestPackages = [...latestPackageBySubmissionId(packages).values()]
  const queuePackages = latestPackages.filter(
    (pack) => pack.submission_id !== null && rowSubmissionIds.has(pack.submission_id),
  )
  const imageSearches = skipImageSearch
    ? []
    : await runAutomatedImageSearchesForPackages({
        rootDir,
        packages: queuePackages,
        now,
        limit: imageSearchLimit,
        force: forceImageSearch,
      })
  const refreshedPackages =
    imageSearches.length > 0 ? await listReviewPackages({ rootDir }) : packages
  const result = buildResearchQueueResult({
    rows,
    packages: refreshedPackages,
    imageSearches,
    createdPackageIds: new Set(prepared.created.map((item) => item.submissionId)),
  })

  if (format === "json") {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  renderTable(result, rootDir)
}

if (process.argv[1]?.endsWith("research-queue.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
