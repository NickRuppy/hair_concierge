-- Oil Lab receipts are properties approvals only. Publication remains explicit.
-- Hash exact stored bytes; JSONB is the readable structural mirror only.
CREATE FUNCTION public.oil_review_property_scope(p_final jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT jsonb_build_object('product', coalesce((SELECT jsonb_object_agg(key,value) FROM jsonb_each(p_final->'product') WHERE key = ANY(ARRAY['canonical_brand','product_line','clean_name','category_key','suitable_thicknesses','affiliate_link','price_eur','currency','purchase_link_status','net_content_value','net_content_unit','market_segment'])), '{}'::jsonb))
 || coalesce((SELECT jsonb_object_agg(key, CASE WHEN key='field_rationales' THEN value - ARRAY['product.image_url','product.canonical_image_sha256','product.thumbnail_image_url','product.price_checked_at','product.purchase_link_checked_at'] ELSE value END) FROM jsonb_each(p_final) WHERE key = ANY(ARRAY['identifiers','category_specs','field_rationales','sources'])), '{}'::jsonb)
$$;

CREATE FUNCTION public.oil_review_assert_current(p_submission_id uuid, p_snapshot jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.product_submissions; j public.product_intake_research_jobs; a public.product_intake_research_artifacts; b jsonb; e jsonb;
BEGIN
 SELECT * INTO s FROM public.product_submissions WHERE id=p_submission_id FOR UPDATE;
 IF s.id IS NULL OR s.category IS DISTINCT FROM 'oil' OR s.status IS DISTINCT FROM 'ready_for_review' OR p_snapshot->>'version' IS DISTINCT FROM 'oil-intake-review-v1' OR p_snapshot->>'submissionId' IS DISTINCT FROM s.id::text THEN RAISE EXCEPTION 'Oil review submission is stale'; END IF;
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
 OR p_snapshot->>'admissionContextSha256' IS NULL
 OR a.payload#>'{oil_admission_context,formula}' IS DISTINCT FROM s.researched_payload#>'{draft,oil_authoritative_formula}'
 OR a.payload#>'{oil_admission_context,final_product_identity}' IS DISTINCT FROM jsonb_build_object('canonical_brand',s.researched_payload#>'{final,product,canonical_brand}','product_line',s.researched_payload#>'{final,product,product_line}','clean_name',s.researched_payload#>'{final,product,clean_name}','net_content_value',s.researched_payload#>'{final,product,net_content_value}','net_content_unit',s.researched_payload#>'{final,product,net_content_unit}')
 OR a.payload#>>'{oil_admission_context,resolved_identity_artifact_id}' IS DISTINCT FROM p_snapshot->>'resolvedIdentityArtifactId'
 OR e->>'submission_id' IS DISTINCT FROM s.id::text
 OR e#>>'{research_method,purpose}' IS DISTINCT FROM 'intake_research'
 OR e#>>'{provenance,import_kind}' IS DISTINCT FROM 'current'
 OR e->'research_method' IS DISTINCT FROM p_snapshot->'method' OR b->'method' IS DISTINCT FROM p_snapshot->'method'
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

-- The shared decision trigger performs an indexed submission lookup for every
-- category, taking a row lock only for oil. Oil publication and import acquire
-- submission before job locks; non-oil decision rows acquire no additional lock.
CREATE FUNCTION public.oil_review_lock_decision_submission() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
   PERFORM 1 FROM public.product_submissions WHERE id IN (OLD.submission_id,NEW.submission_id) AND category='oil' ORDER BY id FOR UPDATE;
 ELSE
   PERFORM 1 FROM public.product_submissions WHERE id=NEW.submission_id AND category='oil' FOR UPDATE;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER oil_review_decision_submission_lock
BEFORE INSERT OR UPDATE ON public.product_intake_review_decisions
FOR EACH ROW EXECUTE FUNCTION public.oil_review_lock_decision_submission();
REVOKE ALL ON FUNCTION public.oil_review_lock_decision_submission() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.product_intake_get_oil_lab_handoff(p_submission_id uuid,p_receipt_id text DEFAULT NULL) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
 SELECT reviewer_value FROM public.product_intake_review_decisions WHERE submission_id=p_submission_id AND field_path='final.properties' AND decision='approved' AND reviewer_value->>'origin'='oil_lab' AND (p_receipt_id IS NULL OR reviewer_value->>'receipt_id'=p_receipt_id) ORDER BY created_at DESC,id DESC LIMIT 1
$$;

CREATE FUNCTION public.product_intake_complete_oil_review(p_submission_id uuid,p_check_only boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v jsonb; img public.product_intake_research_artifacts; d public.product_intake_review_decisions; result public.product_intake_review_decisions;
BEGIN
 -- Lock before selecting the receipt so concurrent imports cannot race completion.
 PERFORM 1 FROM public.product_submissions WHERE id=p_submission_id FOR UPDATE;
 v := public.product_intake_get_oil_lab_handoff(p_submission_id,NULL);
 IF v IS NULL THEN RETURN NULL; END IF;
 PERFORM public.oil_review_assert_current(p_submission_id,v->'snapshot');
 SELECT * INTO img FROM public.product_intake_research_artifacts WHERE submission_id=p_submission_id AND kind='processed_image' ORDER BY created_at DESC,id DESC LIMIT 1 FOR SHARE;
 SELECT * INTO d FROM public.product_intake_review_decisions WHERE submission_id=p_submission_id AND field_path='final.image' ORDER BY reviewed_at DESC,created_at DESC,id DESC LIMIT 1;
 IF img.id IS NULL OR img.status IS DISTINCT FROM 'pending_review' OR img.payload->>'final_image_ready' IS DISTINCT FROM 'true' OR img.payload->>'transparent_background_detected' IS DISTINCT FROM 'true' OR d.decision IS DISTINCT FROM 'image_approved' OR d.reviewed_at IS NULL OR img.created_at IS NULL OR d.reviewed_at<img.created_at THEN RETURN NULL; END IF;
 SELECT * INTO result FROM public.product_intake_review_decisions WHERE submission_id=p_submission_id AND field_path='final.product' AND decision='publish_approved' AND reviewer_value=v LIMIT 1;
 IF result.id IS NULL AND p_check_only THEN RETURN NULL; END IF;
 IF result.id IS NULL THEN
 INSERT INTO public.product_intake_review_decisions(submission_id,job_id,field_path,decision,reviewer_value,reviewed_by,comment) VALUES(p_submission_id,(v#>>'{snapshot,jobId}')::uuid,'final.product','publish_approved',v,'nick','Current oil Lab properties, image and brand approved.') RETURNING * INTO result;
 END IF;
 RETURN to_jsonb(result);
END $$;

CREATE FUNCTION public.product_intake_import_oil_lab_review(p_submission_id uuid,p_receipt jsonb,p_snapshot jsonb,p_snapshot_fingerprint text,p_package_fingerprint text,p_snapshot_json text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v jsonb; previous jsonb; completion jsonb;
BEGIN
 PERFORM public.oil_review_assert_current(p_submission_id,p_snapshot);
 IF p_receipt->>'version' IS DISTINCT FROM 'oil-lab-review-receipt-v1' OR p_receipt->>'manualMatchingApproved' IS DISTINCT FROM 'true'
 OR p_receipt->>'snapshotFingerprint' IS DISTINCT FROM p_snapshot_fingerprint OR p_receipt->>'packageFingerprint' IS DISTINCT FROM p_package_fingerprint
 OR p_snapshot_json IS NULL OR p_snapshot_json::jsonb IS DISTINCT FROM p_snapshot
 OR encode(sha256(convert_to(p_snapshot_json,'UTF8')),'hex') IS DISTINCT FROM p_snapshot_fingerprint
 OR coalesce(p_snapshot_fingerprint,'') !~ '^[a-f0-9]{64}$' OR coalesce(p_package_fingerprint,'') !~ '^[a-f0-9]{64}$'
 OR coalesce(p_receipt->>'receiptId','') !~ '^[a-f0-9]{64}$' OR coalesce((p_receipt->>'reviewRevision')::integer,0)<1
 OR jsonb_typeof(p_snapshot->'normalizedFinal') IS DISTINCT FROM 'object' OR jsonb_typeof(p_snapshot->'specOperations') IS DISTINCT FROM 'array'
 OR octet_length(convert_to(p_snapshot_json,'UTF8'))>131072
 OR (p_receipt->'approvedPropertyIds' @> '["base","named_oils","weight","dispenser","penetration_potential","provides_heat_protection","provides_uv_protection","supported_uses","persistence_potential","ingredient_flags.silicones","ingredient_flags.mineral_oil","ingredient_flags.drying_alcohol","ingredient_flags.fragrance","ingredient_flags.scalp_active_botanicals","scenario_fit","projection","matching"]'::jsonb) IS NOT TRUE
 THEN RAISE EXCEPTION 'Oil Lab receipt is incomplete'; END IF;
 v := jsonb_build_object('origin','oil_lab','receipt_id',p_receipt->>'receiptId','package_fingerprint',p_package_fingerprint,'snapshot_fingerprint',p_snapshot_fingerprint,'review_revision',(p_receipt->>'reviewRevision')::integer,'receipt',p_receipt,'snapshot',p_snapshot,'snapshot_json',p_snapshot_json);
 previous := public.product_intake_get_oil_lab_handoff(p_submission_id,p_receipt->>'receiptId');
 IF previous IS NOT NULL AND previous IS DISTINCT FROM v THEN RAISE EXCEPTION 'Oil receipt token conflict'; END IF;
 IF previous IS NULL THEN
 INSERT INTO public.product_intake_review_decisions(submission_id,job_id,field_path,decision,reviewer_value,reviewed_by,comment) VALUES(p_submission_id,(p_snapshot->>'jobId')::uuid,'final.properties','approved',v,'nick','Imported completed current Oil Research Lab review.');
 END IF;
 UPDATE public.product_submissions SET researched_payload=jsonb_set(researched_payload,'{final,review}',coalesce(researched_payload#>'{final,review}','{}'::jsonb) || '{"manual_reviewed":true}'::jsonb) WHERE id=p_submission_id;
 completion := public.product_intake_complete_oil_review(p_submission_id);
 -- Acknowledgement metadata is not part of the immutable stored receipt token.
 RETURN v || jsonb_build_object('publication_ready',completion IS NOT NULL,'review_blockers',CASE WHEN completion IS NULL THEN '["current_image_approval_pending"]'::jsonb ELSE '[]'::jsonb END);
END $$;

CREATE FUNCTION public.product_intake_oil_publication_preflight(p_submission_id uuid,p_final_payload jsonb,p_spec_operations jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v jsonb; d public.product_intake_review_decisions; img public.product_intake_research_artifacts;
BEGIN
 PERFORM 1 FROM public.product_submissions WHERE id=p_submission_id FOR UPDATE;
 v := public.product_intake_get_oil_lab_handoff(p_submission_id,NULL);
 IF v IS NULL THEN RAISE EXCEPTION 'Current oil Lab approval required'; END IF;
 PERFORM public.oil_review_assert_current(p_submission_id,v->'snapshot');
 IF public.oil_review_property_scope(p_final_payload) IS DISTINCT FROM v#>'{snapshot,normalizedFinal}' OR p_spec_operations IS DISTINCT FROM v#>'{snapshot,specOperations}' THEN RAISE EXCEPTION 'Oil publication payload differs from approved review'; END IF;
 IF public.product_intake_complete_oil_review(p_submission_id,true) IS NULL THEN RAISE EXCEPTION 'Current oil image and brand approval required'; END IF;
 SELECT * INTO img FROM public.product_intake_research_artifacts WHERE submission_id=p_submission_id AND kind='processed_image' ORDER BY created_at DESC,id DESC LIMIT 1 FOR SHARE;
 IF nullif(img.payload->>'planned_public_url','') IS NULL
 OR coalesce(img.payload->>'asset_sha256','') !~ '^[a-f0-9]{64}$'
 OR nullif(img.payload->>'thumbnail_public_url','') IS NULL
 OR p_final_payload#>>'{product,image_url}' IS DISTINCT FROM img.payload->>'planned_public_url'
 OR p_final_payload#>>'{product,canonical_image_sha256}' IS DISTINCT FROM img.payload->>'asset_sha256'
 OR p_final_payload#>>'{product,thumbnail_image_url}' IS DISTINCT FROM img.payload->>'thumbnail_public_url'
 THEN RAISE EXCEPTION 'Oil publication image differs from the current reviewed artifact'; END IF;
 SELECT * INTO d FROM public.product_intake_review_decisions WHERE submission_id=p_submission_id AND field_path='final.product' ORDER BY reviewed_at DESC,created_at DESC,id DESC LIMIT 1;
 IF d.decision IS DISTINCT FROM 'publish_approved' OR d.reviewer_value IS DISTINCT FROM v THEN RAISE EXCEPTION 'Current bound oil publication approval required'; END IF;
 RETURN v;
END $$;

-- Preserve the entire current wrapper chain (identifier, package, protocol and image).
ALTER FUNCTION public.product_intake_approve_reviewed_product(uuid,jsonb,jsonb,text,timestamptz,text) RENAME TO product_intake_approve_reviewed_product_before_oil_lab;
CREATE FUNCTION public.product_intake_approve_reviewed_product(p_submission_id uuid,p_final_payload jsonb,p_spec_operations jsonb,p_reviewed_by text,p_reviewed_at timestamptz DEFAULT now(),p_review_notes text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE category text;
BEGIN
 SELECT s.category INTO category FROM public.product_submissions s WHERE s.id=p_submission_id FOR UPDATE;
 IF category='oil' OR p_final_payload#>>'{product,category_key}'='oil' THEN
 PERFORM public.product_intake_oil_publication_preflight(p_submission_id,p_final_payload,p_spec_operations);
 END IF;
 RETURN public.product_intake_approve_reviewed_product_before_oil_lab(p_submission_id,p_final_payload,p_spec_operations,p_reviewed_by,p_reviewed_at,p_review_notes);
END $$;
REVOKE ALL ON FUNCTION public.product_intake_approve_reviewed_product_before_oil_lab(uuid,jsonb,jsonb,text,timestamptz,text) FROM PUBLIC,anon,authenticated,service_role;
-- Old renamed wrappers inherited grants in earlier migrations. They remain
-- callable by the SECURITY DEFINER chain owner, never directly by API roles.
DO $$ DECLARE f regprocedure; BEGIN
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname = ANY(ARRAY[
 'product_intake_approve_reviewed_product_legacy',
 'product_intake_approve_reviewed_product_without_canonical_guidance',
 'product_intake_approve_reviewed_product_before_net_content',
 'product_intake_approve_reviewed_product_before_thumbnail_image',
 'product_intake_approve_reviewed_product_before_scanned_identifier']) LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f);
 END LOOP;
END $$;
DO $$ DECLARE f regprocedure; BEGIN
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname = ANY(ARRAY['oil_review_property_scope','oil_review_assert_current','product_intake_get_oil_lab_handoff','product_intake_complete_oil_review','product_intake_import_oil_lab_review','product_intake_oil_publication_preflight','product_intake_approve_reviewed_product']) LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f);
 IF f::text NOT LIKE 'oil_review_%' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f); END IF;
 END LOOP;
END $$;
