import { createAdminClient } from "@/lib/supabase/admin"
import { mobileBody, mobileJSON, mobileRateLimit } from "@/lib/mobile/auth"
import { MobileError } from "@/lib/mobile/errors"
import { registrationSubmissionSchema } from "@/lib/mobile/registration-contract"
import { registrationRoute, startMobileRegistration } from "@/lib/mobile/registration-auth"
export async function POST(request: Request) {
  return registrationRoute(async () => {
    const parsed = registrationSubmissionSchema.safeParse(await mobileBody(request))
    if (!parsed.success) throw new MobileError("invalid_request", 400)
    const client = createAdminClient(),
      ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    await mobileRateLimit(client, ip, "mobile-registration-ip", 20, 600_000)
    await mobileRateLimit(client, parsed.data.email, "mobile-registration-email", 5, 3_600_000)
    return mobileJSON(await startMobileRegistration(parsed.data, client))
  })
}
