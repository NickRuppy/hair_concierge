import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0"

import { type CustomerIoTransactionalEmail, type SendEmailHookPayload } from "./message-builder.ts"
import {
  buildRegistrationAwareEmails,
  registrationHookBinding,
} from "./registration-message-builder.ts"

const customerIoApiUrl = Deno.env.get("CUSTOMERIO_APP_API_URL") ?? "https://api-eu.customer.io"
const publicSiteUrl = Deno.env.get("SITE_URL") ?? "https://chaarlie.de"

function requiredEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function normalizeHookSecret(secret: string) {
  return secret.replace("v1,whsec_", "")
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@")
  if (!domain) return "***"
  return `${local.slice(0, 2)}***@${domain}`
}

async function sendCustomerIoEmail(email: CustomerIoTransactionalEmail, appApiKey: string) {
  const response = await fetch(`${customerIoApiUrl}/v1/send/email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${appApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(email),
  })

  if (!response.ok) {
    throw new Error("customerio_delivery_failed")
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 })
  }

  try {
    const hookSecret = normalizeHookSecret(requiredEnv("SEND_EMAIL_HOOK_SECRET"))
    const payload = await req.text()
    const headers = Object.fromEntries(req.headers)
    const verifiedPayload = new Webhook(hookSecret).verify(payload, headers) as SendEmailHookPayload
    const emails = await buildRegistrationAwareEmails(
      verifiedPayload,
      { siteUrl: publicSiteUrl },
      Deno.env.toObject(),
      registrationHookBinding(Deno.env.toObject()),
    )
    const appApiKey = requiredEnv("CUSTOMERIO_APP_API_KEY")

    console.info("[send-email] dispatch", {
      actionType: verifiedPayload.email_data.email_action_type,
      transactionalMessageIds: emails.map((email) => email.transactional_message_id),
      recipients: emails.map((email) => maskEmail(email.to)),
    })

    await Promise.all(emails.map((email) => sendCustomerIoEmail(email, appApiKey)))

    return Response.json({}, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown"
    const isSignatureError = message.toLowerCase().includes("signature")
    console.error("[send-email] failed", {
      kind: isSignatureError ? "signature" : "delivery_or_configuration",
    })
    return Response.json(
      { error: isSignatureError ? "unauthorized" : "temporarily_unavailable" },
      { status: isSignatureError ? 401 : 500 },
    )
  }
})
