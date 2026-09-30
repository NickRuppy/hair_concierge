/**
 * The disposable PostgreSQL both Docker two-session proofs run on (clean-switch task 7B): a
 * network-isolated `postgres:17` container, a fresh database per run, and the REAL migration
 * chain the PGlite harnesses replay — personal-plan foundation … `user_facts_save_v1`, the mobile
 * scanner / edit / registration migrations, the two clean-switch migrations and (optionally)
 * the lock — so a proof exercises exactly the SQL production runs, not a hand-written schema.
 * Never targets the active local stack or any remote database.
 */
import assert from "node:assert/strict"
import { execFile, spawn } from "node:child_process"
import { readFile } from "node:fs/promises"
import { promisify } from "node:util"

import {
  CLEAN_SWITCH_MIGRATIONS,
  MOBILE_MIGRATIONS,
  MOBILE_STUBS,
} from "../../tests/mobile-profile-facts-pglite.fixtures"
import {
  PERSONAL_PLAN_MIGRATIONS,
  PERSONAL_PLAN_STUB_PREREQUISITES,
  USER_FACTS_LOCK_MIGRATION,
} from "../../tests/personal-plan-pglite-migration.fixtures"

const exec = promisify(execFile)

export const docker = "/opt/homebrew/bin/docker"
export const dockerArgs = ["--host", "unix:///Users/nick/.colima/chaarlie/docker.sock"]
export const proofContainer = "chaarlie-hosted-profile-proof"

export const literal = (value: unknown) =>
  value === null || value === undefined
    ? "NULL"
    : `'${(typeof value === "object" ? JSON.stringify(value) : String(value)).replaceAll("'", "''")}'`

/** A call in named-argument notation, so no signature list can drift from the migrations. */
export function namedCallSql(name: string, args: Record<string, unknown>): string {
  const entries = Object.entries(args).filter(([, value]) => value !== undefined)
  return `SELECT public.${name}(${entries.map(([key, value]) => `${key} => ${literal(value)}`).join(",")});`
}

export function psqlArgs(database: string) {
  return [
    ...dockerArgs,
    "exec",
    "-i",
    proofContainer,
    "psql",
    "-X",
    "-U",
    "postgres",
    "-d",
    database,
    "-Atq",
    "-v",
    "ON_ERROR_STOP=1",
  ]
}

export function proofSql(database: string) {
  return async function sql(query: string): Promise<string> {
    const child = spawn(docker, psqlArgs(database), { stdio: ["pipe", "pipe", "pipe"] })
    let out = "",
      err = ""
    child.stdout.on("data", (chunk) => (out += chunk))
    child.stderr.on("data", (chunk) => (err += chunk))
    child.stdin.end(query)
    await new Promise<void>((resolve, reject) => {
      child.on("error", reject)
      child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(err))))
    })
    return out.trim()
  }
}

const ROLE_LINES = ["CREATE ROLE anon;", "CREATE ROLE authenticated;", "CREATE ROLE service_role;"]

/** Refuses anything but the isolated proof container, starts it, and builds `database` fresh. */
export async function createProofDatabase(database: string, options: { lock: boolean }) {
  const inspected = JSON.parse(
    (await exec(docker, [...dockerArgs, "inspect", proofContainer])).stdout,
  )[0]
  assert.equal(inspected.HostConfig.NetworkMode, "none", "proof container must have no network")
  assert.equal(Object.keys(inspected.HostConfig.PortBindings ?? {}).length, 0)
  assert.equal(inspected.Config.Image, "postgres:17")
  if (!inspected.State.Running) {
    await exec(docker, [...dockerArgs, "start", proofContainer])
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const ready = await exec(docker, [
        ...dockerArgs,
        "exec",
        proofContainer,
        "pg_isready",
        "-U",
        "postgres",
      ]).then(
        () => true,
        () => false,
      )
      if (ready) break
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }
  const admin = proofSql("postgres")
  await admin(`DROP DATABASE IF EXISTS ${database} WITH (FORCE);`)
  await admin(`CREATE DATABASE ${database};`)
  // Roles are cluster-wide: create them once, and replay the stub without its CREATE ROLE lines.
  await admin(
    `DO $$ BEGIN ${["anon", "authenticated", "service_role"]
      .map(
        (role) =>
          `IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${role}') THEN CREATE ROLE ${role}; END IF;`,
      )
      .join(" ")} END $$;`,
  )
  let stub = PERSONAL_PLAN_STUB_PREREQUISITES
  for (const line of ROLE_LINES) {
    assert.ok(stub.includes(line), `stub drifted: ${line}`)
    stub = stub.replace(line, "")
  }
  const sql = proofSql(database)
  await sql(stub)
  const root = new URL("../../", import.meta.url)
  for (const file of PERSONAL_PLAN_MIGRATIONS)
    await sql(await readFile(new URL(file, root), "utf8"))
  await sql(MOBILE_STUBS)
  for (const file of [...MOBILE_MIGRATIONS, ...CLEAN_SWITCH_MIGRATIONS]) {
    await sql(await readFile(new URL(file, root), "utf8"))
  }
  if (options.lock) await applyProofLock(database)
  return sql
}

/** The lock migration, applied last — after any legacy seed, exactly the rollout order. */
export async function applyProofLock(database: string) {
  const root = new URL("../../", import.meta.url)
  await proofSql(database)(await readFile(new URL(USER_FACTS_LOCK_MIGRATION, root), "utf8"))
}
