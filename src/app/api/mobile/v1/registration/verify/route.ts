import { authVerifySchema } from "@/lib/mobile/contracts"
import { mobileBody, mobileJSON } from "@/lib/mobile/auth"
import { MobileError } from "@/lib/mobile/errors"
import { registrationRoute, verifyMobileRegistration } from "@/lib/mobile/registration-auth"
export async function POST(request: Request) {
  return registrationRoute(async () => {
    const parsed = authVerifySchema.safeParse(await mobileBody(request))
    if (!parsed.success) throw new MobileError("invalid_request", 400)
    return mobileJSON(await verifyMobileRegistration(parsed.data))
  })
}
