import { NextResponse } from "next/server"

import { safeBearerTokenMatches } from "@/app/api/billing/payment-monitor/route"
import { dispatchPublicContractDeclarationReceipts } from "@/lib/billing/public-contract-declaration-receipt-delivery"

export const runtime = "nodejs"
export const maxDuration = 60

export async function handlePublicContractDeclarationReceiptReconcile(
  request: Request,
  dependencies: {
    cronSecret?: string
    dispatch?: typeof dispatchPublicContractDeclarationReceipts
  } = {},
) {
  if (
    !safeBearerTokenMatches(
      request.headers.get("authorization"),
      dependencies.cronSecret ?? process.env.CRON_SECRET,
    )
  ) {
    return { status: 401, body: { error: "unauthorized" } }
  }
  try {
    const delivery = await (dependencies.dispatch ?? dispatchPublicContractDeclarationReceipts)()
    return { status: 200, body: { declarationReceiptDelivery: delivery } }
  } catch {
    // No recipient, declaration content, or provider response enters logs/API.
    return { status: 500, body: { error: "declaration_receipt_delivery_failed" } }
  }
}

export async function GET(request: Request) {
  const result = await handlePublicContractDeclarationReceiptReconcile(request)
  return NextResponse.json(result.body, { status: result.status })
}
