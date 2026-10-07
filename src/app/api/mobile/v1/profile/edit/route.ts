import {
  mobileBody,
  mobileJSON,
  mobileRateLimit,
  mobileRoute,
  requireMobileUser,
  MobileError,
} from "@/lib/mobile/auth"
import { profileEditRequestSchema } from "@/lib/mobile/profile-edit-contract"
import { loadMobileProfileEdit, saveMobileProfileEdit } from "@/lib/mobile/profile-edit-service"

export async function GET(request: Request) {
  return mobileRoute(async () => {
    const { client, userId } = await requireMobileUser(request)
    return mobileJSON(await loadMobileProfileEdit(client, userId))
  })
}
export async function POST(request: Request) {
  return mobileRoute(async () => {
    const { client, userId } = await requireMobileUser(request)
    const parsed = profileEditRequestSchema.safeParse(await mobileBody(request))
    if (!parsed.success) throw new MobileError("invalid_request", 400)
    await mobileRateLimit(client, userId, "mobile-profile-edit", 30, 60_000)
    return mobileJSON(await saveMobileProfileEdit(client, userId, parsed.data))
  })
}
