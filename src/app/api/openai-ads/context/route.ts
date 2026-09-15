import { createAdminClient } from "@/lib/supabase/admin"
import { handleOpenAIContextRequest } from "@/lib/openai-ads/server/context"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function GET(request: Request) {
  return handleOpenAIContextRequest(request, { supabase: createAdminClient })
}
export async function POST(request: Request) {
  return handleOpenAIContextRequest(request, { supabase: createAdminClient })
}
