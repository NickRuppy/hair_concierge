import { handlePublicContractDeclaration } from "@/lib/billing/public-contract-declaration-request"

export const runtime = "nodejs"

export async function POST(request: Request) {
  return handlePublicContractDeclaration(request)
}
