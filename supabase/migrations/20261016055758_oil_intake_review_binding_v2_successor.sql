-- v1 receipts are immutable historical evidence. Keep their admission and
-- 17-row receipt contract byte-for-byte behind a versioned dispatch while
-- requiring the lean v0.10 scope for new intake records.
ALTER FUNCTION public.oil_review_assert_current(uuid,jsonb)
  RENAME TO oil_review_assert_current_v1;

CREATE FUNCTION public.oil_review_current_v2_method() RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT '{
  "purpose":"intake_research",
  "engine_id":"oil-standard",
  "methodology_version":"v0.10",
  "adapter_version":"oil-production-adapter-v1",
  "policy_pins":{
    "docs/research/oil-inci/v1.0/02_classification-standard-v0.10.md":"57a4b4a0e160fdbd7a7bd0e171e2cc58ec3cdf7a0eb7d8303d803f709dd16bbb",
    "docs/research/oil-inci/v1.0/01_property-set-v0.4.md":"bcf5f60d6df11fd01b2d4a60465db4664e2eff4c7b31a16963d3a8e9d3b1606b",
    "docs/research/oil-inci/v1.0/11_operating-guide-v0.4.md":"a24114c000c074d9fbabd221d1c3da56283ec7d20146a3198c8047c0507f3a66",
    "docs/research/oil-inci/v1.0/10_persistence-guidance-v0.3.md":"01c3c1caa317d588cc4bdc429dc171fcc1f47c51f289402652ede1adae08b248",
    "docs/research/shared/persistence-potential-v0.1.md":"b8b9ef91e408af0756dcb7d9f931f5fe0f8c3874f92ffc780512baf423f31fd4",
    "docs/research/oil-inci/v1.0/03_weight-reference-v0.10.md":"dc6d7f117cae895014620ce9b3f542f5cb35c980581d0e692aa022862ede657d",
    "data/research/oil-inci/v1.0/reference/natural-oil-weight-v0.10.json":"f2a57bd84195fa911578b69cb2153743f839d1d64f403e1bda625028bb855b50",
    "docs/research/oil-inci/v1.0/04_blend-weight-policy-v0.2.md":"5db652413c5dd814f9a9488dfab6a8bedbd7dcc107a9fe002448203429db8391",
    "data/research/oil-inci/v1.0/reference/blend-weight-policy-v0.2.json":"00d916f2faab0b07f607b3a220e788c4d82e026a36381faab40c49bcae9d5305",
    "docs/research/oil-inci/v1.0/05_thickness-fit-standard-v0.1.md":"1a28981bedf298ace48924125f12c5610ad84da4d2de5866239e4db00dc5b43c"
  }
 }'::jsonb
$$;

