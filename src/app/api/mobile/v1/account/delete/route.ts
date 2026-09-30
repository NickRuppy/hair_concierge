import { handleAccountDeletePost } from "@/lib/mobile/account-deletion"

// Web billing cancellation, the data routine and external cleanup run in one request.
export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  return handleAccountDeletePost(request)
}
