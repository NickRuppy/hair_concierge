import { z } from "zod"
import {
  MobileError,
  mobileJSON,
  mobileRateLimit,
  mobileRoute,
  requireMobileUser,
} from "@/lib/mobile/auth"
import { resolveMobileResearchResult } from "@/lib/mobile/research-result-service"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  return mobileRoute(async () => {
    const { client, userId } = await requireMobileUser(request)
    await mobileRateLimit(client, userId, "mobile-research-result", 30, 60_000)
    const { submissionId } = await params
    if (!z.uuid().safeParse(submissionId).success) throw new MobileError("invalid_request", 400)
    const result = await resolveMobileResearchResult(client, userId, submissionId)
    if (result.kind === "not_found") throw new MobileError("not_found", 404)
    if (result.kind === "not_ready")
      return mobileJSON({ contractVersion: 1, kind: "not_ready" }, 409)
    return mobileJSON(result.result)
  })
}
