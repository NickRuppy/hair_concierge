import { MobileError, mobileJSON, mobileRateLimit, mobileRoute } from "@/lib/mobile/auth"
import { requireMobileScannerAccess } from "@/lib/mobile/access"
import { loadMobileProfile } from "@/lib/mobile/profile-service"
import { searchMobileScanCatalog } from "@/lib/mobile/scan-service"

export async function GET(request: Request) {
  return mobileRoute(async () => {
    const { client, userId } = await requireMobileScannerAccess(request)
    await mobileRateLimit(client, userId, "mobile-scan", 30, 60_000)
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? ""
    if (query.length < 2 || query.length > 120) throw new MobileError("invalid_request", 400)
    if ((await loadMobileProfile(client, userId)).status !== "ready")
      throw new MobileError("profile_required", 403)
    return mobileJSON(await searchMobileScanCatalog(client, query))
  })
}
