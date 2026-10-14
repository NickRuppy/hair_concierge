// Mechanical serialization of the frozen four-product or separate P08 package.
// No database connection, projector, or mutable product lookup is involved.
import { readFileSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"

const root = new URL("../../../", import.meta.url)
const premiere = process.argv.includes("--premiere")
const directory = new URL(
  premiere
    ? "data/research/bondbuilder-inci/v1.0/recommendation-promotion-2026-10-07-premiere/"
    : "data/research/bondbuilder-inci/v1.0/recommendation-promotion-2026-10-06/",
  root,
)
const read = (name) => JSON.parse(readFileSync(new URL(name, directory), "utf8"))
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`
  return JSON.stringify(value)
}
const hash = (value) => createHash("sha256").update(canonical(value)).digest("hex")
const baseline = read("baseline.json"),
  manifest = read("manifest.json")
if (hash(baseline) !== manifest.baseline_preimage_sha256)
  throw new Error("Frozen baseline hash mismatch")
if (
  premiere &&
  (hash(baseline) !== "2e1f38d11fe2147b2fe99c407add1eec289a2ffd1b1919fdf61238ab21c082bd" ||
    manifest.items[0]?.artifact_sha256 !==
      "b76fe671efd435e973679a2991f4ad7505c2c20a198ed51916df5f75524b27e7")
)
  throw new Error("Frozen P08 reviewed binding mismatch")
const items = (premiere ? ["P08"] : ["P04", "P05", "P07"]).map((key) => {
  const artifact = read(`${key}.json`),
    entry = manifest.items.find((item) => item.research_key === key)
  if (hash(artifact) !== entry.artifact_sha256)
    throw new Error(`Frozen artifact hash mismatch: ${key}`)
  const preimage = baseline.products.find((item) => item.id === artifact.productId).bundle
  return { artifact, preimage, preimage_sha256: hash(preimage), artifact_sha256: hash(artifact) }
})
if (!premiere) {
  const ogx = read("P06.json"),
    ogxBaseline = read("ogx-baseline.json")
  if (hash(ogx) !== "297d6ec2a4953f7683d938d2b784b620bf2cf4c4af3a405731ab2eecfbeb0c61")
    throw new Error("Frozen P06 artifact hash mismatch")
  if (hash(ogxBaseline) !== "4658d073b37fd278f0ce08361b03d328d4c1727e5f21e04f9592213d44f0187b")
    throw new Error("Frozen P06 baseline hash mismatch")
  const ogxPreimage = ogxBaseline.products.find((item) => item.id === ogx.productId).bundle
  items.push({
    artifact: ogx,
    preimage: ogxPreimage,
    preimage_sha256: hash(ogxPreimage),
    artifact_sha256: hash(ogx),
  })
}
const checkedDate = premiere ? "2026-10-07" : "2026-10-06"
const batchName = premiere
  ? "bondbuilder-reviewed-promotion-2026-10-07-premiere"
  : "bondbuilder-reviewed-promotion-2026-10-06"
const targetSQL = premiere
  ? "'2490911e-1c8c-413b-924c-0604f3f922e0'"
  : "'e5fd7ff9-f7d7-44d5-a600-f44bdec939a8', '9e5da870-1ab8-40f3-a74c-7088cbb31b2f',\n    '04a83f16-e610-4883-b44d-038d3a343787', '2c809d0d-fbce-435a-bbde-aa4270aaf48d'"
const sql = `-- Finite reviewed ${premiere ? "P08" : "P04/P05/P06/P07"} publication. Generated from frozen reviewed
-- artifacts by scripts/product-intake/bondbuilder/generate-reviewed-promotion-sql.mjs.
-- No reusable apply API or trigger bypass. Full readbacks include timestamps,
-- commerce, images, identity and legacy selectors; any drift requires new review.
BEGIN;
DO $promotion$
#variable_conflict use_variable
DECLARE
  item jsonb;
  artifact jsonb;
  preimage jsonb;
  postimage jsonb;
  saved_postimage jsonb;
  evidence_values jsonb;
  evidence_item record;
  product_id uuid;
  research_key text;
  post_hash text;
  prior public.catalog_enrichment_applied_items%ROWTYPE;
  batch constant text := '${batchName}';
BEGIN
  -- Fresh databases have no historical targets. Skip before policy/preimage guards.
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id IN (
    ${targetSQL})) THEN RETURN; END IF;

  -- Same dependency order as catalogue activation. Table locks additionally
  -- cover absent child rows, so concurrent inserts cannot escape the readback CAS.
  LOCK TABLE public.products, public.product_bondbuilder_specs,
    public.product_image_assets, public.product_identifiers,
    public.product_application_protocols, public.personal_plan_catalog_fact_evidence,
    public.catalog_enrichment_applied_items IN SHARE ROW EXCLUSIVE MODE;

  FOR item IN SELECT value FROM jsonb_array_elements($reviewed$
${JSON.stringify(items, null, 2)}
$reviewed$::jsonb) ORDER BY value#>>'{artifact,productId}'
  LOOP
    artifact := item->'artifact';
    product_id := (artifact->>'productId')::uuid;
    research_key := artifact->>'researchKey';
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id=product_id);
    -- Refuse silently omitted or modified policy migrations even on replay.
    IF (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc
        WHERE oid='public.bondbuilder_curated_facts_ready_v1(uuid)'::regprocedure)
        IS DISTINCT FROM '16dd604125bfe70bba78cb0d6c956a140d6c14775b8c3e308132ac6e6d39ba24' THEN
      RAISE EXCEPTION 'Bondbuilder reviewed promotion requires reviewed trust and diameter policy';
    END IF;
    preimage := public.bondbuilder_internal_admission_readback_v1(product_id);
    SELECT * INTO prior FROM public.catalog_enrichment_applied_items l
      WHERE l.batch_id=batch AND l.product_key=research_key;
    IF FOUND THEN
      SELECT e.fact_value INTO saved_postimage FROM public.personal_plan_catalog_fact_evidence e
        WHERE e.product_id=product_id AND e.batch_id=batch AND e.fact_key='bondbuilder_promotion_postimage';
      post_hash := encode(sha256(convert_to(public.bondbuilder_json_canonical_v1(saved_postimage),'UTF8')),'hex');
      IF prior.product_id IS DISTINCT FROM product_id OR prior.reviewed_by IS DISTINCT FROM 'nick'
        OR prior.batch_fingerprint IS DISTINCT FROM item->>'preimage_sha256'
        OR prior.content_fingerprint IS DISTINCT FROM post_hash
        OR saved_postimage IS NULL OR preimage IS DISTINCT FROM saved_postimage THEN
        RAISE EXCEPTION 'Bondbuilder reviewed promotion replay drift: %',research_key;
      END IF;
      postimage := saved_postimage;
    ELSE
      IF preimage IS DISTINCT FROM item->'preimage'
        OR encode(sha256(convert_to(public.bondbuilder_json_canonical_v1(preimage),'UTF8')),'hex')
          IS DISTINCT FROM item->>'preimage_sha256' THEN
        RAISE EXCEPTION 'Bondbuilder reviewed promotion preimage drift: %',research_key;
      END IF;
      IF EXISTS (SELECT 1 FROM public.personal_plan_catalog_fact_evidence e WHERE e.product_id=product_id AND e.batch_id=batch)
        OR EXISTS (SELECT 1 FROM public.catalog_enrichment_applied_items l WHERE l.product_id=product_id AND l.batch_id=batch) THEN
        RAISE EXCEPTION 'Bondbuilder reviewed promotion orphan evidence: %',research_key;
      END IF;
      IF NOT public.bondbuilder_profile_valid_v1(artifact->'profile')
        OR artifact#>>'{profile,identity,product_id}' IS DISTINCT FROM product_id::text THEN
        RAISE EXCEPTION 'Bondbuilder reviewed promotion invalid profile: %',research_key;
      END IF;
      UPDATE public.product_bondbuilder_specs s SET research_profile=artifact->'profile',
        application_mode=artifact#>>'{spec,application_mode}', treatment_mode=artifact#>>'{spec,treatment_mode}',
        usage_protocol=artifact#>>'{spec,usage_protocol}' WHERE s.product_id=product_id;
      INSERT INTO public.product_application_protocols(product_id,category,role,cadence,
        application_stage,application_state,placement,contact_time_seconds,rinse_action,
        reapplication,instruction_modifiers,source_label,source_url,source_text,guidance_payload,guidance_payload_v2)
      VALUES(product_id,'bondbuilder','specialized_bond_treatment',NULL,
        CASE WHEN research_key='P06' THEN NULL ELSE 'pre_shampoo' END,
        CASE artifact#>>'{protocolV2,facts,applicationState}' WHEN 'dry_hair' THEN 'dry' WHEN 'damp_or_dry_hair' THEN 'either' ELSE 'damp' END,
        CASE WHEN research_key='P06' THEN NULL ELSE 'pre_shampoo' END,
        (artifact#>>'{protocolV1,protocolFacts,contactTimeSeconds}')::integer,
        CASE WHEN research_key='P06' THEN 'leave_in' ELSE 'rinse' END,
        'not_stated','[]'::jsonb,'Reviewed product directions',
        artifact#>>'{source,source_url}',artifact#>>'{source,source_text}',artifact->'protocolV1',artifact->'protocolV2');
      UPDATE public.products p SET suitable_thicknesses=ARRAY(SELECT jsonb_array_elements_text(artifact->'eligibleThicknesses')),
        is_chaarlie_recommended=true WHERE p.id=product_id;
      PERFORM public.assert_personal_plan_curated_publication(product_id);
      postimage := public.bondbuilder_internal_admission_readback_v1(product_id);
      post_hash := encode(sha256(convert_to(public.bondbuilder_json_canonical_v1(postimage),'UTF8')),'hex');
    END IF;

    evidence_values := jsonb_build_object('bondbuilder_promotion_preimage',item->'preimage',
      'bondbuilder_promotion_artifact',artifact,'bondbuilder_promotion_postimage',postimage,
      'bondbuilder_promotion_digests',jsonb_build_object('preimage_sha256',item->>'preimage_sha256',
        'artifact_sha256',item->>'artifact_sha256','postimage_sha256',post_hash));
    IF prior.product_id IS NULL THEN
      INSERT INTO public.personal_plan_catalog_fact_evidence(product_id,fact_key,fact_value,
        source_label,source_url,source_text,source_type,checked_at,batch_id,batch_fingerprint,content_fingerprint)
      SELECT product_id,key,value,'Reviewed Bondbuilder recommendation promotion',artifact#>>'{source,source_url}',
        'Exact reviewed promotion preimage, artifact, postimage and canonical SHA-256 digests.',
        'internal_verified','${checkedDate}'::date,batch,item->>'preimage_sha256',post_hash FROM jsonb_each(evidence_values);
      INSERT INTO public.catalog_enrichment_applied_items(batch_id,product_key,batch_fingerprint,content_fingerprint,product_id,reviewed_by)
      VALUES(batch,research_key,item->>'preimage_sha256',post_hash,product_id,'nick');
    END IF;
    IF (SELECT count(*) FROM public.personal_plan_catalog_fact_evidence e WHERE e.product_id=product_id AND e.batch_id=batch) <> 4
      OR (SELECT count(*) FROM public.catalog_enrichment_applied_items l WHERE l.product_id=product_id AND l.batch_id=batch) <> 1 THEN
      RAISE EXCEPTION 'Bondbuilder reviewed promotion evidence count drift: %',research_key;
    END IF;
    FOR evidence_item IN SELECT key,value FROM jsonb_each(evidence_values) LOOP
      IF NOT EXISTS (SELECT 1 FROM public.personal_plan_catalog_fact_evidence e
        WHERE e.product_id=product_id AND e.fact_key=evidence_item.key AND e.fact_value=evidence_item.value
          AND e.batch_id=batch AND e.source_label='Reviewed Bondbuilder recommendation promotion'
          AND e.source_url=artifact#>>'{source,source_url}'
          AND e.source_text='Exact reviewed promotion preimage, artifact, postimage and canonical SHA-256 digests.'
          AND e.source_type='internal_verified' AND e.checked_at='${checkedDate}'::date
          AND e.batch_fingerprint=item->>'preimage_sha256' AND e.content_fingerprint=post_hash) THEN
        RAISE EXCEPTION 'Bondbuilder reviewed promotion evidence drift: %',research_key;
      END IF;
    END LOOP;
    PERFORM public.assert_personal_plan_curated_publication(product_id);
  END LOOP;
END $promotion$;
-- Execute the actual deferred publication and profile-binding guards before commit.
SET CONSTRAINTS ALL IMMEDIATE;
COMMIT;
`
const output = new URL(
  premiere
    ? "supabase/migrations/20261007080123_bondbuilder_reviewed_promotion_p08.sql"
    : "supabase/migrations/20261006170000_bondbuilder_reviewed_promotion_p04_p05_p07.sql",
  root,
)
if (process.argv.includes("--check")) {
  if (readFileSync(output, "utf8") !== sql) throw new Error("Generated promotion SQL drifted")
} else {
  writeFileSync(output, sql)
}
console.log(fileURLToPath(output))
