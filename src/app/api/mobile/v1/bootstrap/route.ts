import { mobileJSON, mobileRoute, requireMobileUser } from "@/lib/mobile/auth"
import { loadMobileProfile } from "@/lib/mobile/profile-service"
import { resolveMobileAccess } from "@/lib/mobile/access"

export async function GET(request: Request) {
  return mobileRoute(async () => {
    const { client, userId, email } = await requireMobileUser(request)
    try {
      const result = await loadMobileProfile(client, userId)
      if (result.status !== "ready") return mobileJSON({ status: "profile_required" })
      const access = await resolveMobileAccess(client, userId, email, new Date())
      return mobileJSON({
        status: "ready",
        profileRevision: result.profileRevision,
        contextRevision: result.contextRevision,
        researchDeliveryEnabled: process.env.MOBILE_RESEARCH_DELIVERY_ENABLED === "true",
        access,
      })
    } catch {
      return mobileJSON({ status: "temporarily_unavailable" }, 503)
    }
  })
}
