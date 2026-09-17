import { refreshSchema } from "@/lib/mobile/contracts"
import {
  mobileBody,
  MobileError,
  mobileJSON,
  mobileRoute,
  refreshMobileSession,
} from "@/lib/mobile/auth"
export async function POST(request: Request) {
  return mobileRoute(async () => {
    const input = refreshSchema.safeParse(await mobileBody(request))
    if (!input.success) throw new MobileError("invalid_request", 400)
    return mobileJSON(await refreshMobileSession(input.data.refreshToken))
  })
}
