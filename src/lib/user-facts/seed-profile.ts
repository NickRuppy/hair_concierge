import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { BRUSH_TYPES } from "@/lib/vocabulary/onboarding-care"

import {
  legacyColumnsToCareHabits,
  type LegacyCareHabitColumns,
} from "./backfill/legacy-columns-to-care-habits"
import {
  legacyColumnsToDiagnostics,
  type LegacyDiagnosticColumns,
} from "./backfill/legacy-columns-to-diagnostics"
import { saveUserFacts, type SaveUserFactsResult } from "./save"
import {
  CARE_HABITS_SCHEMA_VERSION,
  DIAGNOSTICS_SCHEMA_VERSION,
  careHabitsV1Schema,
  diagnosticsV1Schema,
} from "./schema"

/**
 * THE seeding helper for dev users, the chat eval, local fixture scripts and Playwright specs
 * (clean-switch task 7B): a `hair_profiles` row described in the legacy column vocabulary is
 * written THROUGH THE DOOR (`user_facts_save_v1`, via `saveUserFacts`), so it carries real fact
 * documents and survives the lock (`20260930120000_user_facts_lock.sql`), which rejects every
 * other write of a fact column.
 *
 * - The columns are converted with the ONE legacy->native conversion the backfill uses
 *   (`legacyColumnsToDiagnostics`, `legacyColumnsToCareHabits`, `brush_type` lifted as
 *   `brushesCombs`); a value outside the native vocabulary is dropped, never coerced. What the
 *   door then derives into the columns is what the seed reads back.
 * - Replacement per domain, like the upserts it replaces: a domain the seed names is rewritten
 *   from exactly the named columns (a named `null` clears); a domain it does not name is left
 *   alone. Provenance `legacy_columns`: a seed stands for a pre-switch profile.
 * - The four columns no domain derives (`additional_notes`, `conversation_memory`,
 *   `products_used`, `routine_preference`) are written directly afterwards — the lock leaves
 *   them free. Any other key throws, so a seed can never silently lose a value.
 *
 * Needs a service-role client (the door is granted to `service_role` only).
 */

const DIAGNOSTIC_COLUMNS = [
  "hair_texture",
  "thickness",
  "density",
  "hair_length",
  "cuticle_condition",
  "protein_moisture_balance",
  "scalp_type",
  "scalp_condition",
  "chemical_treatment",
  "concerns",
  "goals",
  "desired_volume",
  "primary_concern",
] as const

const CARE_COLUMNS = [
  "towel_material",
  "towel_technique",
  "drying_method",
  "styling_tools",
  "heat_styling",
  "uses_heat_protection",
  "night_protection",
  "brush_type",
] as const

const NON_FACT_COLUMNS = [
  "additional_notes",
  "conversation_memory",
  "products_used",
  "routine_preference",
] as const

type SeedColumn =
  | (typeof DIAGNOSTIC_COLUMNS)[number]
  | (typeof CARE_COLUMNS)[number]
  | (typeof NON_FACT_COLUMNS)[number]

/** A seed in the legacy column vocabulary; `user_id` may be repeated (it must match). */
export type SeedHairProfile = Partial<Record<SeedColumn, unknown>> & { user_id?: string }

const ARRAY_COLUMNS = new Set<string>([
  "chemical_treatment",
  "concerns",
  "goals",
  "styling_tools",
  "night_protection",
  "brush_type",
])

const BRUSH_TYPE_VALUES = new Set<string>(BRUSH_TYPES)

/** A column value as the conversions read it: a string, a string array for the array columns,
 * a boolean for heat protection, else nothing (`null`). */
function columnValue(column: string, value: unknown): string | string[] | boolean | null {
  if (ARRAY_COLUMNS.has(column)) {
    return Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string")
      : null
  }
  if (column === "uses_heat_protection") return typeof value === "boolean" ? value : null
  return typeof value === "string" ? value : null
}

function columnsOf<Column extends string>(
  profile: SeedHairProfile,
  columns: readonly Column[],
): Record<Column, never> {
  return Object.fromEntries(
    columns.map((column) => [
      column,
      columnValue(column, (profile as Record<string, unknown>)[column]),
    ]),
  ) as Record<Column, never>
}

