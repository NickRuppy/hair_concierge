import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

import {
  STAGE5_V2_ARTIFACT_PATH,
  STAGE5_V2_POINTER_DELTA_DEFAULT_FILE,
  STAGE5_V2_POINTER_DELTA_MIGRATION,
  STAGE5_V2_POINTER_DELTA_RPC,
  buildStage5V2PointerDelta,
} from "@/lib/product-intake/catalog-enrichment/stage5-v2-pointer-delta"

/**
 * Real-Postgres tests for the Stage-5 V2 pointer delta executor.
 *
 * Harness pattern: tests/leave-in-calibration-executor-postgres.test.ts — stub
 * the FK targets and column shapes, then execute the REAL migration file and
 * call the RPC end to end. Nothing here re-states the SQL in TypeScript: every
 * refusal path is proven by running it.
 *
 * Two dependencies are bootstrapped the same way the executor finds them in
 * production: `extensions.digest` (pgcrypto, stubbed onto `sha256`) and
 * `public.personal_plan_stage5_v2_canonical_json_v1`, sliced out of the migration
 * that created it (20260813060630). The canonical function is load-bearing — the
 * seeded V1 payload is the REAL reviewed S5-14 / S5R-05 payload, so the SQL-side
 * fingerprint recompute has to reproduce the `source_fingerprint` the reviewed
 * artifact carries, byte for byte, or the happy path does not apply.
 *
 * Known limitation, stated rather than papered over: PGlite is a single
 * in-process connection, so a real two-session interleave cannot run here. The
 * TOCTOU posture is covered by the `FOR UPDATE` in the source and by the
 * "source diverged" and "authority conflicts" refusals below, which are the
 * outcomes the race would otherwise produce.
 */

const ROOT = new URL("../", import.meta.url)
const MIGRATION = `supabase/migrations/${STAGE5_V2_POINTER_DELTA_MIGRATION}_personal_plan_stage5_v2_pointer_delta_executor.sql`
const CANONICAL_MIGRATION =
  "supabase/migrations/20260813060630_personal_plan_stage5_v2_artifact_executor.sql"
const REDKEN_ID = "2b7db7e3-2058-4178-8a03-7d05f4a1d447"

const STUB_PREREQUISITES = `
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE FUNCTION extensions.digest(value bytea, algorithm text)
  RETURNS bytea LANGUAGE sql IMMUTABLE AS $$ SELECT sha256(value) $$;

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text,
  category_key text,
  origin text NOT NULL DEFAULT 'curated',
  is_active boolean NOT NULL DEFAULT true,
  lifecycle_status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.personal_plan_application_family_identity_v1(
  p_role text, p_guidance_payload jsonb, p_guidance_payload_v2 jsonb
) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT COALESCE(p_guidance_payload_v2->>'applicationFamily', p_guidance_payload->>'applicationFamily')
$$;

CREATE TABLE public.product_application_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category text NOT NULL,
  role text NOT NULL,
  guidance_payload jsonb,
  guidance_payload_v2 jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  application_family text GENERATED ALWAYS AS (
    public.personal_plan_application_family_identity_v1(role, guidance_payload, guidance_payload_v2)
  ) STORED
);
CREATE UNIQUE INDEX idx_product_application_protocols_product_category_role_family
  ON public.product_application_protocols (product_id, category, role, application_family);

CREATE TABLE public.catalog_enrichment_applied_items (
  batch_id text NOT NULL,
  product_key text NOT NULL,
  batch_fingerprint text NOT NULL CHECK (batch_fingerprint ~ '^[a-f0-9]{64}$'),
  content_fingerprint text NOT NULL CHECK (content_fingerprint ~ '^[a-f0-9]{64}$'),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  reviewed_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_id, product_key)
);
`

async function loadDelta() {
  const [deltaText, artifactText] = await Promise.all([
    readFile(new URL(STAGE5_V2_POINTER_DELTA_DEFAULT_FILE, ROOT), "utf8"),
    readFile(new URL(STAGE5_V2_ARTIFACT_PATH, ROOT), "utf8"),
  ])
  return buildStage5V2PointerDelta({ delta: JSON.parse(deltaText), artifactText })
}

