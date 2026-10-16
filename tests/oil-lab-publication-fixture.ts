export const publicationTestDdl = `CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE TABLE product_submissions(id uuid PRIMARY KEY,category text,status text,researched_payload jsonb);
 CREATE TABLE product_intake_research_jobs(id uuid PRIMARY KEY,submission_id uuid,status text,created_at timestamptz DEFAULT now());
 CREATE TABLE product_intake_research_artifacts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),submission_id uuid,job_id uuid,kind text,status text,payload jsonb,created_at timestamptz DEFAULT now());
 CREATE TABLE product_intake_review_decisions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),submission_id uuid,job_id uuid,field_path text,decision text,proposed_value jsonb,reviewer_value jsonb,comment text,reviewed_by text,reviewed_at timestamptz NOT NULL DEFAULT now(),resolved_at timestamptz,created_at timestamptz DEFAULT now());
 CREATE TABLE catalog_writes(id uuid);
 CREATE FUNCTION product_intake_approve_reviewed_product_legacy(uuid,jsonb,jsonb,text,timestamptz DEFAULT now(),text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN INSERT INTO public.catalog_writes VALUES($1); RETURN '{"legacy":true}'::jsonb; END $$;
 REVOKE ALL ON FUNCTION product_intake_approve_reviewed_product_legacy(uuid,jsonb,jsonb,text,timestamptz,text) FROM PUBLIC,anon,authenticated;
 GRANT EXECUTE ON FUNCTION product_intake_approve_reviewed_product_legacy(uuid,jsonb,jsonb,text,timestamptz,text) TO service_role;
 CREATE FUNCTION product_intake_approve_reviewed_product(uuid,jsonb,jsonb,text,timestamptz DEFAULT now(),text DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$ SELECT public.product_intake_approve_reviewed_product_legacy($1,$2,$3,$4,$5,$6) $$;
 GRANT USAGE ON SCHEMA public TO service_role;
 GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;`

export const publicationImage = {
  planned_public_url:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/oil-fixture.png",
  asset_sha256: "a".repeat(64),
  thumbnail_public_url:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/thumbnails/search-v1/" +
    "a".repeat(64) +
    ".webp",
  final_image_ready: true,
  transparent_background_detected: true,
}
export function publicationFinal(scope: Record<string, unknown>) {
  return {
    ...scope,
    product: {
      ...(scope.product as object),
      image_url: publicationImage.planned_public_url,
      canonical_image_sha256: publicationImage.asset_sha256,
      thumbnail_image_url: publicationImage.thumbnail_public_url,
    },
  }
}
