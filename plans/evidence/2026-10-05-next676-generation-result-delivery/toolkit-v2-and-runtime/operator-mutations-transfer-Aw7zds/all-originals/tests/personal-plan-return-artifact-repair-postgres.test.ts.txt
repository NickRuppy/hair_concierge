import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { setTimeout } from "node:timers/promises"

const enabled = process.env.PERSONAL_PLAN_RETURN_REPAIR_POSTGRES_TEST === "1"
function command(args: string[], input = "") {
  const child = spawn("docker", ["--context", "colima-chaarlie", ...args], {
    stdio: ["pipe", "pipe", "pipe"],
  })
  let output = "",
    error = ""
  let reached!: () => void
  const barrier = new Promise<void>((resolve) => {
    reached = resolve
  })
  const done = new Promise<string>((resolve, reject) => {
    child.stdout.on("data", (chunk) => {
      output += chunk.toString()
      if (output.includes("LOCK_BARRIER")) reached()
    })
    child.stderr.on("data", (chunk) => {
      error += chunk.toString()
    })
    child.on("error", reject)
    child.on("close", (code) => (code === 0 ? resolve(output.trim()) : reject(new Error(error))))
  })
  child.stdin.end(input)
  return { done, barrier }
}

test(
  "real PostgreSQL serializes parallel repairs and rejects a concurrent source change",
  {
    skip: !enabled,
    timeout: 60000,
  },
  async (t) => {
    const container = `chaarlie-return-repair-${crypto.randomUUID()}`
    await command([
      "run",
      "--rm",
      "--detach",
      "--name",
      container,
      "-e",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "postgres:17",
    ]).done
    t.after(async () => {
      await command(["rm", "--force", container]).done
    })
    for (let attempt = 0; ; attempt++) {
      try {
        await command(["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]).done
        break
      } catch (error) {
        if (attempt >= 99) throw error
        await setTimeout(100)
      }
    }
    const run = (sql: string) =>
      command(
        ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres"],
        sql,
      )
    const sql = (statement: string) => run(statement).done
    const user = "22222222-2222-4222-8222-222222222222"
    const lead = "11111111-1111-4111-8111-111111111111"
    const answers = `' {"kind":"personal_plan","version":3,"answers":{}}'::jsonb`
    await sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE public.leads(id uuid PRIMARY KEY, user_id uuid, quiz_kind text, quiz_answers jsonb);
    CREATE TABLE public.personal_plan_need_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, prepared_artifact_source_id uuid);
    GRANT SELECT, UPDATE ON public.leads TO service_role;
    GRANT SELECT, INSERT ON public.personal_plan_need_versions TO service_role;
    INSERT INTO auth.users VALUES('${user}');
    INSERT INTO public.leads VALUES('${lead}','${user}','personal_plan',${answers});`)
    for (const file of [
      "20260728130000_add_personal_plan_prepared_artifacts",
      "20260918182402_repair_return_personal_plan_artifact",
    ]) {
      await sql(readFileSync(`supabase/migrations/${file}.sql`, "utf8"))
    }
    const repair = `SELECT status FROM public.repair_return_personal_plan_artifact(
    '${lead}','${user}',${answers},repeat('a',64),repeat('b',64),
    '{"modelVersion":"personal_plan_canonical_v1"}','{}','[]','{}',
    '{"modelVersion":"personal_plan_offer_v2"}','{"modelVersion":"personal_plan_locked_v1"}');`
    for (const role of ["anon", "authenticated"]) {
      await assert.rejects(sql(`SET ROLE ${role}; ${repair}`), /permission denied/)
    }
    const assertWaiting = async () => {
      for (let attempt = 0; attempt < 40; attempt++) {
        const waiting = await sql(
          "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='repair-waiter' AND wait_event_type='Lock');",
        )
        if (waiting === "t") return
        await setTimeout(25)
      }
      assert.fail("second connection did not wait for the lead lock")
    }
    const first = run(
      `BEGIN; SET ROLE service_role; ${repair} SELECT 'LOCK_BARRIER'; SELECT pg_sleep(2); COMMIT;`,
    )
    await first.barrier
    const second = run(`SET application_name='repair-waiter'; SET ROLE service_role; ${repair}`)
    await assertWaiting()
    assert.match(await first.done, /repaired/)
    assert.equal(await second.done, "already_present")
    assert.equal(await sql("SELECT count(*) FROM personal_plan_prepared_artifacts"), "1")

    const editor =
      run(`BEGIN; UPDATE public.leads SET quiz_answers=jsonb_set(quiz_answers,'{version}','2');
    SELECT 'LOCK_BARRIER'; SELECT pg_sleep(2); COMMIT;`)
    await editor.barrier
    const stale = run(`SET application_name='repair-waiter'; SET ROLE service_role; ${repair}`)
    await assertWaiting()
    await editor.done
    assert.equal(await stale.done, "conflict")
    assert.equal(await sql("SELECT count(*) FROM personal_plan_prepared_artifacts"), "1")

    // A cumulative missing-fact repair must serialize against Stage1 in both orders.
    const oldId = await sql(
      "SELECT id FROM personal_plan_prepared_artifacts WHERE status='attached'",
    )
    const completeAnswers = `'{"kind":"personal_plan","version":3,"answers":{"hairLength":"long","texture":"curly"}}'::jsonb`
    await sql(`UPDATE leads SET quiz_answers=${completeAnswers};`)
    const completeRepair = repair
      .replace(answers, completeAnswers)
      .replace("repeat('b',64)", "repeat('c',64)")
    const stageInsert = `INSERT INTO personal_plan_need_versions(user_id,prepared_artifact_source_id) VALUES('${user}','${oldId}');`
    const stageFirst = run(
      `BEGIN; SET ROLE service_role; ${stageInsert} SELECT 'LOCK_BARRIER'; SELECT pg_sleep(2); COMMIT;`,
    )
    await stageFirst.barrier
    const repairSecond = run(
      `SET application_name='repair-waiter'; SET ROLE service_role; ${completeRepair}`,
    )
    await assertWaiting()
    await stageFirst.done
    assert.equal(await repairSecond.done, "conflict")
    await sql("DELETE FROM personal_plan_need_versions")

    const repairFirst = run(
      `BEGIN; SET ROLE service_role; ${completeRepair} SELECT 'LOCK_BARRIER'; SELECT pg_sleep(2); COMMIT;`,
    )
    await repairFirst.barrier
    const stageSecond = run(
      `SET application_name='repair-waiter'; SET ROLE service_role; ${stageInsert}`,
    )
    const rejectedStage = assert.rejects(stageSecond.done, /not an attached owner source/)
    await assertWaiting()
    assert.match(await repairFirst.done, /repaired/)
    await rejectedStage
    assert.equal(
      await sql("SELECT count(*) FROM personal_plan_prepared_artifacts WHERE status='attached'"),
      "1",
    )
    assert.equal(
      await sql(
        "SELECT count(*) FROM personal_plan_prepared_artifacts WHERE status='superseded' AND retained_for_return_repair",
      ),
      "1",
    )
    assert.equal(await sql("SELECT count(*) FROM personal_plan_need_versions"), "0")
  },
)