/** The authored S5-14 / S5R-05 V1 payload the protocol batch writes in production. */
async function carryForwardPayload() {
  const file = JSON.parse(
    await readFile(
      new URL(
        "data/catalog-enrichment/personal-plan-stage5-v1/S5R-05-leave-in-calibration-protocol-carry-forward.json",
        ROOT,
      ),
      "utf8",
    ),
  )
  return file.items[0].protocol.guidance_payload as Record<string, unknown>
}

async function migratedDatabase(t: { after: (fn: () => Promise<void>) => void }): Promise<PGlite> {
  const pg = new PGlite()
  t.after(async () => {
    await pg.close()
  })
  await pg.exec(STUB_PREREQUISITES)

  // The canonical-JSON helper is created by the full-apply executor migration.
  // Slicing it out (rather than restating it) keeps this harness honest: the
  // delta executor hashes with exactly the function production has.
  const canonicalSource = await readFile(new URL(CANONICAL_MIGRATION, ROOT), "utf8")
  const canonicalSlice = canonicalSource.slice(
    0,
    canonicalSource.indexOf(
      "CREATE OR REPLACE FUNCTION public.apply_personal_plan_stage5_v2_artifact_v1",
    ),
  )
  assert.match(canonicalSlice, /personal_plan_stage5_v2_canonical_json_v1/)
  await pg.exec(canonicalSlice)
  await pg.exec(await readFile(new URL(MIGRATION, ROOT), "utf8"))
  return pg
}

type SeedOptions = {
  product?: Record<string, unknown>
  guidance_payload?: unknown
  guidance_payload_v2?: unknown
  skipProtocol?: boolean
}

async function seedReviewedState(pg: PGlite, options: SeedOptions = {}) {
  const product = {
    category_key: "leave_in",
    origin: "curated",
    is_active: true,
    lifecycle_status: "active",
    ...options.product,
  }
  await pg.query(
    `INSERT INTO public.products (id, name, brand, category_key, origin, is_active, lifecycle_status)
     VALUES ($1,'Redken Extreme Anti-Snap','Redken',$2,$3,$4,$5)`,
    [REDKEN_ID, product.category_key, product.origin, product.is_active, product.lifecycle_status],
  )
  if (options.skipProtocol) return
  const payload =
    "guidance_payload" in options ? options.guidance_payload : await carryForwardPayload()
  await pg.query(
    `INSERT INTO public.product_application_protocols
       (product_id, category, role, guidance_payload, guidance_payload_v2)
     VALUES ($1,'leave_in','pre_heat_protection',$2,$3)`,
    [
      REDKEN_ID,
      payload === null || payload === undefined ? null : JSON.stringify(payload),
      options.guidance_payload_v2 === undefined
        ? null
        : JSON.stringify(options.guidance_payload_v2),
    ],
  )
}

type ExecutorRow = {
  delta_product_key: string
  delta_product_id: string
  delta_outcome: string
  delta_ledger_state: string
}

function callExecutor(
  pg: PGlite,
  json: string,
  overrides: { fingerprint?: string; reviewer?: string } = {},
) {
  return pg.query<ExecutorRow>(`SELECT * FROM public.${STAGE5_V2_POINTER_DELTA_RPC}($1, $2, $3)`, [
    json,
    overrides.fingerprint ?? createHash("sha256").update(json, "utf8").digest("hex"),
    overrides.reviewer ?? "nick",
  ])
}

async function livePointer(pg: PGlite) {
  const result = await pg.query<{ guidance_payload_v2: unknown }>(
    `SELECT guidance_payload_v2 FROM public.product_application_protocols WHERE product_id = $1`,
    [REDKEN_ID],
  )
  return result.rows[0]?.guidance_payload_v2 ?? null
}

