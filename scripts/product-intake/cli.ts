import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { join, sep } from "node:path"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { config as loadEnv } from "dotenv"

export type CliArgs = {
  positional: string[]
  flags: Map<string, string | boolean>
}

export function parseArgs(argv = process.argv.slice(2)): CliArgs {
  const positional: string[] = []
  const flags = new Map<string, string | boolean>()

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (!arg.startsWith("--")) {
      positional.push(arg)
      continue
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2)
    if (!rawKey) continue
    if (inlineValue !== undefined) {
      flags.set(rawKey, inlineValue)
      continue
    }

    const next = argv[index + 1]
    if (next && !next.startsWith("--")) {
      flags.set(rawKey, next)
      index += 1
    } else {
      flags.set(rawKey, true)
    }
  }

  return { positional, flags }
}

export function flag(args: CliArgs, name: string): string | null {
  const value = args.flags.get(name)
  return typeof value === "string" ? value : null
}

export function flagBool(args: CliArgs, name: string): boolean {
  return args.flags.get(name) === true
}

export function flagInt(args: CliArgs, name: string, fallback: number): number {
  const raw = flag(args, name)
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function loadLocalEnv() {
  for (const envPath of envCandidatePaths()) {
    if (existsSync(envPath)) {
      loadEnv({ path: envPath })
    }
  }
}

function envCandidatePaths(): string[] {
  const cwd = process.cwd()
  const candidates = [join(cwd, ".env.local")]
  const worktreeIndex = cwd.indexOf(`${sep}.worktrees${sep}`)

  if (worktreeIndex >= 0) {
    candidates.push(join(cwd.slice(0, worktreeIndex), ".env.local"))
  }

  return [...new Set(candidates)]
}

export function createSupabaseClientFromEnv(): SupabaseClient {
  loadLocalEnv()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function hashUserId(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 10)
}

export function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2))
}

export function requireFlag(args: CliArgs, name: string): string {
  const value = flag(args, name)
  if (!value) {
    throw new Error(`Missing --${name}`)
  }
  return value
}
