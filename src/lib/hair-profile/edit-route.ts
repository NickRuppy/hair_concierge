import "server-only"

import { z } from "zod"
import { hasCompletedQuizDiagnostics } from "@/lib/quiz/completion"
import { ProfileEditError, publishProfileEdit } from "@/lib/scan/profile-edit"
import { prepareScannerContext } from "@/lib/scan/scanner-context"
import { readScannerProfileSource } from "@/lib/scan/scanner-context-supabase"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  CHEMICAL_TREATMENTS,
  CUTICLE_CONDITIONS,
  GOALS,
  HAIR_DENSITIES,
  HAIR_LENGTHS,
  HAIR_TEXTURES,
  HAIR_THICKNESSES,
  PROFILE_CONCERNS,
  PROTEIN_MOISTURE_LEVELS,
  SCALP_CONDITIONS,
  SCALP_TYPES,
} from "@/lib/vocabulary"

export const profileAnswersPatchSchema = z
  .object({
    hair_texture: z.enum(HAIR_TEXTURES).nullable(),
    thickness: z.enum(HAIR_THICKNESSES).nullable(),
    density: z.enum(HAIR_DENSITIES).nullable(),
    hair_length: z.enum(HAIR_LENGTHS).nullable(),
    cuticle_condition: z.enum(CUTICLE_CONDITIONS).nullable(),
    protein_moisture_balance: z.enum(PROTEIN_MOISTURE_LEVELS).nullable(),
    scalp_type: z.enum(SCALP_TYPES).nullable(),
    scalp_condition: z.enum(SCALP_CONDITIONS).nullable(),
    chemical_treatment: z.array(z.enum(CHEMICAL_TREATMENTS)),
    concerns: z.array(z.enum(PROFILE_CONCERNS)),
    // The existing web picker limits new selections, but its prior direct
    // upsert also preserved larger prefills from the regular quiz.
    goals: z.array(z.enum(GOALS)).min(1),
  })
  .partial()
  .strict()
  .superRefine((patch, ctx) => {
    if (Object.keys(patch).length === 0)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Keine Antworten zum Speichern" })
    if (patch.goals?.includes("volume") && patch.goals.includes("less_volume"))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["goals"],
        message: "Mehr und weniger Volumen schliessen sich aus",
      })
    if (patch.chemical_treatment?.includes("natural") && patch.chemical_treatment.length > 1)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["chemical_treatment"],
        message: "Naturhaar kann nicht mit chemischen Behandlungen kombiniert werden",
      })
  })

export async function authenticatedProfileUser(client: {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> }
}) {
  return (await client.auth.getUser()).data.user?.id ?? null
}

export type ProfileEditRouteClient = {
  from: (table: string) => {
    upsert: (
      row: Record<string, unknown>,
      options: { onConflict: string },
    ) => { select: () => { single: () => Promise<{ data: unknown; error: unknown }> } }
  }
}

export type ProfileEditRouteDeps = {
  createAdminClient: typeof createAdminClient
  readScannerProfileSource: typeof readScannerProfileSource
  prepareScannerContext: typeof prepareScannerContext
  publishProfileEdit: typeof publishProfileEdit
  randomUUID: () => string
}

export type CompatibleProfileEditResult =
  | { kind: "legacy"; profile: unknown }
  | {
      kind: "published"
      profile: Record<string, unknown>
      profileRevision: string
      contextRevision: string
    }

async function legacyWrite(
  client: ProfileEditRouteClient,
  userId: string,
  patch: Record<string, unknown>,
) {
  return client
    .from("hair_profiles")
    .upsert(
      { user_id: userId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    )
    .select()
    .single()
}

/**
 * The caller has already authenticated the owner and validated its route-specific patch.
 * An unavailable source never falls through to legacy storage. A source that is incomplete
 * before the patch, or a valid explicit clear that makes the resulting profile incomplete,
 * preserves the existing non-scanner upsert behavior.
 */
export async function saveCompatibleProfileEdit(
  deps: ProfileEditRouteDeps,
  client: ProfileEditRouteClient,
  userId: string,
  patch: Record<string, unknown>,
): Promise<CompatibleProfileEditResult> {
  let source
  try {
    source = await deps.readScannerProfileSource(deps.createAdminClient(), userId)
  } catch {
    throw new ProfileEditError("temporarily_unavailable")
  }

  let prepared
  try {
    prepared = deps.prepareScannerContext(source)
  } catch {
    throw new ProfileEditError("temporarily_unavailable")
  }

  const nextProfile = { ...(source.profile ?? {}), ...patch }
  if (!prepared || !hasCompletedQuizDiagnostics(nextProfile)) {
    const { data, error } = await legacyWrite(client, userId, patch)
    if (error) throw error
    return { kind: "legacy", profile: data }
  }

  const result = await deps.publishProfileEdit(deps.createAdminClient(), userId, {
    expectedProfileRevision: source.profileRevision,
    requestId: deps.randomUUID(),
    patch,
  })
  return {
    kind: "published",
    profile: result.profile,
    profileRevision: result.profileRevision,
    contextRevision: result.contextRevision,
  }
}
