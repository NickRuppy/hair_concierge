import { z } from "zod"
import {
  MobileError,
  mobileBody,
  mobileJSON,
  mobileRateLimit,
  mobileRoute,
  requireMobileUser,
} from "@/lib/mobile/auth"
import { setMobileHistoryFavorite } from "@/lib/mobile/history-service"

const favoriteBodySchema = z.object({ isFavorite: z.boolean() }).strict()

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  return mobileRoute(async () => {
    const { client, userId } = await requireMobileUser(request)
    await mobileRateLimit(client, userId, "mobile-history-favorite", 30, 60_000)
    const { entryId } = await params
    if (!z.uuid().safeParse(entryId).success) throw new MobileError("invalid_request", 400)
    const parsed = favoriteBodySchema.safeParse(await mobileBody(request))
    if (!parsed.success) throw new MobileError("invalid_request", 400)
    const isFavorite = await setMobileHistoryFavorite(
      client,
      userId,
      entryId,
      parsed.data.isFavorite,
    )
    return mobileJSON({ contractVersion: 1, entryId, isFavorite })
  })
}
