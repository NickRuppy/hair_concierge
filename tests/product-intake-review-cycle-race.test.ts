import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { setTimeout } from "node:timers/promises"

import { loadAdminAlertTestDatabaseSql } from "../scripts/product-intake/admin-alert-test-database"
import {
  loadPublicationTestDatabaseSql,
  publicationMaskBatch,
  OPERATOR,
} from "./helpers/product-intake-publication-postgres"
import type { ReviewBinding } from "@chaarlie/product-intake-core"

// Opt-in isolated PostgreSQL: PGlite's single connection cannot prove row-lock races.
const enabled = process.env.PRODUCT_INTAKE_REVIEW_CYCLE_POSTGRES_TEST === "1"
const dockerArgs = ["--context", "colima-chaarlie"]
function command(args: string[], input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", [...dockerArgs, ...args], { stdio: ["pipe", "pipe", "pipe"] })
    let output = ""
    let error = ""
    child.stdout.on("data", (chunk) => {
      output += chunk.toString()
    })
    child.stderr.on("data", (chunk) => {
      error += chunk.toString()
    })
    child.on("error", reject)
    child.on("close", (code) =>
      code === 0 ? resolve(output.trim()) : reject(new Error(error || `docker exited ${code}`)),
    )
    child.stdin.end(input)
  })
}

type Job = {
  id: string
  submission_id: string
  locked_at: string
  locked_by: string
  review_cycle_id: string
  reserved_model_runs: number
  status: string
  payload_revision?: number
}