/** Every field of the domain `null` (the door's "clear"), then the new document over it. */
function replacement(fields: readonly string[], document: Record<string, unknown>) {
  const patch: Record<string, unknown> = Object.fromEntries(fields.map((field) => [field, null]))
  for (const [field, value] of Object.entries(document))
    if (value !== undefined) patch[field] = value
  return patch
}

function assertWritten(
  result: SaveUserFactsResult,
  domain: string,
  userId: string,
): asserts result is Extract<SaveUserFactsResult, { status: "ok" }> {
  if (result.status !== "ok") {
    throw new Error(`seedHairProfile(${userId}): ${domain} write returned ${result.status}`)
  }
}

export async function seedHairProfile(
  client: SupabaseClient,
  userId: string,
  profile: SeedHairProfile,
  options: { now?: string } = {},
): Promise<{ revision: number }> {
  const known = new Set<string>([...DIAGNOSTIC_COLUMNS, ...CARE_COLUMNS, ...NON_FACT_COLUMNS])
  for (const key of Object.keys(profile)) {
    if (key === "user_id") {
      if (profile.user_id !== userId) throw new Error("seedHairProfile: user_id mismatch")
      continue
    }
    if (!known.has(key)) throw new Error(`seedHairProfile: unknown hair_profiles column "${key}"`)
  }
  const names = (columns: readonly string[]) => columns.some((column) => column in profile)
  const now = options.now ?? new Date().toISOString()

  const current = await client
    .from("hair_profiles")
    .select("facts_revision")
    .eq("user_id", userId)
    .maybeSingle()
  if (current.error) throw new Error(`seedHairProfile: ${current.error.message}`)
  let revision = (current.data as { facts_revision?: number } | null)?.facts_revision ?? 0

  if (names(DIAGNOSTIC_COLUMNS)) {
    const document = legacyColumnsToDiagnostics(
      columnsOf(profile, DIAGNOSTIC_COLUMNS) as unknown as LegacyDiagnosticColumns,
      {},
    )
    const result = await saveUserFacts(client, {
      userId,
      domain: "diagnostics",
      patch: replacement(
        Object.keys(diagnosticsV1Schema.shape).filter((field) => field !== "source"),
        document,
      ),
      provenance: {
        source: { kind: "legacy_columns" },
        schemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
        at: now,
      },
      expectedRevision: revision,
      mode: "upsert",
    })
    assertWritten(result, "diagnostics", userId)
    revision = result.revision
  }

  if (names(CARE_COLUMNS)) {
    const columns = columnsOf(profile, CARE_COLUMNS) as unknown as LegacyCareHabitColumns & {
      brush_type: string[] | null
    }
    const document = {
      ...legacyColumnsToCareHabits(columns),
      ...(columns.brush_type
        ? {
            brushesCombs: [...new Set(columns.brush_type)].filter((brush) =>
              BRUSH_TYPE_VALUES.has(brush),
            ),
          }
        : {}),
    }
    const result = await saveUserFacts(client, {
      userId,
      domain: "care_habits",
      patch: replacement(Object.keys(careHabitsV1Schema.shape), document) as never,
      provenance: {
        source: { kind: "legacy_columns" },
        schemaVersion: CARE_HABITS_SCHEMA_VERSION,
        at: now,
      },
      expectedRevision: revision,
      mode: "upsert",
    })
    assertWritten(result, "care_habits", userId)
    revision = result.revision
  }

  const free = Object.fromEntries(
    NON_FACT_COLUMNS.filter((column) => column in profile).map((column) => [
      column,
      (profile as Record<string, unknown>)[column] ?? null,
    ]),
  )
  if (Object.keys(free).length > 0) {
    // The door created the row if a domain was named; otherwise a bare row (every fact column at
    // its default, which the lock allows) carries the free fields.
    const exists = current.data !== null || names(DIAGNOSTIC_COLUMNS) || names(CARE_COLUMNS)
    const { error } = exists
      ? await client.from("hair_profiles").update(free).eq("user_id", userId)
      : await client.from("hair_profiles").insert({ user_id: userId, ...free })
    if (error) throw new Error(`seedHairProfile: ${error.message}`)
  }

  return { revision }
}
