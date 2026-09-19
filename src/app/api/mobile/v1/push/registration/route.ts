import {
  mobileBody,
  MobileError,
  mobileJSON,
  mobileRateLimit,
  mobileRoute,
  requireMobileUser,
} from "@/lib/mobile/auth"
import {
  mobilePushRegistrationSchema,
  mobilePushRevocationSchema,
  registerMobilePushInstallation,
  revokeMobilePushInstallation,
} from "@/lib/mobile/push-installation-service"

export async function POST(request: Request) {
  return mobileRoute(async () => {
    const { client, userId } = await requireMobileUser(request)
    await mobileRateLimit(client, userId, "mobile-push-register", 12, 60_000)
    const parsed = mobilePushRegistrationSchema.safeParse(await mobileBody(request, 4096))
    if (!parsed.success) throw new MobileError("invalid_request", 400)
    await registerMobilePushInstallation(client, userId, parsed.data)
    return mobileJSON({ registered: true })
  })
}

export async function DELETE(request: Request) {
  return mobileRoute(async () => {
    const { client, userId } = await requireMobileUser(request)
    await mobileRateLimit(client, userId, "mobile-push-revoke", 12, 60_000)
    const parsed = mobilePushRevocationSchema.safeParse(await mobileBody(request, 1024))
    if (!parsed.success) throw new MobileError("invalid_request", 400)
    await revokeMobilePushInstallation(client, userId, parsed.data.installationId)
    return mobileJSON({ revoked: true })
  })
}
