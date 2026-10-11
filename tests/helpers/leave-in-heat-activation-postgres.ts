import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

import type { PGlite } from "@electric-sql/pglite"

import { migratedDatabase } from "../scan-expansion-batch-postgres.test"

/**
 * PGlite harness for Leave-In v1.2 heat activation (S3).
 *
 * Starts from the shared catalogue harness (`migratedDatabase`: stub tables +
 * the real Personal Plan publication chain), replays the Bondbuilder gate
 * migrations and the live eligibility expander, then closes the one known gap
 * between this harness and production: 20260812102000 (scalp-care thickness
 * applicability) is outside the harness chain, so its one-line widening of the
 * thickness exemption is applied here. The resulting bodies are then pinned to
 * the exact production digests the S3 schema migration's lineage guard
 * expects — the harness proves it is faithful before anything runs on it.
 */

const ROOT = new URL("../../", import.meta.url)

export const S3_SCHEMA_MIGRATION =
  "supabase/migrations/20261011160000_leave_in_heat_activation_schema.sql"

export const LIVE_DIGESTS = {
  expand: "797fc3dab95b3e6b80fcd40393f19df4a68191c59b3d6454fae77a882befcf7e",
  gate: "77b8b02f8f6dad278619a1c62259773c5a506429f23d9cadf27a4becb9c5f6b7",
  dependency: "fa824278149856a2cd052c5c87d8ab0dc9138d65463397d6021fadf1d8e564d5",
} as const

/** Production `product_leave_in_specs` columns before S3 (read 2026-10-11). */
export const PRODUCTION_LEAVE_IN_SPEC_COLUMNS = [
  "application_stage",
  "care_benefits",
  "care_direction",
  "category_key",
  "conditioner_relationship",
  "created_at",
  "format",
  "functional_benefits",
  "heat_activation_required",
  "heat_protection_max_c",
  "ingredient_flags",
  "plan_roles",
  "product_id",
  "provides_heat_protection",
  "repair_support_level",
  "roles",
  "updated_at",
  "weight",
] as const

export async function readRepoFile(path: string): Promise<string> {
  return readFile(new URL(path, ROOT), "utf8")
}

export async function functionDigest(pg: PGlite, signature: string): Promise<string> {
  const result = await pg.query<{ sha: string }>(
    `SELECT encode(sha256(convert_to(prosrc, 'UTF8')), 'hex') AS sha FROM pg_proc WHERE oid = $1::regprocedure`,
    [signature],
  )
  return result.rows[0]!.sha
}

