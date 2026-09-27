import { handleAccountDeletePreflight } from "@/lib/mobile/account-deletion"

export const runtime = "nodejs"

export async function GET(request: Request) {
  return handleAccountDeletePreflight(request)
}
