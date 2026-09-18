import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { setTimeout } from "node:timers/promises"
import {
  submitMobileScan,
  type MobileScanSubmitDependencies,
} from "../src/lib/mobile/scan-submit-service"
import { submitScanProductIntake } from "../src/lib/product-intake/submissions"

const enabled = process.env.MOBILE_HISTORY_POSTGRES_TEST === "1"
function command(args: string[], input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["--context", "colima-chaarlie", ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    })
    let output = "",
      error = ""
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
  "real PostgreSQL: parallel history scan/search writes merge atomically, clear leaves research, and client grants fail closed",
  { skip: !enabled, timeout: 120000 },
  async (t) => {
    const container = `chaarlie-mobile-history-${crypto.randomUUID()}`
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
    for (let attempt = 0; ; attempt++) {
      try {
        await command(["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"])
        break
      } catch (error) {
        if (attempt === 99) throw error
        await setTimeout(100)
      }
    }
    const sql = (statement: string) =>
      command(
        ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres"],
        statement,
      )
    const owner = "11111111-1111-4111-8111-111111111111",
      other = "22222222-2222-4222-8222-222222222222",
      product = "33333333-3333-4333-8333-333333333333"
    await sql(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE profiles(id uuid PRIMARY KEY);
    CREATE TABLE products(id uuid PRIMARY KEY);
    CREATE TABLE product_submissions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,source text,scanned_identifier_value text,status text);
    CREATE TABLE product_identifiers(product_id uuid,canonical_gtin14 text);
    INSERT INTO profiles VALUES('${owner}'),('${other}'); INSERT INTO products VALUES('${product}');
    INSERT INTO product_identifiers VALUES('${product}','04012345678901');
    GRANT SELECT ON products,product_identifiers,product_submissions TO service_role;
  `)
    await sql(
      readFileSync(
        "supabase/migrations/20260826142000_product_identifier_canonical_gtin_expand.sql",
        "utf8",
      ).split("ALTER TABLE public.product_identifiers")[0],
    )
    await sql(readFileSync("supabase/migrations/20260918181303_mobile_scan_history.sql", "utf8"))
    await sql(
      readFileSync(
        "supabase/migrations/20260820103000_product_submissions_one_open_scan.sql",
        "utf8",
      ),
    )
    const touch = (barcode: string | null, productId: string | null) =>
      `SELECT mobile_scan_history_touch('${owner}',${barcode ? `'${barcode}'` : "NULL"},${productId ? `'${productId}'` : "NULL"},NULL);`
    async function race(first: string, second: string) {
      const a = sql(
        `SET application_name='history-first'; BEGIN; ${first} SELECT pg_sleep(0.6); COMMIT;`,
      )
      // Observe the first transaction holding its real lock before starting session B.
      for (let attempt = 0; ; attempt++) {
        if (
          (await sql(
            "SELECT count(*) FROM pg_stat_activity WHERE application_name='history-first' AND wait_event='PgSleep'",
          )) === "1"
        )
          break
        if (attempt === 60) throw new Error("first session did not acquire lock")
        await setTimeout(10)
      }
      const b = sql(second)
      await Promise.all([a, b])
    }
    await race(touch(null, product), touch("4012345678901", product))
    assert.equal(
      await sql("SELECT count(*)||':'||count(barcode_ean) FROM mobile_scan_history"),
      "1:1",
    )
    await sql("DELETE FROM mobile_scan_history")
    await race(touch("4012345678901", null), touch(null, product))
    assert.equal(
      await sql("SELECT count(*)||':'||count(product_id) FROM mobile_scan_history"),
      "1:1",
    )
    const before = await sql("SELECT last_seen_at FROM mobile_scan_history")
    await race(touch("4012345678901", product), touch("4012345678901", product))
    assert.equal(await sql("SELECT count(*) FROM mobile_scan_history"), "1")
    assert.ok(
      new Date(await sql("SELECT last_seen_at FROM mobile_scan_history")) >= new Date(before),
    )
    await race(touch("4006381333931", product), touch(null, product))
    assert.equal(
      await sql("SELECT count(*)||':'||count(barcode_ean) FROM mobile_scan_history"),
      "2:2",
    )
    // Existing intake unique index remains the arbiter for canonical mobile spelling.
    const insert = `INSERT INTO product_submissions(user_id,source,scanned_identifier_value,status) VALUES('${owner}','scan','4012345678901','pending_review');`
    const results = await Promise.allSettled([sql(insert), sql(insert)])
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1)
    assert.match(
      String(
        (results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason,
      ),
      /idx_product_submissions_one_open_scan/,
    )
    const submitDeps: Partial<MobileScanSubmitDependencies> = {
      loadProfile: async () => ({ status: "ready", context: {} }) as never,
      findOpen: async () => null,
      // This test owns History concurrency; the durable research-intent RPC
      // is exercised against PostgreSQL in mobile-research-delivery-postgres.
      markMobileResultRequested: async () => {},
      // Real shared get-or-create function, with repository IO backed by separate
      // PostgreSQL connections and the real existing scan-submission unique index.
      submit: submitScanProductIntake,
      createRepository: () =>
        ({
          loadCatalog: async () => ({ products: [], identifiers: [] }),
          loadBrandResolutionCatalog: async () => ({ brands: [] }),
          insertProductSubmission: async (row: {
            id: string
            user_id: string
            scanned_identifier_value: string
          }) => {
            await sql(
              `INSERT INTO product_submissions(id,user_id,source,scanned_identifier_value,status) VALUES('${row.id}','${row.user_id}','scan','${row.scanned_identifier_value}','pending_review')`,
            )
            return { id: row.id }
          },
          findOpenScanSubmissionByIdentifier: async () => ({
            id: await sql(
              `SELECT id FROM product_submissions WHERE user_id='${owner}' AND scanned_identifier_value='0000096385074'`,
            ),
          }),
        }) as never,
      save: async (_client, userId, barcode, _productId, submissionId) => {
        await sql(
          `SELECT mobile_scan_history_touch('${userId}','${barcode}',NULL,'${submissionId}')`,
        )
        return true
      },
    }
    const mobileResults = await Promise.all(
      ["96385074", "0000096385074"].map((value) =>
        submitMobileScan(
          {} as never,
          owner,
          { identifier: { type: "ean", value }, category: "shampoo" },
          submitDeps,
        ),
      ),
    )
    assert.equal(mobileResults[0].kind, "pending_submission")
    assert.deepEqual(mobileResults[0], mobileResults[1])
    assert.equal(
      await sql(
        "SELECT count(*) FROM product_submissions WHERE scanned_identifier_value='0000096385074'",
      ),
      "1",
    )
    assert.equal(
      await sql("SELECT count(*) FROM mobile_scan_history WHERE barcode_gtin14='00000096385074'"),
      "1",
    )
    await sql(`SET ROLE service_role; SELECT mobile_scan_history_clear('${owner}');`)
    assert.equal(await sql("SELECT count(*) FROM mobile_scan_history"), "0")
    assert.equal(await sql("SELECT count(*) FROM product_submissions"), "2")
    await sql(touch("4012345678901", null))
    assert.equal(
      await sql(
        `SET ROLE authenticated; SET request.jwt.claim.sub='${other}'; SELECT count(*) FROM mobile_scan_history;`,
      ),
      "0",
    )
    await assert.rejects(
      sql(`SET ROLE authenticated; ${touch("4012345678901", null)}`),
      /permission denied/,
    )
    await assert.rejects(
      sql("SET ROLE anon; SELECT * FROM mobile_scan_history;"),
      /permission denied/,
    )
    await sql(`DELETE FROM profiles WHERE id='${owner}'`)
    assert.equal(await sql("SELECT count(*) FROM mobile_scan_history"), "0")
  },
)
