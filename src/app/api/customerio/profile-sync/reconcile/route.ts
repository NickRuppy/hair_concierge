import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

import {
  dispatchCustomerIoProfileSyncDue,
  type CustomerIoProfileSyncStats,
} from "@/lib/personal-plan-quiz/customerio-outbox"

export const runtime = "nodejs"
export const maxDuration = 60

type ReconcileDependencies = {
  supabase: SupabaseClient
  cronSecret?: string
  dispatchDue?: (
    supabase: SupabaseClient,
    options: { limit: number },
  ) => Promise<CustomerIoProfileSyncStats>
}

export async function GET(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  const result = await handleCustomerIoProfileSyncReconcile(request, {
    supabase,
    cronSecret: process.env.CRON_SECRET,
  })
  return NextResponse.json(result.body, { status: result.status })
}

export async function handleCustomerIoProfileSyncReconcile(
  request: Request,
  dependencies: ReconcileDependencies,
) {
  if (
    !dependencies.cronSecret ||
    request.headers.get("authorization") !== `Bearer ${dependencies.cronSecret}`
  ) {
    return { status: 401, body: { error: "unauthorized" } }
  }

  const dispatchDue = dependencies.dispatchDue ?? dispatchCustomerIoProfileSyncDue
  const stats = await dispatchDue(dependencies.supabase, { limit: 25 })
  return { status: 200, body: stats }
}