async function ledgerRows(pg: PGlite) {
  const result = await pg.query<{
    batch_id: string
    product_key: string
    batch_fingerprint: string
    content_fingerprint: string
    reviewed_by: string
  }>(`SELECT * FROM public.catalog_enrichment_applied_items ORDER BY product_key`)
  return result.rows
}

/** Every refusal must leave the database exactly as it was. */
async function assertNothingWritten(pg: PGlite) {
  assert.equal(await livePointer(pg), null, "no pointer was written")
  assert.deepEqual(await ledgerRows(pg), [], "no ledger row was written")
}

test("the delta executor writes the reviewed pointer and one ledger row", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadDelta()
  await seedReviewedState(pg)

  const result = await callExecutor(pg, built.canonical_json, { fingerprint: built.fingerprint })
  assert.equal(result.rows.length, 1)
  assert.deepEqual(
    {
      key: result.rows[0]!.delta_product_key,
      outcome: result.rows[0]!.delta_outcome,
      ledger: result.rows[0]!.delta_ledger_state,
    },
    {
      key: `v2-delta:${REDKEN_ID}:pre_heat_protection`,
      outcome: "written",
      ledger: "inserted",
    },
  )

  assert.deepEqual(await livePointer(pg), built.delta.items[0]!.guidance_payload_v2)
  const ledger = await ledgerRows(pg)
  assert.equal(ledger.length, 1)
  assert.equal(ledger[0]!.batch_id, "S5V2D-01-leave-in-calibration-redken")
  assert.equal(ledger[0]!.batch_fingerprint, built.fingerprint)
  assert.equal(ledger[0]!.reviewed_by, "nick")
})

test("the SQL-side source fingerprint reproduces the reviewed artifact fingerprint", async (t) => {
  const pg = await migratedDatabase(t)
  await seedReviewedState(pg)

  // If the SQL canonicaliser and the TypeScript one ever disagree, the happy
  // path above would fail for an opaque reason. Pin the value directly.
  const recomputed = await pg.query<{ fingerprint: string }>(
    `SELECT encode(
       extensions.digest(
         convert_to(
           public.personal_plan_stage5_v2_canonical_json_v1(
             jsonb_build_object('role', role, 'payload', guidance_payload)
           ), 'UTF8'
         ), 'sha256'
       ), 'hex'
     ) AS fingerprint
     FROM public.product_application_protocols WHERE product_id = $1`,
    [REDKEN_ID],
  )
  assert.equal(
    recomputed.rows[0]!.fingerprint,
    "8e1b1bbc51ce497047f75891d18bc5b87125dbe6a0b20b01a95f7b5f8fa7b8cb",
  )
})

test("re-running the delta is a per-item replay, not a second write", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadDelta()
  await seedReviewedState(pg)
  await callExecutor(pg, built.canonical_json, { fingerprint: built.fingerprint })

  const before = await pg.query<{ updated_at: string }>(
    `SELECT updated_at::text FROM public.product_application_protocols WHERE product_id = $1`,
    [REDKEN_ID],
  )
  const replay = await callExecutor(pg, built.canonical_json, { fingerprint: built.fingerprint })
  assert.equal(replay.rows[0]!.delta_outcome, "already_current")
  assert.equal(replay.rows[0]!.delta_ledger_state, "replayed")

  const after = await pg.query<{ updated_at: string }>(
    `SELECT updated_at::text FROM public.product_application_protocols WHERE product_id = $1`,
    [REDKEN_ID],
  )
  assert.equal(after.rows[0]!.updated_at, before.rows[0]!.updated_at, "the row was not rewritten")
  assert.equal((await ledgerRows(pg)).length, 1, "the ledger is not duplicated")
})

test("a live pointer that already equals the delta is a no-op that still books the ledger", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadDelta()
  await seedReviewedState(pg, { guidance_payload_v2: built.delta.items[0]!.guidance_payload_v2 })

  const result = await callExecutor(pg, built.canonical_json, { fingerprint: built.fingerprint })
  assert.equal(result.rows[0]!.delta_outcome, "already_current")
  assert.equal(result.rows[0]!.delta_ledger_state, "inserted")
  assert.equal((await ledgerRows(pg)).length, 1)
})

