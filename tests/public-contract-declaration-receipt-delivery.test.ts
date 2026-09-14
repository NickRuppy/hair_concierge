import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

import {
  CustomerIoAmbiguousDeliveryError,
  CustomerIoHttpError,
} from "../src/lib/customerio/transactional"
import {
  dispatchPublicContractDeclarationReceipts,
  PUBLIC_DECLARATION_RECEIPT_DELIVERY_LEASE_SECONDS,
  PUBLIC_DECLARATION_RECEIPT_DELIVERY_LIMIT,
} from "../src/lib/billing/public-contract-declaration-receipt-delivery"
import type { PublicContractDeclarationReceipt } from "../src/lib/billing/public-contract-declaration"
import { handlePublicContractDeclarationReceiptReconcile } from "../src/app/api/billing/public-contract-declaration-receipts/reconcile/route"

const receiptPayload: PublicContractDeclarationReceipt = {
  declarationId: "11111111-1111-4111-8111-111111111111",
  submittedAt: "2026-09-14T12:00:00.000Z",
  declaration: {
    requestId: "22222222-2222-4222-8222-222222222222",
    kind: "ordinary_cancellation",
    name: "Marie Beispiel",
    email: "marie@example.com",
    contract: "Chaarlie Jahresabo CH-123",
    requestedEnd: "Zum nächstmöglichen Zeitpunkt",
    reason: null,
  },
}

const claimedRow = {
  declaration_id: receiptPayload.declarationId,
  attempt_id: "33333333-3333-4333-8333-333333333333",
  receipt_payload: receiptPayload,
}

const ROOT = new URL("../", import.meta.url)
const MIGRATIONS = [
  "supabase/migrations/20260914103100_public_contract_declarations.sql",
  "supabase/migrations/20260914110000_public_contract_declaration_receipt_delivery.sql",
] as const
const MUTANT = process.env.PUBLIC_RECEIPT_DELIVERY_MUTANT

async function database(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;")
  for (const migration of MIGRATIONS) {
    let sql = await readFile(new URL(migration, ROOT), "utf8")
    // Mutation proof: a provider queue acknowledgement must never be accepted
    // as delivery. The receipt remains queued until verified confirmation.
    if (MUTANT === "skip-sent-confirmation" && migration.endsWith("receipt_delivery.sql")) {
      sql = sql.replace(
        "SET delivery_status = 'sent', sent_at = clock_timestamp(), failed_at = NULL,",
        "SET delivery_status = 'queued', sent_at = NULL, failed_at = NULL,",
      )
    }
    await pg.exec(sql)
  }
  return pg
}

