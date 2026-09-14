import { z } from "zod"
import {
  mobileBody,
  MobileError,
  mobileJSON,
  mobileRateLimit,
  mobileRoute,
  requireMobileUser,
} from "@/lib/mobile/auth"
import { loadMobileProfile } from "@/lib/mobile/profile-service"
import { resolveMobileScan } from "@/lib/mobile/scan-service"
import { validateEanInput } from "@/lib/scan/identifier-lookup"

const schema = z
  .object({
    productId: z.uuid().optional(),
    identifier: z
      .object({ type: z.literal("ean"), value: z.string().trim().min(1).max(64) })
      .strict()
      .optional(),
  })
  .strict()
  .refine((value) => Boolean(value.productId) !== Boolean(value.identifier))

export async function POST(request: Request) {
  return mobileRoute(async () => {
    const { client, userId } = await requireMobileUser(request)
    await mobileRateLimit(client, userId, "mobile-scan", 30, 60_000)
    const parsed = schema.safeParse(await mobileBody(request))
    if (!parsed.success) throw new MobileError("invalid_request", 400)
    if (parsed.data.identifier && !validateEanInput(parsed.data.identifier.value).ok)
      throw new MobileError("invalid_identifier", 400)
    const profile = await loadMobileProfile(client, userId)
    return mobileJSON(
      await resolveMobileScan(
        client,
        profile.status === "ready" ? profile.context : null,
        parsed.data,
      ),
    )
  })
}
