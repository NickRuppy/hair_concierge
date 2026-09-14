import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
const USER = "11111111-1111-4111-8111-111111111111",
  OTHER = "22222222-2222-4222-8222-222222222222",
  ENROLLMENT = "33333333-3333-4333-8333-333333333333",
  DECLARATION = "44444444-4444-4444-8444-444444444444"
async function setup(t: test.TestContext, kind = "ordinary_cancellation", paid = false) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE TABLE public.profiles(id uuid PRIMARY KEY);CREATE TABLE public.billing_subscriptions(id uuid PRIMARY KEY);
 GRANT USAGE ON SCHEMA public TO service_role;`)
  for (const file of [
    "20260914044650_trial_admission_foundation.sql",
    "20260914090614_trial_cancellation_declarations.sql",
    "20260914094203_trial_payment_events.sql",
    "20260914103100_public_contract_declarations.sql",
    "20260914135527_trial_required_notices.sql",
    "20260914141918_public_contract_declaration_resolution.sql",
  ])
    await pg.exec(
      await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"),
    )
  await pg.query("INSERT INTO public.profiles VALUES($1),($2)", [USER, OTHER])
  const offer = createTrialOfferSnapshot("month", {
    monthPriceId: "p_month",
    yearPriceId: "p_year",
    annualCouponId: null,
  })
  await pg.query(
    `INSERT INTO public.trial_enrollments(id,user_id,accepted_offer,provider,provider_agreement_id,admission_status,authorization_succeeded_at,original_trial_end_at,first_payment_succeeded_at,paid_through_at)
 VALUES($1,$2,$3,'stripe','agreement','active','2024-01-01Z','2024-01-08Z',$4,$5)`,
    [
      ENROLLMENT,
      USER,
      JSON.stringify(offer),
      paid ? "2024-01-08Z" : null,
      paid ? "2024-02-08Z" : null,
    ],
  )
  const payload = {
    kind,
    name: "Submitted Person",
    email: "untrusted@example.test",
    contract: "Customer's description",
    requestedEnd: kind === "withdrawal" ? null : "Zum nächstmöglichen Zeitpunkt",
    reason: kind === "extraordinary_cancellation" ? "Begründung" : null,
  }
  await pg.query(
    "INSERT INTO private.public_contract_declarations(id,request_id,submitted_at,payload) VALUES($1,gen_random_uuid(),'2024-01-07Z',$2)",
    [DECLARATION, JSON.stringify(payload)],
  )
  await pg.query(
    "INSERT INTO private.public_contract_declaration_reviews(declaration_id) VALUES($1)",
    [DECLARATION],
  )
  await pg.query(
    `INSERT INTO private.public_contract_declaration_receipts(declaration_id,receipt_payload) SELECT id,jsonb_build_object('declarationId',id,'submittedAt',submitted_at,'declaration',payload) FROM private.public_contract_declarations WHERE id=$1`,
    [DECLARATION],
  )
  return pg
}
async function match(pg: PGlite, user = USER, reference = "support_identity_verification_1") {
  return (
    await pg.query<{ result: unknown }>(
      "SELECT public.match_public_contract_declaration($1,$2,$3,$4) result",
      [DECLARATION, user, ENROLLMENT, reference],
    )
  ).rows[0]!.result
}
async function apply(pg: PGlite) {
  return (
    await pg.query<{ result: Record<string, unknown> }>(
      "SELECT public.apply_public_trial_cancellation($1,$2) result",
      [DECLARATION, "verified_requested_end_is_original_trial_end"],
    )
  ).rows[0]!.result
}
async function status(pg: PGlite) {
  return (
    await pg.query<{ status: string }>(
      "SELECT status FROM private.public_contract_declaration_reviews WHERE declaration_id=$1",
      [DECLARATION],
    )
  ).rows[0]!.status
}
const evidence = {
  completionReference: "support_case_completion_1",
  providerTerminationReference: "stripe_retrieved_canceled_1",
  effectiveEndAt: "2024-01-08T00:00:00Z",
  refundDisposition: "not_due",
  refundReference: null,
  refundAssessmentReference: "no_successful_collection_verified",
}
async function complete(pg: PGlite, extra: Record<string, unknown> = {}) {
  return (
    await pg.query<{ result: boolean }>(
      "SELECT public.complete_public_contract_declaration_resolution($1,$2) result",
      [DECLARATION, JSON.stringify({ ...evidence, ...extra })],
    )
  ).rows[0]!.result
}
test("trusted match validates owner and freezes original submitted time and verification reference", async (t) => {
  const pg = await setup(t)
  await assert.rejects(match(pg, OTHER))
  await assert.rejects(match(pg, USER, ""))
  assert.equal(await status(pg), "pending")
  await pg.exec("SET ROLE service_role")
  await match(pg)
  await match(pg)
  assert.equal(await status(pg), "in_review")
  await assert.rejects(match(pg, USER, "different_reference"))
  const m = (
    await pg.query<{ submitted_at: Date }>(
      "SELECT submitted_at FROM private.public_contract_declaration_matches",
    )
  ).rows[0]!
  assert.equal(new Date(m.submitted_at).toISOString(), "2024-01-07T00:00:00.000Z")
  await assert.rejects(
    pg.exec(
      "UPDATE private.public_contract_declaration_matches SET verification_reference='rewrite'",
    ),
  )
  await pg.exec("SET ROLE authenticated")
  await assert.rejects(match(pg))
})
test("late processing of timely unpaid trial cancellation preserves original declaration time and queues provider work once", async (t) => {
  const pg = await setup(t)
  await match(pg)
  const before = (
    await pg.query("SELECT receipt_payload FROM private.public_contract_declaration_receipts")
  ).rows[0]
  const result = await apply(pg)
  assert.equal(result.outcome, "provider_operation_queued")
  assert.deepEqual(await apply(pg), result)
  const d = (
    await pg.query<{ submitted_at: Date; effective_end_at: Date }>(
      "SELECT submitted_at,effective_end_at FROM private.trial_cancellation_declarations",
    )
  ).rows[0]!
  assert.equal(new Date(d.submitted_at).toISOString(), "2024-01-07T00:00:00.000Z")
  assert.equal(new Date(d.effective_end_at).toISOString(), "2024-01-08T00:00:00.000Z")
  assert.equal(
    (await pg.query("SELECT * FROM private.trial_cancellation_provider_operations")).rows.length,
    1,
  )
  assert.equal(await status(pg), "in_review")
  assert.deepEqual(
    (await pg.query("SELECT receipt_payload FROM private.public_contract_declaration_receipts"))
      .rows[0],
    before,
  )
  await assert.rejects(complete(pg), /provider|completion|evidence/i)
  await pg.exec(
    "UPDATE private.trial_cancellation_provider_operations SET status='confirmed',reconciled_at=now()",
  )
  assert.equal(await complete(pg), true)
  assert.equal(await status(pg), "resolved")
  assert.equal(await complete(pg), true)
  await assert.rejects(complete(pg, { completionReference: "changed" }))
})
test("charge winning before apply never creates unpaid cancellation; paid and withdrawal require external completion/refund evidence", async (t) => {
  const pg = await setup(t, "ordinary_cancellation", true)
  await match(pg)
  assert.equal((await apply(pg)).outcome, "payment_review_required")
  assert.equal(
    (await pg.query("SELECT * FROM private.trial_cancellation_declarations")).rows.length,
    0,
  )
  assert.equal(await status(pg), "in_review")
  await pg.exec("UPDATE public.trial_enrollments SET cancel_at_period_end=true")
  await assert.rejects(complete(pg), /refund|evidence/i)
  assert.equal(
    await complete(pg, {
      refundDisposition: "completed",
      refundReference: "stripe_refund_verified_re_1",
    }),
    true,
  )
})
test("withdrawal and extraordinary declarations never enter ordinary-trial cancellation queue or resolve from email state", async (t) => {
  for (const kind of ["withdrawal", "extraordinary_cancellation"]) {
    const pg = await setup(t, kind)
    await match(pg)
    assert.equal((await apply(pg)).outcome, "external_review_required")
    await assert.rejects(complete(pg, { providerTerminationReference: "" }))
    assert.equal(await status(pg), "in_review")
    await pg.exec("UPDATE public.trial_enrollments SET cancel_at_period_end=true")
    assert.equal(await complete(pg), true)
  }
})

test("a successful in-flight charge after accepted cancellation prevents resolution until refund evidence exists", async (t) => {
  const pg = await setup(t)
  await match(pg)
  await apply(pg)
  await pg.query(
    `INSERT INTO private.trial_payment_events(enrollment_id,provider,source_event_id,source_object_id,outcome,occurred_at,amount_minor,currency,period_start_at,period_end_at,result,phase)
 VALUES($1,'stripe','late_evt','late_invoice','succeeded','2024-01-08Z',999,'EUR','2024-01-08Z','2024-02-08Z','reconciliation_required','none')`,
    [ENROLLMENT],
  )
  await pg.exec(
    "UPDATE private.trial_cancellation_provider_operations SET status='confirmed',reconciled_at=now()",
  )
  await assert.rejects(complete(pg), /refund/)
  assert.equal(await status(pg), "in_review")
  assert.equal(
    await complete(pg, {
      refundDisposition: "completed",
      refundReference: "verified_late_payment_refund",
    }),
    true,
  )
})

test("null/queued-mail evidence cannot resolve, and direct status updates still require match/completion records", async (t) => {
  const pg = await setup(t)
  await pg.exec("SET ROLE service_role")
  await assert.rejects(
    pg.exec("UPDATE private.public_contract_declaration_reviews SET status='in_review'"),
    /match/,
  )
  await match(pg)
  await apply(pg)
  await assert.rejects(
    pg.exec(
      "UPDATE private.public_contract_declaration_reviews SET status='resolved',resolved_at=now(),resolution_reference='email_queued'",
    ),
    /evidence/,
  )
  await pg.exec(
    "UPDATE private.trial_cancellation_provider_operations SET status='confirmed',reconciled_at=now()",
  )
  await assert.rejects(complete(pg, { refundDisposition: null }), /evidence/)
  await assert.rejects(complete(pg, { receiptQueued: true }), /evidence/)
  assert.equal(await complete(pg), true)
})

test("operator commands validate exact scope and require a complete evidence file; they never dispatch providers", async () => {
  const { runPublicContractDeclarationCommand } =
    await import("../scripts/billing/public-contract-declarations")
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const client = {
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args })
      return {
        data:
          name === "complete_public_contract_declaration_resolution"
            ? true
            : { declarationId: DECLARATION, status: "in_review" },
        error: null,
      }
    },
  }
  await assert.rejects(
    runPublicContractDeclarationCommand(
      ["match", `--declaration=${DECLARATION}`, `--user=${USER}`, `--enrollment=${ENROLLMENT}`],
      client,
    ),
  )
  await assert.rejects(
    runPublicContractDeclarationCommand(
      ["inspect", `--declaration=${DECLARATION}`, "--send=true"],
      client,
    ),
  )
  assert.equal(calls.length, 0)
  await runPublicContractDeclarationCommand(
    [
      "match",
      `--declaration=${DECLARATION}`,
      `--user=${USER}`,
      `--enrollment=${ENROLLMENT}`,
      "--verification-reference=verified_case_1",
    ],
    client,
  )
  assert.equal(calls[0]!.name, "match_public_contract_declaration")
  assert.equal(calls[0]!.args.p_verified_user_id, USER)
  await assert.rejects(
    runPublicContractDeclarationCommand(
      ["complete", `--declaration=${DECLARATION}`, "--evidence-file=case.json"],
      client,
      async () => JSON.stringify({ receiptQueued: true }),
    ),
  )
  assert.equal(calls.length, 1)
  const result = await runPublicContractDeclarationCommand(
    ["complete", `--declaration=${DECLARATION}`, "--evidence-file=case.json"],
    client,
    async () => JSON.stringify(evidence),
  )
  assert.deepEqual(result, {
    mode: "complete",
    result: { declarationId: DECLARATION, status: "resolved" },
  })
  assert.equal(calls[1]!.name, "complete_public_contract_declaration_resolution")
})