test("the durable declaration starts locally queued and only a later matching provider confirmation can mark it sent", async (t) => {
  const pg = await database(t)
  const request = receiptPayload.declaration.requestId
  const payload = { ...receiptPayload.declaration }
  delete (payload as Partial<typeof payload>).requestId
  await pg.exec("SET ROLE service_role")
  const submitted = await pg.query<{ declaration_id: string }>(
    "SELECT * FROM public.submit_public_contract_declaration($1::uuid, $2::jsonb)",
    [request, JSON.stringify(payload)],
  )
  const id = submitted.rows[0]!.declaration_id
  const initial = await pg.query<{
    delivery_status: string
    provider_delivery_id: string | null
    sent_at: string | null
  }>(
    "SELECT delivery_status, provider_delivery_id, sent_at FROM private.public_contract_declaration_receipts",
  )
  assert.deepEqual(initial.rows[0], {
    delivery_status: "queued",
    provider_delivery_id: null,
    sent_at: null,
  })

  const claimed = await pg.query<{ declaration_id: string; attempt_id: string }>(
    "SELECT * FROM public.claim_public_contract_declaration_receipt_deliveries(1, 60)",
  )
  assert.equal(claimed.rows.length, 1)
  assert.equal(
    (
      await pg.query<{ complete: boolean }>(
        "SELECT public.complete_public_contract_declaration_receipt_delivery($1::uuid, $2::uuid, 'queued', '', 'cio-1', '2026-09-14T12:01:00Z') AS complete",
        [id, claimed.rows[0]!.attempt_id],
      )
    ).rows[0]!.complete,
    true,
  )
  const queued = await pg.query<{
    delivery_status: string
    provider_delivery_id: string
    sent_at: string | null
  }>(
    "SELECT delivery_status, provider_delivery_id, sent_at FROM private.public_contract_declaration_receiptS",
  )
  assert.deepEqual(queued.rows[0], {
    delivery_status: "queued",
    provider_delivery_id: "cio-1",
    sent_at: null,
  })
  assert.equal(
    (
      await pg.query<{ confirmed: boolean }>(
        "SELECT public.confirm_public_contract_declaration_receipt_delivery($1::uuid, 'wrong') AS confirmed",
        [id],
      )
    ).rows[0]!.confirmed,
    false,
  )
  assert.equal(
    (
      await pg.query<{ confirmed: boolean }>(
        "SELECT public.confirm_public_contract_declaration_receipt_delivery($1::uuid, 'cio-1') AS confirmed",
        [id],
      )
    ).rows[0]!.confirmed,
    true,
  )
  assert.equal(
    (
      await pg.query<{ delivery_status: string }>(
        "SELECT delivery_status FROM private.public_contract_declaration_receipts",
      )
    ).rows[0]!.delivery_status,
    "sent",
  )
  const retryRequest = "44444444-4444-4444-8444-444444444444"
  const retrySubmitted = await pg.query<{ declaration_id: string }>(
    "SELECT * FROM public.submit_public_contract_declaration($1::uuid, $2::jsonb)",
    [retryRequest, JSON.stringify(payload)],
  )
  const retryClaim = await pg.query<{ attempt_id: string }>(
    "SELECT * FROM public.claim_public_contract_declaration_receipt_deliveries(1, 60)",
  )
  assert.equal(
    (
      await pg.query<{ complete: boolean }>(
        "SELECT public.complete_public_contract_declaration_receipt_delivery($1::uuid, $2::uuid, 'retryable_error', 'customerio_http_5xx', '', '') AS complete",
        [retrySubmitted.rows[0]!.declaration_id, retryClaim.rows[0]!.attempt_id],
      )
    ).rows[0]!.complete,
    true,
  )
  const retryable = await pg.query<{ delivery_status: string; failed_at: string | null }>(
    "SELECT delivery_status, failed_at FROM private.public_contract_declaration_receipts WHERE declaration_id = $1::uuid",
    [retrySubmitted.rows[0]!.declaration_id],
  )
  assert.equal(retryable.rows[0]!.delivery_status, "retryable_error")
  assert.notEqual(retryable.rows[0]!.failed_at, null)
  await pg.exec("SET ROLE anon")
  await assert.rejects(
    () =>
      pg.query("SELECT * FROM public.claim_public_contract_declaration_receipt_deliveries(1, 60)"),
    /permission denied/,
  )
})

test("a Customer.io acknowledgement records queued, never sent, and uses the declared recipient", async () => {
  const sent: Array<{ email: string; messageId: string; receiptText: string }> = []
  const settled: unknown[] = []
  const result = await dispatchPublicContractDeclarationReceipts({
    messageId: "legal-declaration-receipt",
    apiKeyPresent: true,
    claim: async () => [claimedRow],
    send: async (input) => {
      sent.push(input)
      return { deliveryId: "cio-1", queuedAt: 1_786_272_000 }
    },
    settle: async (_claim, outcome) => {
      settled.push(outcome)
    },
  })

  assert.deepEqual(result, {
    claimed: 1,
    queued: 1,
    retryable: 0,
    supportRequired: 0,
    blocked: false,
  })
  assert.deepEqual(
    sent.map(({ email, messageId }) => ({ email, messageId })),
    [
      {
        email: "marie@example.com",
        messageId: "legal-declaration-receipt",
      },
    ],
  )
  assert.match(sent[0]!.receiptText, /Eingangsbestätigung/)
  assert.match(sent[0]!.receiptText, /Marie Beispiel/)
  assert.deepEqual(settled, [
    {
      status: "queued",
      deliveryId: "cio-1",
      queuedAt: new Date(1_786_272_000 * 1000).toISOString(),
    },
  ])
})

test("missing receipt-template configuration fails closed before a declaration is claimed", async () => {
  let claims = 0
  const result = await dispatchPublicContractDeclarationReceipts({
    messageId: "",
    apiKeyPresent: true,
    claim: async () => {
      claims++
      return [claimedRow]
    },
    send: async () => {
      throw new Error("must not send")
    },
    settle: async () => {
      throw new Error("must not settle")
    },
  })
  assert.deepEqual(result, {
    claimed: 0,
    queued: 0,
    retryable: 0,
    supportRequired: 0,
    blocked: true,
  })
  assert.equal(claims, 0)
})

