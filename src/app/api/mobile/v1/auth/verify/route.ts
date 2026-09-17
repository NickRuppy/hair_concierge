import { createAdminClient } from "@/lib/supabase/admin"
import { registrationStore } from "@/lib/mobile/registration-store"
import { verifyRegisteredLogin } from "@/lib/mobile/registration-auth"
import { authVerifySchema } from "@/lib/mobile/contracts"
import { verifyMobileAuth } from "@/lib/mobile/auth-service"
import {
  mobileAuthDependencies,
  validateMobileVerification,
  mobileBody,
  MobileError,
  mobileJSON,
  mobileRoute,
} from "@/lib/mobile/auth"

export async function POST(request: Request) {
  return mobileRoute(async () => {
    const input = authVerifySchema.safeParse(await mobileBody(request))
    if (!input.success) throw new MobileError("invalid_request", 400)
    if (process.env.MOBILE_REGISTRATION_ENABLED === "true") {
      const client = createAdminClient()
      const intent = await registrationStore(client).read(input.data.attemptId)
      if (intent) return mobileJSON(await verifyRegisteredLogin(input.data, client))
    }
    await validateMobileVerification(input.data)
    const session = await verifyMobileAuth(input.data, mobileAuthDependencies())
    if (!session) throw new MobileError("invalid_or_expired_code", 401)
    return mobileJSON(session)
  })
}
