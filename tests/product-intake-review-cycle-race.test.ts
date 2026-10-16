import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { setTimeout } from "node:timers/promises"

import { loadAdminAlertTestDatabaseSql } from "../scripts/product-intake/admin-alert-test-database"

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
    const race = async (winnerQuery: string, loserQuery: string) => {
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
          (value) => ({ value: JSON.parse(value) as Job, error: null }),
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
          winner: JSON.parse(output.split("\n").find((line) => line.startsWith("{"))!) as Job,
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
  },
)
