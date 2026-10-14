import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { setTimeout } from "node:timers/promises"

const enabled = process.env.QUIZ_EMAIL_RETURN_POSTGRES_TEST === "1"

function docker(args: string[], input = "") {
  const child = spawn("docker", ["--context", "colima-chaarlie", ...args], {
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
  child.stdin.end(input)
  return new Promise<string>((resolve, reject) => {
    child.on("error", reject)
    child.on("close", (code) => (code === 0 ? resolve(output.trim()) : reject(new Error(error))))
  })
}

test(
  "real PostgreSQL enforces email-return link expiry, revocation and service-only access",
  {
    skip: !enabled,
    timeout: 60000,
  },
  async (t) => {
    const container = `chaarlie-email-return-${crypto.randomUUID()}`
    await docker([
      "run",
      "--rm",
      "--detach",
      "--name",
      container,
      "-e",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "postgres:17",
    ])
    t.after(async () => {
      await docker(["rm", "--force", container])
    })
    for (let attempt = 0; ; attempt++) {
      try {
        await docker(["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"])
        break
      } catch (error) {
        if (attempt >= 99) throw error
        await setTimeout(100)
      }
    }
    const sql = (statement: string) =>
      docker(
        ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres"],
        statement,
      )
    await sql(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE public.leads(id uuid PRIMARY KEY, quiz_kind text, quiz_answers jsonb);
    INSERT INTO public.leads VALUES
      ('11111111-1111-4111-8111-111111111111','legacy','{"structure":"wavy"}');
  `)
    await sql(
      readFileSync("supabase/migrations/20260918180721_quiz_email_return_links.sql", "utf8"),
    )
    const link = "22222222-2222-4222-8222-222222222222"
    const lead = "11111111-1111-4111-8111-111111111111"
    const hash = "a".repeat(64)
    await sql(`INSERT INTO public.quiz_email_return_links
    (id, token_hash, source_lead_id, campaign_key, package_key, expires_at)
    VALUES ('${link}', '${hash}', '${lead}', 'return_test',
            'customerio_scan_return_v1', now() + interval '1 day');`)

    const byHash = `SELECT lead_id FROM public.resolve_quiz_email_return_link('${hash}');`
    const byId = `SELECT lead_id FROM public.resolve_quiz_email_return_link_by_id('${link}');`
    assert.equal(await sql(`SET ROLE service_role; ${byHash}`), lead)
    assert.equal(await sql(`SET ROLE service_role; ${byId}`), lead)
    await assert.rejects(sql(`SET ROLE anon; ${byHash}`), /permission denied/)
    await assert.rejects(sql(`SET ROLE authenticated; ${byId}`), /permission denied/)
    await assert.rejects(
      sql("SET ROLE anon; SELECT id FROM public.quiz_email_return_links;"),
      /permission denied/,
    )

    await sql(`UPDATE public.quiz_email_return_links SET revoked_at = now() WHERE id = '${link}';`)
    assert.equal(await sql(`SET ROLE service_role; ${byHash}`), "")
    await sql(`UPDATE public.quiz_email_return_links
    SET revoked_at = NULL, created_at = now() - interval '2 days',
        expires_at = now() - interval '1 day' WHERE id = '${link}';`)
    assert.equal(await sql(`SET ROLE service_role; ${byId}`), "")
  },
)
