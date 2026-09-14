import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { submitPublicContractDeclaration } from "../src/lib/billing/public-contract-declarations"
import { publicDeclarationReceiptText } from "../src/lib/billing/public-contract-declaration"
import { readPublicContractDeclarations } from "../scripts/billing/public-contract-declarations"

const input = {
  requestId: "00000000-0000-4000-8000-000000000001",
  kind: "ordinary_cancellation",
  name: "Marie Beispiel",
  email: "marie@example.com",
  contract: "Chaarlie Jahresabo · CH-12345",
  requestedEnd: "Zum nächstmöglichen Zeitpunkt",
  reason: null,
}

async function harness(t: test.TestContext) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; GRANT USAGE ON SCHEMA public TO service_role;",
  )
  let migration = readFileSync(
    "supabase/migrations/20260914103100_public_contract_declarations.sql",
    "utf8",
  )
  if (process.env.PUBLIC_DECLARATION_MUTANT === "skip-outbox")
    migration = migration.replace(
      /    INSERT INTO private\.public_contract_declaration_receipts[\s\S]*?;\n/,
      "",
    )
  await pg.exec(migration)
  const client = {
    async rpc(name: string, args: Record<string, unknown>) {
      assert.equal(name, "submit_public_contract_declaration")
      try {
        const result = await pg.query<{ declaration_id: string; submitted_at: Date }>(
          "SELECT * FROM public.submit_public_contract_declaration($1::uuid, $2::jsonb)",
          [args.p_request_id, JSON.stringify(args.p_payload)],
        )
        return {
          data: result.rows.map((r) => ({
            ...r,
            submitted_at: new Date(r.submitted_at).toISOString(),
          })),
          error: null,
        }
      } catch (error) {
        return { data: null, error }
      }
    },
  }
  return { pg, client }
}

test("durably saves unmatched declaration and receipt atomically; identical replay keeps original timestamp", async (t) => {
  const { pg, client } = await harness(t)
  const before = Date.now()
  const receipt = await submitPublicContractDeclaration(input, client)
  assert.ok(Date.parse(receipt.submittedAt) >= before)
  assert.ok(Date.parse(receipt.submittedAt) <= Date.now())
  assert.deepEqual(await submitPublicContractDeclaration(input, client), receipt)
  const rows = await pg.query<{ receipt_payload: unknown; delivery_status: string }>(
    "SELECT * FROM private.public_contract_declaration_receipts",
  )
  assert.equal(rows.rows.length, 1)
  assert.equal(rows.rows[0].delivery_status, "pending")
  const snapshot = rows.rows[0].receipt_payload as typeof receipt
  assert.deepEqual(snapshot.declaration, receipt.declaration)
  assert.equal(Date.parse(snapshot.submittedAt), Date.parse(receipt.submittedAt))
  assert.match(publicDeclarationReceiptText(receipt), /ordentlich/)
  assert.match(publicDeclarationReceiptText(receipt), /Nach sicherer Zuordnung/)
  assert.doesNotMatch(
    publicDeclarationReceiptText(receipt),
    /wurde.*gesendet|Rückerstattung|Vertragsende: \d/,
  )
  await assert.rejects(
    submitPublicContractDeclaration({ ...input, email: "attacker@example.com" }, client),
  )
  assert.deepEqual(await submitPublicContractDeclaration(input, client), receipt)
})

test("receipt enqueue failure rolls back acceptance; retry can then succeed", async (t) => {
  const { pg, client } = await harness(t)
  await pg.exec(
    "ALTER TABLE private.public_contract_declaration_receipts ADD CONSTRAINT forced_failure CHECK (false)",
  )
  await assert.rejects(submitPublicContractDeclaration(input, client))
  assert.equal(
    (await pg.query("SELECT * FROM private.public_contract_declarations")).rows.length,
    0,
  )
  await pg.exec(
    "ALTER TABLE private.public_contract_declaration_receipts DROP CONSTRAINT forced_failure",
  )
  assert.ok((await submitPublicContractDeclaration(input, client)).declarationId)
})

