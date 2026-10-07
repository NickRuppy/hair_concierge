import {
  mobileBody,
  MobileError,
  mobileJSON,
  mobileRateLimit,
  mobileRoute,
} from "@/lib/mobile/auth"
import { requireMobileScannerAccess } from "@/lib/mobile/access"
import { mobileScanSubmitSchema, submitMobileScan } from "@/lib/mobile/scan-submit-service"

export async function POST(request: Request) {
  return mobileRoute(async () => {
    const { client, userId } = await requireMobileScannerAccess(request)
    await mobileRateLimit(client, userId, "mobile-scan-submit", 10, 60_000)
    const parsed = mobileScanSubmitSchema.safeParse(await mobileBody(request))
    if (!parsed.success) throw new MobileError("invalid_request", 400)
    const result = await submitMobileScan(client, userId, parsed.data)
    return mobileJSON(result, result.kind === "pending_submission" ? 202 : 200)
  })
}
