import { config as loadEnv } from "dotenv"
import { existsSync } from "node:fs"
import { join, sep } from "node:path"
import { pathToFileURL } from "node:url"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const PRODUCT_INTAKE_BUCKET = "product-intake"
const DEFAULT_TMP_MAX_AGE_HOURS = 24
const SUBMISSION_BATCH_SIZE = 100
const STORAGE_PAGE_SIZE = 100

type ProductSubmissionPhotoRow = {
  id: string
  front_image_path: string | null
  barcode_image_path: string | null
}

type ReferencedSubmissionPhotoRow = {
  front_image_path: string | null
  barcode_image_path: string | null
}

function loadLocalEnv() {
  for (const envPath of envCandidatePaths()) {
    if (existsSync(envPath)) {
      loadEnv({ path: envPath })
    }
  }
}

function envCandidatePaths(): string[] {
  const cwd = process.cwd()
  const candidates = [join(cwd, ".env.local")]
  const worktreeIndex = cwd.indexOf(`${sep}.worktrees${sep}`)

  if (worktreeIndex >= 0) {
    candidates.push(join(cwd.slice(0, worktreeIndex), ".env.local"))
  }

  return [...new Set(candidates)]
}

function createSupabaseClientFromEnv(): SupabaseClient {
  loadLocalEnv()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function hasApplyFlag() {
  return process.argv.includes("--apply")
}

function tmpMaxAgeHours() {
  const raw = process.env.PRODUCT_INTAKE_TMP_MAX_AGE_HOURS
  if (!raw) return DEFAULT_TMP_MAX_AGE_HOURS
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TMP_MAX_AGE_HOURS
}

function cutoffDate(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000)
}

function isOlderThan(value: string | null | undefined, cutoff: Date) {
  if (!value) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date < cutoff
}

function uniquePaths(paths: Array<string | null | undefined>) {
  return [...new Set(paths.filter((path): path is string => Boolean(path)))]
}

async function removeStorageObjects(
  supabase: SupabaseClient,
  paths: string[],
  apply: boolean,
): Promise<number> {
  if (paths.length === 0) return 0
  if (!apply) return paths.length

  const { error } = await supabase.storage.from(PRODUCT_INTAKE_BUCKET).remove(paths)
  if (error) {
    throw new Error(`remove product intake photos: ${error.message}`)
  }
  return paths.length
}

export async function cleanupExpiredSubmissionPhotos(supabase: SupabaseClient, apply: boolean) {
  let totalRows = 0
  let totalObjects = 0
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from("product_submissions")
      .select("id, front_image_path, barcode_image_path")
      .in("status", ["cancelled_by_user", "rejected"])
      .lte("cleanup_after", new Date().toISOString())
      .is("photos_deleted_at", null)
      .range(offset, offset + SUBMISSION_BATCH_SIZE - 1)

    if (error) {
      throw new Error(`load expired submission photos: ${error.message}`)
    }

    const rows = (data ?? []) as ProductSubmissionPhotoRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      const paths = uniquePaths([row.front_image_path, row.barcode_image_path])
      totalObjects += await removeStorageObjects(supabase, paths, apply)

      if (apply) {
        const { error: updateError } = await supabase
          .from("product_submissions")
          .update({ photos_deleted_at: new Date().toISOString() })
          .eq("id", row.id)

        if (updateError) {
          throw new Error(`stamp photos_deleted_at for ${row.id}: ${updateError.message}`)
        }
      }

      totalRows += 1
    }

    if (rows.length < SUBMISSION_BATCH_SIZE) break
    if (!apply) offset += rows.length
  }

  return { rows: totalRows, objects: totalObjects }
}

export async function loadReferencedSubmissionImagePaths(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  const paths = new Set<string>()

  for (let offset = 0; ; offset += SUBMISSION_BATCH_SIZE) {
    const { data, error } = await supabase
      .from("product_submissions")
      .select("front_image_path, barcode_image_path")
      .is("photos_deleted_at", null)
      .range(offset, offset + SUBMISSION_BATCH_SIZE - 1)

    if (error) {
      throw new Error(`load referenced submission photos: ${error.message}`)
    }

    const rows = (data ?? []) as ReferencedSubmissionPhotoRow[]
    for (const row of rows) {
      for (const path of uniquePaths([row.front_image_path, row.barcode_image_path])) {
        paths.add(path)
      }
    }

    if (rows.length < SUBMISSION_BATCH_SIZE) break
  }

  return paths
}

async function listStoragePage(supabase: SupabaseClient, path: string, offset: number) {
  const { data, error } = await supabase.storage.from(PRODUCT_INTAKE_BUCKET).list(path, {
    limit: STORAGE_PAGE_SIZE,
    offset,
    sortBy: { column: "name", order: "asc" },
  })

  if (error) {
    throw new Error(`list storage path ${path}: ${error.message}`)
  }

  return data ?? []
}

async function listAllStorageEntries(supabase: SupabaseClient, path: string) {
  const entries = []
  for (let offset = 0; ; offset += STORAGE_PAGE_SIZE) {
    const page = await listStoragePage(supabase, path, offset)
    entries.push(...page)
    if (page.length < STORAGE_PAGE_SIZE) break
  }
  return entries
}

export async function cleanupAbandonedTmpUploads(
  supabase: SupabaseClient,
  apply: boolean,
  cutoff: Date,
  protectedPaths: ReadonlySet<string> = new Set(),
) {
  const users = await listAllStorageEntries(supabase, "tmp")
  let totalObjects = 0

  for (const userEntry of users) {
    if (!userEntry.name) continue
    const userPath = `tmp/${userEntry.name}`
    const files = await listAllStorageEntries(supabase, userPath)
    const stalePaths = files
      .filter((file) => isOlderThan(file.updated_at ?? file.created_at, cutoff))
      .map((file) => `${userPath}/${file.name}`)
      .filter((path) => !protectedPaths.has(path))

    totalObjects += await removeStorageObjects(supabase, stalePaths, apply)
  }

  return { objects: totalObjects }
}

async function main() {
  const apply = hasApplyFlag()
  const supabase = createSupabaseClientFromEnv()
  const tmpCutoff = cutoffDate(tmpMaxAgeHours())

  console.log(`Product Intake photo cleanup mode: ${apply ? "apply" : "dry-run"}`)
  console.log(`Temporary upload cutoff: ${tmpCutoff.toISOString()}`)

  const expiredSubmissions = await cleanupExpiredSubmissionPhotos(supabase, apply)
  const protectedPaths = await loadReferencedSubmissionImagePaths(supabase)
  const tmpUploads = await cleanupAbandonedTmpUploads(supabase, apply, tmpCutoff, protectedPaths)

  console.log(
    `Expired submission rows: ${expiredSubmissions.rows}; committed objects ${
      apply ? "removed" : "eligible"
    }: ${expiredSubmissions.objects}`,
  )
  console.log(`Temporary objects ${apply ? "removed" : "eligible"}: ${tmpUploads.objects}`)

  if (!apply) {
    console.log("Dry-run only. Re-run with --apply to delete objects and stamp reviewed rows.")
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Product Intake cleanup failed")
    process.exitCode = 1
  })
}
