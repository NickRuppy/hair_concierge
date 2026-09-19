import {
  mobileBody,
  MobileError,
  mobileJSON,
  mobileRateLimit,
  mobileRoute,
  requireMobileUser,
} from "@/lib/mobile/auth"
import { loadMobileProfile } from "@/lib/mobile/profile-service"
import { resolveMobileScan } from "@/lib/mobile/scan-service"
import { recordMobileHistory } from "@/lib/mobile/history-service"
import { mobileScanResolveRequestSchema } from "@/lib/mobile/scan-contracts"
import { validateEanInput } from "@/lib/scan/identifier-lookup"

export async function POST(request: Request) {
  return mobileRoute(async () => {
    const { client, userId } = await requireMobileUser(request)
    await mobileRateLimit(client, userId, "mobile-scan", 30, 60_000)
    const parsed = mobileScanResolveRequestSchema.safeParse(await mobileBody(request))
    if (!parsed.success) throw new MobileError("invalid_request", 400)
    if (parsed.data.identifier && !validateEanInput(parsed.data.identifier.value).ok)
      throw new MobileError("invalid_identifier", 400)
    const profile = await loadMobileProfile(client, userId)
    const result = await resolveMobileScan(
      client,
      profile.status === "ready" ? profile.context : null,
      { ...parsed.data, retailerImageOrigin: request.url },
    )
    const historySaved = await recordMobileHistory(client, userId, parsed.data, result)
    return mobileJSON({ ...result, ...(historySaved === undefined ? {} : { historySaved }) })
  })
}
