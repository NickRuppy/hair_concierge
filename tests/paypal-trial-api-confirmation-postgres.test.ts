import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readFileSync, readdirSync } from "node:fs"
import test from "node:test"
import { setTimeout } from "node:timers/promises"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"

// This is deliberately a real PostgreSQL test. PGlite cannot prove the row-lock
// and immutable-trigger behaviour that protects a frozen provider payload.
const enabled = process.env.PAYPAL_TRIAL_API_CONFIRMATION_POSTGRES_TEST === "1"
const SCHEDULE_MIGRATION =
  "supabase/migrations/20260915190501_paypal_trial_noon_schedule_contract.sql"
const USER = "11111111-1111-4111-8111-111111111111"
const offerInputs = {
  monthPriceId: "price_month",
  yearPriceId: "price_year",
  annualCouponId: "coupon",
}
const offer = createTrialOfferSnapshot("year", offerInputs)

function command(args: string[], input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["--context", "colima-chaarlie", ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    })
    let output = ""
    let error = ""
    child.stdout.on("data", (chunk) => (output += chunk.toString()))
    child.stderr.on("data", (chunk) => (error += chunk.toString()))
    child.on("error", reject)
    child.on("close", (code) =>
      code === 0 ? resolve(output.trim()) : reject(new Error(error || `docker exited ${code}`)),
    )
    child.stdin.end(input)
  })
}