test("a different live pointer is an authority conflict, never an overwrite", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadDelta()
  const conflicting = JSON.parse(
    JSON.stringify(built.delta.items[0]!.guidance_payload_v2),
  ) as Record<string, unknown> & { facts: Record<string, unknown> }
  conflicting.facts.applicationArea = "hair_ends"
  await seedReviewedState(pg, { guidance_payload_v2: conflicting })

  await assert.rejects(
    callExecutor(pg, built.canonical_json, { fingerprint: built.fingerprint }),
    /product authority conflicts/,
  )
  assert.deepEqual(await livePointer(pg), conflicting, "the live pointer is untouched")
  assert.deepEqual(await ledgerRows(pg), [])
})

test("the executor refuses an unapproved reviewer or a fingerprint that does not match", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadDelta()
  await seedReviewedState(pg)

  await assert.rejects(
    callExecutor(pg, built.canonical_json, {
      fingerprint: built.fingerprint,
      reviewer: "someone-else",
    }),
    /reviewer must be nick/,
  )
  await assert.rejects(
    callExecutor(pg, built.canonical_json, { fingerprint: "not-a-sha" }),
    /must be lowercase sha256/,
  )
  await assert.rejects(
    callExecutor(pg, built.canonical_json, { fingerprint: "d".repeat(64) }),
    /fingerprint mismatch/,
  )
  // Editing the payload invalidates the caller-supplied fingerprint.
  const tampered = built.canonical_json.replace('"hair_lengths_ends"', '"hair_ends"')
  assert.notEqual(tampered, built.canonical_json, "tamper fixture did not apply")
  await assert.rejects(
    callExecutor(pg, tampered, { fingerprint: built.fingerprint }),
    /fingerprint mismatch/,
  )
  await assert.rejects(callExecutor(pg, "not json at all"), /invalid JSON/)
  await assertNothingWritten(pg)
})

test("the executor refuses an invalid header, count, size, or duplicate role", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadDelta()
  await seedReviewedState(pg)
  type MutableDelta = {
    schema_version: string
    batch_id: string
    observed_counts: { items: number }
    items: unknown
  }
  const base = JSON.parse(built.canonical_json) as MutableDelta
  const mutate = (change: (delta: MutableDelta) => void) => {
    const copy = JSON.parse(built.canonical_json) as MutableDelta
    change(copy)
    return JSON.stringify(copy)
  }
  const firstItem = () => JSON.parse(JSON.stringify((base.items as unknown[])[0]))

  const cases: Array<[string, RegExp]> = [
    [
      mutate((delta) => {
        delta.schema_version = "personal-plan-stage5-v2-pointer-delta-v2"
      }),
      /header is invalid/,
    ],
    [
      mutate((delta) => {
        delta.batch_id = "S5-01-leave-in"
      }),
      /header is invalid/,
    ],
    [
      mutate((delta) => {
        delta.items = {}
      }),
      /header is invalid/,
    ],
    [
      mutate((delta) => {
        delta.items = []
      }),
      /must carry 1\.\.20 items/,
    ],
    [
      mutate((delta) => {
        delta.items = Array.from({ length: 21 }, firstItem)
      }),
      /must carry 1\.\.20 items/,
    ],
    [
      mutate((delta) => {
        delta.observed_counts.items = 2
      }),
      /counts are invalid/,
    ],
    [
      mutate((delta) => {
        delta.items = [firstItem(), firstItem()]
        delta.observed_counts.items = 2
      }),
      /duplicate product roles/,
    ],
  ]
  for (const [json, expected] of cases) {
    await assert.rejects(callExecutor(pg, json), expected)
  }
  await assertNothingWritten(pg)
})

