/**
 * Slice 4 (0) — K18 DE cadence copy + Epres 30 ml, carried by re-sealing each reference anchor's
 * preserved Bondbuilder bundle. Generated from frozen inputs only; no database access.
 *
 * Inputs: the source-bound amendment (`data/research/bondbuilder-inci/v1.0/s4-k18-epres-reseal/
 * amendment.json`), the read-only prod prestate (`prestate.json`) and — only once Nick has
 * approved this exact batch — `approval.json` beside the amendment. Without a matching approval
 * the generated migration refuses on any database that holds the two products (fresh databases
 * skip). Run:  npx tsx plans/catalog-completeness-fill/slice4/k18-epres/generate.ts
 * `buildK18EpresArtifacts()` is pure; the rehearsal test asserts the files on disk equal it.
 */
import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { canonical, sha256 } from "../generate"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../../../..")
const DIR = "plans/catalog-completeness-fill/slice4/k18-epres"
const LANE = "data/research/bondbuilder-inci/v1.0/s4-k18-epres-reseal"
// Staged OUTSIDE supabase/migrations: the gated file raises on any database holding K18/Epres
// until Nick approves, so it must not sit in the deploy chain. After approval, re-run this
// generator and move the approved file to supabase/migrations/ under the same name.
export const K18_EPRES_MIGRATION = `${DIR}/20261011175000_bondbuilder_k18_epres_bundle_reseal.sql`
export const K18_EPRES_BATCH_ID = "S4-catalog-completeness-k18-epres-bundle-reseal"

const K18 = "38dace91-0fba-49ee-a93f-ac36e488fe4b"
const EPRES = "f8a63590-9d80-454a-8008-e2a56321e64c"
const K18_PROTOCOL = "ef3f1639-cab4-4a1b-bbcc-54b8e436af39"
const BUNDLE_KEY = "bondbuilder_research_preserved_bundle"
const PROFILE_KEY = "bondbuilder_research_profile"
const ARCHIVE_KEY = "bondbuilder_research_preserved_bundle_superseded"
const INTENSITY = "{specs,bond_repair_intensity}"
// Installed lineages the re-seal understands: before and after #660 step 2 (20261011120000).
const LINEAGE = {
  preimage: "01b51453052fe73f19ebfc6bdd915a6024e79033d9e8d05e8165f16f22f3395a",
  pre660: {
    ready: "16dd604125bfe70bba78cb0d6c956a140d6c14775b8c3e308132ac6e6d39ba24",
    protected: "e18246d0a2a5558f82902164d59e7d596305b3de4b7f8b25d7f798e874967dc6",
  },
  post660: {
    ready: "cabd0253b8544485ae4d0a0a6ba8b6d1f0837d8ec8a317024371a335b63ca17e",
    protected: "0355ae67bedda58cf9107bd36df3411b953285c133c0f55ec8efb0c460fc5e80",
  },
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
type Approval = { approved_by: string; approved_at: string; batch_fingerprint: string }
export type BuildOptions = {
  /** Overrides approval.json (rehearsal only). */
  approval?: Approval | null
  /** Overrides the prod-captured saved-bundle digests (rehearsal DBs have other product columns). */
  savedBundleSha256?: Record<string, string>
}

const read = (path: string) => JSON.parse(readFileSync(resolve(ROOT, path), "utf8"))
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`k18-epres generator: ${message}`)
}
const sqlText = (value: string) => `'${value.replaceAll("'", "''")}'`
const sqlJson = (value: unknown) => `$json$${JSON.stringify(value)}$json$::jsonb`
const canonicalSql = (expr: string) =>
  `encode(sha256(convert_to(public.bondbuilder_json_canonical_v1(${expr}), 'UTF8')), 'hex')`