test(
  "PayPal API confirmation: real PostgreSQL proof authority and concurrent admission",
  { skip: !enabled, timeout: 180000 },
  async (t) => {
    const container = `chaarlie-paypal-confirmation-${crypto.randomUUID()}`
    await command([
      "run",
      "--rm",
      "--detach",
      "--name",
      container,
      "-e",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "postgres:17",
    ])
    t.after(() => command(["rm", "--force", container]))
    for (let attempts = 0; ; attempts++) {
      try {
        await command(["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"])
        break
      } catch (error) {
        if (attempts === 99) throw error
        await setTimeout(100)
      }
    }
    const sql = (statement: string) =>
      command(
        ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres"],
        statement,
      )
    const migration = (name: string) => readFileSync(`supabase/migrations/${name}.sql`, "utf8")
    await sql(`
      CREATE EXTENSION pgcrypto;
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA private; GRANT USAGE ON SCHEMA private TO service_role;
      CREATE TABLE public.profiles(id uuid PRIMARY KEY);
      ${migration("20260527_add_billing_subscriptions").split("CREATE POLICY")[0]}
      ${migration("20260708133700_billing_analytics_outbox")}
      CREATE TABLE public.funnel_sessions(id uuid PRIMARY KEY,package_key text,landing_variant text,quiz_variant text,offer_variant text,is_internal_test boolean,test_kind text,visitor_id uuid);
      CREATE TABLE public.trial_checkout_attempts(enrollment_id uuid,stripe_params jsonb);
      GRANT SELECT ON public.funnel_sessions,public.trial_checkout_attempts TO service_role;
      INSERT INTO public.profiles VALUES('${USER}');
      ${migration("20260914044650_trial_admission_foundation")}
      ${migration("20260914090614_trial_cancellation_declarations")}
      ${migration("20260914093927_trial_cancellation_provider_operations")}
      ${migration("20260914094203_trial_payment_events")}
      ${migration("20260914120000_paypal_trial_checkout_attempt")}
      ${migration("20260914135017_paypal_trial_activation_clock")}
      ${migration("20260914142559_trial_prior_paid_claims")}
      ${migration("20260914144351_trial_identity_rights_lifecycle")}
      ${migration("20260915190000_paypal_trial_frozen_end")}
      ${migration("20260914140320_trial_management_operations")}
      ${migration("20260914140634_paypal_trial_management_requests")}
      GRANT EXECUTE ON FUNCTION private.paypal_trial_offer_is_valid(jsonb),
        private.paypal_trial_attempt_row(private.paypal_trial_checkout_attempts),
        private.prevent_paypal_trial_checkout_attempt_rewrite(),
        private.prevent_paypal_trial_activation_clock_rewrite(),
        private.prevent_paypal_trial_management_request_rewrite() TO service_role;
      GRANT SELECT ON public.profiles TO service_role;
      GRANT SELECT,INSERT,UPDATE ON public.trial_enrollments,public.paypal_checkout_intents TO service_role;
      GRANT SELECT,INSERT,UPDATE ON private.paypal_trial_checkout_attempts,private.paypal_trial_management_requests TO service_role;
      ${migration("20260914142808_trial_paid_recovery_operations").split("CREATE FUNCTION")[0]}
      ${migration("20260914143014_paypal_trial_paid_recovery_requests").split("CREATE FUNCTION")[0]}
      ${migration("20260914144638_paypal_trial_candidate_expiry")}
      GRANT SELECT,INSERT,UPDATE ON public.billing_subscriptions TO service_role;
      ${migration("20260915190500_paypal_trial_frozen_start_expiry")}
      ${readFileSync(SCHEDULE_MIGRATION, "utf8")}
      ${migration("20260914135527_trial_required_notices")}
      ${migration("20260914141036_trial_required_notice_revisions")}
      ${migration("20260915113126_trial_lifecycle_analytics")}
      SELECT public.configure_trial_identity_key_versions(ARRAY[1]);
    `)

    // Pin one real webhook with the old function to prove migration-first compatibility.
    const historical = JSON.parse(
      await sql(`SET ROLE service_role;
      DO $fixture$ DECLARE a jsonb; BEGIN
        a:=public.create_paypal_trial_checkout_attempt_v2('user','${USER}','${crypto.randomUUID()}',
          '${JSON.stringify(offer)}','history@example.com',null,'pricing_page');
        PERFORM public.freeze_paypal_trial_checkout_attempt_v2((a->>'id')::uuid,'APP','PROD','P-year','paypal-trial:'||(a->>'id')||':v2');
        PERFORM public.bind_paypal_trial_checkout_reference((a->>'id')::uuid,'I-historical');
        PERFORM public.pin_paypal_trial_activation(a->>'intent_token','I-historical','WH-historical',clock_timestamp());
      END $fixture$;
      SELECT private.paypal_trial_attempt_row(a) FROM private.paypal_trial_checkout_attempts a WHERE provider_reference='I-historical'`),
    )

    // Only the deliberate red run permits an absent migration. Normal verification
    // must load the actual migration; no alternate RPC implementation is supplied.
    const proofMigrations = readdirSync("supabase/migrations")
      .filter((name) => /paypal_trial_api_confirmation.*\.sql$/.test(name))
      .sort()
    if (proofMigrations.length === 0 && process.env.PAYPAL_TRIAL_API_CONFIRMATION_RED !== "1")
      assert.fail("The API confirmation migration is required for final verification")
    for (const name of proofMigrations)
      await sql(readFileSync(`supabase/migrations/${name}`, "utf8"))
    assert.equal(
      await sql(`SELECT to_regprocedure(
      'public.confirm_paypal_trial_activation(text,text,uuid,text,text,timestamp with time zone,timestamp with time zone)') IS NOT NULL`),
      "t",
      "server-verified ACTIVE has a service confirmation RPC before webhook delivery",
    )

    const service = (statement: string) => sql(`SET ROLE service_role; ${statement}`)
    const json = async (statement: string) => JSON.parse(await service(statement))
    const createAttempt = async () => {
      const user = crypto.randomUUID()
      await sql(`INSERT INTO public.profiles VALUES('${user}')`)
      const attempt = await json(`SELECT public.create_paypal_trial_checkout_attempt_v2(
        'user','${user}','${crypto.randomUUID()}','${JSON.stringify(offer)}',
        'fixture@example.com',null,'pricing_page')`)
      return { user, ...attempt } as {
        user: string
        id: string
        enrollment_id: string
        intent_token: string
        intent_id: string
        created_at: string
      }
    }
    const freezeInitial = (id: string, version: 1 | 2) =>
      `SELECT public.freeze_paypal_trial_checkout_attempt${version === 2 ? "_v2" : ""}(
        '${id}','APP','PROD','P-year','paypal-trial:${id}:v${version}')`

    // The winner holds its completed RPC uncommitted. The loser must actually
    // block in a separate backend before COMMIT releases it; elapsed time is
    // never treated as evidence of concurrency or lock acquisition.
    const race = async (
      winnerQuery: string,
      loserQuery: string,
      beforeCommit?: () => Promise<void>,
    ) => {
      const app = `paypal-race-${crypto.randomUUID()}`
      const child = spawn(
        "docker",
        [
          "--context",
          "colima-chaarlie",
          "exec",
          "-i",
          container,
          "psql",
          "-X",
          "-qAt",
          "-v",
          "ON_ERROR_STOP=1",
          "-U",
          "postgres",
        ],
        { stdio: ["pipe", "pipe", "pipe"] },
      )
      let output = ""
      let error = ""
      child.stdout.on("data", (chunk) => {
        output += chunk.toString()
      })
      child.stderr.on("data", (chunk) => {
        error += chunk.toString()
      })
      const done = new Promise<void>((resolve, reject) => {
        child.on("error", reject)
        child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(error))))
      })
      // Attach a rejection handler immediately while the session awaits input.
      const completed = done.then(
        () => ({ ok: true }),
        (failure: Error) => ({ ok: false, failure }),
      )
      try {
        child.stdin.write(`BEGIN; SET ROLE service_role; ${winnerQuery}; SELECT 'WINNER_READY';\n`)
        for (let n = 0; !output.includes("WINNER_READY"); n++) {
          if (error || n > 100)
            throw new Error(error || "Winner RPC did not reach the transaction barrier")
          await setTimeout(25)
        }
        const loser = sql(
          `SET application_name='${app}'; SET ROLE service_role; ${loserQuery}`,
        ).then(
          (value) => ({ value: JSON.parse(value), error: null }),
          (failure: Error) => ({ value: null, error: failure }),
        )
        let observed = false
        for (let n = 0; n < 100; n++) {
          const blocked = await sql(`SELECT count(*) FROM pg_stat_activity
            WHERE application_name='${app}' AND wait_event_type='Lock'
            AND cardinality(pg_blocking_pids(pid))>0`)
          if (blocked === "1") {
            observed = true
            break
          }
          await setTimeout(25)
        }
        assert.equal(observed, true, "losing backend was observed waiting for a real lock")
        if (beforeCommit) await beforeCommit()
        child.stdin.end("COMMIT;\n")
        const finish = await completed
        assert.equal(finish.ok, true, "winner transaction committed")
        return {
          winner: JSON.parse(output.split("\n").find((line) => line.startsWith("{"))!),
          loser: await loser,
        }
      } finally {
        if (!child.stdin.writableEnded) child.stdin.end("ROLLBACK;\n")
        await completed
      }
    }

    const fixture = async (version: 1 | 2 = 2) => {
      const a = await createAttempt()
      const frozen = await json(freezeInitial(a.id, version))
      const agreement = `I-${a.id}`
      await service(`SELECT public.bind_paypal_trial_checkout_reference('${a.id}','${agreement}')`)
      const at = await service("SELECT clock_timestamp()")
      return { ...a, ...frozen, agreement, eventAt: at } as typeof a & {
        agreement: string
        eventAt: string
        trial_end_at: string
        provider_start_time: string
      }
    }
    type Fixture = Awaited<ReturnType<typeof fixture>>
    const confirm = (
      a: Fixture,
      id = crypto.randomUUID(),
      overrides: {
        app?: string
        plan?: string
        agreement?: string
        start?: string
        next?: string
      } = {},
    ) => `SELECT public.confirm_paypal_trial_activation(
      '${a.intent_token}','${overrides.agreement ?? a.agreement}','${id}',
      '${overrides.app ?? "APP"}','${overrides.plan ?? "P-year"}',
      '${overrides.start ?? a.provider_start_time}','${overrides.next ?? a.trial_end_at}')`
    const pin = (a: Fixture, event = `WH-${crypto.randomUUID()}`, at = a.eventAt) =>
      `SELECT public.pin_paypal_trial_activation('${a.intent_token}','${a.agreement}','${event}','${at}')`
    const read = (a: Fixture) =>
      json(`SELECT public.get_paypal_trial_checkout_attempt_v2('${a.intent_token}')`)
    const proof = (row: Record<string, unknown>) => ({
      kind: row.authorization_proof_kind,
      clock: row.authorization_succeeded_at,
      event: row.activation_event_id,
      receipt: row.api_confirmation_id,
      confirmed: row.api_confirmed_at,
      end: row.trial_end_at,
      start: row.provider_start_time,
    })
    const admit = (a: Fixture, row: Record<string, unknown>) => {
      const claim = [
        {
          kind: "account",
          keyVersion: 1,
          namespace: "chaarlie",
          value: a.user.replaceAll("-", "").repeat(2),
        },
      ]
      return service(`SELECT public.admit_trial_enrollment('${a.enrollment_id}',
        '${JSON.stringify(claim)}','${row.authorization_succeeded_at}','${a.agreement}','${a.trial_end_at}')`)
    }

    await t.test(
      "migration backfills real webhook provenance without changing its clock or ID",
      async () => {
        const current = await json(
          `SELECT public.get_paypal_trial_checkout_attempt_v2('${historical.intent_token}')`,
        )
        assert.equal(current.authorization_proof_kind, "webhook")
        assert.equal(current.authorization_succeeded_at, historical.authorization_succeeded_at)
        assert.equal(current.activation_event_id, historical.activation_event_id)
        assert.equal(current.api_confirmation_id, null)
        assert.equal(current.api_confirmed_at, null)
        assert.equal(
          await service(
            "SELECT count(*) FROM private.paypal_trial_activation_evidence WHERE event_id='WH-historical'",
          ),
          "1",
        )
      },
    )

    await t.test(
      "service confirmation pins explicit immutable API proof, never a fake webhook ID",
      async () => {
        const a = await fixture()
        const receipt = crypto.randomUUID()
        const before = Date.parse(await service("SELECT clock_timestamp()"))
        const first = await json(confirm(a, receipt))
        const after = Date.parse(await service("SELECT clock_timestamp()"))
        assert.equal(first.authorization_proof_kind, "api_confirmation")
        assert.equal(first.api_confirmation_id, receipt)
        assert.equal(first.activation_event_id, null)
        assert.equal(first.authorization_succeeded_at, first.api_confirmed_at)
        assert.ok(
          Date.parse(first.api_confirmed_at) >= before &&
            Date.parse(first.api_confirmed_at) <= after,
        )
        assert.deepEqual(proof(await json(confirm(a))), proof(first))
        assert.deepEqual(
          proof(await read(a)),
          proof(first),
          "existing v2 reader returns the proof additively",
        )
        for (const assignment of [
          "authorization_succeeded_at=authorization_succeeded_at+interval '1 second'",
          "api_confirmed_at=api_confirmed_at+interval '1 second'",
          `api_confirmation_id='${crypto.randomUUID()}'`,
          "activation_event_id='WH-fabricated'",
          "authorization_proof_kind='webhook'",
        ])
          await assert.rejects(
            () =>
              service(
                `UPDATE private.paypal_trial_checkout_attempts SET ${assignment} WHERE id='${a.id}'`,
              ),
            /immutable|check constraint/i,
          )
        for (const role of ["anon", "authenticated"]) {
          await assert.rejects(() => sql(`SET ROLE ${role}; ${confirm(a)}`), /permission denied/i)
          await assert.rejects(() => sql(`SET ROLE ${role}; ${pin(a)}`), /permission denied/i)
          await assert.rejects(
            () => sql(`SET ROLE ${role}; SELECT * FROM private.paypal_trial_activation_evidence`),
            /permission denied/i,
          )
        }
      },
    )

    await t.test(
      "both sequential proof orders preserve the winner and append immutable event evidence",
      async () => {
        for (const firstKind of ["api", "webhook"] as const) {
          const a = await fixture()
          const event = `WH-${crypto.randomUUID()}`
          const first = await json(firstKind === "api" ? confirm(a) : pin(a, event))
          const second = await json(firstKind === "api" ? pin(a, event) : confirm(a))
          assert.deepEqual(proof(second), proof(first))
          assert.deepEqual(proof(await json(pin(a, event))), proof(first))
          assert.equal(
            await service(
              `SELECT count(*) FROM private.paypal_trial_activation_evidence WHERE attempt_id='${a.id}'`,
            ),
            "1",
          )
          const other = await fixture()
          await assert.rejects(
            () => json(pin(other, event)),
            /conflict|mismatch|duplicate|evidence/i,
          )
          const changed = new Date(Date.parse(a.eventAt) - 1000).toISOString()
          await assert.rejects(() => json(pin(a, event, changed)), /conflict|mismatch|evidence/i)
          await assert.rejects(
            () =>
              service(
                `UPDATE private.paypal_trial_activation_evidence SET resource_status_updated_at=resource_status_updated_at+interval '1 second' WHERE event_id='${event}'`,
              ),
            /immutable|permission denied/i,
          )
          await assert.rejects(
            () =>
              service(
                `DELETE FROM private.paypal_trial_activation_evidence WHERE event_id='${event}'`,
              ),
            /immutable|permission denied/i,
          )
        }
      },
    )

    await t.test(
      "independent backends block and converge for API/API, API/webhook and webhook/API",
      async () => {
        for (const [first, second] of [
          ["api", "api"],
          ["api", "webhook"],
          ["webhook", "api"],
        ] as const) {
          const a = await fixture()
          const result = await race(
            first === "api" ? confirm(a) : pin(a),
            second === "api" ? confirm(a) : pin(a),
          )
          assert.equal(result.loser.error, null)
          assert.deepEqual(proof(result.loser.value), proof(result.winner))
          assert.deepEqual(proof(await read(a)), proof(result.winner))
          assert.equal(await admit(a, result.winner), "active")
          assert.equal(await admit(a, result.loser.value), "active")
          assert.equal(
            await service(
              `SELECT count(*) FROM public.trial_identity_claims WHERE enrollment_id='${a.enrollment_id}' AND consumed_at IS NOT NULL`,
            ),
            "1",
          )
          assert.equal(
            await service(
              `SELECT count(*) FROM private.trial_required_notices WHERE enrollment_id='${a.enrollment_id}' AND kind='contract_confirmation'`,
            ),
            "1",
          )
          assert.equal(
            await service(
              `SELECT count(*) FROM public.billing_analytics_outbox WHERE event_key='paypal:trial_started:${a.enrollment_id}'`,
            ),
            "1",
          )
          const payload = await json(
            `SELECT payload FROM public.billing_analytics_outbox WHERE event_key='paypal:trial_started:${a.enrollment_id}'`,
          )
          const snapshot = await json(
            `SELECT snapshot FROM private.trial_required_notices WHERE enrollment_id='${a.enrollment_id}' AND kind='contract_confirmation'`,
          )
          const expectedKind = first === "api" ? "api_confirmation" : "webhook"
          assert.equal(payload.authorization_proof_kind, expectedKind)
          assert.equal(snapshot.authorization_proof_kind, expectedKind)
          assert.equal(
            payload.authorization_clock_kind,
            first === "api" ? "server_confirmation" : "provider_event",
          )
          assert.equal(
            payload.lifecycle_source,
            first === "api" ? "verified_api_confirmation" : "verified_activation",
          )
          if (first === "api") {
            assert.equal(snapshot.authorization_confirmed_at, snapshot.authorizedAt)
            assert.equal(payload.authorization_confirmed_at, payload.authorization_succeeded_at)
          }
          await json(pin(a))
          assert.deepEqual(
            await json(
              `SELECT snapshot FROM private.trial_required_notices WHERE enrollment_id='${a.enrollment_id}' AND kind='contract_confirmation'`,
            ),
            snapshot,
          )
          assert.deepEqual(
            await json(
              `SELECT payload FROM public.billing_analytics_outbox WHERE event_key='paypal:trial_started:${a.enrollment_id}'`,
            ),
            payload,
          )
        }
      },
    )

    await t.test(
      "a later activation event after expiry cannot rewrite API proof or admitted trial",
      async () => {
        for (const admitted of [false, true]) {
          const a = await fixture()
          const first = await json(confirm(a))
          if (admitted) assert.equal(await admit(a, first), "active")
          await service(
            `UPDATE public.paypal_checkout_intents SET expires_at=clock_timestamp()-interval '1 second' WHERE id='${a.intent_id}'`,
          )
          const lateAt = await service("SELECT clock_timestamp()")
          const supplemental = await json(pin(a, `WH-later-${crypto.randomUUID()}`, lateAt))
          assert.deepEqual(proof(supplemental), proof(first))
          assert.deepEqual(proof(await json(confirm(a))), proof(first))
          assert.equal(
            await service(
              `SELECT admission_status FROM public.trial_enrollments WHERE id='${a.enrollment_id}'`,
            ),
            admitted ? "active" : "reserved",
          )
        }
      },
    )

    await t.test(
      "late initial denial is atomic with API proof and replay preserves neutralization",
      async () => {
        const stale = await fixture()
        const unproven = await read(stale)
        assert.equal(unproven.authorization_succeeded_at, null)
        // API wins and holds the serializer; the webhook caller's earlier read is
        // stale. Change expiry inside that transaction before exposing its proof.
        const result = await race(
          confirm(stale) +
            `; UPDATE public.paypal_checkout_intents SET expires_at=clock_timestamp()-interval '1 millisecond' WHERE id='${stale.intent_id}'`,
          `SELECT public.pin_paypal_trial_activation('${stale.intent_token}','${stale.agreement}','WH-raced-${crypto.randomUUID()}',clock_timestamp())`,
        )
        assert.equal(result.loser.error, null)
        assert.equal(result.loser.value.authorization_proof_kind, "api_confirmation")
        assert.equal(
          await service(
            `SELECT admission_status||':'||neutralization_required FROM public.trial_enrollments WHERE id='${stale.enrollment_id}'`,
          ),
          "reserved:false",
        )

        const late = await fixture()
        await service(
          `UPDATE public.paypal_checkout_intents SET expires_at=clock_timestamp()-interval '1 second' WHERE id='${late.intent_id}'`,
        )
        const at = await service("SELECT clock_timestamp()")
        const event = `WH-late-${crypto.randomUUID()}`
        const first = await json(pin(late, event, at))
        assert.equal(first.authorization_succeeded_at, null)
        assert.equal(
          await service(
            `SELECT admission_status||':'||neutralization_required||':'||provider_agreement_id FROM public.trial_enrollments WHERE id='${late.enrollment_id}'`,
          ),
          `blocked:true:${late.agreement}`,
        )
        assert.deepEqual(proof(await json(pin(late, event, at))), proof(first))
        assert.equal((await json(confirm(late))).authorization_succeeded_at, null)
        assert.equal(
          await service(
            `SELECT count(*) FROM private.paypal_trial_activation_evidence WHERE attempt_id='${late.id}'`,
          ),
          "1",
        )
      },
    )

    await t.test(
      "ineligible initial states retain unproven fallback and cannot be resurrected",
      async () => {
        for (const state of [
          "expired",
          "blocked",
          "released",
          "revoked",
          "candidate",
          "v1",
        ] as const) {
          const a = await fixture(state === "v1" ? 1 : 2)
          if (state === "expired")
            await service(
              `UPDATE public.paypal_checkout_intents SET expires_at=clock_timestamp()-interval '1 second' WHERE id='${a.intent_id}'`,
            )
          if (state === "blocked" || state === "released")
            await service(
              `UPDATE public.trial_enrollments SET admission_status='${state}' WHERE id='${a.enrollment_id}'`,
            )
          if (state === "revoked")
            await service(
              `UPDATE public.trial_enrollments SET access_revoked=true WHERE id='${a.enrollment_id}'`,
            )
          if (state === "candidate")
            await service(`INSERT INTO private.paypal_trial_candidate_expiry(agreement_id,kind,reference_id,enrollment_id,app_id,plan_id,custom_id,created_at,expires_at,start_time)
          SELECT '${a.agreement}','initial','${a.id}','${a.enrollment_id}','APP','P-year',token,created_at,expires_at,'${a.trial_end_at}' FROM public.paypal_checkout_intents WHERE id='${a.intent_id}'`)
          const original = await read(a)
          const result = await json(
            confirm(
              a,
              crypto.randomUUID(),
              state === "v1"
                ? {
                    start: new Date(Date.now() + 9 * 86400000).toISOString(),
                    next: new Date(Date.now() + 8 * 86400000).toISOString(),
                  }
                : {},
            ),
          )
          assert.equal(result.authorization_succeeded_at, null, state)
          assert.deepEqual(proof(await read(a)), proof(original), state)
        }
      },
    )

    await t.test("approval expiry is checked after a real lock wait, not before it", async () => {
      const a = await fixture()
      await service(
        `UPDATE public.paypal_checkout_intents SET expires_at=clock_timestamp()+interval '700 milliseconds' WHERE id='${a.intent_id}'`,
      )
      const result = await race(
        "SELECT pg_advisory_xact_lock(74144351); SELECT jsonb_build_object('barrier',true)",
        confirm(a),
        async () => {
          for (let n = 0; n < 100; n++) {
            if (
              (await service(
                `SELECT clock_timestamp()>expires_at FROM public.paypal_checkout_intents WHERE id='${a.intent_id}'`,
              )) === "t"
            )
              return
            await setTimeout(25)
          }
          assert.fail("fixture approval deadline did not pass")
        },
      )
      assert.equal(result.loser.error, null)
      assert.equal(result.loser.value.authorization_succeeded_at, null)
      assert.equal((await read(a)).authorization_succeeded_at, null)
    })

    await t.test(
      "a self-consistent frozen schedule still requires seven to ten days from confirmation",
      async () => {
        for (const offset of [-2, 3]) {
          const a = await createAttempt()
          // Historical/corrupt-clock fixture: it obeys actual v2 schedule and
          // immutability constraints but cannot meet today's admission duration.
          await service(`UPDATE private.paypal_trial_checkout_attempts
          SET paypal_app_id='APP',paypal_product_id='PROD',paypal_plan_id='P-year',
            request_id='paypal-trial:${a.id}:v2',request_expires_at=clock_timestamp()+interval '${72 + offset * 24} hours',
            trial_end_at=private.paypal_trial_frozen_start(clock_timestamp()+interval '${72 + offset * 24} hours'),
            provider_start_time=private.paypal_trial_frozen_start(clock_timestamp()+interval '${72 + offset * 24} hours')+interval '12 hours',status='frozen'
          WHERE id='${a.id}';
          UPDATE public.paypal_checkout_intents SET metadata=metadata||jsonb_build_object('paypal_app_id','APP','paypal_product_id','PROD','paypal_plan_id','P-year','paypal_request_id','paypal-trial:${a.id}:v2') WHERE id='${a.intent_id}'`)
          const agreement = `I-${a.id}`
          await service(
            `SELECT public.bind_paypal_trial_checkout_reference('${a.id}','${agreement}')`,
          )
          const row = await read(a as Fixture)
          const candidate = { ...a, ...row, agreement } as Fixture
          const result = await json(confirm(candidate))
          assert.equal(result.authorization_succeeded_at, null)
          assert.equal((await read(candidate)).authorization_succeeded_at, null)
        }
      },
    )

    await t.test(
      "bound app, plan, agreement and exact billing schedule cannot be substituted",
      async () => {
        const a = await fixture()
        for (const overrides of [
          { app: "APP-other" },
          { plan: "P-other" },
          { agreement: "I-other" },
          { start: new Date(Date.parse(a.provider_start_time) + 1000).toISOString() },
          { next: new Date(Date.parse(a.trial_end_at) - 1).toISOString() },
          { next: new Date(Date.parse(a.trial_end_at) + 2 * 86400000).toISOString() },
          { start: "infinity" },
          { next: "infinity" },
        ]) {
          await assert.rejects(
            () => json(confirm(a, crypto.randomUUID(), overrides)),
            /mismatch|invalid|schedule|billing|evidence|contract/i,
          )
          assert.equal((await read(a)).authorization_succeeded_at, null)
        }
      },
    )
    await t.test(
      "operator report separates provider-event and API confirmation latency",
      async () => {
        const report = await json("SELECT public.report_paypal_trial_approval_latency()")
        assert.equal(report.clockKind, "provider_event")
        assert.equal(
          report.approved,
          Number(
            await service(
              "SELECT count(*) FROM private.paypal_trial_checkout_attempts WHERE authorization_proof_kind='webhook'",
            ),
          ),
        )
        assert.equal(report.byClockKind.provider_event.count, report.approved)
        assert.equal(
          report.byClockKind.server_confirmation.count,
          Number(
            await service(
              "SELECT count(*) FROM private.paypal_trial_checkout_attempts WHERE authorization_proof_kind='api_confirmation'",
            ),
          ),
        )
      },
    )
  },
)
