import assert from "node:assert/strict"
import test from "node:test"

import {
  EXPECTED_SUPABASE_PROJECT_ID,
  PRODUCTION_WRITE_GATE,
  runPayPalTestClassification,
  type PayPalTestSubscriptionRow,
} from "../scripts/billing/classify-payment-monitor-paypal-test"

const row: PayPalTestSubscriptionRow = {
  id: "8342d251-ae12-43d7-9829-5040ec283b5c",
  provider: "paypal",
  provider_subscription_id: "I-RAWLEGACYTEST",
  provider_status: "ACTIVE",
  entitlement_status: "active",
  created_at: "2026-05-28T09:35:39.281Z",
  updated_at: "2026-05-28T09:35:51.654Z",
  metadata: { pricing_catalog: "standard" },
}

const subscriptionArg = "--subscription-id=I-RAWLEGACYTEST"

test("PayPal test classification dry-run is PII-safe and does not write", async () => {
  let writes = 0
  const summary = await runPayPalTestClassification([subscriptionArg], {
    environment: {},
    now: () => new Date("2026-08-02T12:00:00.000Z"),
    listRows: async () => [row],
    updateMetadata: async () => {
      writes += 1
    },
  })

  assert.deepEqual(summary, {
    mode: "dry-run",
    matched: 1,
    eligible: 1,
    already_classified: 0,
    provider: "paypal",
    provider_status: "ACTIVE",
    entitlement_status: "active",
    created_month: "2026-05",
  })
  assert.equal(writes, 0)
  assert.equal(JSON.stringify(summary).includes("I-RAW"), false)
  assert.equal(JSON.stringify(summary).includes(row.id), false)
})

test("PayPal test classification apply requires every production gate", async () => {
  const baseEnvironment = {
    NEXT_PUBLIC_SUPABASE_URL: `https://${EXPECTED_SUPABASE_PROJECT_ID}.supabase.co`,
    [PRODUCTION_WRITE_GATE]: "1",
  }
  const requiredArgs = [
    subscriptionArg,
    "--apply",
    "--confirm-internal-test",
    `--confirm-project=${EXPECTED_SUPABASE_PROJECT_ID}`,
  ]

  for (const args of [
    requiredArgs.filter((arg) => arg !== "--confirm-internal-test"),
    requiredArgs.filter((arg) => !arg.startsWith("--confirm-project=")),
    requiredArgs,
  ]) {
    const environment =
      args === requiredArgs ? { ...baseEnvironment, [PRODUCTION_WRITE_GATE]: "0" } : baseEnvironment
    await assert.rejects(
      runPayPalTestClassification(args, {
        environment,
        listRows: async () => [row],
        updateMetadata: async () => undefined,
      }),
      /requires the production write gate/,
    )
  }
})

test("PayPal test classification applies a metadata-only optimistic update", async () => {
  const writes: unknown[] = []
  const summary = await runPayPalTestClassification(
    [
      subscriptionArg,
      "--apply",
      "--confirm-internal-test",
      `--confirm-project=${EXPECTED_SUPABASE_PROJECT_ID}`,
    ],
    {
      environment: {
        NEXT_PUBLIC_SUPABASE_URL: `https://${EXPECTED_SUPABASE_PROJECT_ID}.supabase.co`,
        [PRODUCTION_WRITE_GATE]: "1",
      },
      now: () => new Date("2026-08-02T12:00:00.000Z"),
      listRows: async () => [row],
      updateMetadata: async (id, metadata, expectedUpdatedAt) => {
        writes.push({ id, metadata, expectedUpdatedAt })
      },
    },
  )

  assert.equal(summary.mode, "apply")
  assert.deepEqual(writes, [
    {
      id: row.id,
      expectedUpdatedAt: row.updated_at,
      metadata: {
        pricing_catalog: "standard",
        is_internal_test: true,
        payment_monitor_exclusion_reason: "pre_cutover_rest_app",
        payment_monitor_excluded_at: "2026-08-02T12:00:00.000Z",
      },
    },
  ])
})

test("PayPal test classification refuses ambiguous, post-cutover, or non-PayPal rows", async () => {
  for (const rows of [
    [],
    [row, { ...row, id: "another-row" }],
    [{ ...row, provider: "stripe" }],
    [{ ...row, provider_status: "CANCELLED" }],
    [{ ...row, entitlement_status: "canceled" }],
    [{ ...row, created_at: "2026-06-01T00:00:00.000Z" }],
  ]) {
    await assert.rejects(
      runPayPalTestClassification([subscriptionArg], {
        environment: {},
        listRows: async () => rows as PayPalTestSubscriptionRow[],
        updateMetadata: async () => undefined,
      }),
      /refusing classification/,
    )
  }
})