export function buildK18EpresArtifacts(options: BuildOptions = {}) {
  const amendment = read(`${LANE}/amendment.json`)
  const prestate = read(`${DIR}/prestate.json`)
  const approvalPath = `${LANE}/approval.json`
  const approval: Approval | null =
    options.approval !== undefined
      ? options.approval
      : existsSync(resolve(ROOT, approvalPath))
        ? read(approvalPath)
        : null

  const pre = (id: string) =>
    prestate.products.find((p: { product: { id: string } }) => p.product.id === id)
  const change = (key: string) => amendment.items.find((i: { key: string }) => i.key === key)
  const k18 = pre(K18)
  const epres = pre(EPRES)
  const k18Change = change("K18")
  const epresChange = change("Epres")

  // ── frozen inputs agree with each other and with the captured prod state ──
  for (const [state, item] of [
    [k18, k18Change],
    [epres, epresChange],
  ]) {
    const profile = state.spec.research_profile
    assert(item.product_id === state.product.id, `${item.key} product`)
    assert(profile.review.profile_sha256 === item.profile_sha256, `${item.key} profile digest`)
    assert(state.seal.content_fingerprint === item.profile_sha256, `${item.key} seal binds profile`)
    assert(sha256(profile) === state.canonical_sha256.research_profile, `${item.key} profile bytes`)
    assert(
      sha256(state.product) === state.canonical_sha256.product_without_embedding,
      `${item.key} product bytes`,
    )
    assert(sha256(state.spec) === state.canonical_sha256.spec, `${item.key} spec bytes`)
    assert(state.protocols.length === 1, `${item.key} single protocol`)
    assert(
      sha256(state.protocols) === state.canonical_sha256.protocols,
      `${item.key} protocol bytes`,
    )
    assert(
      state.curated_facts_ready && state.live_equals_saved_bundle && state.s4_receipts === 0,
      `${item.key} bundle is authoritative and untouched`,
    )
    assert(profile.holds.protocol.length === state.protocol_holds, `${item.key} holds`)
    const source = profile.sources.find(
      (s: { id: string }) => s.id === item.profile_binding.source_id,
    )
    assert(source && source.url === item.profile_binding.url, `${item.key} source in profile`)
    assert(
      source.observation.includes(item.profile_binding.observation_excerpt),
      `${item.key} source wording is the profile's own observation`,
    )
  }
  const k18Protocol = k18.protocols[0]
  assert(k18Protocol.id === K18_PROTOCOL, "K18 protocol id")
  assert(canonical(k18Protocol.cadence) === canonical(k18Change.before), "K18 cadence before")
  assert(
    canonical(k18.spec.research_profile.application.cadence.value) ===
      canonical(k18Change.profile_binding.profile_cadence_value),
    "K18 profile already selects the DE cadence",
  )
  assert(
    epres.product.net_content_value === null && epres.product.net_content_unit === null,
    "Epres net content NULL",
  )

  const savedBundle = (state: typeof k18) =>
    options.savedBundleSha256?.[state.product.id] ??
    state.canonical_sha256.saved_bundle_without_intensity
  const item = (state: typeof k18, amend: typeof k18Change, extra: Record<string, Json>) => {
    const evidence = extra.evidence as Record<string, Json>
    const body = {
      key: amend.key as string,
      product_id: state.product.id as string,
      profile_sha256: amend.profile_sha256 as string,
      profile_canonical_sha256: state.canonical_sha256.research_profile as string,
      seal: {
        batch_id: state.seal.batch_id,
        batch_fingerprint: state.seal.batch_fingerprint,
        content_fingerprint: state.seal.content_fingerprint,
        reviewed_by: state.seal.reviewed_by,
        bundle: state.evidence.find((e: { fact_key: string }) => e.fact_key === BUNDLE_KEY),
        profile: state.evidence.find((e: { fact_key: string }) => e.fact_key === PROFILE_KEY),
        saved_bundle_sha256: savedBundle(state),
      } as Json,
      ...extra,
      evidence,
    }
    return { ...body, fingerprint: sha256(body) }
  }

  const k18Item = item(k18, k18Change, {
    change: "protocol_cadence",
    protocol: {
      id: k18Protocol.id,
      category: k18Protocol.category,
      role: k18Protocol.role,
      source_label: k18Protocol.source_label,
      source_url: k18Protocol.source_url,
      source_text: k18Protocol.source_text,
      guidance_payload_sha256: sha256(k18Protocol.guidance_payload),
      guidance_payload_v2_sha256: sha256(k18Protocol.guidance_payload_v2),
    },
    before: k18Change.before,
    after: k18Change.after,
    after_path: ["protocols", "0", "cadence"],
    changed_paths: [
      ["protocols", "0", "cadence"],
      ["protocols", "0", "updated_at"],
    ],
    evidence: {
      fact_key: "bondbuilder.protocol.cadence",
      fact_value: {
        protocol_id: k18Protocol.id,
        before: k18Change.before,
        after: k18Change.after,
        profile_sha256: k18Change.profile_sha256,
        profile_source_id: k18Change.profile_binding.source_id,
        amendment: `${LANE}/amendment.json`,
        ruling: k18Change.ruling,
      },
      source_label: "K18 Leave-In Mask – deutsche Marken-Seite (Kevin Murphy GmbH), Ruling B3",
      source_url: k18Change.profile_binding.url,
      source_text: `"${k18Change.live_read.verbatim_de}" (read ${k18Change.live_read.checked_at}; profile source ${k18Change.profile_binding.source_id}, checked ${k18Change.profile_binding.checked_date})`,
      source_type: "manufacturer",
      checked_at: k18Change.live_read.checked_at,
    },
  })
  const epresItem = item(epres, epresChange, {
    change: "net_content",
    before: epresChange.before,
    after: epresChange.after,
    after_path: ["product"],
    changed_paths: [
      ["product", "net_content_value"],
      ["product", "net_content_unit"],
      ["product", "updated_at"],
    ],
    evidence: {
      fact_key: "product.net_content",
      fact_value: {
        before: epresChange.before,
        after: epresChange.after,
        profile_sha256: epresChange.profile_sha256,
        profile_source_ids: [
          epresChange.profile_binding.source_id,
          epresChange.profile_binding.corroboration.source_id,
        ],
        amendment: `${LANE}/amendment.json`,
        ruling: epresChange.ruling,
      },
      source_label: "Kevin Murphy Germany (epres-Distributor DE), Group E",
      source_url: epresChange.profile_binding.url,
      source_text: `Kit and refill each hold two 15 ml concentrate ampoules (profile sources ${epresChange.profile_binding.source_id}, ${epresChange.profile_binding.corroboration.source_id}): 2 x 15 ml = 30 ml concentrate.`,
      source_type: "retailer",
      checked_at: epresChange.profile_binding.checked_date,
    },
  })
  const items = [k18Item, epresItem]
  const fingerprint = sha256({
    batch: K18_EPRES_BATCH_ID,
    lineage: LINEAGE,
    items: items.map((i) => i.fingerprint),
  })
  const approved = approval?.approved_by === "nick" && approval.batch_fingerprint === fingerprint
  const ids = `ARRAY[${sqlText(K18)}, ${sqlText(EPRES)}]::uuid[]`

  // ── shared SQL fragments (item := one element of v_items) ──
  const live = `(public.bondbuilder_research_protected_v1(public.bondbuilder_research_preimage_v1(v_product)) #- '${INTENSITY}')`
  const changeInPlace = `CASE item->>'change'
        WHEN 'protocol_cadence' THEN (SELECT a.cadence = item->'after' AND a.product_id = v_product
          FROM public.product_application_protocols a WHERE a.id = (item#>>'{protocol,id}')::uuid)
        ELSE (SELECT p.net_content_value = (item#>>'{after,net_content_value}')::numeric
          AND p.net_content_unit = item#>>'{after,net_content_unit}'
          FROM public.products p WHERE p.id = v_product) END`
  const postimageOk = `EXISTS (SELECT 1 FROM public.catalog_enrichment_applied_items r
        WHERE r.batch_id = v_batch AND r.product_key = v_product::text AND r.product_id = v_product
          AND r.reviewed_by = 'nick' AND r.batch_fingerprint = item->>'fingerprint'
          AND r.content_fingerprint = item->>'profile_sha256')
      AND (SELECT count(*) FROM public.personal_plan_catalog_fact_evidence e
        WHERE e.product_id = v_product AND e.batch_id = v_batch AND e.batch_fingerprint = item->>'fingerprint'
          AND e.content_fingerprint = item->>'profile_sha256'
          AND e.fact_key IN ('${PROFILE_KEY}', '${BUNDLE_KEY}', '${ARCHIVE_KEY}', item#>>'{evidence,fact_key}')) = 4
      AND (SELECT count(*) FROM public.personal_plan_catalog_fact_evidence e WHERE e.product_id = v_product AND e.batch_id = v_batch) = 4
      AND EXISTS (SELECT 1 FROM public.personal_plan_catalog_fact_evidence e
        WHERE e.product_id = v_product AND e.batch_id = v_batch AND e.fact_key = item#>>'{evidence,fact_key}'
          AND e.fact_value = item#>'{evidence,fact_value}' AND e.source_label = item#>>'{evidence,source_label}'
          AND e.source_url = item#>>'{evidence,source_url}' AND e.source_text = item#>>'{evidence,source_text}'
          AND e.source_type = item#>>'{evidence,source_type}' AND e.checked_at = (item#>>'{evidence,checked_at}')::date)
      AND EXISTS (SELECT 1 FROM public.personal_plan_catalog_fact_evidence e, public.product_bondbuilder_specs s
        WHERE e.product_id = v_product AND s.product_id = v_product AND e.batch_id = v_batch
          AND e.fact_key = '${PROFILE_KEY}' AND e.fact_value = s.research_profile)
      AND EXISTS (SELECT 1 FROM public.personal_plan_catalog_fact_evidence e
        WHERE e.product_id = v_product AND e.batch_id = v_batch AND e.fact_key = '${BUNDLE_KEY}'
          AND (e.fact_value #- '${INTENSITY}') = ${live})
      AND NOT EXISTS (SELECT 1 FROM public.personal_plan_catalog_fact_evidence e
        WHERE e.product_id = v_product AND e.batch_id = item#>>'{seal,batch_id}')
      AND ${changeInPlace}
      AND public.bondbuilder_curated_facts_ready_v1(v_product)`
  const declareItems = `  v_batch constant text := ${sqlText(K18_EPRES_BATCH_ID)};
  v_items constant jsonb := ${sqlJson(items)};`
  const lockAll = `PERFORM pg_advisory_xact_lock(hashtextextended('catalog-enrichment:product-apply', 0));
  LOCK TABLE public.products, public.product_bondbuilder_specs, public.product_application_protocols,
    public.personal_plan_catalog_fact_evidence, public.catalog_enrichment_applied_items
    IN SHARE ROW EXCLUSIVE MODE;`
  const postflight = (label: string) => `SET CONSTRAINTS ALL IMMEDIATE;
DO $${label}_postflight$
DECLARE v_product uuid;
BEGIN
  FOR v_product IN SELECT id FROM public.products WHERE id = ANY (${ids}) LOOP
    IF NOT public.bondbuilder_curated_facts_ready_v1(v_product) THEN
      RAISE EXCEPTION 'S4 K18/Epres re-seal: curated Bondbuilder facts not ready for %', v_product;
    END IF;
    PERFORM public.assert_personal_plan_curated_publication(v_product);
  END LOOP;
END;
$${label}_postflight$;`

  const header = `-- Slice 4 (0): K18 DE cadence copy (ruling B3) + Epres net content 30 ml (Group E), carried by
-- re-sealing each reference anchor's preserved Bondbuilder bundle.
-- GENERATED by ${DIR}/generate.ts — do not edit by hand.
-- Inputs: ${LANE}/amendment.json
--         ${DIR}/prestate.json (prod, ${prestate.captured_at})
-- Batch fingerprint: ${fingerprint}
-- Approval: ${approved ? `${approval!.approved_by} ${approval!.approved_at}` : "NONE — refuses on any database holding K18/Epres until Nick approves this fingerprint (APPROVAL.md)"}
--
-- Per product: create-only CAS on the 2026-10-04 seal (batch, fingerprints, receipt, saved bundle
-- digest, live image = saved bundle, profile bytes) and on the changed field; one field write; the
-- new protected image must differ from the saved bundle in exactly the changed field + updated_at;
-- the superseded seal is archived verbatim, then replaced by a new profile + bundle evidence pair
-- under this batch, a source-bound change-evidence row and a receipt (reviewed_by nick).
-- Research profiles are not rewritten; protocol holds are not adjudicated. Replay is a verified
-- no-op; any drift raises. Fresh databases without the two products skip.`

  const migration = `${header}
BEGIN;
DO $s4_reseal$
#variable_conflict use_variable
DECLARE
${declareItems}
  v_fingerprint constant text := ${sqlText(fingerprint)};
  v_approved_fingerprint constant text := ${approved ? sqlText(fingerprint) : "NULL"};
  item jsonb;
  path jsonb;
  v_product uuid;
  v_present integer;
  v_saved public.personal_plan_catalog_fact_evidence%ROWTYPE;
  v_profile public.personal_plan_catalog_fact_evidence%ROWTYPE;
  v_protocol public.product_application_protocols%ROWTYPE;
  v_new jsonb;
  v_old_cmp jsonb;
  v_new_cmp jsonb;
  v_rows integer;
  v_ready text;
  v_protected text;
BEGIN
  SELECT count(*) INTO v_present FROM public.products WHERE id = ANY (${ids});
  -- Fresh databases (CI, local resets) have neither reference anchor.
  IF v_present = 0 THEN RETURN; END IF;
  IF v_present <> 2 THEN RAISE EXCEPTION 'S4 K18/Epres re-seal: partial catalogue'; END IF;
  IF v_approved_fingerprint IS DISTINCT FROM v_fingerprint THEN
    RAISE EXCEPTION 'S4 K18/Epres re-seal awaiting Nick''s approval of batch fingerprint %', v_fingerprint;
  END IF;

  -- Bundle semantics this batch relies on: before or after #660 step 2, never a third body.
  SELECT encode(sha256(convert_to(prosrc, 'UTF8')), 'hex') INTO v_ready FROM pg_proc
    WHERE oid = 'public.bondbuilder_curated_facts_ready_v1(uuid)'::regprocedure;
  SELECT encode(sha256(convert_to(prosrc, 'UTF8')), 'hex') INTO v_protected FROM pg_proc
    WHERE oid = 'public.bondbuilder_research_protected_v1(jsonb)'::regprocedure;
  IF NOT ((v_ready = ${sqlText(LINEAGE.pre660.ready)} AND v_protected = ${sqlText(LINEAGE.pre660.protected)})
       OR (v_ready = ${sqlText(LINEAGE.post660.ready)} AND v_protected = ${sqlText(LINEAGE.post660.protected)}))
    OR (SELECT encode(sha256(convert_to(prosrc, 'UTF8')), 'hex') FROM pg_proc
        WHERE oid = 'public.bondbuilder_research_preimage_v1(uuid)'::regprocedure)
      IS DISTINCT FROM ${sqlText(LINEAGE.preimage)} THEN
    RAISE EXCEPTION 'S4 K18/Epres re-seal: Bondbuilder bundle lineage changed';
  END IF;

  ${lockAll}

  FOR item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
    v_product := (item->>'product_id')::uuid;
    PERFORM 1 FROM public.products WHERE id = v_product FOR UPDATE;
    PERFORM 1 FROM public.product_application_protocols WHERE product_id = v_product FOR UPDATE;

    -- Replay: the receipt exists, so the exact postimage must be in place.
    IF EXISTS (SELECT 1 FROM public.catalog_enrichment_applied_items
               WHERE batch_id = v_batch AND product_key = v_product::text) THEN
      IF NOT (${postimageOk}) THEN
        RAISE EXCEPTION 'S4 K18/Epres re-seal replay drift: %', item->>'key';
      END IF;
      CONTINUE;
    END IF;

    -- Create-only CAS on the reviewed 2026-10-04 seal.
    SELECT * INTO v_saved FROM public.personal_plan_catalog_fact_evidence
      WHERE product_id = v_product AND fact_key = '${BUNDLE_KEY}';
    SELECT * INTO v_profile FROM public.personal_plan_catalog_fact_evidence
      WHERE product_id = v_product AND fact_key = '${PROFILE_KEY}';
    IF (SELECT count(*) FROM public.personal_plan_catalog_fact_evidence
        WHERE product_id = v_product AND fact_key IN ('${BUNDLE_KEY}', '${PROFILE_KEY}')) <> 2
      OR v_saved.batch_id IS DISTINCT FROM item#>>'{seal,batch_id}'
      OR v_saved.batch_fingerprint IS DISTINCT FROM item#>>'{seal,batch_fingerprint}'
      OR v_saved.content_fingerprint IS DISTINCT FROM item#>>'{seal,content_fingerprint}'
      OR v_saved.source_url IS DISTINCT FROM item#>>'{seal,bundle,source_url}'
      OR v_saved.source_label IS DISTINCT FROM item#>>'{seal,bundle,source_label}'
      OR v_saved.source_text IS DISTINCT FROM item#>>'{seal,bundle,source_text}'
      OR v_profile.batch_id IS DISTINCT FROM item#>>'{seal,batch_id}'
      OR v_profile.batch_fingerprint IS DISTINCT FROM item#>>'{seal,batch_fingerprint}'
      OR v_profile.content_fingerprint IS DISTINCT FROM item#>>'{seal,content_fingerprint}'
      OR v_profile.source_url IS DISTINCT FROM item#>>'{seal,profile,source_url}'
      OR NOT EXISTS (SELECT 1 FROM public.catalog_enrichment_applied_items r
        WHERE r.batch_id = item#>>'{seal,batch_id}' AND r.product_key = v_product::text
          AND r.product_id = v_product AND r.reviewed_by = item#>>'{seal,reviewed_by}'
          AND r.batch_fingerprint = item#>>'{seal,batch_fingerprint}'
          AND r.content_fingerprint = item#>>'{seal,content_fingerprint}')
      OR ${canonicalSql(`v_saved.fact_value #- '${INTENSITY}'`)} IS DISTINCT FROM item#>>'{seal,saved_bundle_sha256}'
      OR ${live} IS DISTINCT FROM (v_saved.fact_value #- '${INTENSITY}')
      OR (SELECT ${canonicalSql("s.research_profile")} FROM public.product_bondbuilder_specs s
          WHERE s.product_id = v_product) IS DISTINCT FROM item->>'profile_canonical_sha256'
      OR (SELECT s.research_profile #>> '{review,profile_sha256}' FROM public.product_bondbuilder_specs s
          WHERE s.product_id = v_product) IS DISTINCT FROM item->>'profile_sha256'
      OR (SELECT s.research_profile FROM public.product_bondbuilder_specs s WHERE s.product_id = v_product)
        IS DISTINCT FROM v_profile.fact_value
      OR (SELECT count(*) FROM public.product_application_protocols a WHERE a.product_id = v_product) <> 1
      OR NOT public.bondbuilder_curated_facts_ready_v1(v_product)
      OR EXISTS (SELECT 1 FROM public.personal_plan_catalog_fact_evidence e
        WHERE e.product_id = v_product
          AND (e.batch_id = v_batch OR e.fact_key IN ('${ARCHIVE_KEY}', item#>>'{evidence,fact_key}')))
    THEN
      RAISE EXCEPTION 'S4 K18/Epres re-seal preimage changed: %', item->>'key';
    END IF;

    -- The one field write.
    IF item->>'change' = 'protocol_cadence' THEN
      SELECT * INTO v_protocol FROM public.product_application_protocols
        WHERE id = (item#>>'{protocol,id}')::uuid;
      IF v_protocol.id IS NULL OR v_protocol.product_id IS DISTINCT FROM v_product
        OR v_protocol.category IS DISTINCT FROM item#>>'{protocol,category}'
        OR v_protocol.role IS DISTINCT FROM item#>>'{protocol,role}'
        OR v_protocol.source_label IS DISTINCT FROM item#>>'{protocol,source_label}'
        OR v_protocol.source_url IS DISTINCT FROM item#>>'{protocol,source_url}'
        OR v_protocol.source_text IS DISTINCT FROM item#>>'{protocol,source_text}'
        OR ${canonicalSql("v_protocol.guidance_payload")} IS DISTINCT FROM item#>>'{protocol,guidance_payload_sha256}'
        OR ${canonicalSql("v_protocol.guidance_payload_v2")} IS DISTINCT FROM item#>>'{protocol,guidance_payload_v2_sha256}'
        OR v_protocol.cadence IS DISTINCT FROM item->'before' THEN
        RAISE EXCEPTION 'S4 K18/Epres re-seal preimage changed: % protocol', item->>'key';
      END IF;
      UPDATE public.product_application_protocols SET cadence = item->'after'
        WHERE id = v_protocol.id AND cadence = item->'before';
    ELSE
      UPDATE public.products
        SET net_content_value = (item#>>'{after,net_content_value}')::numeric,
            net_content_unit = item#>>'{after,net_content_unit}'
        WHERE id = v_product AND net_content_value IS NULL AND net_content_unit IS NULL;
    END IF;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'S4 K18/Epres re-seal write count % for %', v_rows, item->>'key'; END IF;

    -- The new image may differ from the sealed one only in the approved field and updated_at.
    v_new := public.bondbuilder_research_protected_v1(public.bondbuilder_research_preimage_v1(v_product));
    v_old_cmp := v_saved.fact_value #- '${INTENSITY}';
    v_new_cmp := v_new #- '${INTENSITY}';
    FOR path IN SELECT value FROM jsonb_array_elements(item->'changed_paths') LOOP
      v_old_cmp := v_old_cmp #- ARRAY(SELECT jsonb_array_elements_text(path));
      v_new_cmp := v_new_cmp #- ARRAY(SELECT jsonb_array_elements_text(path));
    END LOOP;
    IF v_old_cmp IS DISTINCT FROM v_new_cmp OR NOT (${changeInPlace}) THEN
      RAISE EXCEPTION 'S4 K18/Epres re-seal: unexpected bundle difference for %', item->>'key';
    END IF;

    -- Archive the superseded seal verbatim, then replace it under this batch.
    INSERT INTO public.personal_plan_catalog_fact_evidence (
      product_id, fact_key, fact_value, source_label, source_url, source_text, source_type,
      checked_at, batch_id, batch_fingerprint, content_fingerprint
    ) VALUES (
      v_product, '${ARCHIVE_KEY}',
      jsonb_build_object('superseded_by', v_batch, 'bundle_evidence', to_jsonb(v_saved),
        'profile_evidence', to_jsonb(v_profile) - 'fact_value'),
      'Superseded preserved bundle (archived by re-seal)', v_saved.source_url,
      'The 2026-10-04 reviewed seal, archived verbatim before the approved re-seal.',
      'internal_verified', v_saved.checked_at, v_batch, item->>'fingerprint', item->>'profile_sha256'
    );
    DELETE FROM public.personal_plan_catalog_fact_evidence
      WHERE product_id = v_product AND batch_id = item#>>'{seal,batch_id}'
        AND fact_key IN ('${BUNDLE_KEY}', '${PROFILE_KEY}');
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 2 THEN RAISE EXCEPTION 'S4 K18/Epres re-seal superseded rows % for %', v_rows, item->>'key'; END IF;
    INSERT INTO public.personal_plan_catalog_fact_evidence (
      product_id, fact_key, fact_value, source_label, source_url, source_text, source_type,
      checked_at, batch_id, batch_fingerprint, content_fingerprint
    ) VALUES
      (v_product, '${PROFILE_KEY}', v_profile.fact_value, v_profile.source_label, v_profile.source_url,
        v_profile.source_text, v_profile.source_type, v_profile.checked_at, v_batch,
        item->>'fingerprint', item->>'profile_sha256'),
      (v_product, '${BUNDLE_KEY}', v_new, 'Reviewed re-sealed product bundle', v_saved.source_url,
        'Re-seal of the reviewed preserved bundle after one approved source-bound field change.',
        'internal_verified', (item#>>'{evidence,checked_at}')::date, v_batch,
        item->>'fingerprint', item->>'profile_sha256'),
      (v_product, item#>>'{evidence,fact_key}', item#>'{evidence,fact_value}',
        item#>>'{evidence,source_label}', item#>>'{evidence,source_url}', item#>>'{evidence,source_text}',
        item#>>'{evidence,source_type}', (item#>>'{evidence,checked_at}')::date, v_batch,
        item->>'fingerprint', item->>'profile_sha256');
    INSERT INTO public.catalog_enrichment_applied_items (
      batch_id, product_key, batch_fingerprint, content_fingerprint, product_id, reviewed_by
    ) VALUES (v_batch, v_product::text, item->>'fingerprint', item->>'profile_sha256', v_product, 'nick');

    IF NOT (${postimageOk}) THEN
      RAISE EXCEPTION 'S4 K18/Epres re-seal postimage check failed for %', item->>'key';
    END IF;
  END LOOP;
END;
$s4_reseal$;

-- Flush the deferred Bondbuilder validators and curated-publication gate inside this
-- transaction, then re-assert both gates on the final state.
${postflight("s4_reseal")}
COMMIT;
`

  const rollback = `-- Slice 4 K18/Epres re-seal rollback (prepared, NOT a migration). Reverses exactly batch
-- ${K18_EPRES_BATCH_ID} (fingerprint ${fingerprint}); refuses unless its postimage is in place.
-- Restores the original field values AND their updated_at stamps (the sealed bundle contains
-- them), with only the updated_at trigger of the touched table disabled inside this transaction
-- (brief ACCESS EXCLUSIVE lock), and reinstates the archived 2026-10-04 seal rows verbatim.
-- Constraints run IMMEDIATE so no deferred trigger event is pending when a trigger is re-enabled.
BEGIN;
SET CONSTRAINTS ALL IMMEDIATE;
DO $s4_reseal_rollback$
#variable_conflict use_variable
DECLARE
${declareItems}
  item jsonb;
  v_product uuid;
  v_archive jsonb;
  v_old jsonb;
  v_rows integer;
BEGIN
  ${lockAll}
  FOR item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
    v_product := (item->>'product_id')::uuid;
    PERFORM 1 FROM public.products WHERE id = v_product FOR UPDATE;
    PERFORM 1 FROM public.product_application_protocols WHERE product_id = v_product FOR UPDATE;
    IF NOT (${postimageOk}) THEN
      RAISE EXCEPTION 'S4 K18/Epres rollback: postimage not in place for %', item->>'key';
    END IF;
    SELECT fact_value INTO v_archive FROM public.personal_plan_catalog_fact_evidence
      WHERE product_id = v_product AND batch_id = v_batch AND fact_key = '${ARCHIVE_KEY}';
    v_old := v_archive#>'{bundle_evidence,fact_value}';

    -- Reinstate the archived seal first, so the immediate publication check on the
    -- reverted row below compares against the original bundle.
    DELETE FROM public.personal_plan_catalog_fact_evidence WHERE product_id = v_product AND batch_id = v_batch;
    INSERT INTO public.personal_plan_catalog_fact_evidence
      SELECT * FROM jsonb_populate_record(NULL::public.personal_plan_catalog_fact_evidence, v_archive->'bundle_evidence');
    INSERT INTO public.personal_plan_catalog_fact_evidence
      SELECT * FROM jsonb_populate_record(NULL::public.personal_plan_catalog_fact_evidence,
        (v_archive->'profile_evidence') || jsonb_build_object('fact_value',
          (SELECT s.research_profile FROM public.product_bondbuilder_specs s WHERE s.product_id = v_product)));
    DELETE FROM public.catalog_enrichment_applied_items WHERE batch_id = v_batch AND product_key = v_product::text;

    IF item->>'change' = 'protocol_cadence' THEN
      ALTER TABLE public.product_application_protocols DISABLE TRIGGER set_updated_at_product_application_protocols;
      UPDATE public.product_application_protocols
        SET cadence = item->'before', updated_at = (v_old#>>'{protocols,0,updated_at}')::timestamptz
        WHERE id = (item#>>'{protocol,id}')::uuid AND cadence = item->'after';
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      ALTER TABLE public.product_application_protocols ENABLE TRIGGER set_updated_at_product_application_protocols;
    ELSE
      ALTER TABLE public.products DISABLE TRIGGER set_updated_at_products;
      UPDATE public.products
        SET net_content_value = NULL, net_content_unit = NULL,
            updated_at = (v_old#>>'{product,updated_at}')::timestamptz
        WHERE id = v_product AND net_content_value = (item#>>'{after,net_content_value}')::numeric
          AND net_content_unit = item#>>'{after,net_content_unit}';
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      ALTER TABLE public.products ENABLE TRIGGER set_updated_at_products;
    END IF;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'S4 K18/Epres rollback write count % for %', v_rows, item->>'key'; END IF;

    IF ${live} IS DISTINCT FROM (v_old #- '${INTENSITY}')
      OR NOT public.bondbuilder_curated_facts_ready_v1(v_product) THEN
      RAISE EXCEPTION 'S4 K18/Epres rollback: original seal not authoritative again for %', item->>'key';
    END IF;
  END LOOP;
END;
$s4_reseal_rollback$;
${postflight("s4_reseal_rollback")}
COMMIT;
`

  const verify = `-- Slice 4 K18/Epres re-seal verify (read-only). Zero rows = the generated postimage is in place.
-- Batch ${K18_EPRES_BATCH_ID}, fingerprint ${fingerprint}.
WITH items AS (
  SELECT value AS item, (value->>'product_id')::uuid AS v_product
  FROM jsonb_array_elements(${sqlJson(items)})
)
SELECT item->>'key' AS product, 'postimage' AS check_name
FROM items, LATERAL (SELECT ${sqlText(K18_EPRES_BATCH_ID)}::text AS v_batch) b
WHERE NOT (${postimageOk});
`

  const manifest = {
    version: "catalog-completeness-slice4-k18-epres-manifest-v1",
    status: approved
      ? "approved — apply only through the guarded migration"
      : "prepared, rehearsed, NOT applied — needs Nick's approval of the re-seal (APPROVAL.md)",
    batch_id: K18_EPRES_BATCH_ID,
    migration: K18_EPRES_MIGRATION,
    content_fingerprint: fingerprint,
    approval: approved ? approval : null,
    lineage: LINEAGE,
    inputs: {
      amendment: { path: `${LANE}/amendment.json`, sha256: sha256(amendment) },
      prestate: { path: `${DIR}/prestate.json`, sha256: sha256(prestate) },
    },
    items,
    artifacts_sha256: {} as Record<string, string>,
  }
  const files: Record<string, string> = {
    [K18_EPRES_MIGRATION]: migration,
    [`${DIR}/rollback.sql`]: rollback,
    [`${DIR}/verify.sql`]: verify,
  }
  for (const [path, text] of Object.entries(files))
    manifest.artifacts_sha256[path] = createHash("sha256").update(text).digest("hex")
  files[`${DIR}/manifest.json`] = `${JSON.stringify(manifest, null, 2)}\n`
  return { fingerprint, items, approved, files }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { files, fingerprint, approved } = buildK18EpresArtifacts()
  for (const [path, text] of Object.entries(files)) writeFileSync(resolve(ROOT, path), text)
  console.log(`k18-epres generated, batch fingerprint ${fingerprint}, approved=${approved}`)
}
