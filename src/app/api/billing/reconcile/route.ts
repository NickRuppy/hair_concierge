import { NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { reconcileExpiredBillingEntitlements } from "@/lib/billing/entitlements"
import { getStripeTierIds } from "@/lib/stripe/tier-ids"

export const runtime = "nodejs"

type ReconcileDeps = {
  supabase: SupabaseClient
  getFreeTierId: (supabase: SupabaseClient) => Promise<string>
  cronSecret?: string
  now?: Date
}

export async function GET(request: Request) {
  const supabase: SupabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  return toNextResponse(
    await handleBillingReconcile(request, {
      supabase,
      getFreeTierId,
      cronSecret: process.env.CRON_SECRET,
    }),
  )
}

export async function handleBillingReconcile(request: Request, deps: ReconcileDeps) {
  const secret = deps.cronSecret
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return { status: 401, body: { error: "unauthorized" } }
  }

  const freeTierId = await deps.getFreeTierId(deps.supabase)
  const result = await reconcileExpiredBillingEntitlements(deps.supabase, {
    freeTierId,
    now: deps.now,
  })
  return { status: 200, body: result }
}

async function getFreeTierId(supabase: SupabaseClient): Promise<string> {
  return (await getStripeTierIds(supabase)).freeTierId
}

function toNextResponse(result: { status: number; body: Record<string, unknown> }) {
  return NextResponse.json(result.body, { status: result.status })
}
