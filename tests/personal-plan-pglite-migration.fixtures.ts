import { readFile } from "node:fs/promises"

import { PGlite } from "@electric-sql/pglite"
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp"

/**
 * Shared PGlite harness for the two Stage-2/Stage-3 activation RPCs added in
 * PR 1 (`personal_plan_complete_stage2_module`,
 * `personal_plan_complete_draft_activate_v2`). These functions call several
 * OTHER real RPCs internally (`personal_plan_enqueue_routine_source_change`,
 * `personal_plan_complete_draft_activate_initial_v1`,
 * `personal_plan_confirm_routine_proposal`, …), so a fidelity-preserving test
 * must apply the REAL prerequisite migration files rather than reimplement
 * their logic — a stub would silently drift from production the moment any
 * of those functions changes.
 *
 * What IS stubbed (and why it is safe to stub):
 *   - `public.profiles`, `public.product_categories`, `public.products`,
 *     `public.product_submissions`: these are foreign-key TARGETS the
 *     foundation/routine-backend DDL references. Only their column shapes
 *     matter for the DDL to apply; the two RPCs under test never join through
 *     them except inside `ownedProducts` / `pendingProducts` / `plannedPurchases`
 *     EXISTS-checks, which every test here satisfies with EMPTY arrays (a
 *     vacuous EXISTS-over-empty-array is always satisfied), so no row content
 *     in these stub tables is ever asserted on.
 *   - `public.update_updated_at_column()`, `auth.uid()`: generic,
 *     project-wide utility functions defined far outside this feature's own
 *     migrations (00001_initial_schema.sql and Supabase's own `auth` schema
 *     respectively). Copied verbatim; they are one-line pass-throughs with no
 *     feature-specific behavior to drift.
 *   - `extensions."uuid-ossp"`: a real Postgres extension PGlite bundles
 *     (`@electric-sql/pglite/contrib/uuid_ossp`), enabled for real rather than
 *     stubbed — `extensions.uuid_generate_v4()` runs the actual C extension.
 *
 * What is REAL (read from the migration files at test-run time, exactly like
 * `personal-plan-refinement-answer-provenance-migration.test.ts`):
 *   - 20260808062602 (Stage 1-3 foundation): personal_plans,
 *     personal_plan_need_versions, personal_plan_refinement_drafts,
 *     personal_plan_product_drafts, personal_plan_portfolio_versions, and
 *     `personal_plan_create_or_reuse_initial_need` /
 *     `personal_plan_complete_refinement_draft` /
 *     `personal_plan_create_or_load_product_draft`.
 *   - 20260808062603 (routine backend): routine_versions, routine_proposals,
 *     the source-change outbox, `personal_plan_enqueue_routine_source_change`,
 *     `personal_plan_complete_product_draft_and_stage_routine`,
 *     `personal_plan_confirm_routine_proposal`.
 *   - 20260811154526 (initial routine activation v1):
 *     `personal_plan_complete_draft_activate_initial_v1`.
 *   - 20260817085000 (direct-acceptance provenance columns): adds
 *     `unrefined_direct_accept` / `nudge_dismissed_until` to `personal_plans`,
 *     both read/written by the v2 wrapper under test.
 *   - 20260825120000 (answer provenance): applied for real deploy-order
 *     fidelity even though neither RPC under test reads its column.
 *   - 20260825130000 / 20260825140000: the two migrations under test.
 */

const ROOT = new URL("../", import.meta.url)

const MIGRATIONS = [
  "supabase/migrations/20260808062602_personal_plan_stage1_3_foundation.sql",
  "supabase/migrations/20260808062603_personal_plan_routine_backend.sql",
  // The successor lifecycle (`personal_plan_stage_routine_successor`) and the
  // source-reconciliation patch that rewrites its portfolio-lineage guard. The
  // recompute lane's historical-Routine re-activation stages through exactly
  // this pair, so a faithful test must apply both, in deploy order.
  "supabase/migrations/20260808070000_personal_plan_routine_successor_lifecycle.sql",
  "supabase/migrations/20260808071000_personal_plan_routine_source_reconciliation.sql",
  "supabase/migrations/20260811154526_personal_plan_initial_routine_activation_v1.sql",
  "supabase/migrations/20260817085000_personal_plan_direct_acceptance_provenance.sql",
  "supabase/migrations/20260825120000_personal_plan_refinement_answer_provenance.sql",
  "supabase/migrations/20260825130000_personal_plan_complete_stage2_module.sql",
  "supabase/migrations/20260825140000_personal_plan_refinement_recompute_activation.sql",
] as const

