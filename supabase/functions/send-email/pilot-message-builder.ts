import { eligibleAccount, readPilotConfig, sealCredential } from "../_shared/mobile-credentials.ts"
import {
  buildCustomerIoEmails,
  type CustomerIoTransactionalEmail,
  type SendEmailHookPayload,
} from "./message-builder.ts"

type BuildOptions = { siteUrl: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TOKEN_HASH = /^[A-Za-z0-9_-]{32,256}$/

function invalidPilotLink(): never {
  throw new Error("mobile_pilot_link_invalid")
}

function pilotAttemptId(redirectTo: string): string | null {
  const declaresPilotScheme = redirectTo.trimStart().toLowerCase().startsWith("chaarlie-pilot:")
  let url: URL
  try {
    url = new URL(redirectTo)
  } catch {
    if (declaresPilotScheme) invalidPilotLink()
    return null
  }
  if (url.protocol !== "chaarlie-pilot:") return null
  if (
    url.hostname !== "auth" ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "" ||
    url.search ||
    !/^#attemptId=([0-9a-f-]{36})$/i.test(url.hash)
  ) {
    invalidPilotLink()
  }
  const attemptId = url.hash.slice("#attemptId=".length)
  if (!UUID.test(attemptId)) invalidPilotLink()
  return attemptId
}

function withPilotProof(email: CustomerIoTransactionalEmail, callbackUrl: string, proof: string) {
  return {
    ...email,
    message_data: {
      ...email.message_data,
      token_hash: proof,
      confirmation_url: callbackUrl,
      action_url: callbackUrl,
      magic_link_url: callbackUrl,
      reset_url: callbackUrl,
    },
  }
}

export async function buildPilotAwareEmails(
  payload: SendEmailHookPayload,
  options: BuildOptions,
  env: Record<string, string | undefined>,
): Promise<CustomerIoTransactionalEmail[]> {
  const redirectTo = payload.email_data.redirect_to ?? ""
  const attemptId = pilotAttemptId(redirectTo)
  if (!attemptId) return buildCustomerIoEmails(payload, options)
  if (payload.email_data.email_action_type !== "magiclink") invalidPilotLink()
  if (typeof payload.user.email !== "string" || typeof payload.user.id !== "string")
    invalidPilotLink()
  const tokenHash = payload.email_data.token_hash
  if (!tokenHash || !TOKEN_HASH.test(tokenHash)) invalidPilotLink()

  const config = readPilotConfig(env)
  const account = eligibleAccount(config, payload.user.email)
  if (!account || account.userId !== payload.user.id) invalidPilotLink()
  const proof = await sealCredential(config, {
    purpose: "verification",
    credential: tokenHash,
    userId: account.userId,
    email: account.email,
    attemptId,
    expiresAt: Math.min(config.expiresAt, Math.floor(Date.now() / 1000) + 3600),
  })
  const callbackUrl = `chaarlie-pilot://auth#attemptId=${attemptId}&tokenHash=${encodeURIComponent(proof)}`
  return buildCustomerIoEmails(payload, options).map((email) =>
    withPilotProof(email, callbackUrl, proof),
  )
}
