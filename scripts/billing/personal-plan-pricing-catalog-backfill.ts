import { createClient } from "@supabase/supabase-js"

export const PRODUCTION_WRITE_GATE = "BILLING_PRICING_CATALOG_BACKFILL_PRODUCTION_WRITE"
export const EXPECTED_SUPABASE_PROJECT_ID = "pqdkhefxsxkyeqelqegq"

type Catalog = "standard" | "personal_plan_launch_v1"
type Provider = "stripe" | "paypal"
type Interval = "month" | "quarter" | "year"

type CatalogEntry = { catalog: Catalog; interval: Interval }
export type BillingSubscriptionInventoryRow = {
  id: string
  created_at: string
  provider: Provider
  provider_subscription_id: string
  provider_status: string
  entitlement_status: string
  interval: string | null
  metadata: unknown
  updated_at: string
}

export type BackfillClassification =
  | {
      kind: "verified"
      catalog: Catalog
      providerId: string | null
      providerMetadataKey: string | null
      provenance: "provider_id" | "preactivation_cutoff"
    }
  | { kind: "already_classified" }
  | { kind: "reconcile"; reason: string }

const intervalEnvSuffix: Record<Interval, string> = {
  month: "MONTHLY",
  quarter: "QUARTERLY",
  year: "ANNUAL",
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function configuredIds(
  environment: Record<string, string | undefined>,
  provider: Provider,
): Map<string, CatalogEntry[]> {
  const entries = new Map<string, CatalogEntry[]>()
  const add = (id: string | null, entry: CatalogEntry) => {
    if (!id) return
    entries.set(id, [...(entries.get(id) ?? []), entry])
  }
  for (const interval of Object.keys(intervalEnvSuffix) as Interval[]) {
    const suffix = intervalEnvSuffix[interval]
    const currentKey =
      provider === "stripe" ? `STRIPE_PRICE_ID_${suffix}` : `PAYPAL_PLAN_ID_${suffix}`
    const legacyKeys =
      provider === "stripe"
        ? [`STRIPE_LEGACY_PRICE_ID_${suffix}`, `STRIPE_LEGACY_PRICE_IDS_${suffix}`]
        : [`PAYPAL_LEGACY_PLAN_ID_${suffix}`, `PAYPAL_LEGACY_PLAN_IDS_${suffix}`]
    add(stringValue(environment[currentKey]), { catalog: "standard", interval })
    for (const legacyKey of legacyKeys) {
      for (const id of (environment[legacyKey] ?? "").split(","))
        add(stringValue(id), { catalog: "standard", interval })
    }
    const launchKey =
      provider === "stripe"
        ? `STRIPE_PRICE_ID_PERSONAL_PLAN_LAUNCH_${suffix}`
        : `PAYPAL_PLAN_ID_PERSONAL_PLAN_LAUNCH_${suffix}`
    add(stringValue(environment[launchKey]), { catalog: "personal_plan_launch_v1", interval })
  }
  return entries
}

function uniqueEntries(entries: CatalogEntry[]): CatalogEntry[] {
  return entries.filter(
    (entry, index) =>
      entries.findIndex(
        (candidate) => candidate.catalog === entry.catalog && candidate.interval === entry.interval,
      ) === index,
  )
}

export function classifyBillingSubscription(
  row: BillingSubscriptionInventoryRow,
  environment: Record<string, string | undefined> = process.env,
  options: { preactivationStandardBefore?: string | null } = {},
): BackfillClassification {
  const metadata = metadataRecord(row.metadata)
  const catalog = stringValue(metadata.pricing_catalog)
  const providerMetadataKey = row.provider === "stripe" ? "stripe_price_id" : "paypal_plan_id"
  const providerIds =
    row.provider === "stripe"
      ? [stringValue(metadata.stripe_price_id)]
      : [stringValue(metadata.paypal_plan_id), stringValue(metadata.plan_id)]
  const distinctProviderIds = [...new Set(providerIds.filter((id): id is string => Boolean(id)))]

  if (distinctProviderIds.length === 0) {
    if (catalog === "standard" || catalog === "personal_plan_launch_v1") {
      return { kind: "already_classified" }
    }
    const cutoff = options.preactivationStandardBefore
      ? Date.parse(options.preactivationStandardBefore)
      : Number.NaN
    const createdAt = Date.parse(row.created_at)
    if (!catalog && Number.isFinite(cutoff) && Number.isFinite(createdAt) && createdAt < cutoff) {
      return {
        kind: "verified",
        catalog: "standard",
        providerId: null,
        providerMetadataKey: null,
        provenance: "preactivation_cutoff",
      }
    }
    return { kind: "reconcile", reason: "missing_provider_identity" }
  }
  if (distinctProviderIds.length > 1)
    return { kind: "reconcile", reason: "conflicting_provider_identity" }

  const providerId = distinctProviderIds[0]
  const matches = uniqueEntries(configuredIds(environment, row.provider).get(providerId) ?? [])
  if (matches.length === 0) return { kind: "reconcile", reason: "unknown_provider_id" }
  if (matches.length > 1) return { kind: "reconcile", reason: "conflicting_configured_provider_id" }

  const resolved = matches[0]
  if (catalog === resolved.catalog) return { kind: "already_classified" }
  if (catalog) return { kind: "reconcile", reason: "conflicting_pricing_catalog" }
  return {
    kind: "verified",
    catalog: resolved.catalog,
    providerId,
    providerMetadataKey,
    provenance: "provider_id",
  }
}

export function buildMetadataPayload(
  metadata: unknown,
  classification: Extract<BackfillClassification, { kind: "verified" }>,
): Record<string, unknown> {
  return {
    ...metadataRecord(metadata),
    ...(classification.providerMetadataKey && classification.providerId
      ? { [classification.providerMetadataKey]: classification.providerId }
      : {}),
    pricing_catalog: classification.catalog,
  }
}

export function canApply(
  args: readonly string[],
  environment: Record<string, string | undefined>,
): boolean {
  let targetProjectId: string | null = null
  try {
    targetProjectId = new URL(environment.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0]
  } catch {
    targetProjectId = null
  }
  return (
    args.includes("--apply") &&
    args.includes(`--confirm-project=${EXPECTED_SUPABASE_PROJECT_ID}`) &&
    environment[PRODUCTION_WRITE_GATE]?.trim() === "1" &&
    targetProjectId === EXPECTED_SUPABASE_PROJECT_ID
  )
}

export function parseMode(args: readonly string[]): "dry-run" | "apply" {
  if (!args.includes("--apply")) return "dry-run"
  if (args.includes("--dry-run")) throw new Error("--dry-run cannot be combined with --apply")
  return "apply"
}

export function parsePreactivationStandardBefore(args: readonly string[]): string | null {
  const values = args
    .filter((arg) => arg.startsWith("--preactivation-standard-before="))
    .map((arg) => arg.slice("--preactivation-standard-before=".length).trim())
  if (values.length > 1) throw new Error("preactivation cutoff may be supplied only once")
  if (values.length === 0) return null
  const parsed = Date.parse(values[0])
  if (!values[0] || !Number.isFinite(parsed)) throw new Error("invalid preactivation cutoff")
  return new Date(parsed).toISOString()
}

export async function runPricingCatalogBackfill(
  args: readonly string[],
  dependencies: {
    environment?: Record<string, string | undefined>
    listRows: () => Promise<BillingSubscriptionInventoryRow[]>
    updateMetadata: (
      id: string,
      metadata: Record<string, unknown>,
      expectedUpdatedAt: string,
    ) => Promise<void>
  },
) {
  const environment = dependencies.environment ?? process.env
  const mode = parseMode(args)
  const preactivationStandardBefore = parsePreactivationStandardBefore(args)
  if (mode === "apply" && !canApply(args, environment))
    throw new Error(
      `--apply requires ${PRODUCTION_WRITE_GATE}=1, --confirm-project=${EXPECTED_SUPABASE_PROJECT_ID}, and the matching Supabase URL`,
    )
  if (mode === "apply" && environment.PERSONAL_PLAN_LAUNCH_PRICING_ENABLED?.trim() === "true")
    throw new Error("refusing metadata backfill while launch pricing is enabled")

  const rows = await dependencies.listRows()
  const inventory = rows.map((row) => ({
    row,
    classification: classifyBillingSubscription(row, environment, {
      preactivationStandardBefore,
    }),
  }))
  const verified = inventory.filter(
    (
      item,
    ): item is {
      row: BillingSubscriptionInventoryRow
      classification: Extract<BackfillClassification, { kind: "verified" }>
    } => item.classification.kind === "verified",
  )
  const summary = {
    mode,
    preactivation_standard_before: preactivationStandardBefore,
    total: rows.length,
    verified: verified.length,
    already_classified: inventory.filter(
      (item) => item.classification.kind === "already_classified",
    ).length,
    reconciliation: inventory
      .filter((item) => item.classification.kind === "reconcile")
      .map((item) => ({
        id: item.row.id,
        provider: item.row.provider,
        reason: (item.classification as Extract<BackfillClassification, { kind: "reconcile" }>)
          .reason,
      })),
    updates: verified.map((item) => ({
      id: item.row.id,
      provider: item.row.provider,
      metadata: buildMetadataPayload(item.row.metadata, item.classification),
    })),
  }
  if (mode === "apply")
    for (const item of verified)
      await dependencies.updateMetadata(
        item.row.id,
        buildMetadataPayload(item.row.metadata, item.classification),
        item.row.updated_at,
      )
  return summary
}

async function main() {
  const args = process.argv.slice(2)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key)
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const result = await runPricingCatalogBackfill(args, {
    listRows: async () => {
      const { data, error } = await supabase
        .from("billing_subscriptions")
        .select(
          "id, created_at, provider, provider_subscription_id, provider_status, entitlement_status, interval, metadata, updated_at",
        )
        .order("created_at", { ascending: true })
      if (error) throw error
      return (data ?? []) as BillingSubscriptionInventoryRow[]
    },
    updateMetadata: async (id, metadata, expectedUpdatedAt) => {
      const { data, error } = await supabase
        .from("billing_subscriptions")
        .update({ metadata })
        .eq("id", id)
        .eq("updated_at", expectedUpdatedAt)
        .is("metadata->>pricing_catalog", null)
        .select("id")
      if (error) throw error
      if (data?.length !== 1)
        throw new Error(`Billing subscription ${id} changed after inventory; refusing stale update`)
    },
  })
  console.log(JSON.stringify(result, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
