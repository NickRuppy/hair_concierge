import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { researchDeliveryEnabled } from "@/lib/mobile/push-installation-service"
import { reconcileMobileResearchDeliveries } from "@/lib/mobile/research-delivery-worker"

export const runtime = "nodejs"
export const maxDuration = 60

export async function handleMobileResearchDeliveryReconcile(
  request: Request,
  dependencies: {
    cronSecret?: string
    enabled: boolean
    createClient: () => SupabaseClient
    reconcile?: typeof reconcileMobileResearchDeliveries
  },
) {
  if (
    !dependencies.cronSecret ||
    request.headers.get("authorization") !== `Bearer ${dependencies.cronSecret}`
  )
    return { status: 401, body: { error: "unauthorized" } }
  if (!dependencies.enabled) return { status: 200, body: { disabled: true } }
  try {
    const stats = await (dependencies.reconcile ?? reconcileMobileResearchDeliveries)(
      dependencies.createClient(),
    )
    return { status: stats.errors ? 503 : 200, body: stats }
  } catch {
    return { status: 503, body: { error: "temporarily_unavailable" } }
  }
}

export async function GET(request: Request) {
  const result = await handleMobileResearchDeliveryReconcile(request, {
    cronSecret: process.env.CRON_SECRET,
    enabled: researchDeliveryEnabled(),
    createClient: () =>
      createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false },
      }),
  })
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  })
}