test("the executor refuses a pointer whose shape contradicts its own item", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadDelta()
  await seedReviewedState(pg)
  const base = JSON.parse(built.canonical_json)
  const mutate = (change: (item: Record<string, unknown>) => void) => {
    const copy = JSON.parse(JSON.stringify(base))
    change(copy.items[0])
    return JSON.stringify(copy)
  }

  for (const json of [
    mutate((item) => ((item.guidance_payload_v2 as { schemaVersion: number }).schemaVersion = 1)),
    mutate(
      (item) =>
        ((item.guidance_payload_v2 as { contractKind: string }).contractKind = "family_template"),
    ),
    mutate(
      (item) =>
        ((item.guidance_payload_v2 as { scope: { kind: string } }).scope.kind =
          "application_family"),
    ),
    mutate(
      (item) =>
        ((item.guidance_payload_v2 as { scope: { productId: string } }).scope.productId =
          "aadbbab5-1111-2222-3333-444455556666"),
    ),
    mutate(
      (item) =>
        ((item.guidance_payload_v2 as { sourceRole: string }).sourceRole = "post_wash_leave_in"),
    ),
    mutate(
      (item) =>
        ((item.guidance_payload_v2 as { applicationFamily: string }).applicationFamily = ""),
    ),
    mutate((item) => (item.source_fingerprint = "not-a-sha256")),
  ]) {
    await assert.rejects(callExecutor(pg, json), /item is invalid/)
  }
  await assertNothingWritten(pg)
})

test("the executor refuses a product that is missing, inactive, recategorised, or not curated", async (t) => {
  const built = await loadDelta()

  const empty = await migratedDatabase(t)
  await assert.rejects(
    callExecutor(empty, built.canonical_json, { fingerprint: built.fingerprint }),
    /product is missing, inactive, or recategorized/,
    "no product row at all",
  )
  await assertNothingWritten(empty)

  for (const product of [
    { is_active: false },
    { lifecycle_status: "retired" },
    { origin: "user" },
    { category_key: "oil" },
  ]) {
    const pg = await migratedDatabase(t)
    await seedReviewedState(pg, { product })
    await assert.rejects(
      callExecutor(pg, built.canonical_json, { fingerprint: built.fingerprint }),
      /product is missing, inactive, or recategorized/,
      JSON.stringify(product),
    )
    await assertNothingWritten(pg)
  }
})

test("the executor refuses a missing source protocol row and a NULL V1 payload", async (t) => {
  const built = await loadDelta()

  const withoutRow = await migratedDatabase(t)
  await seedReviewedState(withoutRow, { skipProtocol: true })
  await assert.rejects(
    callExecutor(withoutRow, built.canonical_json, { fingerprint: built.fingerprint }),
    /source protocol is missing/,
  )

  // A pointer-only row (V1 payload deleted) must not be treated as a source.
  const withoutPayload = await migratedDatabase(t)
  await seedReviewedState(withoutPayload, { guidance_payload: null })
  await assert.rejects(
    callExecutor(withoutPayload, built.canonical_json, { fingerprint: built.fingerprint }),
    /source protocol is missing/,
  )

  // A row for a different application family is not this item's source row.
  const otherFamily = await migratedDatabase(t)
  const payload = await carryForwardPayload()
  await seedReviewedState(otherFamily, {
    guidance_payload: { ...payload, applicationFamily: "pre_heat_dry" },
  })
  await assert.rejects(
    callExecutor(otherFamily, built.canonical_json, { fingerprint: built.fingerprint }),
    /source protocol is missing/,
  )
})

test("the executor refuses a source protocol whose payload drifted since review", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadDelta()
  const payload = await carryForwardPayload()
  await seedReviewedState(pg, { guidance_payload: { ...payload, locale: "en" } })

  await assert.rejects(
    callExecutor(pg, built.canonical_json, { fingerprint: built.fingerprint }),
    /source protocol fingerprint diverged/,
  )
  await assertNothingWritten(pg)
})