test("unprivileged roles cannot read or submit; service can submit but cannot rewrite immutable snapshots", async (t) => {
  const { pg, client } = await harness(t)
  for (const role of ["anon", "authenticated"]) {
    await pg.exec(`SET ROLE ${role}`)
    await assert.rejects(submitPublicContractDeclaration(input, client))
    await assert.rejects(pg.query("SELECT * FROM private.public_contract_declarations"))
    await assert.rejects(pg.query("SELECT * FROM private.public_contract_declaration_receipts"))
    await pg.exec("RESET ROLE")
  }
  await pg.exec("SET ROLE service_role")
  await submitPublicContractDeclaration(input, client)
  await assert.rejects(
    pg.exec("UPDATE private.public_contract_declarations SET submitted_at = now()"),
  )
  await assert.rejects(
    pg.exec(
      "UPDATE private.public_contract_declaration_receipts SET receipt_payload = '{}'::jsonb",
    ),
  )
  await pg.exec("RESET ROLE")
})

test("withdrawal and extraordinary declarations keep their distinct text without asserting refund/effective date", async (t) => {
  const { client } = await harness(t)
  const withdrawal = await submitPublicContractDeclaration(
    { ...input, kind: "withdrawal", requestedEnd: null },
    client,
  )
  assert.match(publicDeclarationReceiptText(withdrawal), /Hiermit widerrufe ich/)
  assert.doesNotMatch(publicDeclarationReceiptText(withdrawal), /Hiermit kündige|Rückerstattung/)
  await assert.rejects(
    submitPublicContractDeclaration({ ...input, kind: "extraordinary_cancellation" }, client),
  )
  const special = await submitPublicContractDeclaration(
    {
      ...input,
      requestId: "00000000-0000-4000-8000-000000000002",
      kind: "extraordinary_cancellation",
      requestedEnd: "30.09.2026",
      reason: "Mein Grund",
    },
    client,
  )
  assert.match(publicDeclarationReceiptText(special), /außerordentlich/)
  assert.match(publicDeclarationReceiptText(special), /Gewünschtes Vertragsende: 30.09.2026/)
})

test("operator review queue stays pending after receipt delivery and exposes details only to service-role exact reads", async (t) => {
  const { pg, client } = await harness(t)
  const receipt = await submitPublicContractDeclaration(input, client)
  await pg.exec(
    "UPDATE private.public_contract_declaration_receipts SET delivery_status = 'sent', sent_at = now()",
  )
  const list = () =>
    pg.query<Record<string, unknown>>(
      "SELECT * FROM public.list_public_contract_declarations_for_review(100)",
    )
  const detail = () =>
    pg.query<Record<string, unknown>>(
      "SELECT * FROM public.get_public_contract_declaration_for_review($1::uuid)",
      [receipt.declarationId],
    )
  for (const role of ["anon", "authenticated"]) {
    await pg.exec(`SET ROLE ${role}`)
    await assert.rejects(list())
    await assert.rejects(detail())
    await pg.exec("RESET ROLE")
  }
  await pg.exec("SET ROLE service_role")
  const rows = (await list()).rows
  assert.equal(rows.length, 1)
  assert.equal(rows[0].review_status, "pending")
  assert.equal(rows[0].receipt_delivery_status, "sent")
  assert.deepEqual(Object.keys(rows[0]).sort(), [
    "declaration_id",
    "kind",
    "receipt_delivery_status",
    "review_status",
    "submitted_at",
  ])
  assert.doesNotMatch(JSON.stringify(rows), /marie|Beispiel|CH-12345/)
  assert.deepEqual((await detail()).rows[0].payload, {
    kind: input.kind,
    name: input.name,
    email: input.email,
    contract: input.contract,
    requestedEnd: input.requestedEnd,
    reason: null,
  })
  await assert.rejects(
    pg.exec("UPDATE private.public_contract_declaration_reviews SET status = 'resolved'"),
  )
  await pg.exec("RESET ROLE")
})

test("read-only operator CLI rejects mutation arguments without calling the database", async () => {
  for (const args of [["--resolve"], ["--list", "--apply"], ["--declaration=arbitrary"], []]) {
    await assert.rejects(
      readPublicContractDeclarations(args, {
        rpc: async () => {
          assert.fail("invalid command must not call database")
        },
      }),
    )
  }
  const calls: string[] = []
  const client = {
    rpc: async (name: string) => {
      calls.push(name)
      return { data: [], error: null }
    },
  }
  assert.deepEqual(await readPublicContractDeclarations(["--list"], client), {
    mode: "read-only",
    rows: [],
  })
  await readPublicContractDeclarations([`--declaration=${input.requestId}`], client)
  assert.deepEqual(calls, [
    "list_public_contract_declarations_for_review",
    "get_public_contract_declaration_for_review",
  ])
})
