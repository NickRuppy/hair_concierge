/**
 * Slice 4 (T4.10) — Aveda damage-band cadence, generated from frozen inputs only.
 *
 * Inputs: the frozen P07 research profile (recommendation-promotion-2026-10-06), the reviewed
 * D-b binding (`s4-aveda-cadence-binding/aveda-damage-binding.json`) and the read-only prod
 * prestate (`prestate.json`). No database access. Writes the guarded one-shot migration, the
 * prepared rollback, the read-only verify query and the manifest. Run:
 *   npx tsx plans/catalog-completeness-fill/slice4/generate.ts
 * `buildSlice4Artifacts()` is pure; the rehearsal test asserts the files on disk equal it.
 */
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  projectBondbuilderDamageBranchedCadence,
  type BondbuilderDamageCadenceBinding,
} from "../../../src/lib/bondbuilder-research/cadence-projection"
import type { BondbuilderResearchProfile } from "../../../src/lib/bondbuilder-research/contracts"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../../..")
const PROFILE_PATH =
  "data/research/bondbuilder-inci/v1.0/recommendation-promotion-2026-10-06/P07.json"
const BINDING_PATH =
  "data/research/bondbuilder-inci/v1.0/s4-aveda-cadence-binding/aveda-damage-binding.json"
export const SLICE4_MIGRATION =
  "supabase/migrations/20261011170000_bondbuilder_aveda_damage_cadence.sql"
export const SLICE4_BATCH_ID = "S4-catalog-completeness-aveda-damage-cadence"
export const SLICE4_PRODUCT_KEY = "P07"

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

const read = (path: string) => JSON.parse(readFileSync(resolve(ROOT, path), "utf8"))
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(",")}}`
  return JSON.stringify(value)
}
export const sha256 = (value: unknown) =>
  createHash("sha256").update(canonical(value)).digest("hex")
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`slice4 generator: ${message}`)
}
const sqlText = (value: string) => `'${value.replaceAll("'", "''")}'`
const sqlJson = (value: unknown) => `$json$${JSON.stringify(value)}$json$::jsonb`

