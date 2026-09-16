import assert from "node:assert/strict"
import { createHmac, randomBytes } from "node:crypto"
import { spawn } from "node:child_process"
import { createServer } from "node:net"
import test from "node:test"
import { setTimeout } from "node:timers/promises"
import { createClient } from "@supabase/supabase-js"
import { ensurePayPalTrialAccountIdentity } from "../src/lib/paypal/checkout-activation"
import type { PayPalCheckoutIntentRow } from "../src/lib/paypal/checkout-intents"

// This uses a disposable PostgreSQL + GoTrue stack. It intentionally never reads
// local environment files: its JWT secret, network, ports and database all exist
// only for this test invocation.
const enabled = process.env.PAYPAL_TRIAL_IDENTITY_AUTH_TEST === "1"
const docker = ["--context", "colima-chaarlie"]
const lockKey = 781_429

function command(args: string[], input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", [...docker, ...args], { stdio: ["pipe", "pipe", "pipe"] })
    let output = ""
    let error = ""
    child.stdout.on("data", (chunk) => (output += chunk.toString()))
    child.stderr.on("data", (chunk) => (error += chunk.toString()))
    child.on("error", reject)
    child.on("close", (code) =>
      code === 0
        ? resolve(`${output}${error}`.trim())
        : reject(new Error(error || output || `docker exited ${code}`)),
    )
    child.stdin.end(input)
  })
}

async function removeOwned(args: string[]) {
  try {
    await command(args)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/no such (container|network)/i.test(message)) return
    throw error
  }
}

async function freePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("did not reserve a test port")
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
  return address.port
}

function serviceToken(secret: string) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url")
  const header = encode({ alg: "HS256", typ: "JWT" })
  const payload = encode({ role: "service_role", exp: Math.floor(Date.now() / 1000) + 3600 })
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url")
  return `${header}.${payload}.${signature}`
}

function intent(token: string, email: string): PayPalCheckoutIntentRow {
  return {
    id: "4a1d6e2c-4c61-4b3a-9675-cb3f0429f444",
    token,
    interval: "month",
    source: "pricing_page",
    lead_id: "1176763d-1c46-487a-86e7-51f2d554a6a9",
    email,
    user_id: null,
    reactivation_reservation_id: null,
    provider_subscription_id: "I-local-trial",
    status: "approved",
    duplicate_reason: null,
    expires_at: "2099-01-01T00:00:00.000Z",
    created_at: "2026-09-16T00:00:00.000Z",
    updated_at: "2026-09-16T00:00:00.000Z",
    metadata: { trial_enrollment_id: "enrollment-local" },
  }
}

