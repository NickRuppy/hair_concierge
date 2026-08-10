import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  PaymentSupportPersistenceError,
  REPORTABLE_PAYMENT_FEEDBACK_KINDS,
  createPaymentSupportCase,
  getPaymentSupportReportedFacts,
  parsePaymentSupportRequest,
} from "../src/lib/billing/payment-support"

const migration = readFileSync(
  "supabase/migrations/20260810082837_payment_support_cases.sql",
  "utf8",
)

test("payment support request parsing is closed, canonical, and rejects unsafe fields", () => {
  assert.deepEqual(REPORTABLE_PAYMENT_FEEDBACK_KINDS, [
    "access_already_active",
    "checkout_not_loaded",
    "details_invalid",
    "card_declined",
    "provider_temporarily_unavailable",
    "payment_not_completed",
    "payment_status_pending",
    "access_activation_delayed",
  ])
  assert.deepEqual(
    parsePaymentSupportRequest({
      checkoutAttemptId: "checkout-attempt-123",
      checkoutContext: "result_membership",
      feedbackKind: "card_declined",
      provider: "stripe",
      method: "card",
    }),
    {
      checkoutAttemptId: "checkout-attempt-123",
      checkoutContext: "result_membership",
      feedbackKind: "card_declined",
      provider: "stripe",
      method: "card",
    },
  )

  for (const unsafe of [
    {
      checkoutAttemptId: "x",
      checkoutContext: "result_membership",
      feedbackKind: "card_declined",
      provider: "stripe",
      method: "card",
      leadId: "forged",
    },
    {
      checkoutAttemptId: "x",
      checkoutContext: "result_membership",
      feedbackKind: "card_declined",
      provider: "stripe",
      method: "card",
      note: "help",
    },
    {
      checkoutAttemptId: "x",
      checkoutContext: "result_membership",
      feedbackKind: "not_reportable",
      provider: "stripe",
      method: "card",
    },
  ]) {
    assert.throws(() => parsePaymentSupportRequest(unsafe), PaymentSupportPersistenceError)
  }
})

test("payment support preserves pending and succeeded truth", () => {
  assert.deepEqual(getPaymentSupportReportedFacts("payment_status_pending"), {
    reportedPaymentFamily: "pending",
    reportedPaymentTruth: "pending",
    reportedRetryable: false,
  })
  assert.deepEqual(getPaymentSupportReportedFacts("access_activation_delayed"), {
    reportedPaymentFamily: "activation",
    reportedPaymentTruth: "succeeded",
    reportedRetryable: false,
  })
})

test("payment support persistence maps typed RPC outcomes and rejects malformed responses", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args })
      return {
        data: [
          {
            case_id: "case-1",
            report_code: "PAY-ABCDEFGH",
            created: true,
            receipt_delivery_status: "pending",
          },
        ],
        error: null,
      }
    },
  }

  const result = await createPaymentSupportCase(client, {
    identity: { kind: "lead", id: "11111111-1111-4111-8111-111111111111" },
    request: parsePaymentSupportRequest({
      checkoutAttemptId: "checkout-attempt-123",
      checkoutContext: "result_one_time",
      feedbackKind: "payment_status_pending",
      provider: "paypal",
      method: "paypal",
    }),
    reportedPaymentFamily: "pending",
    reportedPaymentTruth: "pending",
    reportedRetryable: false,
  })

  assert.deepEqual(result, {
    caseId: "case-1",
    reportCode: "PAY-ABCDEFGH",
    created: true,
    receiptDeliveryStatus: "pending",
  })
  assert.deepEqual(calls, [
    {
      name: "create_payment_support_case",
      args: {
        p_lead_id: "11111111-1111-4111-8111-111111111111",
        p_user_id: null,
        p_checkout_attempt_id: "checkout-attempt-123",
        p_checkout_context: "result_one_time",
        p_feedback_kind: "payment_status_pending",
        p_provider: "paypal",
        p_method: "paypal",
        p_reported_payment_family: "pending",
        p_reported_payment_truth: "pending",
        p_reported_retryable: false,
      },
    },
  ])

  await assert.rejects(
    () =>
      createPaymentSupportCase(
        {
          rpc: async () => ({
            data: null,
            error: { code: "P0001", message: "payment support case limit reached" },
          }),
        },
        {
          identity: { kind: "user", id: "22222222-2222-4222-8222-222222222222" },
          request: parsePaymentSupportRequest({
            checkoutAttemptId: "checkout-attempt-456",
            checkoutContext: "reactivation",
            feedbackKind: "access_already_active",
            provider: "stripe",
            method: "card",
          }),
          reportedPaymentFamily: "access",
          reportedPaymentTruth: "failed",
          reportedRetryable: true,
        },
      ),
    (error: unknown) =>
      error instanceof PaymentSupportPersistenceError && error.code === "case_limit_reached",
  )
})

test("payment support migration enforces service-only atomic durable cases", () => {
  assert.match(migration, /CREATE TABLE public\.payment_support_cases/i)
  assert.match(migration, /CHECK \(\(lead_id IS NULL\) <> \(user_id IS NULL\)\)/i)
  assert.match(migration, /UNIQUE \(report_code\)/i)
  assert.match(migration, /gen_random_bytes\(1\)/i)
  assert.match(migration, /23456789ABCDEFGHJKMNPQRSTUVWXYZ_/)
  assert.match(migration, /UNIQUE \(dedupe_key\)/i)
  assert.match(migration, /ALTER TABLE public\.payment_support_cases ENABLE ROW LEVEL SECURITY/i)
  assert.doesNotMatch(migration, /CREATE POLICY/i)
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.payment_support_cases FROM PUBLIC, anon, authenticated/i,
  )
  assert.match(migration, /SECURITY INVOKER/i)
  assert.doesNotMatch(migration, /SECURITY DEFINER/i)
  assert.match(migration, /SET search_path = public, pg_temp/i)
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.create_payment_support_case[\s\S]*FROM PUBLIC, anon, authenticated/i,
  )
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.create_payment_support_case[\s\S]*TO service_role/i,
  )
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(identity_key, 0\)\)/i)
  assert.match(migration, /ON CONFLICT \(dedupe_key\) DO NOTHING\s+RETURNING/i)
  assert.match(migration, /created_at >= now\(\) - interval '24 hours'/i)
  assert.match(migration, /case_count >= 3/i)
  assert.match(migration, /receipt_delivery_status text NOT NULL DEFAULT 'pending'/i)
  assert.match(migration, /resolution_delivery_status text/i)
  assert.match(migration, /CHECK \(status <> 'resolved' OR resolved_by IS NOT NULL\)/i)
  assert.doesNotMatch(migration, /\b(email|ip_address|provider_reference|card_number|free_text)\b/i)
})
