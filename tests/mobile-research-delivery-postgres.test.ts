import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { setTimeout } from "node:timers/promises"

const enabled = process.env.MOBILE_RESEARCH_POSTGRES_TEST === "1"
const migration = readFileSync(
  "supabase/migrations/20260919130507_mobile_research_delivery_intent.sql",
  "utf8",
)
const owner = "11111111-1111-4111-8111-111111111111"
const submission = "33333333-3333-4333-8333-333333333333"
const product = "66666666-6666-4666-8666-666666666666"

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
  "real PostgreSQL concurrent mobile intent and approval enqueue exactly once",
  { skip: !enabled, timeout: 60000 },
  async (t) => {
    const container = `chaarlie-mobile-delivery-${crypto.randomUUID()}`
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
      CREATE TABLE public.product_submissions(
        id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        source text NOT NULL, scanned_identifier_value text, status text NOT NULL,
        approved_product_id uuid
      );
      GRANT SELECT, UPDATE ON public.product_submissions TO service_role;
      INSERT INTO profiles VALUES ('${owner}');
      INSERT INTO product_submissions VALUES ('${submission}','${owner}','scan','4012345678901','pending_review',NULL);
      ${migration}
    `)
    const approval = sql(`
      BEGIN;
      UPDATE product_submissions SET status='approved',approved_product_id='${product}' WHERE id='${submission}';
      SELECT pg_sleep(0.4);
      COMMIT;
    `)
    await setTimeout(75)
    const intent = sql(`SELECT mobile_research_request_result('${owner}','${submission}');`)
    const [, marked] = await Promise.all([approval, intent])
    assert.equal(marked, "t")
    assert.equal(await sql("SELECT count(*) FROM private.mobile_research_delivery_candidates"), "1")
    const [first, second] = await Promise.all([
      sql("SELECT jsonb_array_length(claim_mobile_research_delivery_candidates(1));"),
      sql("SELECT jsonb_array_length(claim_mobile_research_delivery_candidates(1));"),
    ])
    assert.deepEqual([first, second].sort(), ["0", "1"])
  },
)
