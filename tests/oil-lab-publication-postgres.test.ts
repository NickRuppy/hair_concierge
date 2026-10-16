import { stableOilReviewJson } from "../packages/product-intake-core/src/oil-review-binding"
import assert from "node:assert/strict"
import test from "node:test"
import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import { setTimeout } from "node:timers/promises"
import {
  publicationTestDdl,
  publicationImage,
  publicationFinal,
} from "./oil-lab-publication-fixture"
import { detailFixture } from "./oil-lab-handoff-fixture"
import { buildOilLabReviewPackage } from "../src/lib/oil-research/lab-package"
import { OIL_CURRENT_REVIEW_PROPERTY_IDS } from "../src/lib/oil-research/review-state"

function command(args: string[], input = "") {
  const child = spawn("docker", ["--context", "colima-chaarlie", ...args], {
    stdio: ["pipe", "pipe", "pipe"],
  })
  let out = "",
    err = ""
  let reached!: () => void
  const barrier = new Promise<void>((r) => {
    reached = r
  })
  const done = new Promise<string>((resolve, reject) => {
    child.stdout.on("data", (v) => {
      out += v.toString()
      if (out.includes("LOCK_BARRIER")) reached()
    })
    child.stderr.on("data", (v) => {
      err += v.toString()
    })
    child.on("error", reject)
    child.on("close", (c) => (c === 0 ? resolve(out.trim()) : reject(new Error(err))))
  })
  child.stdin.end(input)
  return { done, barrier }
}
const literal = (x: unknown) => "'" + JSON.stringify(x).replaceAll("'", "''") + "'::jsonb"
test(
  "real PostgreSQL locks serialize oil import and publish against rework; rollback and privileges",
  {
    skip:
      process.env.OIL_LAB_POSTGRES_TEST === "1"
        ? false
        : "Requires OIL_LAB_POSTGRES_TEST=1 and Docker context colima-chaarlie with postgres:17",
    timeout: 180000,
  },
  async (t) => {
    const container = `oil-lab-proof-${crypto.randomUUID()}`
    await command([
      "run",
      "--rm",
      "--detach",
      "--network",
      "none",
      "--name",
      container,
      "-e",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "postgres:17",
    ]).done
    t.after(async () => {
      await command(["rm", "--force", container]).done
    })
    for (let i = 0; ; i++) {
      try {
        await command(["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]).done
        break
      } catch (e) {
        if (i > 60) throw e
        await setTimeout(100)
      }
    }
    const run = (sql: string) =>
      command(
        ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres"],
        sql,
      )
    const sql = (s: string) => run(s).done
    await sql(publicationTestDdl)
    await sql(
      readFileSync(
        "supabase/migrations/20261016055747_oil_intake_review_binding_v1_baseline.sql",
        "utf8",
      ),
    )
    await sql(
      readFileSync(
        "supabase/migrations/20261016055758_oil_intake_review_binding_v2_successor.sql",
        "utf8",
      ),
    )
    const d = detailFixture(),
      b = buildOilLabReviewPackage(d),
      s = b.intakeReviewSnapshot
    await sql(`INSERT INTO product_submissions VALUES('${d.id}','oil','ready_for_review',${literal(d.payload)});
 INSERT INTO product_intake_research_jobs(id,submission_id,status) VALUES('${d.job!.id}','${d.id}','waiting_for_review');`)
    for (const a of d.artifacts)
      await sql(
        `INSERT INTO product_intake_research_artifacts(id,submission_id,job_id,kind,status,payload) VALUES('${a.id}','${d.id}','${a.job_id}','${a.kind}','${a.status}',${literal(a.payload)});`,
      )
    const receipt = {
      version: "oil-lab-review-receipt-v2",
      packageFingerprint: b.packageFingerprint,
      snapshotFingerprint: b.snapshotFingerprint,
      reviewRevision: 1,
      approvedAt: new Date().toISOString(),
      receiptId: "b".repeat(64),
      approvedPropertyIds: [...OIL_CURRENT_REVIEW_PROPERTY_IDS],
      manualMatchingApproved: true,
    }
    const importSql = `SELECT product_intake_import_oil_lab_review('${d.id}',${literal(receipt)},${literal(s)},'${b.snapshotFingerprint}','${b.packageFingerprint}','${stableOilReviewJson(s).replaceAll("'", "''")}');`
    const publish = `SELECT product_intake_approve_reviewed_product('${d.id}',${literal(publicationFinal(s.normalizedFinal))},${literal(s.specOperations)},'nick');`
    const waiting = async () => {
      for (let i = 0; i < 80; i++) {
        if (
          (await sql(
            "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='oil-waiter' AND wait_event_type='Lock')",
          )) === "t"
        )
          return
        await setTimeout(25)
      }
      assert.fail("second session did not wait on database lock")
    }
    // Import holds the current job lock; a rework update waits, then invalidates publication.
    const importing = run(
      `BEGIN;SET ROLE service_role;${importSql} SELECT 'LOCK_BARRIER';SELECT pg_sleep(1.5);COMMIT;`,
    )
    await importing.barrier
    const rework = run(
      `SET application_name='oil-waiter'; UPDATE product_intake_research_jobs SET status='waiting_for_rework' WHERE id='${d.job!.id}';`,
    )
    await waiting()
    await importing.done
    await rework.done
    await assert.rejects(sql(importSql), /job or artifact/)
    await assert.rejects(sql(publish), /job or artifact/)
    assert.equal(await sql("SELECT count(*) FROM catalog_writes"), "0")
    await sql(`UPDATE product_intake_research_jobs SET status='waiting_for_review';
 INSERT INTO product_intake_research_artifacts(submission_id,job_id,kind,status,payload) VALUES('${d.id}','${d.job!.id}','processed_image','pending_review',${literal(publicationImage)});
 INSERT INTO product_intake_review_decisions(submission_id,job_id,field_path,decision,reviewed_by) VALUES('${d.id}','${d.job!.id}','final.image','image_approved','nick');
 SELECT product_intake_complete_oil_review('${d.id}');`)
    // A rework transaction winning the job lock forces publication to wait and reject.
    const editor = run(
      `BEGIN; UPDATE product_intake_research_jobs SET status='waiting_for_rework' WHERE id='${d.job!.id}'; SELECT 'LOCK_BARRIER';SELECT pg_sleep(1.5);COMMIT;`,
    )
    await editor.barrier
    const stale = run(`SET application_name='oil-waiter';SET ROLE service_role;${publish}`)
    const rejected = assert.rejects(stale.done, /job or artifact/)
    await waiting()
    await editor.done
    await rejected
    assert.equal(await sql("SELECT count(*) FROM catalog_writes"), "0")
    await sql("UPDATE product_intake_research_jobs SET status='waiting_for_review'")
    // Publication wins: downstream writes and the complete guard share one transaction.
    const publisher = run(
      `BEGIN;SET ROLE service_role;${publish} SELECT 'LOCK_BARRIER';SELECT pg_sleep(1.5);ROLLBACK;`,
    )
    await publisher.barrier
    const later = run(
      `SET application_name='oil-waiter';UPDATE product_intake_research_jobs SET status='waiting_for_rework';`,
    )
    await waiting()
    await publisher.done
    await later.done
    assert.equal(
      await sql("SELECT count(*) FROM catalog_writes"),
      "0",
      "publication rollback retains no downstream writes",
    )
    // A concurrent image rejection must serialize with the same publication lock.
    await sql("UPDATE product_intake_research_jobs SET status='waiting_for_review'")
    if (process.env.OIL_IMAGE_RACE_BASELINE === "1")
      await sql(
        "DROP TRIGGER oil_review_decision_submission_lock ON product_intake_review_decisions",
      )
    const rejectingImage = run(`BEGIN;
 INSERT INTO product_intake_review_decisions(submission_id,job_id,field_path,decision,reviewed_by) VALUES('${d.id}','${d.job!.id}','final.image','image_rejected','nick');
 SELECT 'LOCK_BARRIER';SELECT pg_sleep(3);COMMIT;`)
    await rejectingImage.barrier
    const publishingImage = run(
      `SET application_name='oil-waiter';SET ROLE service_role;${publish}`,
    )
    const imageOutcome = publishingImage.done.then(
      () => "published",
      (error: Error) => error.message,
    )
    await rejectingImage.done
    assert.match(
      await imageOutcome,
      /image and brand/,
      "concurrent rejected image must not publish",
    )
    assert.equal(await sql("SELECT count(*) FROM catalog_writes"), "0")
    // The reverse interleaving: publication owns the lock first, so a rejection
    // waits until its transaction has completed (rollback here preserves isolation).
    await sql("DELETE FROM product_intake_review_decisions WHERE decision='image_rejected'")
    const imagePublisher = run(
      `BEGIN;SET ROLE service_role;${publish} SELECT 'LOCK_BARRIER';SELECT pg_sleep(1.5);ROLLBACK;`,
    )
    await imagePublisher.barrier
    const laterRejection = run(
      `SET application_name='oil-waiter'; INSERT INTO product_intake_review_decisions(submission_id,job_id,field_path,decision,reviewed_by) VALUES('${d.id}','${d.job!.id}','final.image','image_rejected','nick');`,
    )
    await waiting()
    await imagePublisher.done
    await laterRejection.done
    assert.equal(await sql("SELECT count(*) FROM catalog_writes"), "0")
    for (const role of ["anon", "authenticated"])
      await assert.rejects(sql(`SET ROLE ${role};${importSql}`), /permission denied/)
  },
)
