import { mobileJSON, mobileRoute, requireMobileUser } from "@/lib/mobile/auth"
import { loadMobileProfile } from "@/lib/mobile/profile-service"

export async function GET(request: Request) {
  return mobileRoute(async () => {
    const { client, userId } = await requireMobileUser(request)
    const result = await loadMobileProfile(client, userId)
    if (result.status !== "ready") return mobileJSON({ status: "profile_required" }, 403)
    return mobileJSON({ profileRevision: result.profileRevision, answers: result.answers })
  })
}
