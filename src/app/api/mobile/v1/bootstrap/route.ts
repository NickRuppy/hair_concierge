import { mobileJSON, mobileRoute, requireMobileUser } from "@/lib/mobile/auth"
import { loadMobileProfile } from "@/lib/mobile/profile-service"

export async function GET(request: Request) {
  return mobileRoute(async () => {
    const { client, userId } = await requireMobileUser(request)
    try {
      const result = await loadMobileProfile(client, userId)
      return mobileJSON(
        result.status === "ready"
          ? {
              status: "ready",
              profileRevision: result.profileRevision,
              contextRevision: result.contextRevision,
            }
          : { status: "profile_required" },
      )
    } catch {
      return mobileJSON({ status: "temporarily_unavailable" }, 503)
    }
  })
}
