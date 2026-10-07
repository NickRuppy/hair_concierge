import { mobileJSON, MobileError, mobileRoute, requireMobileUser } from "@/lib/mobile/auth"

export async function POST(request: Request) {
  return mobileRoute(async () => {
    const { client, token } = await requireMobileUser(request)
    const { error } = await client.auth.admin.signOut(token, "local")
    if (error) throw new MobileError("temporarily_unavailable", 503)
    return mobileJSON({ status: "signed_out" })
  })
}
