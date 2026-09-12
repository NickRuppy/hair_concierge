import {
  cpSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  existsSync,
  renameSync,
} from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)))
export const stack = resolve(root, "tmp/mobile-stack")
const cli =
  process.env.MOBILE_SUPABASE_CLI ||
  "/Users/nick/AI_work/hair_conscierge/node_modules/.bin/supabase"
const env = {
  PATH: "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin",
  HOME: process.env.HOME,
  DOCKER_HOST: "unix:///Users/nick/.colima/chaarlie/docker.sock",
  SUPABASE_TELEMETRY_DISABLED: "true",
}
function run(args, capture = false) {
  const result = spawnSync(cli, ["--workdir", stack, ...args], {
    cwd: root,
    env,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  })
  if (result.status !== 0)
    throw new Error("Local Supabase command failed; inspect sanitized CLI output")
  return result.stdout
}

export function loadLocalEnvironment() {
  const value = JSON.parse(readFileSync(resolve(stack, "environment.json"), "utf8"))
  if (
    value.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:54321" ||
    value.MOBILE_API_ENABLED !== "true"
  )
    throw new Error("Refusing non-local mobile environment")
  return value
}

const command = process.argv[2]
if (command === "prepare") {
  mkdirSync(resolve(stack, "supabase/templates"), { recursive: true })
  cpSync(resolve(root, "scripts/mobile/config.toml"), resolve(stack, "supabase/config.toml"))
  cpSync(
    resolve(root, "scripts/mobile/mobile-login.html"),
    resolve(stack, "supabase/templates/mobile-login.html"),
  )
  cpSync(resolve(root, "supabase/migrations"), resolve(stack, "supabase/migrations"), {
    recursive: true,
  })
  cpSync(
    resolve(root, "scripts/mobile/legacy-local-baseline.sql"),
    resolve(stack, "supabase/migrations/00002_local_legacy_baseline.sql"),
  )
  cpSync(
    resolve(root, "scripts/mobile/legacy-local-rls.sql"),
    resolve(stack, "supabase/migrations/00003_local_legacy_rls.sql"),
  )
  // Historical data corrections depend on curated rows absent from repository seeds.
  // Keep their version visible while omitting only reviewed DML in this local stack.
  for (const file of [
    "20260609204000_hai_124_product_metadata_corrections.sql",
    "20260810203501_personal_plan_mask_catalog_identity_corrections.sql",
    "20260814121000_personal_plan_leave_in_use_case_coverage.sql",
    "20260817121500_shampoo_coarse_oily_monday_coverage.sql",
    "20260901090000_k18_molecular_repair_hair_mist_readiness.sql",
    "20260901160000_personal_plan_stage5_v2_oil_authority_reconciliation.sql",
  ]) {
    const sql = readFileSync(resolve(root, "supabase/migrations", file), "utf8")
    if (/^\s*(CREATE|ALTER|DROP|GRANT|REVOKE)\s/im.test(sql))
      throw new Error("Excluded historical data migration now contains schema changes: " + file)
    writeFileSync(
      resolve(stack, "supabase/migrations", file),
      "-- Local only: historical catalog DML omitted; absent curated source rows.\nSELECT 1;\n",
    )
  }
  const closure = "20260813085151_personal_plan_catalog_closure.sql"
  const closureSQL = readFileSync(resolve(root, "supabase/migrations", closure), "utf8")
  const retirement = /DO \$retire_no0\$[\s\S]*?\$retire_no0\$;/
  const retirementSQL = closureSQL.match(retirement)?.[0]
  if (!retirementSQL || /^\s*(CREATE|ALTER|DROP|GRANT|REVOKE)\s/im.test(retirementSQL))
    throw new Error("Historical catalog retirement block changed")
  writeFileSync(
    resolve(stack, "supabase/migrations", closure),
    closureSQL.replace(
      retirement,
      "-- Local only: omitted absent OLAPLEX retirement DML; ALL schema/functions below retained.",
    ),
  )
  const reconciliation =
    "20260814191843_20260814122000_personal_plan_stage5_v2_authority_reconciliation.sql"
  let reconciliationSQL = readFileSync(resolve(root, "supabase/migrations", reconciliation), "utf8")
  for (const marker of ["reconcile_reviewed_v1_authority", "reconcile_reviewed_family_authority"]) {
    const block = new RegExp("DO \\$" + marker + "\\$[\\s\\S]*?\\$" + marker + "\\$;")
    if (!block.test(reconciliationSQL)) throw new Error("Historical reconciliation block changed")
    reconciliationSQL = reconciliationSQL.replace(
      block,
      "-- Local only: absent reviewed catalog data omitted.",
    )
  }
  // Keep the third block: it changes the executor function definition.
  writeFileSync(resolve(stack, "supabase/migrations", reconciliation), reconciliationSQL)
  const convergence = "20260816180000_catalog_authority_retire_legacy_sync_and_validate.sql"
  const convergenceSQL = readFileSync(resolve(root, "supabase/migrations", convergence), "utf8")
  const neqi = /DO \$neqi\$[\s\S]*?\$neqi\$;/
  if (!neqi.test(convergenceSQL)) throw new Error("Historical Neqi data block changed")
  writeFileSync(
    resolve(stack, "supabase/migrations", convergence),
    convergenceSQL.replace(
      neqi,
      "-- Local only: absent Neqi projection DML omitted; schema validations retained.",
    ),
  )
  const oil = "20260903083832_simplify_oil_heat_capability.sql"
  let oilSQL = readFileSync(resolve(root, "supabase/migrations", oil), "utf8")
  for (const marker of ["preflight", "postflight"]) {
    const block = new RegExp("DO \\$" + marker + "\\$[\\s\\S]*?\\$" + marker + "\\$;")
    if (!block.test(oilSQL)) throw new Error("Historical Oil data guard changed")
    oilSQL = oilSQL.replace(block, "-- Local only: absent exact Oil catalog cohort check omitted.")
  }
  writeFileSync(resolve(stack, "supabase/migrations", oil), oilSQL)
  console.log("Prepared isolated mobile stack with current migrations; no database started.")
} else if (command === "start") {
  if (
    readFileSync(resolve(stack, "supabase/config.toml"), "utf8") !==
    readFileSync(resolve(root, "scripts/mobile/config.toml"), "utf8")
  )
    throw new Error("Local config differs from reviewed template")
  run(["start", "--exclude", "studio,realtime,edge-runtime,logflare,vector,imgproxy,supavisor"])
} else if (command === "environment") {
  const status = JSON.parse(run(["status", "--output", "json"], true))
  if (status.API_URL !== "http://127.0.0.1:54321") throw new Error("Refusing non-local API")
  const value = {
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    MOBILE_API_ENABLED: "true",
    MOBILE_AUTH_CALLBACK_URL: "chaarlie-local://auth",
    FREEMIUM_SCANNER_FIRST_ENABLED: "false",
    NEXT_TELEMETRY_DISABLED: "1",
  }
  if (!value.NEXT_PUBLIC_SUPABASE_ANON_KEY || !value.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("Missing isolated keys")
  const target = resolve(stack, "environment.json")
  writeFileSync(target, JSON.stringify(value, null, 2), { mode: 0o600 })
  chmodSync(target, 0o600)
  console.log("Saved isolated local credentials in ignored mode-0600 file; values suppressed.")
} else if (command === "stop") {
  run(["stop"])
} else if (command === "migrate") {
  run(["migration", "up", "--local", "--include-all"])
} else if (command === "web" || command === "build") {
  const held = []
  for (const name of [
    ".env",
    ".env.local",
    ".env.development",
    ".env.development.local",
    ".env.production",
    ".env.production.local",
  ]) {
    const original = resolve(root, name)
    const backup = resolve(stack, "held-" + name)
    if (existsSync(backup)) throw new Error("Restore held environment before starting: " + name)
    if (existsSync(original)) held.push({ original, backup })
  }
  // Preserve worktree-provisioned env files without reading or loading them.
  // Restore after the child exits; never overwrite a concurrently created file.
  for (const file of held) renameSync(file.original, file.backup)
  try {
    const result = spawnSync(
      "/usr/local/bin/node",
      [
        resolve(root, "node_modules/next/dist/bin/next"),
        ...(command === "build" ? ["build"] : ["dev", "--hostname", "127.0.0.1", "--port", "3218"]),
      ],
      {
        cwd: root,
        env: {
          ...env,
          ...loadLocalEnvironment(),
          NODE_ENV: command === "build" ? "production" : "development",
        },
        stdio: "inherit",
      },
    )
    process.exitCode = result.status ?? 1
  } finally {
    for (const file of held) {
      if (existsSync(file.original))
        throw new Error("Environment restore collision; original preserved in ignored stack")
      renameSync(file.backup, file.original)
    }
  }
}
