import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let envLoaded = false

export function assertLocalServiceRoute(request: Request) {
  assertLocalServiceHeaders(request.headers)
}

export function assertLocalServiceHeaders(headers: Headers) {
  loadLocalEnv()

  if (process.env.PRODUCT_INTAKE_REVIEW_ALLOW_REMOTE === "1") return

  const host = headers.get("host")?.split(":")[0]
  const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "::1"

  if (isLocalHost) return

  throw new Error(
    "Product intake review service routes are local-only. Set PRODUCT_INTAKE_REVIEW_ALLOW_REMOTE=1 only behind explicit internal protection.",
  )
}

export function createServiceClient(): SupabaseClient {
  loadLocalEnv()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for product intake review app",
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function loadLocalEnv() {
  if (envLoaded) return
  envLoaded = true

  for (const envPath of [
    join(process.cwd(), ".env.local"),
    join(process.cwd(), "..", "..", ".env.local"),
  ]) {
    if (!existsSync(envPath)) continue
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const separator = trimmed.indexOf("=")
      if (separator < 1) continue

      const key = trimmed.slice(0, separator).trim()
      const value = trimmed
        .slice(separator + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "")
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  }
}