test("missing Customer.io credentials fail closed before a declaration is claimed", async () => {
  let claims = 0
  const result = await dispatchPublicContractDeclarationReceipts({
    messageId: "legal-declaration-receipt",
    apiKeyPresent: false,
    claim: async () => {
      claims++
      return [claimedRow]
    },
    send: async () => {
      throw new Error("must not send")
    },
    settle: async () => {
      throw new Error("must not settle")
    },
  })
  assert.equal(result.blocked, true)
  assert.equal(claims, 0)
})

test("ambiguous Customer.io outcomes are parked for support and are never blindly retried", async () => {
  const settled: unknown[] = []
  const result = await dispatchPublicContractDeclarationReceipts({
    messageId: "legal-declaration-receipt",
    apiKeyPresent: true,
    claim: async () => [claimedRow],
    send: async () => {
      throw new CustomerIoAmbiguousDeliveryError("connection reset")
    },
    settle: async (_claim, outcome) => {
      settled.push(outcome)
    },
  })
  assert.equal(result.supportRequired, 1)
  assert.deepEqual(settled, [
    { status: "support_required", errorCode: "customerio_delivery_ambiguous" },
  ])
})

test("Customer.io HTTP failures are parked without retaining provider text because acceptance is unconfirmed", async () => {
  const settled: unknown[] = []
  const result = await dispatchPublicContractDeclarationReceipts({
    messageId: "legal-declaration-receipt",
    apiKeyPresent: true,
    claim: async () => [claimedRow],
    send: async () => {
      throw new CustomerIoHttpError(503, "recipient=marie@example.com")
    },
    settle: async (_claim, outcome) => {
      settled.push(outcome)
    },
  })
  assert.equal(result.supportRequired, 1)
  assert.deepEqual(settled, [
    { status: "support_required", errorCode: "customerio_http_unconfirmed" },
  ])
})

test("a malformed claim aborts the whole invocation before any receipt can be sent", async () => {
  let sends = 0
  await assert.rejects(
    () =>
      dispatchPublicContractDeclarationReceipts({
        messageId: "legal-declaration-receipt",
        apiKeyPresent: true,
        claim: async () => [claimedRow, { declaration_id: "not-a-uuid" }],
        send: async () => {
          sends++
          return { deliveryId: "cio-1", queuedAt: 1 }
        },
        settle: async () => undefined,
      }),
    /Malformed declaration receipt delivery claim/,
  )
  assert.equal(sends, 0)
})

test("a settlement failure after a queue acknowledgement aborts without a second settlement", async () => {
  let settles = 0
  await assert.rejects(
    () =>
      dispatchPublicContractDeclarationReceipts({
        messageId: "legal-declaration-receipt",
        apiKeyPresent: true,
        claim: async () => [claimedRow],
        send: async () => ({ deliveryId: "cio-1", queuedAt: 1 }),
        settle: async () => {
          settles++
          throw new Error("database unavailable")
        },
      }),
    /database unavailable/,
  )
  assert.equal(settles, 1)
})

test("the worker uses one bounded active claim and a lease longer than its route budget", () => {
  assert.equal(PUBLIC_DECLARATION_RECEIPT_DELIVERY_LIMIT, 1)
  assert.ok(PUBLIC_DECLARATION_RECEIPT_DELIVERY_LEASE_SECONDS > 60)
})

test("the cron route requires its secret and exposes aggregates only", async () => {
  const unauthorized = await handlePublicContractDeclarationReceiptReconcile(
    new Request("https://x"),
    {
      cronSecret: "worker-secret",
    },
  )
  assert.deepEqual(unauthorized, { status: 401, body: { error: "unauthorized" } })
  const authorized = await handlePublicContractDeclarationReceiptReconcile(
    new Request("https://x", { headers: { authorization: "Bearer worker-secret" } }),
    {
      cronSecret: "worker-secret",
      dispatch: async () => ({
        claimed: 1,
        queued: 1,
        retryable: 0,
        supportRequired: 0,
        blocked: false,
      }),
    },
  )
  assert.deepEqual(authorized, {
    status: 200,
    body: {
      declarationReceiptDelivery: {
        claimed: 1,
        queued: 1,
        retryable: 0,
        supportRequired: 0,
        blocked: false,
      },
    },
  })
})