/** Production-faithful pre-S3 database (no S3 migration applied). */
export async function preHeatActivationDatabase(t: {
  after: (fn: () => Promise<void>) => void
}): Promise<PGlite> {
  const pg = await migratedDatabase(t)
  for (const migration of [
    "supabase/migrations/20260929230000_expansion_protocol_binding_repair.sql",
    "supabase/migrations/20261002132306_bondbuilder_research_profile_storage.sql",
    "supabase/migrations/20260314235000_secure_leave_in_eligibility.sql",
  ])
    await pg.exec(await readRepoFile(migration))
  // The shared harness stubs the three Leave-In tables loosely. Bring them to the
  // production shape (columns, generated relationship, row-local CHECKs; read
  // 2026-10-11) so exact row comparisons and CHECK interplay are faithful.
  await pg.exec(`
    ALTER TABLE public.product_leave_in_specs
      ALTER COLUMN heat_activation_required SET DEFAULT false,
      ALTER COLUMN heat_activation_required SET NOT NULL,
      ADD COLUMN category_key text NOT NULL DEFAULT 'leave_in' CHECK (category_key = 'leave_in'),
      ADD COLUMN conditioner_relationship text GENERATED ALWAYS AS (
        CASE WHEN 'replacement_conditioner' = ANY (roles) THEN 'replacement_capable' ELSE 'booster_only' END
      ) STORED,
      ADD CONSTRAINT product_leave_in_specs_heat_activation_requires_styling_role
        CHECK (heat_activation_required = false OR roles @> ARRAY['styling_prep']),
      ADD CONSTRAINT product_leave_in_specs_application_stage_check
        CHECK (application_stage <@ ARRAY['towel_dry', 'dry_hair', 'pre_heat', 'post_style']),
      ADD CONSTRAINT product_leave_in_specs_roles_check
        CHECK (roles <@ ARRAY['replacement_conditioner', 'extension_conditioner', 'styling_prep', 'oil_replacement']);
    ALTER TABLE public.product_leave_in_fit_specs
      ADD CONSTRAINT product_leave_in_fit_specs_conditioner_relationship_check
        CHECK (conditioner_relationship = ANY (ARRAY['replacement_capable', 'booster_only']));
    ALTER TABLE public.product_leave_in_eligibility
      ADD COLUMN category_key text NOT NULL DEFAULT 'leave_in',
      ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  `)
  const specColumns = await pg.query<{ column_name: string }>(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_leave_in_specs' ORDER BY column_name",
  )
  assert.deepEqual(
    specColumns.rows.map((row) => row.column_name),
    [...PRODUCTION_LEAVE_IN_SPEC_COLUMNS].sort(),
    "harness product_leave_in_specs has the production column set",
  )
  const gate = await pg.query<{ prosrc: string }>(
    "SELECT prosrc FROM pg_proc WHERE oid = 'public.assert_personal_plan_curated_publication_v1_without_v2(uuid)'::regprocedure",
  )
  const needle = "    v_product.category_key = 'heat_protectant'\n    OR pg_catalog.cardinality"
  const body = gate.rows[0]!.prosrc
  assert.ok(body.includes(needle), "harness gate body has the pre-20260812102000 exemption")
  const patched = body.replace(
    needle,
    "    v_product.category_key IN ('heat_protectant', 'dry_shampoo', 'scalp_care')\n    OR pg_catalog.cardinality",
  )
  assert.ok(!patched.includes("$s3body$"))
  await pg.exec(
    `CREATE OR REPLACE FUNCTION public.assert_personal_plan_curated_publication_v1_without_v2(p_product_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $s3body$${patched}$s3body$`,
  )
  assert.equal(
    await functionDigest(
      pg,
      "public.expand_leave_in_eligibility(text[],text[],text[],text[],boolean,boolean)",
    ),
    LIVE_DIGESTS.expand,
  )
  assert.equal(
    await functionDigest(pg, "public.assert_personal_plan_curated_publication_v1_without_v2(uuid)"),
    LIVE_DIGESTS.gate,
  )
  assert.equal(
    await functionDigest(pg, "public.validate_personal_plan_curated_publication_dependency()"),
    LIVE_DIGESTS.dependency,
  )
  return pg
}

/** Pre-S3 database + the S3 schema migration. */
export async function heatActivationDatabase(t: {
  after: (fn: () => Promise<void>) => void
}): Promise<PGlite> {
  const pg = await preHeatActivationDatabase(t)
  await pg.exec(await readRepoFile(S3_SCHEMA_MIGRATION))
  return pg
}

export type LeaveInSeed = {
  id: string
  origin?: "curated" | "user_submitted"
  recommended?: boolean
  thicknesses?: string[]
  specs?: Partial<{
    roles: string[]
    plan_roles: string[]
    application_stage: string[]
    provides_heat_protection: boolean
    heat_activation_required: boolean
    heat_activation_route: string | null
    functional_benefits: string[]
    care_benefits: string[]
  }>
  fit?: string
  protocols?: Array<{ role: string; family?: string }>
}

export const SOURCE_URL = "https://example.test/manufacturer-directions"

export function protocolPayloads(productId: string, role: string, family: string) {
  const scope = { kind: "product", category: "leave_in", productId }
  return {
    v1: {
      schemaVersion: 1,
      scope,
      applicationFamily: family,
      evidence: [{ sourceUrl: SOURCE_URL, sourceType: "manufacturer", checkedAt: "2026-10-09" }],
    },
    v2: {
      schemaVersion: 2,
      contractKind: "product_pointer",
      scope,
      sourceRole: role,
      applicationFamily: family,
      runtimeBlockerCode: null,
    },
  }
}

