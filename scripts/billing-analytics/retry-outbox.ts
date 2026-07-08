import { createClient } from "@supabase/supabase-js"
import { dispatchBillingAnalyticsDue } from "@/lib/billing/analytics-outbox"
import type { BillingAnalyticsDestination } from "@/lib/billing/types"

function argValue(name: string) {
  const index = process.argv.indexOf(name)
  if (index < 0) return undefined
  return process.argv[index + 1]
}

function destinationArg(): BillingAnalyticsDestination | undefined {
  const destination = argValue("--destination")
  if (!destination) return undefined
  if (destination === "customerio" || destination === "meta" || destination === "posthog") {
    return destination
  }
  throw new Error(`Invalid --destination ${destination}`)
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
  }

  const limit = Number(argValue("--limit") ?? "50")
  if (!Number.isInteger(limit) || limit <= 0) throw new Error("--limit must be a positive integer")

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const processed = await dispatchBillingAnalyticsDue(supabase, {
    destination: destinationArg(),
    eventKey: argValue("--event-key"),
    limit,
  })

  console.info(`[billing-analytics] processed ${processed} due deliveries`)
}

main().catch((error) => {
  console.error("[billing-analytics] retry failed", error)
  process.exitCode = 1
})
