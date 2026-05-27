import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0"

import {
  buildCustomerIoEmails,
  type CustomerIoTransactionalEmail,
  type SendEmailHookPayload,
} from "./message-builder.ts"

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
    const body = await response.text()
    throw new Error(`Customer.io transactional email failed: ${response.status} ${body}`)
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 })
  }

  try {
    const appApiKey = requiredEnv("CUSTOMERIO_APP_API_KEY")
    const hookSecret = normalizeHookSecret(requiredEnv("SEND_EMAIL_HOOK_SECRET"))
    const payload = await req.text()
    const headers = Object.fromEntries(req.headers)
    const verifiedPayload = new Webhook(hookSecret).verify(payload, headers) as SendEmailHookPayload
    const emails = buildCustomerIoEmails(verifiedPayload, { siteUrl: publicSiteUrl })

    console.info("[send-email] dispatch", {
      actionType: verifiedPayload.email_data.email_action_type,
      transactionalMessageIds: emails.map((email) => email.transactional_message_id),
      recipients: emails.map((email) => maskEmail(email.to)),
    })

    await Promise.all(emails.map((email) => sendCustomerIoEmail(email, appApiKey)))

    return Response.json({}, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown send-email hook error"
    const isSignatureError = message.toLowerCase().includes("signature")
    console.error("[send-email]", message)
    return Response.json({ error: message }, { status: isSignatureError ? 401 : 500 })
  }
})
