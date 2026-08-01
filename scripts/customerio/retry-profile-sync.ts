import { createClient } from "@supabase/supabase-js"

import { dispatchCustomerIoProfileSyncDue } from "@/lib/personal-plan-quiz/customerio-outbox"

function argValue(name: string) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
  }
  const limit = Number(argValue("--limit") ?? "25")
  if (!Number.isInteger(limit) || limit <= 0) throw new Error("--limit must be positive")

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const stats = await dispatchCustomerIoProfileSyncDue(supabase, { limit })
  console.info("[customerio:profile-sync]", stats)
}

void main().catch((error) => {
  console.error("[customerio:profile-sync] retry failed", error)
  process.exitCode = 1
})