const DEFAULT_FAMILY: Record<string, string> = {
  post_wash_leave_in: "post_wash_damp_conditioning",
  pre_heat_protection: "pre_heat_damp",
}

/** Inserts one leave-in with specs, fit and protocols (no transaction control). */
export async function insertLeaveIn(pg: PGlite, seed: LeaveInSeed): Promise<void> {
  const specs = {
    roles: ["styling_prep"],
    plan_roles: ["pre_heat_application"],
    application_stage: ["towel_dry"],
    provides_heat_protection: true,
    heat_activation_required: false,
    heat_activation_route: null,
    functional_benefits: ["heat_protect"],
    care_benefits: ["anti_frizz"],
    ...seed.specs,
  }
  await pg.query(
    `INSERT INTO public.products (id, name, category, category_key, origin, is_active, lifecycle_status, is_chaarlie_recommended, suitable_thicknesses)
     VALUES ($1, $2, 'Leave-in', 'leave_in', $3, true, 'active', $4, $5)`,
    [
      seed.id,
      `Leave-in ${seed.id.slice(0, 8)}`,
      seed.origin ?? "curated",
      seed.recommended ?? true,
      seed.thicknesses ?? ["normal"],
    ],
  )
  // `heat_activation_route` exists only after the S3 schema migration; omit it when null
  // so the same seed runs against the pre-S3 database.
  const withRoute = specs.heat_activation_route !== null
  await pg.query(
    `INSERT INTO public.product_leave_in_specs (product_id, format, weight, roles, provides_heat_protection,
       heat_activation_required, care_benefits, application_stage, care_direction,
       repair_support_level, plan_roles, functional_benefits${withRoute ? ", heat_activation_route" : ""})
     VALUES ($1, 'spray', 'medium', $2, $3, $4, $5, $6, 'balanced', 'low', $7, $8${withRoute ? ", $9" : ""})`,
    [
      seed.id,
      specs.roles,
      specs.provides_heat_protection,
      specs.heat_activation_required,
      specs.care_benefits,
      specs.application_stage,
      specs.plan_roles,
      specs.functional_benefits,
      ...(withRoute ? [specs.heat_activation_route] : []),
    ],
  )
  await pg.query(
    `INSERT INTO public.product_leave_in_fit_specs (product_id, weight, conditioner_relationship, care_benefits)
     VALUES ($1, 'medium', $2, ARRAY['detangle_smooth'])`,
    [seed.id, seed.fit ?? "booster_only"],
  )
  for (const protocol of seed.protocols ?? [])
    await insertProtocol(pg, seed.id, protocol.role, protocol.family)
}

export async function insertProtocol(
  pg: PGlite,
  productId: string,
  role: string,
  family = DEFAULT_FAMILY[role] ?? "pre_heat_damp",
): Promise<void> {
  const payloads = protocolPayloads(productId, role, family)
  await pg.query(
    `INSERT INTO public.product_application_protocols (product_id, category, role, application_state, reapplication,
       source_url, source_text, guidance_payload, guidance_payload_v2)
     VALUES ($1, 'leave_in', $2, $3, $4, $5, 'Verbatim manufacturer directions.', $6::jsonb, $7::jsonb)`,
    [
      productId,
      role,
      role === "pre_heat_protection" ? (family === "pre_heat_dry" ? "dry" : "damp") : null,
      role === "pre_heat_protection" ? "required" : null,
      SOURCE_URL,
      JSON.stringify(payloads.v1),
      JSON.stringify(payloads.v2),
    ],
  )
}

/** Runs `body` in one transaction; resolves to the error message, or null when COMMIT succeeded. */
export async function transaction(
  pg: PGlite,
  body: (pg: PGlite) => Promise<void>,
): Promise<string | null> {
  await pg.exec("BEGIN")
  try {
    await body(pg)
    await pg.exec("COMMIT")
    return null
  } catch (error) {
    await pg.exec("ROLLBACK").catch(() => undefined)
    return error instanceof Error ? error.message : String(error)
  }
}