export function buildSlice4Artifacts() {
  const artifact = read(PROFILE_PATH) as {
    productId: string
    profile: BondbuilderResearchProfile
    protocolV1: Json
    protocolV2: Json
  }
  const binding = read(BINDING_PATH) as BondbuilderDamageCadenceBinding
  const prestate = read("plans/catalog-completeness-fill/slice4/prestate.json")

  // ── frozen inputs agree with each other and with the captured prod state ──
  const profile = artifact.profile
  assert(artifact.productId === prestate.product.id, "artifact product")
  assert(binding.product_id === prestate.product.id, "binding product")
  assert(binding.research_key === SLICE4_PRODUCT_KEY, "binding research key")
  assert(
    profile.review.profile_sha256 === prestate.research_profile.review_sha256,
    "profile review digest equals prod",
  )
  assert(sha256(profile) === prestate.research_profile.canonical_sha256, "profile bytes equal prod")
  assert(
    prestate.protocol.cadence === null && prestate.protocol_count === 1,
    "create-only preimage",
  )
  assert(prestate.curated_facts_ready === true, "curated gate passes today")
  assert(
    sha256(artifact.protocolV1) === prestate.protocol_payload_canonical_sha256.guidance_payload &&
      sha256(artifact.protocolV2) ===
        prestate.protocol_payload_canonical_sha256.guidance_payload_v2,
    "protocol payloads equal prod",
  )
  assert(
    canonical(prestate.protocol.guidance_payload) === canonical(artifact.protocolV1),
    "prestate v1",
  )
  assert(
    canonical(prestate.protocol.guidance_payload_v2) === canonical(artifact.protocolV2),
    "prestate v2",
  )

  const projection = projectBondbuilderDamageBranchedCadence(profile, binding)
  assert(projection.status === "ok", `projection refused: ${JSON.stringify(projection)}`)
  const cadence = projection.cadence as Json

  const source = profile.sources.find((entry) => entry.id === "C03-P07-1")
  assert(
    source && source.url === prestate.protocol.source_url,
    "cadence source is the protocol page",
  )
  const verbatim =
    "For mild-to-moderate damage, use weekly; for moderate-to-severe damage, use each wash day."
  assert(source.observation.includes(verbatim), "cadence wording is the profile's own source text")

  const evidenceBody = {
    product_id: prestate.product.id,
    fact_key: "bondbuilder.protocol.cadence",
    fact_value: {
      protocol_id: prestate.protocol.id,
      cadence,
      binding: BINDING_PATH,
      profile_sha256: profile.review.profile_sha256,
      ruling: binding.ruling,
    } as Json,
    source_label: "Aveda Hersteller-Produktseite (DE), Rulings B1/D-b",
    source_url: source.url,
    source_text: `"${verbatim}" (profile source C03-P07-1; ${binding.ruling})`,
    source_type: "manufacturer",
    checked_at: profile.review.checked_date,
  }
  const guarded = {
    protocol_id: prestate.protocol.id,
    product_id: prestate.product.id,
    category: prestate.protocol.category,
    role: prestate.protocol.role,
    source_label: prestate.protocol.source_label,
    source_url: prestate.protocol.source_url,
    source_text: prestate.protocol.source_text,
    guidance_payload_sha256: prestate.protocol_payload_canonical_sha256.guidance_payload,
    guidance_payload_v2_sha256: prestate.protocol_payload_canonical_sha256.guidance_payload_v2,
    profile_canonical_sha256: prestate.research_profile.canonical_sha256,
    // S4-04: the captured stamp is part of the preimage, so the rollback can restore it exactly.
    protocol_updated_at: prestate.protocol.updated_at as string,
  }
  const fingerprint = sha256({ batch: SLICE4_BATCH_ID, guarded, cadence, evidence: evidenceBody })

  const header = `-- Slice 4 (T4.10): Aveda Botanical Repair damage-band cadence (rulings B1/D-b).
-- GENERATED by plans/catalog-completeness-fill/slice4/generate.ts — do not edit by hand.
-- Inputs: ${PROFILE_PATH}
--         ${BINDING_PATH}
--         plans/catalog-completeness-fill/slice4/prestate.json (prod, ${prestate.captured_at})
-- Content fingerprint: ${fingerprint}
--
-- Writes exactly: product_application_protocols.cadence of protocol ${guarded.protocol_id}
-- (NULL → damage_branched), one personal_plan_catalog_fact_evidence row and one
-- catalog_enrichment_applied_items receipt. Create-only CAS on the captured protocol and on the
-- frozen research profile bytes; replay is a verified no-op; any drift raises. Fresh databases
-- without the Aveda row skip before any guard.`

  const declare = `  v_product constant uuid := ${sqlText(guarded.product_id)};
  v_protocol constant uuid := ${sqlText(guarded.protocol_id)};
  v_batch constant text := ${sqlText(SLICE4_BATCH_ID)};
  v_product_key constant text := ${sqlText(SLICE4_PRODUCT_KEY)};
  v_fingerprint constant text := ${sqlText(fingerprint)};
  v_cadence constant jsonb := ${sqlJson(cadence)};
  v_fact_value constant jsonb := ${sqlJson(evidenceBody.fact_value)};`

  const evidenceMatches = `EXISTS (
      SELECT 1 FROM public.personal_plan_catalog_fact_evidence e
      WHERE e.product_id = v_product AND e.fact_key = ${sqlText(evidenceBody.fact_key)}
        AND e.source_url = ${sqlText(evidenceBody.source_url)} AND e.fact_value = v_fact_value
        AND e.source_label = ${sqlText(evidenceBody.source_label)}
        AND e.source_text = ${sqlText(evidenceBody.source_text)}
        AND e.source_type = ${sqlText(evidenceBody.source_type)}
        AND e.checked_at = DATE ${sqlText(evidenceBody.checked_at)}
        AND e.batch_id = v_batch AND e.batch_fingerprint = v_fingerprint
        AND e.content_fingerprint = v_fingerprint)`
  const receiptMatches = `EXISTS (
      SELECT 1 FROM public.catalog_enrichment_applied_items r
      WHERE r.batch_id = v_batch AND r.product_key = v_product_key AND r.product_id = v_product
        AND r.reviewed_by = 'nick' AND r.batch_fingerprint = v_fingerprint
        AND r.content_fingerprint = v_fingerprint)`

  const migration = `${header}
BEGIN;
DO $slice4$
DECLARE
${declare}
  v_row public.product_application_protocols%ROWTYPE;
  v_rows integer;
BEGIN
  -- Fresh databases (CI, local resets) have no historical Aveda row.
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_product) THEN RETURN; END IF;

  LOCK TABLE public.product_application_protocols, public.personal_plan_catalog_fact_evidence,
    public.catalog_enrichment_applied_items IN SHARE ROW EXCLUSIVE MODE;
  SELECT * INTO v_row FROM public.product_application_protocols WHERE id = v_protocol FOR UPDATE;

  -- Replay: the receipt exists, so the exact postimage must be in place.
  IF EXISTS (SELECT 1 FROM public.catalog_enrichment_applied_items WHERE batch_id = v_batch) THEN
    IF NOT ${receiptMatches}
      OR NOT ${evidenceMatches}
      OR v_row.cadence IS DISTINCT FROM v_cadence THEN
      RAISE EXCEPTION 'S4 Aveda cadence replay drift';
    END IF;
    RETURN;
  END IF;

  -- Create-only CAS on the ${prestate.captured_at} capture.
  IF v_row.id IS NULL
    OR v_row.product_id IS DISTINCT FROM v_product
    OR v_row.category IS DISTINCT FROM ${sqlText(guarded.category)}
    OR v_row.role IS DISTINCT FROM ${sqlText(guarded.role)}
    OR v_row.cadence IS NOT NULL
    OR v_row.updated_at IS DISTINCT FROM ${sqlText(guarded.protocol_updated_at)}::timestamptz
    OR v_row.source_label IS DISTINCT FROM ${sqlText(guarded.source_label)}
    OR v_row.source_url IS DISTINCT FROM ${sqlText(guarded.source_url)}
    OR v_row.source_text IS DISTINCT FROM ${sqlText(guarded.source_text)}
    OR encode(sha256(convert_to(public.bondbuilder_json_canonical_v1(v_row.guidance_payload), 'UTF8')), 'hex')
      IS DISTINCT FROM ${sqlText(guarded.guidance_payload_sha256)}
    OR encode(sha256(convert_to(public.bondbuilder_json_canonical_v1(v_row.guidance_payload_v2), 'UTF8')), 'hex')
      IS DISTINCT FROM ${sqlText(guarded.guidance_payload_v2_sha256)}
    OR (SELECT count(*) FROM public.product_application_protocols p WHERE p.product_id = v_product) <> 1
    OR (SELECT encode(sha256(convert_to(public.bondbuilder_json_canonical_v1(s.research_profile), 'UTF8')), 'hex')
        FROM public.product_bondbuilder_specs s WHERE s.product_id = v_product)
      IS DISTINCT FROM ${sqlText(guarded.profile_canonical_sha256)}
  THEN
    RAISE EXCEPTION 'S4 Aveda cadence preimage changed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.personal_plan_catalog_fact_evidence e
             WHERE e.product_id = v_product AND e.fact_key = ${sqlText(evidenceBody.fact_key)}) THEN
    RAISE EXCEPTION 'S4 Aveda cadence orphan evidence';
  END IF;

  UPDATE public.product_application_protocols SET cadence = v_cadence
  WHERE id = v_protocol AND cadence IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'S4 Aveda cadence write count %', v_rows; END IF;

  INSERT INTO public.personal_plan_catalog_fact_evidence (
    product_id, fact_key, fact_value, source_label, source_url, source_text, source_type,
    checked_at, batch_id, batch_fingerprint, content_fingerprint
  ) VALUES (
    v_product, ${sqlText(evidenceBody.fact_key)}, v_fact_value, ${sqlText(evidenceBody.source_label)},
    ${sqlText(evidenceBody.source_url)}, ${sqlText(evidenceBody.source_text)},
    ${sqlText(evidenceBody.source_type)}, DATE ${sqlText(evidenceBody.checked_at)}, v_batch,
    v_fingerprint, v_fingerprint
  );
  INSERT INTO public.catalog_enrichment_applied_items (
    batch_id, product_key, batch_fingerprint, content_fingerprint, product_id, reviewed_by
  ) VALUES (v_batch, v_product_key, v_fingerprint, v_fingerprint, v_product, 'nick');
END;
$slice4$;

-- Flush the deferred Bondbuilder validator and curated-publication gate inside this
-- transaction, then re-assert both gates on the final state.
SET CONSTRAINTS ALL IMMEDIATE;
DO $slice4_postflight$
BEGIN
  IF EXISTS (SELECT 1 FROM public.products WHERE id = ${sqlText(guarded.product_id)}) THEN
    IF NOT public.bondbuilder_curated_facts_ready_v1(${sqlText(guarded.product_id)}) THEN
      RAISE EXCEPTION 'S4 Aveda cadence: curated Bondbuilder facts no longer ready';
    END IF;
    PERFORM public.assert_personal_plan_curated_publication(${sqlText(guarded.product_id)});
  END IF;
END;
$slice4_postflight$;
COMMIT;
`

  const rollback = `-- Slice 4 rollback (prepared, NOT a migration). Reverses exactly the generated batch
-- ${SLICE4_BATCH_ID} (fingerprint ${fingerprint}); refuses if anything else moved.
BEGIN;
-- Immediate checks: the updated_at trigger can only be suspended with no pending trigger events.
SET CONSTRAINTS ALL IMMEDIATE;
DO $slice4_rollback$
DECLARE
${declare}
  v_rows integer;
BEGIN
  LOCK TABLE public.product_application_protocols, public.personal_plan_catalog_fact_evidence,
    public.catalog_enrichment_applied_items IN SHARE ROW EXCLUSIVE MODE;
  PERFORM 1 FROM public.product_application_protocols WHERE id = v_protocol FOR UPDATE;
  IF NOT ${receiptMatches}
    OR NOT ${evidenceMatches}
    OR (SELECT cadence FROM public.product_application_protocols WHERE id = v_protocol)
      IS DISTINCT FROM v_cadence
    -- A later revision of the row (its stamp moved past the apply) is never undone.
    OR (SELECT updated_at FROM public.product_application_protocols WHERE id = v_protocol)
      IS DISTINCT FROM (SELECT r.created_at FROM public.catalog_enrichment_applied_items r
                        WHERE r.batch_id = v_batch AND r.product_key = v_product_key) THEN
    RAISE EXCEPTION 'S4 Aveda cadence rollback: postimage not in place';
  END IF;
  -- Restore the captured stamp too: only this table's updated_at trigger is suspended, inside
  -- this transaction (Slice 1 precedent).
  ALTER TABLE public.product_application_protocols DISABLE TRIGGER set_updated_at_product_application_protocols;
  UPDATE public.product_application_protocols
     SET cadence = NULL, updated_at = ${sqlText(guarded.protocol_updated_at)}::timestamptz
   WHERE id = v_protocol AND cadence = v_cadence;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  ALTER TABLE public.product_application_protocols ENABLE TRIGGER set_updated_at_product_application_protocols;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'S4 Aveda cadence rollback write count %', v_rows; END IF;
  DELETE FROM public.personal_plan_catalog_fact_evidence WHERE product_id = v_product AND batch_id = v_batch;
  DELETE FROM public.catalog_enrichment_applied_items WHERE batch_id = v_batch;
END;
$slice4_rollback$;
SET CONSTRAINTS ALL IMMEDIATE;
COMMIT;
`

  const verify = `-- Slice 4 verify (read-only). Zero rows = the generated postimage is in place.
-- Batch ${SLICE4_BATCH_ID}, fingerprint ${fingerprint}.
WITH expected AS (
  SELECT ${sqlText(guarded.protocol_id)}::uuid AS protocol_id, ${sqlText(guarded.product_id)}::uuid AS product_id,
    ${sqlJson(cadence)} AS cadence
)
SELECT 'protocol_cadence' AS check_name FROM expected x
WHERE NOT EXISTS (SELECT 1 FROM public.product_application_protocols p
  WHERE p.id = x.protocol_id AND p.product_id = x.product_id AND p.cadence = x.cadence)
UNION ALL
SELECT 'evidence' FROM expected x
WHERE (SELECT count(*) FROM public.personal_plan_catalog_fact_evidence e
  WHERE e.product_id = x.product_id AND e.batch_id = ${sqlText(SLICE4_BATCH_ID)}
    AND e.fact_key = ${sqlText(evidenceBody.fact_key)}
    AND e.content_fingerprint = ${sqlText(fingerprint)}) <> 1
UNION ALL
SELECT 'receipt' FROM expected x
WHERE (SELECT count(*) FROM public.catalog_enrichment_applied_items r
  WHERE r.batch_id = ${sqlText(SLICE4_BATCH_ID)} AND r.product_id = x.product_id
    AND r.content_fingerprint = ${sqlText(fingerprint)} AND r.reviewed_by = 'nick') <> 1
UNION ALL
SELECT 'curated_facts_ready' FROM expected x
WHERE NOT public.bondbuilder_curated_facts_ready_v1(x.product_id)
UNION ALL
SELECT 'only_damage_branched_row' FROM expected x
WHERE (SELECT count(*) FROM public.product_application_protocols p
  WHERE p.cadence->>'kind' = 'damage_branched') <> 1;
`

  const manifest = {
    version: "catalog-completeness-slice4-manifest-v1",
    status:
      "prepared, rehearsed, NOT applied — prod apply needs Nick's approval of this exact batch",
    batch_id: SLICE4_BATCH_ID,
    migration: SLICE4_MIGRATION,
    content_fingerprint: fingerprint,
    inputs: {
      profile: {
        path: PROFILE_PATH,
        review_sha256: profile.review.profile_sha256,
        canonical_sha256: sha256(profile),
      },
      binding: { path: BINDING_PATH, sha256: sha256(binding) },
      prestate: {
        path: "plans/catalog-completeness-fill/slice4/prestate.json",
        sha256: sha256(prestate),
      },
    },
    guarded,
    write: { protocol_id: guarded.protocol_id, before: { cadence: null }, after: { cadence } },
    evidence: evidenceBody,
    receipt: {
      batch_id: SLICE4_BATCH_ID,
      product_key: SLICE4_PRODUCT_KEY,
      product_id: guarded.product_id,
      reviewed_by: "nick",
    },
    artifacts_sha256: {} as Record<string, string>,
  }
  const files: Record<string, string> = {
    [SLICE4_MIGRATION]: migration,
    "plans/catalog-completeness-fill/slice4/rollback.sql": rollback,
    "plans/catalog-completeness-fill/slice4/verify.sql": verify,
  }
  for (const [path, text] of Object.entries(files)) {
    manifest.artifacts_sha256[path] = createHash("sha256").update(text).digest("hex")
  }
  files["plans/catalog-completeness-fill/slice4/manifest.json"] =
    `${JSON.stringify(manifest, null, 2)}\n`
  return { fingerprint, cadence, evidence: evidenceBody, files }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { files, fingerprint } = buildSlice4Artifacts()
  for (const [path, text] of Object.entries(files)) writeFileSync(resolve(ROOT, path), text)
  console.log(`slice4 generated, content fingerprint ${fingerprint}`)
}