const STUB_PREREQUISITES = `
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Supabase's real auth schema is not part of any tracked migration; RLS
-- policies in the foundation migration reference auth.uid() literally.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;

-- Copied verbatim from supabase/migrations/00001_initial_schema.sql:410-418.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Minimal FK targets. Column shapes only — see file header for why this is safe.
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY
);
CREATE TABLE public.product_categories (
  key text PRIMARY KEY
);
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key text NOT NULL REFERENCES public.product_categories(key),
  brand text,
  name text,
  is_active boolean NOT NULL DEFAULT true,
  lifecycle_status text NOT NULL DEFAULT 'active',
  is_chaarlie_recommended boolean NOT NULL DEFAULT false
);
CREATE TABLE public.product_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_product_id uuid,
  category text,
  status text
);
`

export type PersonalPlanTestDb = PGlite

export async function migratedPersonalPlanDatabase(t: {
  after: (fn: () => Promise<void>) => void
}): Promise<PersonalPlanTestDb> {
  const pg = new PGlite({ extensions: { uuid_ossp } })
  t.after(async () => {
    await pg.close()
  })
  await pg.exec(STUB_PREREQUISITES)
  for (const migration of MIGRATIONS) {
    await pg.exec(await readFile(new URL(migration, ROOT), "utf8"))
  }
  return pg
}

/** Deterministic, distinct uuids for test fixtures — `id(3, 7)` reads as 33333333-…-777777777777. */
export function id(prefix: number, suffix: number): string {
  const p = String(prefix)
  const s = String(suffix)
  return `${p.repeat(8)}-${p.repeat(4)}-4${p.repeat(3)}-8${s.repeat(3)}-${s.repeat(12)}`
}

export const EMPTY_PORTFOLIO_LISTS = {
  ownedProducts: [] as unknown[],
  pendingProducts: [] as unknown[],
  plannedPurchases: [] as unknown[],
  categoryResolutions: [] as unknown[],
  uncoveredRoles: [] as unknown[],
}

export async function insertProfile(pg: PersonalPlanTestDb, userId: string) {
  await pg.query("INSERT INTO public.profiles (id) VALUES ($1)", [userId])
}

type InitialNeedResult = {
  outcome: string
  personalPlanId: string
  needVersionId: string
  outputSnapshot: unknown
}

export async function createInitialNeed(
  pg: PersonalPlanTestDb,
  input: { userId: string; inputHash: string },
): Promise<InitialNeedResult> {
  const { rows } = await pg.query<{ result: InitialNeedResult }>(
    `SELECT public.personal_plan_create_or_reuse_initial_need(
       $1::uuid, NULL, NULL, 1, 'v1', $2, '{"a":1}'::jsonb, '{"b":1}'::jsonb
     ) AS result`,
    [input.userId, input.inputHash],
  )
  return rows[0]!.result
}

export async function insertOpenRefinementDraft(
  pg: PersonalPlanTestDb,
  input: { draftId: string; userId: string; planId: string; baseInitialNeedVersionId: string },
) {
  await pg.query(
    `INSERT INTO public.personal_plan_refinement_drafts
       (id, user_id, personal_plan_id, base_initial_need_version_id, schema_version, answers, completed_question_ids, revision)
     VALUES ($1, $2, $3, $4, 1, '{}'::jsonb, '{}', 0)`,
    [input.draftId, input.userId, input.planId, input.baseInitialNeedVersionId],
  )
}

type ModuleCompletionResult = {
  outcome: string
  refinedNeedVersionId?: string
  stage3Handoff?: boolean
  currentRevision?: number
  currentInitialNeedVersionId?: string
  reasonCode?: string
}

export async function completeStage2Module(
  pg: PersonalPlanTestDb,
  input: {
    userId: string
    planId: string
    draftId: string
    module: string | null
    expectedRevision: number
    inputHash: string
  },
): Promise<ModuleCompletionResult> {
  const { rows } = await pg.query<{ result: ModuleCompletionResult }>(
    `SELECT public.personal_plan_complete_stage2_module(
       $1::uuid, $2::uuid, $3::uuid, $4, $5::bigint, 1, 'v1', $6, '{"x":1}'::jsonb, '{"y":1}'::jsonb
     ) AS result`,
    [
      input.userId,
      input.planId,
      input.draftId,
      input.module,
      input.expectedRevision,
      input.inputHash,
    ],
  )
  return rows[0]!.result
}

type FullCompletionResult = {
  outcome: string
  refinedNeedVersionId?: string
  currentRevision?: number
}

