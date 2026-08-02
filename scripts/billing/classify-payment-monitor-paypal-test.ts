import { createClient } from "@supabase/supabase-js"

export const EXPECTED_SUPABASE_PROJECT_ID = "pqdkhefxsxkyeqelqegq"
export const PRODUCTION_WRITE_GATE = "PAYMENT_MONITOR_TEST_CLASSIFICATION_PRODUCTION_WRITE"

const PRE_CUTOVER_CREATED_BEFORE = "2026-06-01T00:00:00.000Z"
const EXCLUSION_REASON = "pre_cutover_rest_app"

export type PayPalTestSubscriptionRow = {
  id: string
  provider: string
  provider_subscription_id: string
  provider_status: string
  entitlement_status: string
  created_at: string
  updated_at: string
  metadata: unknown
}

type Dependencies = {
  environment?: Record<string, string | undefined>
  now?: () => Date
  listRows: (providerSubscriptionId: string) => Promise<PayPalTestSubscriptionRow[]>
  updateMetadata: (
    id: string,
    metadata: Record<string, unknown>,
    expectedUpdatedAt: string,
  ) => Promise<void>
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function booleanLike(value: unknown): boolean {
  return value === true || value === "true" || value === "1" || value === 1 || value === "yes"
}

function parseSubscriptionId(args: readonly string[]): string {
  const values = args
    .filter((arg) => arg.startsWith("--subscription-id="))
    .map((arg) => arg.slice("--subscription-id=".length).trim())
  if (values.length !== 1 || !/^I-[A-Z0-9]+$/.test(values[0] ?? ""))
    throw new Error("exactly one valid PayPal subscription id is required")
  return values[0]
}

function parseMode(args: readonly string[]): "dry-run" | "apply" {
  if (!args.includes("--apply")) return "dry-run"
  if (args.includes("--dry-run")) throw new Error("--dry-run cannot be combined with --apply")
  return "apply"
}

function canApply(
  args: readonly string[],
  environment: Record<string, string | undefined>,
): boolean {
  let projectId: string | null = null
  try {
    projectId = new URL(environment.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0] ?? null
  } catch {
    projectId = null
  }
  return (
    args.includes("--apply") &&
    args.includes("--confirm-internal-test") &&
    args.includes(`--confirm-project=${EXPECTED_SUPABASE_PROJECT_ID}`) &&
    environment[PRODUCTION_WRITE_GATE]?.trim() === "1" &&
    projectId === EXPECTED_SUPABASE_PROJECT_ID
  )
}

function isAlreadyClassified(row: PayPalTestSubscriptionRow): boolean {
  const metadata = metadataRecord(row.metadata)
  return (
    booleanLike(metadata.is_internal_test) &&
    metadata.payment_monitor_exclusion_reason === EXCLUSION_REASON
  )
}

function assertEligibleRow(rows: PayPalTestSubscriptionRow[]): PayPalTestSubscriptionRow {
  if (rows.length !== 1) throw new Error("refusing classification: expected exactly one row")
  const row = rows[0]
  const createdAt = Date.parse(row.created_at)
  if (
    row.provider !== "paypal" ||
    row.provider_status !== "ACTIVE" ||
    row.entitlement_status !== "active" ||
    !Number.isFinite(createdAt) ||
    createdAt >= Date.parse(PRE_CUTOVER_CREATED_BEFORE)
  ) {
    throw new Error("refusing classification: row is not an eligible pre-cutover PayPal test")
  }
  return row
}

export async function runPayPalTestClassification(
  args: readonly string[],
  dependencies: Dependencies,
) {
  const environment = dependencies.environment ?? process.env
  const mode = parseMode(args)
  const providerSubscriptionId = parseSubscriptionId(args)
  if (mode === "apply" && !canApply(args, environment))
    throw new Error(
      `--apply requires the production write gate, --confirm-internal-test, --confirm-project=${EXPECTED_SUPABASE_PROJECT_ID}, and the matching Supabase URL`,
    )

  const row = assertEligibleRow(await dependencies.listRows(providerSubscriptionId))
  const alreadyClassified = isAlreadyClassified(row)
  const summary = {
    mode,
    matched: 1,
    eligible: alreadyClassified ? 0 : 1,
    already_classified: alreadyClassified ? 1 : 0,
    provider: "paypal" as const,
    provider_status: row.provider_status,
    entitlement_status: row.entitlement_status,
    created_month: row.created_at.slice(0, 7),
  }

  if (mode === "apply" && !alreadyClassified) {
    await dependencies.updateMetadata(
      row.id,
      {
        ...metadataRecord(row.metadata),
        is_internal_test: true,
        payment_monitor_exclusion_reason: EXCLUSION_REASON,
        payment_monitor_excluded_at: (dependencies.now?.() ?? new Date()).toISOString(),
      },
      row.updated_at,
    )
  }

  return summary
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key)
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

  const args = process.argv.slice(2)
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const result = await runPayPalTestClassification(args, {
    listRows: async (providerSubscriptionId) => {
      const { data, error } = await supabase
        .from("billing_subscriptions")
        .select(
          "id, provider, provider_subscription_id, provider_status, entitlement_status, created_at, updated_at, metadata",
        )
        .eq("provider_subscription_id", providerSubscriptionId)
        .limit(2)
      if (error) throw error
      return (data ?? []) as PayPalTestSubscriptionRow[]
    },
    updateMetadata: async (id, metadata, expectedUpdatedAt) => {
      const { data, error } = await supabase
        .from("billing_subscriptions")
        .update({ metadata })
        .eq("id", id)
        .eq("provider", "paypal")
        .eq("updated_at", expectedUpdatedAt)
        .is("metadata->>payment_monitor_exclusion_reason", null)
        .select("id")
      if (error) throw error
      if (data?.length !== 1)
        throw new Error("billing subscription changed after inventory; refusing stale update")
    },
  })
  console.log(JSON.stringify(result, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "classification failed")
    process.exitCode = 1
  })