CREATE FUNCTION public.oil_review_assert_current_v2(p_submission_id uuid, p_snapshot jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.product_submissions; j public.product_intake_research_jobs; a public.product_intake_research_artifacts; b jsonb; e jsonb;
BEGIN
 SELECT * INTO s FROM public.product_submissions WHERE id=p_submission_id FOR UPDATE;
 IF s.id IS NULL OR s.category IS DISTINCT FROM 'oil' OR s.status IS DISTINCT FROM 'ready_for_review' OR p_snapshot->>'version' IS DISTINCT FROM 'oil-intake-review-v2' OR p_snapshot->>'submissionId' IS DISTINCT FROM s.id::text THEN RAISE EXCEPTION 'Oil review submission is stale'; END IF;
 SELECT * INTO j FROM public.product_intake_research_jobs WHERE submission_id=s.id ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE;
 b := s.researched_payload #> '{draft,oil_research_binding}';
 IF j.id IS NULL OR j.status IS DISTINCT FROM 'waiting_for_review' OR j.id::text IS DISTINCT FROM p_snapshot->>'jobId' OR b->>'job_id' IS DISTINCT FROM j.id::text OR b->>'artifact_id' IS DISTINCT FROM p_snapshot->>'artifactId' THEN RAISE EXCEPTION 'Oil review job or artifact pointer is stale'; END IF;
 SELECT * INTO a FROM public.product_intake_research_artifacts WHERE id=(b->>'artifact_id')::uuid FOR SHARE;
 IF a.id IS NULL OR a.submission_id IS DISTINCT FROM s.id OR a.job_id IS DISTINCT FROM j.id OR a.kind IS DISTINCT FROM 'property_synthesis' OR a.payload->>'oil_storage_version' IS DISTINCT FROM 'oil-research-storage-v1' THEN RAISE EXCEPTION 'Oil review artifact is invalid'; END IF;
 e := (a.payload->>'oil_research_envelope_json')::jsonb;
 IF jsonb_typeof(e) IS DISTINCT FROM 'object' OR e IS DISTINCT FROM a.payload->'oil_research_envelope'
 OR coalesce(p_snapshot->>'rawSha256','') !~ '^[a-f0-9]{64}$'
 OR coalesce(p_snapshot->>'normalizedSha256','') !~ '^[a-f0-9]{64}$'
 OR coalesce(p_snapshot->>'envelopeSha256','') !~ '^[a-f0-9]{64}$'
 OR coalesce(p_snapshot->>'admissionContextSha256','') !~ '^[a-f0-9]{64}$'
 OR jsonb_typeof(p_snapshot->'method') IS DISTINCT FROM 'object'
 OR p_snapshot->'method' IS DISTINCT FROM public.oil_review_current_v2_method()
 OR e->>'version' IS DISTINCT FROM 'oil-research-envelope-v2'
 OR e->'research_method' IS DISTINCT FROM public.oil_review_current_v2_method()
 OR b->'method' IS DISTINCT FROM public.oil_review_current_v2_method()
 OR jsonb_typeof(a.payload#>'{oil_admission_context,formula}') IS DISTINCT FROM 'object'
 OR jsonb_typeof(a.payload#>'{oil_admission_context,formula,source_ids}') IS DISTINCT FROM 'array'
 OR a.payload#>'{oil_admission_context,formula,source_ids}' = '[]'::jsonb
 OR a.payload#>>'{oil_admission_context,formula,declaration_status}' IS DISTINCT FROM 'complete'
 OR s.researched_payload#>>'{draft,formula,status}' IS DISTINCT FROM 'present'
 OR s.researched_payload#>>'{draft,formula,source}' IS DISTINCT FROM 'oil_envelope'
 OR s.researched_payload#>>'{draft,formula,raw_inci}' IS DISTINCT FROM e#>>'{formula,raw_inci}'
 OR s.researched_payload#>>'{draft,formula,fingerprint_sha256}' IS DISTINCT FROM p_snapshot->>'normalizedSha256'
 OR s.researched_payload#>'{draft,formula,normalized_ingredients}' IS DISTINCT FROM (SELECT jsonb_agg(i.value->'canonical_name' ORDER BY i.ord) FROM jsonb_array_elements(e#>'{formula,ingredients}') WITH ORDINALITY i(value,ord))
 OR encode(sha256(convert_to(a.payload->>'oil_research_envelope_json','UTF8')),'hex') IS DISTINCT FROM p_snapshot->>'envelopeSha256'
 OR a.payload->>'oil_research_envelope_sha256' IS DISTINCT FROM p_snapshot->>'envelopeSha256'
 OR b->>'envelope_sha256' IS DISTINCT FROM p_snapshot->>'envelopeSha256'
 OR a.payload->>'oil_admission_context_json' IS NULL
 OR (a.payload->>'oil_admission_context_json')::jsonb IS DISTINCT FROM a.payload->'oil_admission_context'
 OR encode(sha256(convert_to(a.payload->>'oil_admission_context_json','UTF8')),'hex') IS DISTINCT FROM p_snapshot->>'admissionContextSha256'
 OR a.payload->>'oil_admission_context_sha256' IS DISTINCT FROM p_snapshot->>'admissionContextSha256'
 OR b->>'admission_context_sha256' IS DISTINCT FROM p_snapshot->>'admissionContextSha256'
 OR a.payload#>'{oil_admission_context,formula}' IS DISTINCT FROM s.researched_payload#>'{draft,oil_authoritative_formula}'
 OR a.payload#>'{oil_admission_context,final_product_identity}' IS DISTINCT FROM jsonb_build_object('canonical_brand',s.researched_payload#>'{final,product,canonical_brand}','product_line',s.researched_payload#>'{final,product,product_line}','clean_name',s.researched_payload#>'{final,product,clean_name}','net_content_value',s.researched_payload#>'{final,product,net_content_value}','net_content_unit',s.researched_payload#>'{final,product,net_content_unit}')
 OR a.payload#>>'{oil_admission_context,resolved_identity_artifact_id}' IS DISTINCT FROM p_snapshot->>'resolvedIdentityArtifactId'
 OR e->>'submission_id' IS DISTINCT FROM s.id::text
 OR e#>>'{research_method,purpose}' IS DISTINCT FROM 'intake_research'
 OR e#>>'{provenance,import_kind}' IS DISTINCT FROM 'current'
 OR e->'research_method' IS DISTINCT FROM p_snapshot->'method'
 OR e#>>'{formula,raw_sha256}' IS DISTINCT FROM p_snapshot->>'rawSha256' OR b->>'raw_sha256' IS DISTINCT FROM p_snapshot->>'rawSha256'
 OR e#>>'{formula,normalized_sha256}' IS DISTINCT FROM p_snapshot->>'normalizedSha256' OR b->>'normalized_sha256' IS DISTINCT FROM p_snapshot->>'normalizedSha256'
 OR public.oil_review_property_scope(s.researched_payload->'final') IS DISTINCT FROM p_snapshot->'rawPropertyScope'
 THEN RAISE EXCEPTION 'Oil review content changed'; END IF;
 PERFORM 1 FROM public.product_intake_research_artifacts WHERE id=(p_snapshot->>'resolvedIdentityArtifactId')::uuid AND submission_id=s.id AND job_id=j.id AND kind='identity_candidate' AND status='resolved'
 AND payload->>'stage'='identity'
 AND payload = a.payload#>'{oil_admission_context,resolved_identity_artifact}'
 AND payload#>>'{brand_resolution,canonical_brand}'=s.researched_payload#>>'{final,product,canonical_brand}'
 AND (payload#>>'{brand_resolution,product_line}') IS NOT DISTINCT FROM (s.researched_payload#>>'{final,product,product_line}') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Oil identity admission changed'; END IF;
 IF EXISTS(SELECT 1 FROM public.product_intake_review_decisions WHERE submission_id=s.id AND resolved_at IS NULL AND decision IN ('change_requested','reject','needs_more_info')) THEN RAISE EXCEPTION 'Oil review has unresolved decisions'; END IF;
END $$;

CREATE FUNCTION public.oil_review_assert_current(p_submission_id uuid, p_snapshot jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF p_snapshot->>'version'='oil-intake-review-v1' THEN
   PERFORM public.oil_review_assert_current_v1(p_submission_id,p_snapshot);
 ELSIF p_snapshot->>'version'='oil-intake-review-v2' THEN
   PERFORM public.oil_review_assert_current_v2(p_submission_id,p_snapshot);
 ELSE RAISE EXCEPTION 'Unsupported oil intake snapshot'; END IF;
END $$;

ALTER FUNCTION public.product_intake_import_oil_lab_review(uuid,jsonb,jsonb,text,text,text)
  RENAME TO product_intake_import_oil_lab_review_v1;

CREATE FUNCTION public.product_intake_import_oil_lab_review_v2(p_submission_id uuid,p_receipt jsonb,p_snapshot jsonb,p_snapshot_fingerprint text,p_package_fingerprint text,p_snapshot_json text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v jsonb; previous jsonb; completion jsonb;
BEGIN
 PERFORM public.oil_review_assert_current_v2(p_submission_id,p_snapshot);
 IF p_receipt->>'version' IS DISTINCT FROM 'oil-lab-review-receipt-v2' OR p_receipt->>'manualMatchingApproved' IS DISTINCT FROM 'true'
 OR p_receipt->>'snapshotFingerprint' IS DISTINCT FROM p_snapshot_fingerprint OR p_receipt->>'packageFingerprint' IS DISTINCT FROM p_package_fingerprint
 OR p_snapshot_json IS NULL OR p_snapshot_json::jsonb IS DISTINCT FROM p_snapshot
 OR encode(sha256(convert_to(p_snapshot_json,'UTF8')),'hex') IS DISTINCT FROM p_snapshot_fingerprint
 OR coalesce(p_snapshot_fingerprint,'') !~ '^[a-f0-9]{64}$' OR coalesce(p_package_fingerprint,'') !~ '^[a-f0-9]{64}$'
 OR coalesce(p_receipt->>'receiptId','') !~ '^[a-f0-9]{64}$' OR coalesce((p_receipt->>'reviewRevision')::integer,0)<1
 OR jsonb_typeof(p_snapshot->'normalizedFinal') IS DISTINCT FROM 'object' OR jsonb_typeof(p_snapshot->'specOperations') IS DISTINCT FROM 'array'
 OR octet_length(convert_to(p_snapshot_json,'UTF8'))>131072
 OR p_receipt->'approvedPropertyIds' IS DISTINCT FROM '["base","weight","persistence_potential","supported_uses","provides_heat_protection","provides_uv_protection","ingredient_flags.silicones","ingredient_flags.mineral_oil","ingredient_flags.drying_alcohol","ingredient_flags.fragrance","ingredient_flags.scalp_active_botanicals","projection","matching"]'::jsonb
 THEN RAISE EXCEPTION 'Oil Lab receipt is incomplete'; END IF;
 v := jsonb_build_object('origin','oil_lab','receipt_id',p_receipt->>'receiptId','package_fingerprint',p_package_fingerprint,'snapshot_fingerprint',p_snapshot_fingerprint,'review_revision',(p_receipt->>'reviewRevision')::integer,'receipt',p_receipt,'snapshot',p_snapshot,'snapshot_json',p_snapshot_json);
 previous := public.product_intake_get_oil_lab_handoff(p_submission_id,p_receipt->>'receiptId');
 IF previous IS NOT NULL AND previous IS DISTINCT FROM v THEN RAISE EXCEPTION 'Oil receipt token conflict'; END IF;
 IF previous IS NULL THEN
 INSERT INTO public.product_intake_review_decisions(submission_id,job_id,field_path,decision,reviewer_value,reviewed_by,comment) VALUES(p_submission_id,(p_snapshot->>'jobId')::uuid,'final.properties','approved',v,'nick','Imported completed current Oil Research Lab review.') ;
 END IF;
 UPDATE public.product_submissions SET researched_payload=jsonb_set(researched_payload,'{final,review}',coalesce(researched_payload#>'{final,review}','{}'::jsonb) || '{"manual_reviewed":true}'::jsonb) WHERE id=p_submission_id;
 completion := public.product_intake_complete_oil_review(p_submission_id);
 RETURN v || jsonb_build_object('publication_ready',completion IS NOT NULL,'review_blockers',CASE WHEN completion IS NULL THEN '["current_image_approval_pending"]'::jsonb ELSE '[]'::jsonb END);
END $$;

CREATE FUNCTION public.product_intake_import_oil_lab_review(p_submission_id uuid,p_receipt jsonb,p_snapshot jsonb,p_snapshot_fingerprint text,p_package_fingerprint text,p_snapshot_json text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF p_receipt->>'version'='oil-lab-review-receipt-v1' AND p_snapshot->>'version'='oil-intake-review-v1' THEN
   RETURN public.product_intake_import_oil_lab_review_v1(p_submission_id,p_receipt,p_snapshot,p_snapshot_fingerprint,p_package_fingerprint,p_snapshot_json);
 ELSIF p_receipt->>'version'='oil-lab-review-receipt-v2' AND p_snapshot->>'version'='oil-intake-review-v2' THEN
   RETURN public.product_intake_import_oil_lab_review_v2(p_submission_id,p_receipt,p_snapshot,p_snapshot_fingerprint,p_package_fingerprint,p_snapshot_json);
 END IF;
 RAISE EXCEPTION 'Oil Lab receipt is incomplete';
END $$;

DO $$ DECLARE f regprocedure; BEGIN
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname = ANY(ARRAY[
 'oil_review_assert_current_v1','oil_review_assert_current_v2','oil_review_current_v2_method',
 'oil_review_assert_current','product_intake_import_oil_lab_review_v1',
 'product_intake_import_oil_lab_review_v2','product_intake_import_oil_lab_review'
 ]) LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f);
 IF f::text IN ('product_intake_import_oil_lab_review(uuid,jsonb,jsonb,text,text,text)'::text) THEN
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f);
 END IF;
 END LOOP;
END $$;
