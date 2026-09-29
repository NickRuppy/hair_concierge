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
import { localReplayMigrations } from "./local-migrations.mjs"

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)))
export const stack = resolve(root, "tmp/mobile-stack")
const cli =
  process.env.MOBILE_SUPABASE_CLI ||
  resolve(root, "node_modules/.bin/supabase")
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
    value.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:55321" ||
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
  mkdirSync(resolve(stack, "supabase/migrations"), { recursive: true })
  for (const { file, sql } of localReplayMigrations(root))
    writeFileSync(resolve(stack, "supabase/migrations", file), sql)
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
  if (status.API_URL !== "http://127.0.0.1:55321") throw new Error("Refusing non-local API")
  const value = {
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    MOBILE_API_ENABLED: "true",
    MOBILE_AUTH_MODE: "local",
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
      process.execPath,
      [
        resolve(root, "node_modules/next/dist/bin/next"),
        ...(command === "build" ? ["build"] : ["dev", "--hostname", "127.0.0.1", "--port", "3224"]),
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
