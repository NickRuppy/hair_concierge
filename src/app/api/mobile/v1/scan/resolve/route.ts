import {
  mobileBody,
  MobileError,
  mobileJSON,
  mobileRateLimit,
  mobileRoute,
} from "@/lib/mobile/auth"
import { requireMobileScannerAccess } from "@/lib/mobile/access"
import { loadMobileProfile } from "@/lib/mobile/profile-service"
import { resolveMobileScan } from "@/lib/mobile/scan-service"
import { recordMobileHistory } from "@/lib/mobile/history-service"
import { mobileScanResolveRequestSchema } from "@/lib/mobile/scan-contracts"
import { isShoppingBudgetEnabled } from "@/lib/personal-plan/release"
import { validateEanInput } from "@/lib/scan/identifier-lookup"
import { loadScanBudgetForRequest, loadScanShoppingBudget } from "@/lib/scan/shopping-budget"

export async function POST(request: Request) {
  return mobileRoute(async () => {
    const { client, userId } = await requireMobileScannerAccess(request)
    await mobileRateLimit(client, userId, "mobile-scan", 30, 60_000)
    const parsed = mobileScanResolveRequestSchema.safeParse(await mobileBody(request))
    if (!parsed.success) throw new MobileError("invalid_request", 400)
    if (parsed.data.identifier && !validateEanInput(parsed.data.identifier.value).ok)
      throw new MobileError("invalid_identifier", 400)
    const [profile, budget] = await Promise.all([
      loadMobileProfile(client, userId),
      // Flag-gated and fail-open: the budget can reorder alternatives but never fail a scan.
      loadScanBudgetForRequest(
        { isShoppingBudgetEnabled, loadShoppingBudget: loadScanShoppingBudget },
        client,
        userId,
      ),
    ])
    const result = await resolveMobileScan(
      client,
      profile.status === "ready" ? profile.context : null,
      { ...parsed.data, retailerImageOrigin: request.url, ...(budget ? { budget } : {}) },
    )
    const historySaved = await recordMobileHistory(client, userId, parsed.data, result)
    return mobileJSON({ ...result, ...(historySaved === undefined ? {} : { historySaved }) })
  })
}
