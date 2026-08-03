import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

import {
  dispatchWaitlistCustomerIoDue,
  type WaitlistCustomerIoDispatchStats,
} from "@/lib/waitlist/customerio-outbox"
import { waitlistCronBearerMatches } from "@/lib/waitlist/api-auth"

export const runtime = "nodejs"
export const maxDuration = 60

type ReconcileDependencies = {
  supabase: SupabaseClient
  cronSecret?: string
  dispatchDue?: (
    supabase: SupabaseClient,
    options: { limit: number },
  ) => Promise<WaitlistCustomerIoDispatchStats>
}

export async function GET(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  const result = await handleWaitlistCustomerIoReconcile(request, {
    supabase,
    cronSecret: process.env.CRON_SECRET,
  })
  return NextResponse.json(result.body, { status: result.status })
}

export async function handleWaitlistCustomerIoReconcile(
  request: Request,
  dependencies: ReconcileDependencies,
) {
  if (!waitlistCronBearerMatches(request.headers.get("authorization"), dependencies.cronSecret)) {
    return { status: 401, body: { error: "unauthorized" } }
  }

  const dispatchDue = dependencies.dispatchDue ?? dispatchWaitlistCustomerIoDue
  const stats = await dispatchDue(dependencies.supabase, { limit: 10 })
  return { status: 200, body: stats }
}
