import { handleAccountDeleteStatus } from "@/lib/mobile/account-deletion"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await params
  return handleAccountDeleteStatus(request, requestId)
}