test("a ledger row from a different batch run blocks the replay instead of rewriting it", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadDelta()
  await seedReviewedState(pg)
  await callExecutor(pg, built.canonical_json, { fingerprint: built.fingerprint })

  // Capture the fingerprint the executor itself booked, so each mutation below
  // trips exactly one guard: phase A the content-fingerprint comparison, phase B
  // (original fingerprint restored) the reviewer comparison alone.
  const original = await pg.query<{ content_fingerprint: string }>(
    `SELECT content_fingerprint FROM public.catalog_enrichment_applied_items`,
  )
  const originalContentFingerprint = original.rows[0]!.content_fingerprint

  await pg.query(`UPDATE public.catalog_enrichment_applied_items SET content_fingerprint = $1`, [
    "c".repeat(64),
  ])
  await assert.rejects(
    callExecutor(pg, built.canonical_json, { fingerprint: built.fingerprint }),
    /ledger conflicts with retry/,
  )

  await pg.query(
    `UPDATE public.catalog_enrichment_applied_items
       SET content_fingerprint = $1, reviewed_by = 'someone-else'`,
    [originalContentFingerprint],
  )
  await assert.rejects(
    callExecutor(pg, built.canonical_json, { fingerprint: built.fingerprint }),
    /ledger conflicts with retry/,
  )
})

test("NULL reviewer, fingerprint, or payload cannot slip past the approval guards", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadDelta()
  await seedReviewedState(pg)

  const call = (json: string | null, fingerprint: string | null, reviewer: string | null) =>
    pg.query(`SELECT * FROM public.${STAGE5_V2_POINTER_DELTA_RPC}($1, $2, $3)`, [
      json,
      fingerprint,
      reviewer,
    ])

  // Each NULL argument individually, and all at once. `x <> 'nick'` and
  // `x !~ '…'` are NULL — not true — for NULL input, so without null-safe
  // guards every one of these calls would write the pointer and a ledger row.
  await assert.rejects(call(built.canonical_json, built.fingerprint, null), /reviewer must be nick/)
  await assert.rejects(
    call(built.canonical_json, null, "nick"),
    /fingerprint must be lowercase sha256/,
  )
  await assert.rejects(call(null, built.fingerprint, "nick"), /delta payload is required/)
  await assert.rejects(call(null, null, null), /reviewer must be nick/)

  assert.equal(await livePointer(pg), null)
  const ledger = await pg.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public.catalog_enrichment_applied_items`,
  )
  assert.equal(ledger.rows[0]!.count, "0")
})

test("a product deactivated between check and write is refused, not written", async (t) => {
  // The eligibility read now locks the product row (FOR UPDATE) and re-validates
  // from the locked row, so a concurrent deactivation either waits and is then
  // seen, or committed earlier and is seen. Single-connection PGlite cannot
  // interleave two transactions, so this asserts the executor sees a
  // deactivation that lands before the call — plus a source-pin on the lock.
  const pg = await migratedDatabase(t)
  const built = await loadDelta()
  await seedReviewedState(pg)
  await pg.query(`UPDATE public.products SET is_active = false WHERE id = $1`, [REDKEN_ID])
  await assert.rejects(
    callExecutor(pg, built.canonical_json, { fingerprint: built.fingerprint }),
    /product is missing, inactive, or recategorized/,
  )
  assert.equal(await livePointer(pg), null)

  const source = await readFile(new URL(MIGRATION, ROOT), "utf8")
  assert.match(
    source,
    /FROM public\.products product\s+WHERE product\.id = v_product_id\s+FOR UPDATE/,
  )
})

test("the retired full-registry executor is left installed and untouched", async (t) => {
  const source = await readFile(new URL(MIGRATION, ROOT), "utf8")
  assert.doesNotMatch(source, /apply_personal_plan_stage5_v2_artifact_v1\s*\(/)
  const pg = await migratedDatabase(t)
  const installed = await pg.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM pg_proc
      WHERE proname = 'apply_personal_plan_stage5_v2_pointer_delta_v1'`,
  )
  assert.equal(installed.rows[0]!.count, "1")
})
