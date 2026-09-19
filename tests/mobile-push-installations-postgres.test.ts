import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { setTimeout } from "node:timers/promises"

const enabled = process.env.MOBILE_PUSH_POSTGRES_TEST === "1"
const migration = readFileSync(
  "supabase/migrations/20260919130529_mobile_push_installations.sql",
  "utf8",
)
const owner = "11111111-1111-4111-8111-111111111111"
const other = "22222222-2222-4222-8222-222222222222"
const installation = "33333333-3333-4333-8333-333333333333"
const otherInstallation = "44444444-4444-4444-8444-444444444444"
const token = "ab".repeat(32)

function docker(args: string[], input?: string): Promise<string> {
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
  "real PostgreSQL serializes a concurrent APNs token rebind to one latest owner",
  { skip: !enabled, timeout: 60000 },
  async (t) => {
    const container = `chaarlie-mobile-push-${crypto.randomUUID()}`
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
        if (attempt === 99) throw error
        await setTimeout(100)
      }
    }
    const sql = (input: string) =>
      docker(
        ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres"],
        input,
      )
    await sql(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA private; GRANT USAGE ON SCHEMA private TO service_role;
      CREATE TABLE public.profiles(id uuid PRIMARY KEY);
      INSERT INTO public.profiles VALUES ('${owner}'), ('${other}');
      ${migration}
    `)
    const first = sql(`
      SET ROLE service_role; BEGIN;
      SELECT mobile_push_installation_register('${owner}','${installation}','${token}','sandbox','de.chaarlie.app');
      SELECT pg_sleep(0.4); COMMIT;
    `)
    await setTimeout(75)
    const second = sql(`
      SET ROLE service_role;
      SELECT mobile_push_installation_register('${other}','${otherInstallation}','${token}','production','de.chaarlie.app');
    `)
    await Promise.all([first, second])
    assert.equal(
      await sql(
        "SET ROLE service_role; SELECT user_id || ',' || installation_id || ',' || environment FROM private.mobile_push_installations;",
      ),
      `${other},${otherInstallation},production`,
    )
  },
)
