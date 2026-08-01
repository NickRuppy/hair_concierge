import assert from "node:assert/strict"
import test from "node:test"

import {
  EXPECTED_SUPABASE_PROJECT_ID,
  PRODUCTION_WRITE_GATE,
  buildMetadataPayload,
  canApply,
  classifyBillingSubscription,
  parseMode,
  parsePreactivationStandardBefore,
  runPricingCatalogBackfill,
  type BillingSubscriptionInventoryRow,
} from "../scripts/billing/personal-plan-pricing-catalog-backfill"

const environment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://pqdkhefxsxkyeqelqegq.supabase.co",
  STRIPE_PRICE_ID_MONTHLY: "price_standard_month",
  STRIPE_PRICE_ID_PERSONAL_PLAN_LAUNCH_QUARTERLY: "price_launch_quarter",
  PAYPAL_PLAN_ID_ANNUAL: "P-standard-year",
  PAYPAL_PLAN_ID_PERSONAL_PLAN_LAUNCH_MONTHLY: "P-launch-month",
}

function row(
  overrides: Partial<BillingSubscriptionInventoryRow> = {},
): BillingSubscriptionInventoryRow {
  return {
    id: "row-1",
    created_at: "2026-07-31T12:00:00.000Z",
    provider: "stripe",
    provider_subscription_id: "sub_1",
    provider_status: "active",
    entitlement_status: "active",
    interval: "month",
    metadata: {},
    updated_at: "2026-07-31T12:05:00.000Z",
    ...overrides,
  }
}

test("classifies only configured Stripe and PayPal IDs and preserves their catalog family", () => {
  assert.deepEqual(
    classifyBillingSubscription(
      row({ metadata: { stripe_price_id: "price_launch_quarter" } }),
      environment,
    ),
    {
      kind: "verified",
      catalog: "personal_plan_launch_v1",
      providerId: "price_launch_quarter",
      providerMetadataKey: "stripe_price_id",
      provenance: "provider_id",
    },
  )
  assert.deepEqual(
    classifyBillingSubscription(
      row({ provider: "paypal", metadata: { plan_id: "P-standard-year" } }),
      environment,
    ),
    {
      kind: "verified",
      catalog: "standard",
      providerId: "P-standard-year",
      providerMetadataKey: "paypal_plan_id",
      provenance: "provider_id",
    },
  )
  assert.deepEqual(
    classifyBillingSubscription(
      row({ metadata: { stripe_price_id: "price_unknown" } }),
      environment,
    ),
    { kind: "reconcile", reason: "unknown_provider_id" },
  )
})

test("refuses missing or conflicting local identity and catalog evidence", () => {
  assert.deepEqual(classifyBillingSubscription(row(), environment), {
    kind: "reconcile",
    reason: "missing_provider_identity",
  })
  assert.deepEqual(
    classifyBillingSubscription(
      row({
        provider: "paypal",
        metadata: { paypal_plan_id: "P-standard-year", plan_id: "P-launch-month" },
      }),
      environment,
    ),
    { kind: "reconcile", reason: "conflicting_provider_identity" },
  )
  assert.deepEqual(
    classifyBillingSubscription(
      row({
        metadata: {
          stripe_price_id: "price_standard_month",
          pricing_catalog: "personal_plan_launch_v1",
        },
      }),
      environment,
    ),
    { kind: "reconcile", reason: "conflicting_pricing_catalog" },
  )
})

test("classifies only rows before an explicit preactivation cutoff as standard without provider identity", () => {
  assert.equal(
    parsePreactivationStandardBefore(["--preactivation-standard-before=2026-08-01T00:00:00.000Z"]),
    "2026-08-01T00:00:00.000Z",
  )
  assert.throws(
    () => parsePreactivationStandardBefore(["--preactivation-standard-before=not-a-date"]),
    /invalid preactivation cutoff/,
  )
  assert.deepEqual(
    classifyBillingSubscription(row(), environment, {
      preactivationStandardBefore: "2026-08-01T00:00:00.000Z",
    }),
    {
      kind: "verified",
      catalog: "standard",
      providerId: null,
      providerMetadataKey: null,
      provenance: "preactivation_cutoff",
    },
  )
  assert.deepEqual(
    classifyBillingSubscription(row({ created_at: "2026-08-01T00:00:00.000Z" }), environment, {
      preactivationStandardBefore: "2026-08-01T00:00:00.000Z",
    }),
    { kind: "reconcile", reason: "missing_provider_identity" },
  )
  assert.deepEqual(
    classifyBillingSubscription(row({ metadata: { pricing_catalog: "standard" } }), environment),
    { kind: "already_classified" },
  )
})