test(
  "PostgreSQL completion and human rework serialize and stale replay cannot revive an old cycle",
  { skip: !enabled, timeout: 120_000 },
  async (t) => {
    const container = `chaarlie-intake-cycle-${crypto.randomUUID()}`
    await command([
      "run",
      "--rm",
      "--detach",
      "--name",
      container,
      "--memory",
      "512m",
      "-e",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "postgres:17",
    ])
    t.after(() => command(["rm", "--force", container]))
    for (let attempt = 0; ; attempt++) {
      try {
        await command(["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"])
        break
      } catch (error) {
        if (attempt >= 99) throw error
        await setTimeout(100)
      }
    }
    const psqlArgs = [
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
    ]
    const sql = (statement: string) => command(psqlArgs, statement)
    const service = (statement: string) => sql(`SET ROLE service_role; ${statement}`)
    await sql(await loadAdminAlertTestDatabaseSql())
    await sql(
      `RESET ROLE; ${await readFile(new URL("../supabase/migrations/20261016104506_product_intake_review_evidence.sql", import.meta.url), "utf8")}`,
    )
    const createClaim = async (): Promise<Job> => {
      await service(
        "INSERT INTO public.product_submissions(user_id,source,intake_method,category,frequency_range) VALUES('11111111-1111-4111-8111-111111111111','chat','manual','conditioner','weekly_1x');",
      )
      return JSON.parse(
        await service(
          "SELECT row_to_json(j) FROM public.product_intake_claim_research_jobs('race-worker',1) j;",
        ),
      )
    }
    const complete = (job: Job, revision?: number) => {
      const payload = {
        product_name: "Test",
        category_label: "Conditioner",
        outcome_label: "Bereit zur Prüfung",
        question_1: "",
        question_2: "",
        question_3: "",
        review_url: `https://chaarlie.de/admin/produkt-intake/${job.submission_id}`,
        is_test: false,
      }
      return `SELECT row_to_json(j) FROM public.product_intake_commit_research_pass('${job.id}','${job.locked_by}','${job.locked_at}','waiting_for_review','preview_build','{}',NULL,'{"final":"test"}','{}','ready_for_review','${JSON.stringify(payload)}','${job.review_cycle_id}','[{"kind":"model_judgment","payload":{"defects":[]}}]',false${revision === undefined ? "" : `,${revision},'[]'`}) j;`
    }
    const rework = (job: Job) =>
      `SELECT row_to_json(j) FROM public.product_intake_request_rework_job('${job.submission_id}') j;`
    const race = async <W = Job, L = Job>(winnerQuery: string, loserQuery: string) => {
      const application = `intake-race-${crypto.randomUUID()}`
      const child = spawn("docker", [...dockerArgs, ...psqlArgs], {
        stdio: ["pipe", "pipe", "pipe"],
      })
      let output = ""
      let error = ""
      child.stdout.on("data", (chunk) => {
        output += chunk.toString()
      })
      child.stderr.on("data", (chunk) => {
        error += chunk.toString()
      })
      const completed = new Promise<void>((resolve, reject) => {
        child.on("error", reject)
        child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(error))))
      }).then(
        () => ({ ok: true as const }),
        (failure) => ({ ok: false as const, failure }),
      )
      try {
        child.stdin.write(`BEGIN; SET ROLE service_role; ${winnerQuery} SELECT 'WINNER_READY';\n`)
        for (let n = 0; !output.includes("WINNER_READY"); n++) {
          if (error || n > 100) throw new Error(error || "winner did not reach transaction barrier")
          await setTimeout(25)
        }
        const loser = sql(
          `SET application_name='${application}'; SET ROLE service_role; ${loserQuery}`,
        ).then(
          (value) => ({ value: JSON.parse(value) as L, error: null }),
          (failure: Error) => ({ value: null, error: failure }),
        )
        let observed = false
        for (let n = 0; n < 100; n++) {
          const count = await sql(
            `SELECT count(*) FROM pg_stat_activity WHERE application_name='${application}' AND wait_event_type='Lock' AND cardinality(pg_blocking_pids(pid))>0;`,
          )
          if (count === "1") {
            observed = true
            break
          }
          await setTimeout(25)
        }
        assert.equal(
          observed,
          true,
          "second PostgreSQL backend actually waits on the winner's lock",
        )
        child.stdin.end("COMMIT;\n")
        const finished = await completed
        assert.equal(finished.ok, true, "winner committed")
        return {
          winner: JSON.parse(output.split("\n").find((line) => line.startsWith("{"))!) as W,
          loser: await loser,
        }
      } finally {
        if (!child.stdin.writableEnded) child.stdin.end("ROLLBACK;\n")
        await completed
      }
    }

    const first = await createClaim()
    await assert.rejects(service(rework(first)), /No review-ready/)
    const completionWins = await race(complete(first), rework(first))
    assert.equal(completionWins.winner.status, "waiting_for_review")
    assert.equal(completionWins.loser.error, null)
    assert.equal(completionWins.loser.value!.status, "waiting_for_rework")
    assert.notEqual(completionWins.loser.value!.review_cycle_id, first.review_cycle_id)
    await assert.rejects(service(complete(first)), /cycle no longer matches/)
    // Retire first fixture from claim candidates without touching the tested evidence.
    await service(
      `UPDATE public.product_intake_research_jobs SET status='blocked' WHERE id='${first.id}';`,
    )

    const second = await createClaim()
    await service(complete(second))
    const reworkWins = await race(rework(second), complete(second))
    assert.equal(reworkWins.winner.status, "waiting_for_rework")
    assert.match(reworkWins.loser.error?.message ?? "", /cycle no longer matches/)
    const persisted = JSON.parse(
      await service(
        `SELECT row_to_json(j) FROM public.product_intake_research_jobs j WHERE id='${second.id}';`,
      ),
    ) as Job
    assert.equal(persisted.review_cycle_id, reworkWins.winner.review_cycle_id)
    assert.equal(persisted.reserved_model_runs, 0)
    assert.equal(persisted.status, "waiting_for_rework")
    assert.equal(
      await service("SELECT count(*) FROM public.product_intake_research_artifacts;"),
      "2",
    )
    assert.equal(
      await service("SELECT count(*) FROM public.product_intake_admin_notifications;"),
      "2",
    )
    await service(
      `UPDATE public.product_intake_research_jobs SET status='blocked' WHERE id='${second.id}';`,
    )
    const third = await createClaim()
    const payloadWins = await race(
      `UPDATE public.product_submissions SET researched_payload='{"final":"human correction"}'
       WHERE id='${third.submission_id}' RETURNING row_to_json(product_submissions);`,
      complete(third, 1),
    )
    assert.equal(payloadWins.winner.payload_revision, 2)
    assert.match(payloadWins.loser.error?.message ?? "", /payload revision no longer matches/)
    assert.equal(
      await service("SELECT count(*) FROM public.product_intake_research_artifacts;"),
      "2",
    )
    assert.equal(
      await service("SELECT count(*) FROM public.product_intake_admin_notifications;"),
      "2",
    )

    // The same two actual PostgreSQL sessions now exercise the full catalog writer
    // and publication receipt, beyond PGlite's single-connection serialization.
    await sql("CREATE DATABASE publication_race;")
    psqlArgs.push("-d", "publication_race")
    // Roles are cluster-wide and were created by the first isolated database.
    await sql(
      (await loadPublicationTestDatabaseSql()).replace(
        /CREATE ROLE (anon|authenticated|service_role);/g,
        "",
      ),
    )
    const fixture = (await publicationMaskBatch()).items[0]!
    assert.equal(fixture.kind, "new_product")
    if (fixture.kind !== "new_product")
      throw new Error("publication race requires a new product fixture")
    const literal = (value: unknown) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`
    const rpc = (name: string, request: unknown) => `SELECT public.${name}(${literal(request)});`
    let fixtureNumber = 0
    const readyPublication = async () => {
      const id = crypto.randomUUID()
      const final = structuredClone(fixture.final_payload)
      assert.ok(final.product && typeof final.product === "object" && !Array.isArray(final.product))
      const product = final.product as Record<string, unknown>
      product.clean_name = `Concurrent Mask ${++fixtureNumber}`
      Object.assign(product, {
        image_url: null,
        canonical_image_sha256: null,
        thumbnail_image_url: null,
      })
      await service(`INSERT INTO product_submissions(id,user_id,source,intake_method,category,frequency_range,status,researched_payload)
        VALUES('${id}','${OPERATOR}','chat','manual','mask','weekly_1x','ready_for_review',${literal({ final })});
        INSERT INTO product_intake_research_jobs(submission_id,status,stage) VALUES('${id}','waiting_for_review','preview_build');`)
      const common = JSON.parse(
        await service(`SELECT jsonb_build_object('submission_id',s.id,'payload_revision',s.payload_revision,'payload_sha256',s.payload_sha256,
        'job_id',j.id,'review_cycle_id',j.review_cycle_id,'reviewed_by','nick') FROM product_submissions s JOIN product_intake_research_jobs j ON j.submission_id=s.id WHERE s.id='${id}';`),
      ) as ReviewBinding & { reviewed_by: string }
      await service(
        rpc("product_intake_record_review_decision", {
          ...common,
          request_id: crypto.randomUUID(),
          action: "approve_data",
          field_path: "final.properties",
        }),
      )
      await service(
        rpc("product_intake_record_review_decision", {
          ...common,
          request_id: crypto.randomUUID(),
          action: "approve_image",
          field_path: "final.image",
          reviewer_value: { no_image: true },
        }),
      )
      const checked = JSON.parse(
        await service(`SELECT product_intake_review_preflight('${id}');`),
      ) as Record<string, unknown>
      assert.equal(checked.ok, true)
      return {
        ...common,
        request_id: crypto.randomUUID(),
        data_decision_id: checked.data_decision_id,
        image_decision_id: checked.image_decision_id,
        confirm: true,
        final_payload: final,
        spec_operations: fixture.spec_operations,
        public_image: null,
        owner_default: false,
      }
    }
    const firstPublication = await readyPublication()
    const edited = await race<Record<string, unknown>, Record<string, unknown>>(
      `UPDATE product_submissions SET researched_payload=researched_payload WHERE id='${firstPublication.submission_id}' RETURNING row_to_json(product_submissions);`,
      rpc("product_intake_publish_reviewed_submission", firstPublication),
    )
    assert.match(edited.loser.error?.message ?? "", /revision|stale/i)
    assert.equal(await service("SELECT count(*) FROM product_intake_publication_receipts;"), "0")
    assert.equal(await service("SELECT count(*) FROM products;"), "0")
    const secondPublication = await readyPublication()
    const replayed = await race<{ publication: { id: string } }, { publication: { id: string } }>(
      rpc("product_intake_publish_reviewed_submission", secondPublication),
      rpc("product_intake_publish_reviewed_submission", secondPublication),
    )
    assert.equal(replayed.loser.error, null)
    assert.equal(replayed.winner.publication.id, replayed.loser.value!.publication.id)
    assert.equal(await service("SELECT count(*) FROM product_intake_publication_receipts;"), "1")
    assert.equal(await service("SELECT count(*) FROM products;"), "1")
    const thirdPublication = await readyPublication()
    const reworked = await race<Record<string, unknown>, Record<string, unknown>>(
      rpc("product_intake_record_review_decision", {
        ...thirdPublication,
        request_id: crypto.randomUUID(),
        action: "rework",
        comment: "Exakte Werte erneut prüfen",
        confirm: undefined,
        final_payload: undefined,
        spec_operations: undefined,
        public_image: undefined,
        owner_default: undefined,
        data_decision_id: undefined,
        image_decision_id: undefined,
      }),
      rpc("product_intake_publish_reviewed_submission", thirdPublication),
    )
    assert.match(reworked.loser.error?.message ?? "", /cycle|binding|review|revision/i)
    assert.equal(await service("SELECT count(*) FROM product_intake_publication_receipts;"), "1")
    assert.equal(await service("SELECT count(*) FROM products;"), "1")
  },
)