export async function completeRefinementDraft(
  pg: PersonalPlanTestDb,
  input: {
    userId: string
    planId: string
    draftId: string
    expectedRevision: number
    inputHash: string
  },
): Promise<FullCompletionResult> {
  const { rows } = await pg.query<{ result: FullCompletionResult }>(
    `SELECT public.personal_plan_complete_refinement_draft(
       $1::uuid, $2::uuid, $3::uuid, $4::bigint, 1, 'v1', $5, '{"x":1}'::jsonb, '{"y":1}'::jsonb
     ) AS result`,
    [input.userId, input.planId, input.draftId, input.expectedRevision, input.inputHash],
  )
  return rows[0]!.result
}

type ProductDraftRow = {
  id: string
  status: string
  revision: number
  refined_need_version_id: string
}

export async function loadProductDraft(
  pg: PersonalPlanTestDb,
  input: { userId: string; planId: string; refinedNeedVersionId: string },
): Promise<ProductDraftRow> {
  const { rows } = await pg.query<{ result: ProductDraftRow }>(
    `SELECT public.personal_plan_create_or_load_product_draft(
       $1::uuid, $2::uuid, $3::uuid, 1, '{}'::jsonb, '{}'::jsonb
     ) AS result`,
    [input.userId, input.planId, input.refinedNeedVersionId],
  )
  return rows[0]!.result
}

export function portfolioSnapshot(input: {
  personalPlanId: string
  refinedVersionId: string
  sourceDraftRevision: number
}) {
  return {
    schemaVersion: 1,
    personalPlanId: input.personalPlanId,
    refinedVersionId: input.refinedVersionId,
    sourceDraftRevision: String(input.sourceDraftRevision),
    ...EMPTY_PORTFOLIO_LISTS,
  }
}

type PlanRow = {
  active_routine_version_id: string | null
  pending_routine_proposal_id: string | null
  revision: number
  source_revision: number
  unrefined_direct_accept: boolean
  current_refined_need_version_id: string | null
}

export async function readPlan(pg: PersonalPlanTestDb, planId: string): Promise<PlanRow> {
  const { rows } = await pg.query<PlanRow>(
    `SELECT active_routine_version_id, pending_routine_proposal_id, revision, source_revision,
            unrefined_direct_accept, current_refined_need_version_id
       FROM public.personal_plans WHERE id = $1`,
    [planId],
  )
  return rows[0]!
}

export type ActivateV2Result = {
  status: string
  revision?: number
  routineVersionId?: string
  routineProposalId?: string | null
  portfolioVersionId?: string
  reasonCode?: string
  currentRevision?: number
}

export async function activateV2(
  pg: PersonalPlanTestDb,
  input: {
    userId: string
    planId: string
    productDraftId: string
    expectedDraftRevision: number
    expectedSourceRevision: number
    portfolio: unknown
    routineSourceFingerprint?: string
    markUnrefinedDirectAccept?: boolean
  },
): Promise<ActivateV2Result> {
  const { rows } = await pg.query<{ result: ActivateV2Result }>(
    `SELECT public.personal_plan_complete_draft_activate_v2(
       $1::uuid, $2::uuid, $3::uuid, $4::bigint, $5::bigint,
       1, $6::jsonb, 1, 'compiler-v1', '{}'::jsonb, $7,
       '{"steps":[]}'::jsonb, '{}'::jsonb, $8::boolean
     ) AS result`,
    [
      input.userId,
      input.planId,
      input.productDraftId,
      input.expectedDraftRevision,
      input.expectedSourceRevision,
      JSON.stringify(input.portfolio),
      input.routineSourceFingerprint ?? "fingerprint-1",
      input.markUnrefinedDirectAccept ?? false,
    ],
  )
  return rows[0]!.result
}

export type RoutineVersionRow = {
  id: string
  source_refined_need_version_id: string
  source_portfolio_version_id: string
  source_product_draft_id: string
  source_product_draft_revision: number
  payload: Record<string, unknown>
  source_fingerprint: string
}

/** The Routine version compiled from a given completed Stage-3 draft, if any. */
export async function loadRoutineVersionForProductDraft(
  pg: PersonalPlanTestDb,
  input: { userId: string; planId: string; productDraftId: string },
): Promise<RoutineVersionRow | null> {
  const { rows } = await pg.query<RoutineVersionRow>(
    `SELECT id, source_refined_need_version_id, source_portfolio_version_id,
            source_product_draft_id, source_product_draft_revision, payload, source_fingerprint
       FROM public.personal_plan_routine_versions
      WHERE user_id = $1 AND personal_plan_id = $2 AND source_product_draft_id = $3
      ORDER BY created_at ASC LIMIT 1`,
    [input.userId, input.planId, input.productDraftId],
  )
  return rows[0] ?? null
}

