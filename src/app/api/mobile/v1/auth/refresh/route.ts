import { refreshSchema } from "@/lib/mobile/contracts"
import {
  mobileBody,
  MobileError,
  mobileJSON,
  mobileProvider,
  mobileRoute,
  sessionDTO,
} from "@/lib/mobile/auth"

export async function POST(request: Request) {
  return mobileRoute(async () => {
    const input = refreshSchema.safeParse(await mobileBody(request))
    if (!input.success) throw new MobileError("invalid_request", 400)
    const provider = mobileProvider()
    const { data, error } = await provider.auth.refreshSession({
      refresh_token: input.data.refreshToken,
    })
    if (error && (!error.status || error.status >= 500))
      throw new MobileError("temporarily_unavailable", 503)
    if (error || !data.session) throw new MobileError("unauthorized", 401)
    const verified = await provider.auth.getUser(data.session.access_token)
    if (verified.error && (!verified.error.status || verified.error.status >= 500))
      throw new MobileError("temporarily_unavailable", 503)
    if (verified.error || !verified.data.user || verified.data.user.is_anonymous)
      throw new MobileError("unauthorized", 401)
    return mobileJSON(sessionDTO(data.session))
  })
}
