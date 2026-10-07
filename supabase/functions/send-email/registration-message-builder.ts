import {
  openRegistrationCredential,
  readRegistrationConfig,
  registrationCodeDigest,
  sealRegistrationCredential,
  type RegistrationClaims,
} from "../_shared/mobile-registration-credentials.ts"
import {
  buildCustomerIoEmails,
  type CustomerIoTransactionalEmail,
  type SendEmailHookPayload,
} from "./message-builder.ts"
import { buildPilotAwareEmails } from "./pilot-message-builder.ts"
export type RegistrationSendBinding = {
  attemptId: string
  sendGeneration: string
  requestHash: string
  email: string
  userId: string
  codeDigest: string
  codeKeyId: string
}
export type BindRegistrationSend = (binding: RegistrationSendBinding) => Promise<boolean>
function invalid(): never {
  throw new Error("mobile_registration_link_invalid")
}
/** Call only with StandardWebhooks-verified payload; never expose as an unsigned public builder endpoint. */
export async function buildRegistrationAwareEmails(
  payload: SendEmailHookPayload,
  options: { siteUrl: string },
  env: Record<string, string | undefined>,
  bind: BindRegistrationSend,
): Promise<CustomerIoTransactionalEmail[]> {
  const redirect = payload.email_data.redirect_to ?? ""
  let url: URL
  try {
    url = new URL(redirect)
  } catch {
    return buildPilotAwareEmails(payload, options, env)
  }
  const fragment = new URLSearchParams(url.hash.slice(1))
  if (!fragment.has("registrationRequest")) return buildPilotAwareEmails(payload, options, env)
  const config = readRegistrationConfig(env)
  if (
    url.origin !== "null" ||
    `${url.protocol}//${url.host}${url.pathname}` !== config.callbackUrl ||
    url.username ||
    url.password ||
    url.search ||
    [...fragment.keys()].length !== 1
  )
    invalid()
  const proof = await openRegistrationCredential(
    config,
    fragment.get("registrationRequest")!,
    "registration_request",
  )
  const email = payload.user.email?.toLowerCase()
  const userId = payload.user.id
  const code = payload.email_data.token
  const tokenHash = payload.email_data.token_hash
  if (
    (payload.email_data.email_action_type !== "signup" &&
      payload.email_data.email_action_type !== "magiclink") ||
    email !== proof.email ||
    !userId ||
    !code ||
    !tokenHash
  )
    invalid()
  const verification: RegistrationClaims = {
    ...proof,
    purpose: "registration_verification",
    userId,
    credential: tokenHash,
  }
  // Validate all provider identity/hash fields before writing even metadata.
  const linkProof = await sealRegistrationCredential(config, verification)
  const codeDigest = await registrationCodeDigest(config, proof, code)
  if (
    !(await bind({
      attemptId: proof.attemptId,
      sendGeneration: proof.sendGeneration,
      requestHash: proof.requestHash,
      email: proof.email,
      userId,
      codeDigest,
      codeKeyId: config.activeKeyId,
    }))
  )
    invalid()
  const callback = `${config.callbackUrl}#attemptId=${proof.attemptId}&tokenHash=${encodeURIComponent(linkProof)}`
  return buildCustomerIoEmails(payload, options).map((message) => ({
    ...message,
    message_data: {
      ...message.message_data,
      token_hash: linkProof,
      confirmation_url: callback,
      action_url: callback,
      magic_link_url: callback,
      reset_url: callback,
    },
  }))
}
export function registrationHookBinding(
  env: Record<string, string | undefined>,
): BindRegistrationSend {
  return async (b) => {
    const origin = env.SUPABASE_URL,
      key = env.SUPABASE_SERVICE_ROLE_KEY
    if (!origin || !key) invalid()
    const response = await fetch(`${origin}/rest/v1/rpc/mobile_registration_bind_send`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        p_attempt_id: b.attemptId,
        p_send_generation: b.sendGeneration,
        p_request_hash: b.requestHash,
        p_email: b.email,
        p_provider_user_id: b.userId,
        p_code_digest: b.codeDigest,
        p_code_key_id: b.codeKeyId,
      }),
    })
    if (!response.ok) throw new Error("mobile_registration_binding_unavailable")
    return (await response.json()) === true
  }
}
