import { startRegisteredLogin } from "@/lib/mobile/registration-auth"
import { mobilePolicy, eligibleAccount, requireMobileEmail } from "@/lib/mobile/pilot"
import { createAdminClient } from "@/lib/supabase/admin"
import { authStartSchema } from "@/lib/mobile/contracts"
import { startMobileAuth } from "@/lib/mobile/auth-service"
import {
  mobileAuthDependencies,
  requirePinnedProviderIdentity,
  mobileBody,
  MobileError,
  mobileJSON,
  mobileRateLimit,
  mobileRoute,
} from "@/lib/mobile/auth"

export async function POST(request: Request) {
  return mobileRoute(async () => {
    const input = authStartSchema.safeParse(await mobileBody(request))
    if (!input.success) throw new MobileError("invalid_request", 400)
    let registered = false
    if (process.env.MOBILE_REGISTRATION_ENABLED === "true") {
      try {
        const policy = mobilePolicy()
        registered = policy.mode === "local" || !eligibleAccount(policy.config, input.data.email)
      } catch {
        registered = true
      }
    }
    if (!registered) requireMobileEmail(input.data.email)
    const client = createAdminClient()
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    await mobileRateLimit(client, ip, "mobile-auth-ip", 20, 600_000)
    await mobileRateLimit(client, input.data.email, "mobile-auth-email", 5, 3_600_000)
    if (registered) return mobileJSON(await startRegisteredLogin(input.data.email, client))
    await requirePinnedProviderIdentity(input.data.email, client)
    return mobileJSON(await startMobileAuth(input.data.email, mobileAuthDependencies(client)))
  })
}
