import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { setTimeout } from "node:timers/promises"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"

// This is deliberately a real PostgreSQL test. PGlite cannot prove the row-lock
// and immutable-trigger behaviour that protects a frozen provider payload.
const enabled = process.env.PAYPAL_TRIAL_SCHEDULING_POSTGRES_TEST === "1"
const SCHEDULE_MIGRATION =
  "supabase/migrations/20260915190501_paypal_trial_noon_schedule_contract.sql"
const USER = "11111111-1111-4111-8111-111111111111"
const ATTEMPT = "22222222-2222-4222-8222-222222222222"
const offerInputs = {
  monthPriceId: "price_month",
  yearPriceId: "price_year",
  annualCouponId: "coupon",
}
const offer = createTrialOfferSnapshot("year", offerInputs)
const monthOffer = createTrialOfferSnapshot("month", offerInputs)

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
  "PayPal noon schedules: PostgreSQL immutable v2 records and legacy reader fence",
  { skip: !enabled, timeout: 120000 },
  async (t) => {
    const container = `chaarlie-paypal-schedule-${crypto.randomUUID()}`
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
      INSERT INTO public.profiles VALUES('${USER}');
      ${migration("20260914044650_trial_admission_foundation")}
      ${migration("20260914090614_trial_cancellation_declarations")}
      ${migration("20260914120000_paypal_trial_checkout_attempt")}
      ${migration("20260914135017_paypal_trial_activation_clock")}
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
    `)

    const service = (statement: string) => sql(`SET ROLE service_role; ${statement}`)
    const json = async (statement: string) => JSON.parse(await service(statement))
    const createAttempt = async () => {
      const user = crypto.randomUUID()
      await sql(`INSERT INTO public.profiles VALUES('${user}')`)
      const attempt = await json(`SELECT public.create_paypal_trial_checkout_attempt_v2(
        'user','${user}','${crypto.randomUUID()}','${JSON.stringify(offer)}',
        'fixture@example.com',null,'pricing_page')`)
      return { user, ...attempt } as { user: string; id: string; enrollment_id: string }
    }
    const freezeInitial = (id: string, version: 1 | 2) =>
      `SELECT public.freeze_paypal_trial_checkout_attempt${version === 2 ? "_v2" : ""}(
        '${id}','APP','PROD','P-year','paypal-trial:${id}:v${version}')`

    // The winner holds its completed RPC uncommitted. The loser must actually
    // block in a separate backend before COMMIT releases it; elapsed time is
    // never treated as evidence of concurrency or lock acquisition.
    const race = async (winnerQuery: string, loserQuery: string) => {
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

    await t.test(
      "initial freeze: independent v1/v2 sessions preserve either winner and duplicate v2",
      async () => {
        for (const [first, second] of [
          [1, 2],
          [2, 1],
          [2, 2],
        ] as const) {
          const a = await createAttempt()
          const result = await race(freezeInitial(a.id, first), freezeInitial(a.id, second))
          assert.equal(result.winner.request_id, `paypal-trial:${a.id}:v${first}`)
          if (first === 2 && second === 1) {
            assert.match(result.loser.error?.message ?? "", /conflict/)
          } else {
            assert.equal(result.loser.error, null)
            assert.deepEqual(result.loser.value, result.winner)
          }
          const saved = await json(`SELECT public.get_paypal_trial_checkout_attempt_by_scope_v2(
          'user','${a.user}',(SELECT client_attempt_id FROM private.paypal_trial_checkout_attempts WHERE id='${a.id}'))`)
          assert.deepEqual(saved, result.winner)
        }
      },
    )

    const created = JSON.parse(
      await sql(`SET ROLE service_role;
        SELECT public.create_paypal_trial_checkout_attempt_v2(
          'user','${USER}','${ATTEMPT}','${JSON.stringify(offer)}'::jsonb,
          'owner@example.com',null,'pricing_page')`),
    ) as { id: string }
    const frozen = JSON.parse(
      await sql(`SET ROLE service_role;
        SELECT public.freeze_paypal_trial_checkout_attempt_v2(
          '${created.id}','APP','PROD','P-year','paypal-trial:${created.id}:v2')`),
    ) as { trial_end_at: string; provider_start_time: string; request_id: string }
    assert.equal(frozen.request_id, `paypal-trial:${created.id}:v2`)
    assert.equal(
      Date.parse(frozen.provider_start_time) - Date.parse(frozen.trial_end_at),
      12 * 60 * 60 * 1000,
    )

    const replay = JSON.parse(
      await sql(`SET ROLE service_role;
        SELECT public.freeze_paypal_trial_checkout_attempt_v2(
          '${created.id}','APP','PROD','P-year','paypal-trial:${created.id}:v2')`),
    )
    assert.deepEqual(replay, frozen)
    await sql(
      `SET ROLE service_role; SELECT public.bind_paypal_trial_checkout_reference('${created.id}','I-v2')`,
    )
    await sql(
      `SET ROLE service_role; UPDATE public.paypal_checkout_intents SET expires_at=clock_timestamp()-interval '1 second' WHERE id=(SELECT intent_id FROM private.paypal_trial_checkout_attempts WHERE id='${created.id}')`,
    )
    const expiry = JSON.parse(
      await sql(
        "SET ROLE service_role; SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM public.claim_paypal_trial_candidate_expiry(1) x",
      ),
    )[0] as {
      start_time: string
    }
    assert.equal(Date.parse(expiry.start_time), Date.parse(frozen.trial_end_at))
    assert.equal(
      Date.parse(frozen.provider_start_time) - Date.parse(expiry.start_time),
      12 * 3600000,
    )
    await assert.rejects(
      () =>
        sql(`SET ROLE service_role;
          UPDATE private.paypal_trial_checkout_attempts
          SET provider_start_time=provider_start_time + interval '1 hour' WHERE id='${created.id}'`),
      /immutable/,
    )
    await assert.rejects(
      () =>
        sql(`SET ROLE service_role;
          SELECT public.get_paypal_trial_checkout_attempt_by_scope('user','${USER}','${ATTEMPT}')`),
      /v2|legacy|schedule/i,
    )
    for (const role of ["anon", "authenticated"]) {
      await assert.rejects(
        () =>
          sql(
            `SET ROLE ${role}; SELECT public.freeze_paypal_trial_checkout_attempt_v2('${created.id}','APP','PROD','P-year','x')`,
          ),
        /permission denied/,
      )
    }
    const legacyAttempt = crypto.randomUUID()
    const legacy = JSON.parse(
      await sql(`SET ROLE service_role; SELECT public.create_paypal_trial_checkout_attempt(
        'user','${USER}','${legacyAttempt}','${JSON.stringify(offer)}'::jsonb,'legacy@example.com',null,'pricing_page')`),
    ) as { id: string; intent_token: string }
    assert.equal(
      JSON.parse(
        await sql(
          `SET ROLE service_role; SELECT public.get_paypal_trial_checkout_attempt('${legacy.intent_token}')`,
        ),
      ).id,
      legacy.id,
    )
    assert.equal(
      JSON.parse(
        await sql(
          `SET ROLE service_role; SELECT public.get_paypal_trial_checkout_attempt_by_scope('user','${USER}','${legacyAttempt}')`,
        ),
      ).id,
      legacy.id,
    )
    assert.equal(
      await sql(
        "SET ROLE service_role; SELECT private.paypal_trial_legacy_restore_start('2026-09-24T00:00:00Z')",
      ),
      "2026-09-24 00:00:00+00",
    )
    assert.equal(
      await sql(
        "SET ROLE service_role; SELECT private.paypal_trial_legacy_restore_start('2026-09-24T00:00:01Z')",
      ),
      "2026-09-25 00:00:00+00",
    )
    // Seed an attested active enrollment using the real terms/binding triggers,
    // then use the real begin/claim/bind/commit management RPCs throughout.
    const activeFixture = async (version: 1 | 2) => {
      const a = await createAttempt()
      const schedule = await json(freezeInitial(a.id, version))
      const end =
        schedule.trial_end_at ??
        (await service(
          `SELECT private.paypal_trial_frozen_start('${schedule.request_expires_at}')`,
        ))
      const start = schedule.provider_start_time ?? end
      const agreement = `I-${a.id}`
      assert.equal(
        await service(`SELECT public.freeze_trial_management_catalog('${a.enrollment_id}',
        '${JSON.stringify({ month: monthOffer, year: offer })}')`),
        "t",
      )
      await service(`SELECT public.bind_paypal_trial_checkout_reference('${a.id}','${agreement}')`)
      await service(`UPDATE public.trial_enrollments SET authorization_succeeded_at=clock_timestamp(),
        original_trial_end_at='${end}',provider_agreement_id='${agreement}',admission_status='active',cancel_at_period_end=true
        WHERE id='${a.enrollment_id}';
        INSERT INTO public.billing_subscriptions(user_id,provider,provider_customer_id,provider_subscription_id,
          provider_status,entitlement_status,interval,trial_enrollment_id)
        VALUES('${a.user}','paypal','PAYER-${a.id}','${agreement}','ACTIVE','active','year','${a.enrollment_id}')`)
      return { ...a, end, start, agreement }
    }
    type Fixture = Awaited<ReturnType<typeof activeFixture>>
    const begin = async (
      a: Fixture,
      kind: "restore" | "switch",
      revision: number,
      interval = "year",
    ) =>
      json(`SELECT public.begin_trial_management_operation('${crypto.randomUUID()}','${a.enrollment_id}',
        '${a.user}','${kind}',${revision},'${interval}')`)
    const managementFreeze = (
      a: Fixture,
      op: { id: string },
      version: 1 | 2,
      start: string,
      sourcePlan = "P-year",
      targetPlan = "P-year",
    ) =>
      `SELECT public.freeze_paypal_trial_management_request${version === 2 ? "_v2" : ""}(
        '${op.id}','${a.user}','${sourcePlan}','${targetPlan}','https://example.test/return','https://example.test/cancel'
        ${version === 2 ? `,'${start}'` : ""})`
    const commit = async (a: Fixture, op: Record<string, unknown>, target: string) => {
      assert.equal(
        await service(
          `SELECT public.claim_paypal_trial_management_request('${op.id}','${a.user}')`,
        ),
        "t",
      )
      await service(
        `SELECT public.bind_paypal_trial_management_response('${op.id}','${a.user}','${target}',null)`,
      )
      const evidence = {
        provider: "paypal",
        providerCustomerId: op.providerCustomerId,
        sourceAgreementId: op.sourceAgreementId,
        targetAgreementId: target,
        originalTrialEndAt: op.originalTrialEndAt,
        offer: op.targetOffer,
        cancelAtPeriodEnd: op.cancelAtPeriodEnd,
        noImmediatePayment: true,
        sourceAgreementNeutralized: true,
        reference: `verified-${op.id}`,
      }
      assert.equal(
        await service(`SELECT public.commit_trial_management_operation('${op.id}','${a.user}',
        '${JSON.stringify(evidence)}')`),
        "t",
      )
      assert.equal(
        (await json(`SELECT public.load_trial_management_operation('${op.id}','${a.user}')`))
          .status,
        "committed",
      )
    }

    await t.test(
      "real management commits preserve noon lineage through restore, switch and another restore",
      async () => {
        const a = await activeFixture(2)
        const first = await begin(a, "restore", 0)
        const restore = await json(managementFreeze(a, first, 2, a.start))
        assert.equal(Date.parse(restore.source_start_time), Date.parse(a.start))
        assert.equal(Date.parse(restore.target_start_time), Date.parse(a.end) + 12 * 3600000)
        await assert.rejects(
          () =>
            service(
              managementFreeze(a, first, 2, new Date(Date.parse(a.start) + 3600000).toISOString()),
            ),
          /conflict/,
        )
        await assert.rejects(
          () =>
            service(`UPDATE private.paypal_trial_management_requests
        SET target_start_time=target_start_time+interval '1 hour' WHERE operation_id='${first.id}'`),
          /immutable/,
        )
        await assert.rejects(
          () =>
            service(`SELECT public.get_paypal_trial_management_request('${first.id}','${a.user}')`),
          /v2 reader/,
        )
        await commit(a, first, `I-restore-${first.id}`)

        const switched = await begin(a, "switch", 1, "month")
        await assert.rejects(
          () => service(managementFreeze(a, switched, 1, a.start, "P-year", "P-month")),
          /v2 reader/,
        )
        const switchSchedule = await json(
          managementFreeze(a, switched, 2, restore.target_start_time, "P-year", "P-month"),
        )
        assert.equal(switchSchedule.source_start_time, restore.target_start_time)
        assert.equal(switchSchedule.target_start_time, restore.target_start_time)
        await commit(a, switched, `I-restore-${first.id}`)
        assert.equal(
          await service(
            `SELECT public.record_paypal_trial_cancellation('${a.enrollment_id}','I-restore-${first.id}')`,
          ),
          "t",
        )
        const again = await begin(a, "restore", 2, "month")
        const againSchedule = await json(
          managementFreeze(a, again, 2, restore.target_start_time, "P-month", "P-month"),
        )
        assert.equal(againSchedule.source_start_time, restore.target_start_time)
        assert.equal(againSchedule.target_start_time, restore.target_start_time)
        await commit(a, again, `I-restore-${again.id}`)
      },
    )

    await t.test(
      "committed legacy restore is authoritative; new target uses noon and bad source is rejected",
      async () => {
        const a = await activeFixture(1)
        const old = await begin(a, "restore", 0)
        const legacyRequest = await json(managementFreeze(a, old, 1, a.start))
        assert.equal(legacyRequest.source_start_time, null)
        assert.equal(legacyRequest.target_start_time, null)
        // SQL-null schedule fields must remain readable by the old facade.
        assert.deepEqual(
          await json(`SELECT public.get_paypal_trial_management_request('${old.id}','${a.user}')`),
          legacyRequest,
        )
        await commit(a, old, `I-legacy-${old.id}`)
        assert.equal(
          await service(
            `SELECT public.record_paypal_trial_cancellation('${a.enrollment_id}','I-legacy-${old.id}')`,
          ),
          "t",
        )
        const next = await begin(a, "restore", 1)
        await assert.rejects(
          () =>
            service(
              managementFreeze(
                a,
                next,
                2,
                new Date(Date.parse(a.end) + 12 * 3600000).toISOString(),
              ),
            ),
          /source schedule mismatch/,
        )
        const corrected = await json(managementFreeze(a, next, 2, a.end))
        assert.equal(Date.parse(corrected.source_start_time), Date.parse(a.end))
        assert.equal(Date.parse(corrected.target_start_time), Date.parse(a.end) + 12 * 3600000)
        await commit(a, next, `I-noon-${next.id}`)
        const afterNoon = await begin(a, "switch", 2, "month")
        await assert.rejects(
          () =>
            service(
              managementFreeze(a, afterNoon, 1, corrected.target_start_time, "P-year", "P-month"),
            ),
          /v2 reader/,
        )
        const inherited = await json(
          managementFreeze(a, afterNoon, 2, corrected.target_start_time, "P-year", "P-month"),
        )
        assert.equal(inherited.source_start_time, corrected.target_start_time)
        assert.equal(inherited.target_start_time, corrected.target_start_time)
      },
    )

    await t.test(
      "independent management freezes serialize absent rows, including both deployment winner orders",
      async () => {
        for (const [first, second] of [
          [2, 2],
          [2, 1],
          [1, 2],
        ] as const) {
          const a = await activeFixture(1)
          const op = await begin(a, "restore", 0)
          const result = await race(
            managementFreeze(a, op, first, a.start),
            managementFreeze(a, op, second, a.start),
          )
          if (first === 2 && second === 1) {
            assert.match(result.loser.error?.message ?? "", /v2 reader/)
          } else {
            assert.equal(result.loser.error, null)
            assert.deepEqual(result.loser.value, result.winner)
          }
          const saved = await json(
            `SELECT public.get_paypal_trial_management_request_v2('${op.id}','${a.user}')`,
          )
          assert.deepEqual(saved, result.winner)
          assert.equal(saved.request_id.endsWith(":v2"), first === 2)
          assert.equal(
            await service(
              `SELECT count(*) FROM private.paypal_trial_management_requests WHERE operation_id='${op.id}'`,
            ),
            "1",
          )
        }
      },
    )

    await t.test(
      "existing management expiry stays at S while the frozen provider target is noon",
      async () => {
        const a = await activeFixture(2)
        const op = await begin(a, "restore", 0)
        const r = await json(managementFreeze(a, op, 2, a.start))
        assert.equal(
          await service(
            `SELECT public.claim_paypal_trial_management_request('${op.id}','${a.user}')`,
          ),
          "t",
        )
        await service(
          `SELECT public.bind_paypal_trial_management_response('${op.id}','${a.user}','I-expiry-${op.id}',null)`,
        )
        // A new cancellation invalidates the pending restore without editing any
        // immutable clock, causing the real expiry query to discover it now.
        await service(`UPDATE private.trial_management_state SET cancellation_version=cancellation_version+1
        WHERE enrollment_id='${a.enrollment_id}'`)
        const candidates = await json(
          "SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM public.claim_paypal_trial_candidate_expiry(5) x",
        )
        const candidate = candidates.find(
          (x: { agreement_id: string }) => x.agreement_id === `I-expiry-${op.id}`,
        )
        assert.ok(candidate)
        assert.equal(Date.parse(candidate.start_time), Date.parse(a.end))
        assert.equal(
          Date.parse(r.target_start_time) - Date.parse(candidate.start_time),
          12 * 3600000,
        )
      },
    )

    await t.test(
      "storage rejects partial, noncanonical and unknown version schedule contracts",
      async () => {
        const a = await createAttempt()
        for (const assignment of [
          "trial_end_at=clock_timestamp()",
          "request_id='paypal-trial:wrong:v2',request_expires_at=clock_timestamp()+interval '72 hours'",
          `request_id='paypal-trial:${a.id}:v3',request_expires_at=clock_timestamp()+interval '72 hours'`,
          `request_id='paypal-trial:${a.id}:v2',request_expires_at=clock_timestamp()+interval '72 hours'`,
        ]) {
          await assert.rejects(
            () =>
              service(
                `UPDATE private.paypal_trial_checkout_attempts SET ${assignment} WHERE id='${a.id}'`,
              ),
            /immutable|check constraint/,
          )
        }
        const fixture = await activeFixture(2)
        const op = await begin(fixture, "restore", 0)
        const insert = (key: string, source: string, target: string) =>
          service(`INSERT INTO private.paypal_trial_management_requests(
        operation_id,enrollment_id,app_id,product_id,source_plan_id,target_plan_id,request_id,return_url,cancel_url,source_start_time,target_start_time)
        VALUES('${op.id}','${fixture.enrollment_id}','APP','PROD','P-year','P-year','${key}',
          'https://example.test/return','https://example.test/cancel',${source},${target})`)
        for (const [key, source, target] of [
          [`paypal-trial-management:${op.id}:v2`, "null", "null"],
          [`paypal-trial-management:${op.id}:v3`, `'${fixture.start}'`, `'${fixture.start}'`],
          [`paypal-trial-management:wrong:v2`, `'${fixture.start}'`, `'${fixture.start}'`],
          [`paypal-trial-management:${op.id}:v2`, `'${fixture.start}'`, "null"],
        ])
          await assert.rejects(() => insert(key, source, target), /check constraint/)
        assert.equal(
          await sql(
            "SELECT to_regprocedure('public.freeze_paypal_trial_management_request_v1_impl(uuid,uuid,text,text,text,text)') IS NULL",
          ),
          "t",
        )
        for (const role of ["anon", "authenticated"]) {
          await assert.rejects(
            () => sql(`SET ROLE ${role}; ${managementFreeze(fixture, op, 2, fixture.start)}`),
            /permission denied/,
          )
        }
      },
    )
  },
)
