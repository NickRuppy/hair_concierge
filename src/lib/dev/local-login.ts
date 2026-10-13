import type { SupabaseClient, User } from "@supabase/supabase-js"

import { seedHairProfile } from "@/lib/user-facts/seed-profile"

export const LOCAL_DEV_LOGIN_FLAG = "LOCAL_DEV_LOGIN_ENABLED"

const DEFAULT_LOCAL_EMAIL = "local-dev@hairconscierge.test"
const DEFAULT_LOCAL_PASSWORD = "LocalDev!2026"
type LocalDevRequestSource = {
  headers: Headers
  socket?: { remoteAddress?: string }
}

function isLoopbackAuthority(value: string): boolean {
  if (value.toLowerCase() === "::1") return true
  const match = /^(localhost|127\.0\.0\.1|\[::1\])(?::([0-9]{1,5}))?$/i.exec(value)
  return Boolean(match && (!match[2] || Number(match[2]) <= 65535))
}

function isLoopbackClient(value: string): boolean {
  // Node may expose an IPv4 socket as an IPv4-mapped IPv6 address.
  return value.toLowerCase() === "::ffff:127.0.0.1" || isLoopbackAuthority(value)
}

export function isLocalDevLoginEnabled(): boolean {
  return process.env.NODE_ENV === "development" && process.env[LOCAL_DEV_LOGIN_FLAG] === "1"
}

export function isLocalDevLoginHost(host: string | null, source?: LocalDevRequestSource): boolean {
  if (!host || !isLoopbackAuthority(host)) return false
  if (source?.socket?.remoteAddress && !isLoopbackClient(source.socket.remoteAddress)) return false
  if (!source) return true

  // Next's App Router Request has no socket. Next supplies x-forwarded-for from
  // the socket when absent; treat any supplied remote hop as a reason to deny.
  for (const name of ["x-forwarded-for", "x-real-ip", "x-forwarded-host"]) {
    const value = source.headers.get(name)
    if (value !== null && !value.split(",").every((part) => isLoopbackClient(part.trim()))) {
      return false
    }
  }
  const forwarded = source.headers.get("forwarded")
  if (forwarded !== null) {
    for (const hop of forwarded.split(",")) {
      let hasClient = false
      for (const parameter of hop.split(";")) {
        const [key, ...parts] = parameter.trim().split("=")
        if (!["for", "host"].includes(key.toLowerCase())) continue
        const value = parts.join("=").replace(/^"([^"\\]*)"$/, "$1")
        if (!isLoopbackClient(value)) return false
        hasClient = true
      }
      if (!hasClient) return false
    }
  }
  return true
}

export function resolveLocalDevCredentials() {
  return {
    email: process.env.LOCAL_DEV_LOGIN_EMAIL?.trim() || DEFAULT_LOCAL_EMAIL,
    password: process.env.LOCAL_DEV_LOGIN_PASSWORD || DEFAULT_LOCAL_PASSWORD,
  }
}

export function normalizeLocalDevNext(rawNext: string | null): string {
  if (!rawNext) return "/chat"
  if (!rawNext.startsWith("/") || rawNext.startsWith("//") || rawNext.includes("\\")) {
    return "/chat"
  }
  return rawNext
}

export async function ensureLocalDevUser(
  admin: SupabaseClient,
  email: string,
  password: string,
): Promise<User> {
  const existing = await findUserByEmail(admin, email)

  const user = existing
    ? await refreshLocalDevUser(admin, existing.id)
    : await createLocalDevUser(admin, email, password)

  await seedLocalDevProfile(admin, user.id, email)
  return user
}

async function findUserByEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle()

  if (profileError) {
    throw new Error(`Could not look up local dev profile: ${profileError.message}`)
  }

  if (profile?.id) {
    const { data, error } = await admin.auth.admin.getUserById(profile.id)
    if (error) {
      throw new Error(`Could not load local dev auth user: ${error.message}`)
    }
    return data.user
  }

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) {
    throw new Error(`Could not list auth users: ${error.message}`)
  }

  return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null
}

async function createLocalDevUser(
  admin: SupabaseClient,
  email: string,
  password: string,
): Promise<User> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Local Dev User" },
  })

  if (error || !data.user) {
    throw new Error(`Could not create local dev user: ${error?.message ?? "unknown error"}`)
  }

  return data.user
}

async function refreshLocalDevUser(admin: SupabaseClient, userId: string): Promise<User> {
  const { data, error } = await admin.auth.admin.updateUserById(userId, {
    email_confirm: true,
    user_metadata: { full_name: "Local Dev User" },
  })

  if (error || !data.user) {
    throw new Error(`Could not refresh local dev user: ${error?.message ?? "unknown error"}`)
  }

  return data.user
}

export async function resetLocalDevUserPassword(
  admin: SupabaseClient,
  userId: string,
  password: string,
): Promise<User> {
  const { data, error } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
    user_metadata: { full_name: "Local Dev User" },
  })

  if (error || !data.user) {
    throw new Error(`Could not update local dev user: ${error?.message ?? "unknown error"}`)
  }

  return data.user
}

async function seedLocalDevProfile(
  admin: SupabaseClient,
  userId: string,
  email: string,
): Promise<void> {
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: userId,
      email,
      full_name: "Local Dev User",
      onboarding_completed: true,
      onboarding_step: "celebration",
      subscription_status: "active",
      subscription_interval: "month",
      current_period_end: periodEnd,
    },
    { onConflict: "id" },
  )
  if (profileError) {
    throw new Error(`Could not seed local dev profile: ${profileError.message}`)
  }

  // Through the door (`user_facts_save_v1`): the dev user gets real fact documents, and the
  // seed keeps working once the lock rejects direct fact-column writes.
  try {
    await seedHairProfile(admin, userId, {
      hair_texture: "wavy",
      thickness: "fine",
      density: "medium",
      concerns: ["frizz"],
      goals: ["less_frizz", "shine", "volume"],
      cuticle_condition: "rough",
      protein_moisture_balance: "stretches_bounces",
      scalp_type: "balanced",
      scalp_condition: null,
      chemical_treatment: ["colored"],
      heat_styling: "never",
      styling_tools: [],
      towel_material: "mikrofaser",
      towel_technique: "gentle_press",
      drying_method: "air_dry",
      brush_type: ["wide_tooth_comb"],
      night_protection: [],
      uses_heat_protection: false,
    })
  } catch (error) {
    throw new Error(
      `Could not seed local dev hair profile: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const { error: routineError } = await admin.from("user_product_usage").upsert(
    [
      {
        user_id: userId,
        category: "shampoo",
        product_name: "Local Dev Shampoo",
        frequency_range: "weekly_3_4x",
      },
      {
        user_id: userId,
        category: "conditioner",
        product_name: "Local Dev Conditioner",
        frequency_range: "weekly_3_4x",
      },
    ],
    { onConflict: "user_id,category" },
  )
  if (routineError) {
    throw new Error(`Could not seed local dev routine inventory: ${routineError.message}`)
  }
}