export type StageSuccessorResult = {
  outcome: string
  routineVersionId?: string
  routineProposalId?: string
  revision?: number
  reasonCode?: string
  currentRevision?: number
  currentSourceRevision?: number
  currentActiveRoutineVersionId?: string
}

export type ConfirmProposalResult = {
  outcome: string
  revision?: number
  currentRevision?: number
}

/**
 * A minimal PostgREST-shaped client over PGlite, so the REAL
 * `reactivateRoutineForProductDraft` service can be driven against real
 * Postgres rather than re-implemented as SQL in a test. It supports exactly the
 * surface that service uses: `select` + `eq` + `order` + `limit` +
 * `maybeSingle`, and named-notation `rpc` for the two lifecycle functions.
 */
export function pgliteReactivationClient(pg: PersonalPlanTestDb) {
  function toArrayLiteral(values: readonly string[]): string {
    return `{${values
      .map((value) => `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`)
      .join(",")}}`
  }

  return {
    from(table: string) {
      return {
        select(columns: string) {
          const filters: Array<[string, unknown]> = []
          let orderBy: string | null = null
          let ascending = true
          let rowLimit: number | null = null
          async function execute() {
            const where = filters
              .map(([column], index) => `${column} = $${index + 1}`)
              .join(" AND ")
            const sql = [
              `SELECT ${columns} FROM public.${table}`,
              where ? `WHERE ${where}` : "",
              orderBy ? `ORDER BY ${orderBy} ${ascending ? "ASC" : "DESC"}` : "",
              rowLimit === null ? "" : `LIMIT ${rowLimit}`,
            ]
              .filter(Boolean)
              .join(" ")
            const { rows } = await pg.query<Record<string, unknown>>(
              sql,
              filters.map(([, value]) => value),
            )
            return { data: rows[0] ?? null, error: null }
          }
          const chain = {
            eq(column: string, value: unknown) {
              filters.push([column, value])
              return chain
            },
            order(column: string, options: { ascending: boolean }) {
              orderBy = column
              ascending = options.ascending
              return chain
            },
            limit(count: number) {
              rowLimit = count
              return chain
            },
            maybeSingle: execute,
            then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
              execute().then(resolve),
          }
          return chain
        },
      }
    },
    async rpc(functionName: string, args: Record<string, unknown>) {
      if (functionName === "personal_plan_stage_routine_successor") {
        const { rows } = await pg.query<{ result: StageSuccessorResult }>(
          `SELECT public.personal_plan_stage_routine_successor(
             p_user_id => $1::uuid,
             p_personal_plan_id => $2::uuid,
             p_expected_active_routine_version_id => $3::uuid,
             p_expected_revision => $4::bigint,
             p_expected_source_revision => $5::bigint,
             p_source_refined_need_version_id => $6::uuid,
             p_source_portfolio_version_id => $7::uuid,
             p_source_product_draft_id => $8::uuid,
             p_source_product_draft_revision => $9::bigint,
             p_routine_schema_version => $10::integer,
             p_routine_compiler_version => $11::text,
             p_routine_authority_versions => $12::jsonb,
             p_routine_source_fingerprint => $13::text,
             p_routine_payload => $14::jsonb,
             p_proposal_delta => $15::jsonb,
             p_direct_operation_keys => $16::text[],
             p_origin => $17::text
           ) AS result`,
          [
            args.p_user_id,
            args.p_personal_plan_id,
            args.p_expected_active_routine_version_id,
            args.p_expected_revision,
            args.p_expected_source_revision,
            args.p_source_refined_need_version_id,
            args.p_source_portfolio_version_id,
            args.p_source_product_draft_id,
            args.p_source_product_draft_revision,
            args.p_routine_schema_version,
            args.p_routine_compiler_version,
            JSON.stringify(args.p_routine_authority_versions ?? {}),
            args.p_routine_source_fingerprint,
            JSON.stringify(args.p_routine_payload ?? {}),
            JSON.stringify(args.p_proposal_delta ?? {}),
            toArrayLiteral((args.p_direct_operation_keys ?? []) as string[]),
            args.p_origin,
          ],
        )
        return { data: rows[0]!.result, error: null }
      }
      const { rows } = await pg.query<{ result: ConfirmProposalResult }>(
        `SELECT public.personal_plan_confirm_routine_proposal(
           p_user_id => $1::uuid,
           p_personal_plan_id => $2::uuid,
           p_proposal_id => $3::uuid,
           p_expected_revision => $4::bigint
         ) AS result`,
        [args.p_user_id, args.p_personal_plan_id, args.p_proposal_id, args.p_expected_revision],
      )
      return { data: rows[0]!.result, error: null }
    },
  }
}
