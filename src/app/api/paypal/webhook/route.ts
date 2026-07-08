import { after, NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { paypalRequest } from "@/lib/paypal/client"
import { handlePayPalWebhookEvent } from "@/lib/paypal/webhook-handlers"
import { getBillingTierIds } from "@/lib/billing/tier-ids"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"

export const runtime = "nodejs"

type PayPalVerifyWebhookResponse = {
  verification_status?: string
}

async function getTierIds(supabase: SupabaseClient) {
  return getBillingTierIds(supabase)
}

export async function POST(request: Request) {
  const startedAt = Date.now()
  const rawBody = await request.text()
  const webhookId = process.env.PAYPAL_WEBHOOK_ID
  if (!webhookId) return new NextResponse("server misconfigured", { status: 500 })

  let event: unknown
  try {
    event = JSON.parse(rawBody)
  } catch {
    return new NextResponse("invalid json", { status: 400 })
  }

  let verified = false
  try {
    verified = await verifyPayPalWebhookSignature(request, webhookId, event)
  } catch (err) {
    console.warn("[paypal:webhook] signature verification failed:", err)
    return new NextResponse("signature verification failed", { status: 400 })
  }
  if (!verified) return new NextResponse("signature verification failed", { status: 400 })

  const supabase: SupabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  try {
    const { premiumTierId, freeTierId } = await getTierIds(supabase)
    await handlePayPalWebhookEvent(event as Parameters<typeof handlePayPalWebhookEvent>[0], {
      supabase,
      premiumTierId,
      freeTierId,
      linkQuizToProfile,
      defer: after,
      recordBillingAnalytics: true,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown"
    console.error("[paypal:webhook] handler error:", err)
    return new NextResponse(`handler error: ${message}`, { status: 500 })
  }

  const paypalEvent = event as { id?: string; event_type?: string }
  console.info("[paypal:webhook] handled", {
    eventId: paypalEvent.id,
    type: paypalEvent.event_type,
    durationMs: Date.now() - startedAt,
  })

  return NextResponse.json({ received: true })
}

async function verifyPayPalWebhookSignature(
  request: Request,
  webhookId: string,
  webhookEvent: unknown,
): Promise<boolean> {
  const authAlgo = request.headers.get("paypal-auth-algo")
  const certUrl = request.headers.get("paypal-cert-url")
  const transmissionId = request.headers.get("paypal-transmission-id")
  const transmissionSig = request.headers.get("paypal-transmission-sig")
  const transmissionTime = request.headers.get("paypal-transmission-time")

  if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
    return false
  }

  const response = await paypalRequest<PayPalVerifyWebhookResponse>(
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: webhookEvent,
      }),
    },
  )

  return response.verification_status === "SUCCESS"
}
