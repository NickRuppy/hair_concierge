import {
  cleanupAbandonedTmpUploads,
  cleanupExpiredSubmissionPhotos,
  loadReferencedSubmissionImagePaths,
} from "./cleanup-photos"
import { createSupabaseClientFromEnv, flagBool, parseArgs } from "./cli"

const DEFAULT_TMP_MAX_AGE_HOURS = 6

function tmpCutoff() {
  const raw = process.env.PRODUCT_INTAKE_TMP_MAX_AGE_HOURS
  const hours = raw ? Number(raw) : DEFAULT_TMP_MAX_AGE_HOURS
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_TMP_MAX_AGE_HOURS
  return new Date(Date.now() - safeHours * 60 * 60 * 1000)
}

async function main() {
  const args = parseArgs()
  const apply = flagBool(args, "apply")
  const confirm = flagBool(args, "confirm")
  const supabase = createSupabaseClientFromEnv()
  const cutoff = tmpCutoff()

  if (apply && !confirm) {
    throw new Error("Storage cleanup writes require --confirm")
  }

  console.log(`Product Intake storage cleanup mode: ${apply ? "apply" : "dry-run"}`)
  const expiredSubmissions = await cleanupExpiredSubmissionPhotos(supabase, apply)
  const protectedPaths = await loadReferencedSubmissionImagePaths(supabase)
  const tmpUploads = await cleanupAbandonedTmpUploads(supabase, apply, cutoff, protectedPaths)

  console.log(
    `Expired submission rows: ${expiredSubmissions.rows}; committed objects ${
      apply ? "removed" : "eligible"
    }: ${expiredSubmissions.objects}`,
  )
  console.log(`Temporary objects ${apply ? "removed" : "eligible"}: ${tmpUploads.objects}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