test(
  "GoTrue concurrent create collision: trial identity converges only after its bounded post-error reread",
  { skip: !enabled, timeout: 120_000 },
  async (t) => {
    const suffix = randomBytes(6).toString("hex")
    const network = `chaarlie-paypal-auth-${suffix}`
    const postgres = `chaarlie-paypal-auth-pg-${suffix}`
    const gotrue = `chaarlie-paypal-auth-gotrue-${suffix}`
    const pgPort = await freePort()
    const authPort = await freePort()
    const jwtSecret = randomBytes(32).toString("hex")
    const email = `race-${suffix}@example.test`
    const activationToken = `checkout-${suffix}`

    t.after(async () => {
      // Docker refuses to remove a network while a stopped container remains
      // attached. Keep this ordered so cleanup errors are visible, rather than
      // leaving uniquely named disposable networks behind.
      await removeOwned(["rm", "--force", gotrue])
      await removeOwned(["rm", "--force", postgres])
      await removeOwned(["network", "rm", network])
    })

    await command(["network", "create", network])
    await command([
      "run",
      "--detach",
      "--name",
      postgres,
      "--network",
      network,
      "-p",
      `127.0.0.1:${pgPort}:5432`,
      "-e",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "postgres:17",
    ])
    for (let attempt = 0; ; attempt++) {
      try {
        await command(["exec", postgres, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"])
        break
      } catch (error) {
        if (attempt === 99) throw error
        await setTimeout(100)
      }
    }
    const sql = (statement: string) =>
      command(
        ["exec", "-i", postgres, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres"],
        statement,
      )

    // GoTrue's migrations create auth tables. Giving its dedicated role an auth-first
    // search_path is material: a bare postgres role otherwise resolves identities in
    // public and fails before the test reaches real Auth user creation.
    await sql(`
      CREATE SCHEMA auth;
      CREATE ROLE gotrue LOGIN PASSWORD 'local-gotrue';
      ALTER ROLE gotrue SET search_path = auth, public;
      GRANT ALL ON SCHEMA auth, public TO gotrue;
    `)
    await command([
      "run",
      "--detach",
      "--name",
      gotrue,
      "--network",
      network,
      "-p",
      `127.0.0.1:${authPort}:9999`,
      "-e",
      "GOTRUE_API_HOST=0.0.0.0",
      "-e",
      "GOTRUE_API_PORT=9999",
      "-e",
      `GOTRUE_API_EXTERNAL_URL=http://127.0.0.1:${authPort}`,
      "-e",
      `API_EXTERNAL_URL=http://127.0.0.1:${authPort}`,
      "-e",
      "GOTRUE_DB_DRIVER=postgres",
      "-e",
      `GOTRUE_DB_DATABASE_URL=postgres://gotrue:local-gotrue@${postgres}:5432/postgres?application_name=paypal_trial_auth_race`,
      "-e",
      `GOTRUE_JWT_SECRET=${jwtSecret}`,
      "-e",
      "GOTRUE_JWT_ADMIN_ROLES=service_role",
      "-e",
      "GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated",
      "-e",
      "GOTRUE_SITE_URL=http://localhost",
      "-e",
      "GOTRUE_MAILER_AUTOCONFIRM=true",
      "public.ecr.aws/supabase/gotrue:v2.188.1",
    ])
    for (let attempt = 0; ; attempt++) {
      try {
        const health = await fetch(`http://127.0.0.1:${authPort}/health`)
        if (!health.ok) throw new Error(`GoTrue health returned ${health.status}`)
        break
      } catch (error) {
        if (attempt === 99) {
          const logs = await command(["logs", gotrue]).catch((failure) => String(failure))
          const state = await command([
            "inspect",
            gotrue,
            "--format",
            "{{.State.Status}} {{.State.Error}}",
          ]).catch((failure) => String(failure))
          throw new Error(
            `GoTrue did not become healthy: ${String(error)}\nstate=${state}\n${logs}`,
          )
        }
        await setTimeout(100)
      }
    }

    await sql(`
      CREATE TABLE public.profiles (
        id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
        email text,
        full_name text,
        avatar_url text
      );
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      BEGIN
        INSERT INTO public.profiles (id, email, full_name, avatar_url)
        VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'avatar_url');
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
      CREATE OR REPLACE FUNCTION auth.block_trial_test_user_insert()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.email = '${email}' THEN PERFORM pg_advisory_xact_lock(${lockKey}); END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER block_trial_test_user_insert BEFORE INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION auth.block_trial_test_user_insert();
    `)

    const token = serviceToken(jwtSecret)
    // GoTrue is exposed directly here, while supabase-js normally targets a gateway
    // at /auth/v1. The transport rewrite preserves actual SDK admin request shaping.
    const auth = createClient(`http://127.0.0.1:${authPort}`, token, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (url, init) => {
          const rewritten = new URL(url.toString())
          rewritten.pathname = rewritten.pathname.replace(/^\/auth\/v1/, "") || "/"
          return fetch(rewritten, init)
        },
      },
    })

    const profileAdapter = {
      from(table: string) {
        assert.equal(table, "profiles")
        return {
          select() {
            return {
              eq(column: string, value: string) {
                assert.equal(column, "email")
                assert.equal(value, email)
                return {
                  async maybeSingle() {
                    const row = await sql(
                      `SELECT coalesce(json_agg(x), '[]') FROM (SELECT id::text, email FROM public.profiles WHERE email='${email}') x`,
                    )
                    const rows = JSON.parse(row) as Array<{ id: string; email: string }>
                    return { data: rows[0] ?? null, error: null }
                  },
                }
              },
            }
          },
          async upsert(row: { id: string; email: string }) {
            await sql(
              `INSERT INTO public.profiles(id,email) VALUES('${row.id}','${row.email}') ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email`,
            )
            return { error: null }
          },
        }
      },
      auth: auth.auth,
    }

    const coordinator = spawn(
      "docker",
      [...docker, "exec", "-i", postgres, "psql", "-X", "-qAt", "-U", "postgres"],
      { stdio: ["pipe", "pipe", "pipe"] },
    )
    let coordinatorOutput = ""
    coordinator.stdout.on("data", (chunk) => (coordinatorOutput += chunk.toString()))
    coordinator.stdin.write(`BEGIN; SELECT pg_advisory_lock(${lockKey}); SELECT 'LOCKED';\n`)
    for (let attempt = 0; !coordinatorOutput.includes("LOCKED"); attempt++) {
      if (attempt === 99) throw new Error("test coordinator did not acquire advisory lock")
      await setTimeout(25)
    }

    const calls = [
      ensurePayPalTrialAccountIdentity(
        intent(activationToken, email),
        {
          supabase: profileAdapter as any,
          premiumTierId: "tier-local",
        },
        null,
      ),
      ensurePayPalTrialAccountIdentity(
        intent(activationToken, email),
        {
          supabase: profileAdapter as any,
          premiumTierId: "tier-local",
        },
        null,
      ),
    ]
    let blocked = false
    for (let attempt = 0; attempt < 100; attempt++) {
      const waiting = await sql(`SELECT count(*) FROM pg_stat_activity
        WHERE application_name='paypal_trial_auth_race' AND wait_event_type='Lock'
        AND cardinality(pg_blocking_pids(pid)) > 0`)
      if (waiting === "2") {
        blocked = true
        break
      }
      await setTimeout(25)
    }
    assert.equal(blocked, true, "both GoTrue inserts were observed blocked by the coordinator lock")
    coordinator.stdin.end("COMMIT;\n")
    await new Promise<void>((resolve, reject) =>
      coordinator.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error("coordinator failed")),
      ),
    )

    const settled = await Promise.allSettled(calls)
    const failures = settled
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) =>
        result.reason instanceof Error ? result.reason.message : String(result.reason),
      )
    assert.equal(
      settled.filter((result) => result.status === "fulfilled").length,
      2,
      `real GoTrue race must converge: ${failures.join("; ")}`,
    )
    const results = settled.map((result) => {
      if (result.status !== "fulfilled") throw result.reason
      return result.value
    })
    assert.equal(results[0].userId, results[1].userId)
    assert.equal(results[0].canSetInitialPassword, true)
    assert.equal(results[1].canSetInitialPassword, true)
    const users = await sql(`SELECT count(*) FROM auth.users WHERE email='${email}'`)
    const profiles = await sql(`SELECT count(*) FROM public.profiles WHERE email='${email}'`)
    assert.equal(users, "1")
    assert.equal(profiles, "1")
  },
)
