import { config as loadEnv } from "dotenv"
import { existsSync } from "node:fs"
import { join, sep } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

type CheckStatus = "pass" | "fail"

type ReadinessCheck = {
  label: string
  run: () => Promise<void>
}

type CheckResult = {
  label: string
  status: CheckStatus
  detail: string
}

const REQUIRED_BUCKET_ID = "product-intake"
const REQUIRED_BUCKET_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]
const MAX_PRODUCT_INTAKE_UPLOAD_BYTES = 10 * 1024 * 1024

const TABLE_COLUMN_CHECKS = [
  {
    table: "product_categories",
    columns: ["key", "display_name_de", "is_catalog_supported", "is_intake_supported"],
    reason: "category support gating",
  },
  {
    table: "brands",
    columns: ["id", "canonical_name", "normalized_name"],
    reason: "brand resolution",
  },
  {
    table: "product_lines",
    columns: ["id", "brand_id", "canonical_name", "normalized_name"],
    reason: "brand/product-line resolution",
  },
  {
    table: "brand_aliases",
    columns: ["brand_id", "product_line_id", "alias", "normalized_alias"],
    reason: "brand alias resolution",
  },
  {
    table: "products",
    columns: [
      "id",
      "name",
      "brand_id",
      "product_line_id",
      "category_key",
      "is_active",
      "is_chaarlie_recommended",
    ],
    reason: "catalog matching",
  },
  {
    table: "product_identifiers",
    columns: [
      "product_id",
      "identifier_type",
      "identifier_value",
      "normalized_identifier_value",
      "source",
    ],
    reason: "identifier/barcode matching",
  },
  {
    table: "user_product_usage",
    columns: [
      "id",
      "user_id",
      "category",
      "product_name",
      "frequency_range",
      "brand_text",
      "product_id",
      "product_submission_id",
      "match_status",
      "intake_method",
      "source",
      "front_image_path",
    ],
    reason: "user inventory intake/link state",
  },
  {
    table: "product_submissions",
    columns: [
      "id",
      "user_id",
      "user_product_usage_id",
      "source",
      "source_conversation_id",
      "intake_method",
      "category",
      "brand_text",
      "product_name_text",
      "frequency_range",
      "front_image_path",
      "barcode_image_path",
      "front_image_validation_status",
      "front_image_validation_metadata",
      "barcode_image_validation_status",
      "barcode_image_validation_metadata",
      "previous_product_id",
      "previous_product_snapshot",
      "status",
      "researched_payload",
      "intake_history",
      "approved_product_id",
      "reviewed_at",
      "reviewed_by",
      "review_notes",
      "user_facing_resolution_reason",
      "user_facing_next_step",
      "user_facing_missing_fields",
      "notification_sent_at",
      "cleanup_after",
      "photos_deleted_at",
      "created_at",
      "updated_at",
    ],
    reason: "operator review queue",
  },
] as const

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

function targetLabel(): string {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!rawUrl) return "unknown Supabase URL"

  try {
    const url = new URL(rawUrl)
    return url.hostname
  } catch {
    return "configured Supabase URL"
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return "unknown error"
}

async function expectColumns(
  supabase: SupabaseClient,
  table: string,
  columns: readonly string[],
  reason: string,
) {
  const { error } = await supabase.from(table).select(columns.join(",")).limit(1)

  if (error) {
    throw new Error(`${table}: missing or inaccessible primitives for ${reason}: ${error.message}`)
  }
}

async function expectProductIntakeBucket(supabase: SupabaseClient) {
  const { data, error } = await supabase.storage.getBucket(REQUIRED_BUCKET_ID)

  if (error || !data) {
    throw new Error(
      `storage bucket "${REQUIRED_BUCKET_ID}" is missing or inaccessible: ${
        error?.message ?? "no bucket returned"
      }`,
    )
  }

  if (data.public) {
    throw new Error(`storage bucket "${REQUIRED_BUCKET_ID}" must not be public`)
  }

  const configuredLimit = data.file_size_limit ?? 0
  if (configuredLimit < MAX_PRODUCT_INTAKE_UPLOAD_BYTES) {
    throw new Error(
      `storage bucket "${REQUIRED_BUCKET_ID}" file_size_limit is ${configuredLimit}; expected at least ${MAX_PRODUCT_INTAKE_UPLOAD_BYTES}`,
    )
  }

  const mimeTypes = data.allowed_mime_types ?? []
  const missingMimeTypes = REQUIRED_BUCKET_MIME_TYPES.filter(
    (mimeType) => !mimeTypes.includes(mimeType),
  )
  if (missingMimeTypes.length > 0) {
    throw new Error(
      `storage bucket "${REQUIRED_BUCKET_ID}" missing allowed MIME types: ${missingMimeTypes.join(", ")}`,
    )
  }
}

async function runCheck(check: ReadinessCheck): Promise<CheckResult> {
  try {
    await check.run()
    return { label: check.label, status: "pass", detail: "ready" }
  } catch (error) {
    return { label: check.label, status: "fail", detail: formatError(error) }
  }
}

async function main() {
  const supabase = createSupabaseClientFromEnv()
  const checks: ReadinessCheck[] = [
    {
      label: `storage bucket: ${REQUIRED_BUCKET_ID}`,
      run: () => expectProductIntakeBucket(supabase),
    },
    ...TABLE_COLUMN_CHECKS.map((check) => ({
      label: `table columns: ${check.table}`,
      run: () => expectColumns(supabase, check.table, check.columns, check.reason),
    })),
  ]

  console.log(`Product Intake readiness target: ${targetLabel()}`)
  console.log("Checking schema/storage primitives only; empty tables are acceptable.")

  const results = await Promise.all(checks.map(runCheck))

  for (const result of results) {
    const marker = result.status === "pass" ? "PASS" : "FAIL"
    console.log(`${marker} ${result.label} - ${result.detail}`)
  }

  const failures = results.filter((result) => result.status === "fail")
  if (failures.length > 0) {
    console.error(`Product Intake readiness failed: ${failures.length} critical check(s) failed.`)
    process.exitCode = 1
    return
  }

  console.log("Product Intake readiness passed.")
}

main().catch((error) => {
  console.error(`Product Intake readiness check crashed: ${formatError(error)}`)
  process.exitCode = 1
})
