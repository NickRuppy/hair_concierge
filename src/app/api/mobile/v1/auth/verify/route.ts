import { authVerifySchema } from "@/lib/mobile/contracts"
import { verifyMobileAuth } from "@/lib/mobile/auth-service"
import {
  mobileAuthDependencies,
  mobileBody,
  MobileError,
  mobileJSON,
  mobileRoute,
} from "@/lib/mobile/auth"

export async function POST(request: Request) {
  return mobileRoute(async () => {
    const input = authVerifySchema.safeParse(await mobileBody(request))
    if (!input.success) throw new MobileError("invalid_request", 400)
    const session = await verifyMobileAuth(input.data, mobileAuthDependencies())
    if (!session) throw new MobileError("invalid_or_expired_code", 401)
    return mobileJSON(session)
  })
}