test("builds a metadata-only payload without changing subscription fields", () => {
  const classification = classifyBillingSubscription(
    row({ metadata: { stripe_price_id: "price_standard_month", retained: true } }),
    environment,
  )
  assert.equal(classification.kind, "verified")
  assert.deepEqual(
    buildMetadataPayload(
      { stripe_price_id: "price_standard_month", retained: true },
      classification,
    ),
    {
      stripe_price_id: "price_standard_month",
      retained: true,
      pricing_catalog: "standard",
    },
  )
})

test("default and explicit dry-runs inventory without updating; apply needs the dedicated gate", async () => {
  assert.equal(parseMode([]), "dry-run")
  assert.equal(parseMode(["--dry-run"]), "dry-run")
  assert.throws(() => parseMode(["--apply", "--dry-run"]), /cannot be combined/)
  assert.equal(canApply(["--apply"], environment), false)
  assert.equal(canApply(["--apply"], { ...environment, [PRODUCTION_WRITE_GATE]: "1" }), false)
  assert.equal(
    canApply(["--apply", `--confirm-project=${EXPECTED_SUPABASE_PROJECT_ID}`], {
      ...environment,
      [PRODUCTION_WRITE_GATE]: "1",
    }),
    true,
  )
  assert.equal(
    canApply(["--apply", `--confirm-project=${EXPECTED_SUPABASE_PROJECT_ID}`], {
      ...environment,
      NEXT_PUBLIC_SUPABASE_URL: "https://wrong-project.supabase.co",
      [PRODUCTION_WRITE_GATE]: "1",
    }),
    false,
  )

  const writes: unknown[] = []
  const result = await runPricingCatalogBackfill([], {
    environment,
    listRows: async () => [row({ metadata: { stripe_price_id: "price_standard_month" } })],
    updateMetadata: async (...args) => void writes.push(args),
  })
  assert.equal(result.mode, "dry-run")
  assert.equal(result.verified, 1)
  assert.deepEqual(writes, [])
  await assert.rejects(
    runPricingCatalogBackfill(["--apply"], {
      environment,
      listRows: async () => [],
      updateMetadata: async () => undefined,
    }),
    new RegExp(`${PRODUCTION_WRITE_GATE}=1`),
  )
  await assert.rejects(
    runPricingCatalogBackfill(["--apply", `--confirm-project=${EXPECTED_SUPABASE_PROJECT_ID}`], {
      environment: {
        ...environment,
        [PRODUCTION_WRITE_GATE]: "1",
        PERSONAL_PLAN_LAUNCH_PRICING_ENABLED: "true",
      },
      listRows: async () => [],
      updateMetadata: async () => undefined,
    }),
    /launch pricing is enabled/,
  )
})

test("apply updates only verified rows with an optimistic concurrency guard", async () => {
  const writes: Array<[string, Record<string, unknown>, string]> = []
  const result = await runPricingCatalogBackfill(
    ["--apply", `--confirm-project=${EXPECTED_SUPABASE_PROJECT_ID}`],
    {
      environment: { ...environment, [PRODUCTION_WRITE_GATE]: "1" },
      listRows: async () => [
        row({ id: "verified", metadata: { stripe_price_id: "price_standard_month" } }),
        row({ id: "unknown", metadata: { stripe_price_id: "price_unknown" } }),
      ],
      updateMetadata: async (id, metadata, expectedUpdatedAt) =>
        void writes.push([id, metadata, expectedUpdatedAt]),
    },
  )
  assert.equal(result.verified, 1)
  assert.deepEqual(writes, [
    [
      "verified",
      { stripe_price_id: "price_standard_month", pricing_catalog: "standard" },
      "2026-07-31T12:05:00.000Z",
    ],
  ])
})
