ALTER TABLE public.product_intake_research_jobs
  ADD COLUMN IF NOT EXISTS engine_key text,
  ADD COLUMN IF NOT EXISTS engine_version text;

-- Bind the server-selected methodology/adapter tuple while holding the lease.
-- Rework keeps this binding; an explicit boolean upgrade is consumed and receipted.
CREATE OR REPLACE FUNCTION public.product_intake_bind_research_job_engine(
  target_job_id uuid,
  next_engine_key text,
  next_engine_version text,
  expected_locked_by text,
  expected_locked_at timestamptz
)
RETURNS public.product_intake_research_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  job_row public.product_intake_research_jobs;
  binding_changed boolean;
BEGIN
  IF NULLIF(btrim(next_engine_key), '') IS NULL
     OR NULLIF(btrim(next_engine_version), '') IS NULL THEN
    RAISE EXCEPTION 'engine binding requires a non-empty key and version'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO job_row
  FROM public.product_intake_research_jobs
  WHERE id = target_job_id
  FOR UPDATE;

  IF NOT FOUND OR job_row.status <> 'running'
     OR expected_locked_by IS NULL OR expected_locked_at IS NULL
     OR job_row.locked_by IS DISTINCT FROM expected_locked_by
     OR job_row.locked_at IS DISTINCT FROM expected_locked_at THEN
    RAISE EXCEPTION 'Product intake research job lock no longer matches: %', target_job_id
      USING ERRCODE = '40001';
  END IF;

  binding_changed := (job_row.engine_key IS NOT NULL OR job_row.engine_version IS NOT NULL)
    AND (job_row.engine_key IS DISTINCT FROM next_engine_key
      OR job_row.engine_version IS DISTINCT FROM next_engine_version);

  IF binding_changed AND (job_row.progress -> 'engine_upgrade') IS DISTINCT FROM 'true'::jsonb THEN
    IF job_row.engine_key IS DISTINCT FROM next_engine_key THEN
      RAISE EXCEPTION 'engine_key_mismatch: % != %', COALESCE(job_row.engine_key, 'null'), next_engine_key
        USING ERRCODE = '22023';
    END IF;
    RAISE EXCEPTION 'engine_version_mismatch: % != %', COALESCE(job_row.engine_version, 'null'), next_engine_version
      USING ERRCODE = '22023';
  END IF;

  IF job_row.engine_key = next_engine_key AND job_row.engine_version = next_engine_version THEN
    RETURN job_row;
  END IF;

  UPDATE public.product_intake_research_jobs
  SET engine_key = next_engine_key,
      engine_version = next_engine_version,
      progress = CASE WHEN binding_changed THEN COALESCE(job_row.progress, '{}'::jsonb) || jsonb_build_object(
        'engine_upgrade', false,
        'engine_upgrade_receipt', jsonb_build_object(
          'previous_key', job_row.engine_key,
          'previous_version', job_row.engine_version,
          'key', next_engine_key,
          'version', next_engine_version
        )
      ) ELSE job_row.progress END
  WHERE id = target_job_id
  RETURNING * INTO job_row;

  RETURN job_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.product_intake_bind_research_job_engine(uuid, text, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_intake_bind_research_job_engine(uuid, text, text, text, timestamptz)
  TO service_role;
