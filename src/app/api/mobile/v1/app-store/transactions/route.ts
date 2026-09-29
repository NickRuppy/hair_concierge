import { handleAppStoreTransactionsPost } from "@/lib/mobile/app-store-transactions"

// Apple JWS verification reads the committed root certificates from disk.
export const runtime = "nodejs"

export async function POST(request: Request) {
  return handleAppStoreTransactionsPost(request)
}
