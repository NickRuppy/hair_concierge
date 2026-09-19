import {
  MobileError,
  mobileJSON,
  mobileRateLimit,
  mobileRoute,
  requireMobileUser,
} from "@/lib/mobile/auth"
import { clearMobileHistory, loadMobileHistory } from "@/lib/mobile/history-service"

export function parseHistoryFavoritesFilter(raw: string | null) {
  if (raw === null) return false
  if (raw === "1") return true
  throw new MobileError("invalid_request", 400)
}

export async function GET(request: Request) {
  return mobileRoute(async () => {
    const { client, userId } = await requireMobileUser(request)
    await mobileRateLimit(client, userId, "mobile-history-read", 60, 60_000)
    const params = new URL(request.url).searchParams
    return mobileJSON(
      await loadMobileHistory(
        client,
        userId,
        params.get("cursor"),
        params.get("barcode"),
        parseHistoryFavoritesFilter(params.get("favorites")),
      ),
    )
  })
}
export async function DELETE(request: Request) {
  return mobileRoute(async () => {
    const { client, userId } = await requireMobileUser(request)
    await mobileRateLimit(client, userId, "mobile-history-clear", 5, 60_000)
    await clearMobileHistory(client, userId)
    return mobileJSON({ contractVersion: 1, cleared: true })
  })
}
