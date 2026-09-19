import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { MobileError } from "./errors"

const apnsTokenSchema = z
  .string()
  .min(32)
  .max(200)
  .regex(/^[0-9a-fA-F]+$/)
  .refine((value) => value.length % 2 === 0)
  .transform((value) => value.toLowerCase())
const bundleIdentifierSchema = z
  .string()
  .min(3)
  .max(255)
  .regex(/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/)

export const mobilePushRegistrationSchema = z
  .object({
    installationId: z.uuid(),
    token: apnsTokenSchema,
    environment: z.enum(["sandbox", "production"]),
    topic: bundleIdentifierSchema,
  })
  .strict()
export const mobilePushRevocationSchema = z.object({ installationId: z.uuid() }).strict()

export type MobilePushRegistration = z.output<typeof mobilePushRegistrationSchema>
export type ApnsTopicAllowlist = Readonly<Record<"sandbox" | "production", readonly string[]>>

/**
 * A deployment must opt in to the exact bundle identifiers it can send to.
 * Example: {"sandbox":["de.chaarlie.app"],"production":["de.chaarlie.app"]}
 */
export function readApnsTopicAllowlist(
  environment: Record<string, string | undefined> = process.env,
): ApnsTopicAllowlist {
  const raw = environment.MOBILE_APNS_ALLOWED_TOPICS
  if (!raw || raw.length > 4096) throw new MobileError("temporarily_unavailable", 503)
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new MobileError("temporarily_unavailable", 503)
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new MobileError("temporarily_unavailable", 503)
  const record = parsed as Record<string, unknown>
  const values = (key: "sandbox" | "production") => {
    const value = record[key]
    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      value.some(
        (item) => typeof item !== "string" || !bundleIdentifierSchema.safeParse(item).success,
      )
    )
      throw new MobileError("temporarily_unavailable", 503)
    return [...new Set(value)]
  }
  return { sandbox: values("sandbox"), production: values("production") }
}

export function researchDeliveryEnabled(
  environment: Record<string, string | undefined> = process.env,
) {
  return environment.MOBILE_RESEARCH_DELIVERY_ENABLED === "true"
}

export async function registerMobilePushInstallation(
  client: SupabaseClient,
  userId: string,
  input: MobilePushRegistration,
  environment: Record<string, string | undefined> = process.env,
) {
  if (!researchDeliveryEnabled(environment)) throw new MobileError("not_found", 404)
  const allowed = readApnsTopicAllowlist(environment)
  if (!allowed[input.environment].includes(input.topic))
    throw new MobileError("invalid_request", 400)
  const { data, error } = await client.rpc("mobile_push_installation_register", {
    p_user_id: userId,
    p_installation_id: input.installationId,
    p_apns_token: input.token,
    p_environment: input.environment,
    p_topic: input.topic,
  })
  if (error || data !== true) throw new MobileError("temporarily_unavailable", 503)
}

export async function revokeMobilePushInstallation(
  client: SupabaseClient,
  userId: string,
  installationId: string,
) {
  const { data, error } = await client.rpc("mobile_push_installation_revoke", {
    p_user_id: userId,
    p_installation_id: installationId,
  })
  if (error || data !== true) throw new MobileError("temporarily_unavailable", 503)
}
