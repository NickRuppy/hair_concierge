-- Public, unverified statements are deliberately separate from authenticated
-- trial cancellation authority. No foreign key or lookup identifies an account.
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE private.public_contract_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  payload jsonb NOT NULL,
  CONSTRAINT public_declaration_payload_shape CHECK (
    jsonb_typeof(payload) = 'object'
    AND payload ?& ARRAY['kind', 'name', 'email', 'contract', 'requestedEnd', 'reason']
    AND payload - ARRAY['kind', 'name', 'email', 'contract', 'requestedEnd', 'reason'] = '{}'::jsonb
    AND jsonb_typeof(payload->'kind') = 'string'
    AND payload->>'kind' IN ('ordinary_cancellation', 'extraordinary_cancellation', 'withdrawal')
    AND jsonb_typeof(payload->'name') = 'string' AND length(btrim(payload->>'name')) BETWEEN 1 AND 200
    AND jsonb_typeof(payload->'email') = 'string' AND length(payload->>'email') BETWEEN 3 AND 254
    AND jsonb_typeof(payload->'contract') = 'string' AND length(btrim(payload->>'contract')) BETWEEN 1 AND 500
    AND ((payload->>'kind' = 'withdrawal' AND payload->'requestedEnd' = 'null'::jsonb AND payload->'reason' = 'null'::jsonb)
      OR (payload->>'kind' <> 'withdrawal'
        AND jsonb_typeof(payload->'requestedEnd') = 'string' AND length(btrim(payload->>'requestedEnd')) BETWEEN 1 AND 200
        AND (payload->'reason' = 'null'::jsonb OR (payload->>'kind' = 'extraordinary_cancellation'
          AND jsonb_typeof(payload->'reason') = 'string' AND length(btrim(payload->>'reason')) BETWEEN 1 AND 2000))))
  )
);

CREATE TABLE private.public_contract_declaration_receipts (
  declaration_id uuid PRIMARY KEY REFERENCES private.public_contract_declarations(id) ON DELETE RESTRICT,
  -- Immutable snapshot. The delivery worker must not resolve an account or
  -- replace these supplied details with verified membership facts.
  receipt_version text NOT NULL DEFAULT 'public_declaration_v1' CHECK (receipt_version = 'public_declaration_v1'),
  receipt_payload jsonb NOT NULL,
  delivery_status text NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'error')),
  delivery_attempt_id uuid,
  sent_at timestamptz,
  failed_at timestamptz,
  CHECK ((delivery_status = 'sent') = (sent_at IS NOT NULL)),
  CHECK ((delivery_status = 'error') = (failed_at IS NOT NULL))
);

-- Receipt delivery does not mean the contract has been identified or acted on.
-- Every accepted statement also remains visible in a distinct operator queue.
CREATE TABLE private.public_contract_declaration_reviews (
  declaration_id uuid PRIMARY KEY REFERENCES private.public_contract_declarations(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'resolved')),
  resolved_at timestamptz,
  resolution_reference text,
  CHECK ((status = 'resolved') = (resolved_at IS NOT NULL)),
  CHECK ((status = 'resolved') = (resolution_reference IS NOT NULL)),
  CHECK (resolution_reference IS NULL OR length(btrim(resolution_reference)) BETWEEN 1 AND 200)
);

ALTER TABLE private.public_contract_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.public_contract_declaration_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.public_contract_declaration_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.public_contract_declarations, private.public_contract_declaration_receipts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.public_contract_declaration_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON private.public_contract_declarations TO service_role;
GRANT SELECT, INSERT ON private.public_contract_declaration_receipts TO service_role;
GRANT UPDATE (delivery_status, delivery_attempt_id, sent_at, failed_at) ON private.public_contract_declaration_receipts TO service_role;
GRANT SELECT, INSERT ON private.public_contract_declaration_reviews TO service_role;
-- There is intentionally no generic status-update RPC or update grant. A later
-- trusted resolution workflow must bind secure matching and completion proof.

CREATE FUNCTION public.submit_public_contract_declaration(p_request_id uuid, p_payload jsonb)
RETURNS TABLE (declaration_id uuid, submitted_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  declaration private.public_contract_declarations%ROWTYPE;
BEGIN
  IF p_request_id IS NULL OR p_payload IS NULL THEN
    RAISE EXCEPTION 'Invalid declaration' USING ERRCODE = '22023';
  END IF;
  -- Serialize same-key submissions. A replay returns only id/time and may not
  -- replace fields, enqueue another receipt, or disclose an earlier payload.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  SELECT * INTO declaration FROM private.public_contract_declarations WHERE request_id = p_request_id;
  IF FOUND THEN
    IF declaration.payload IS DISTINCT FROM p_payload THEN
      RAISE EXCEPTION 'Declaration request mismatch' USING ERRCODE = '22023';
    END IF;
  ELSE
    INSERT INTO private.public_contract_declarations(request_id, payload)
      VALUES (p_request_id, p_payload) RETURNING * INTO declaration;
    INSERT INTO private.public_contract_declaration_receipts(declaration_id, receipt_payload)
      VALUES (declaration.id, jsonb_build_object(
        'declarationId', declaration.id, 'submittedAt', declaration.submitted_at,
        'declaration', declaration.payload || jsonb_build_object('requestId', declaration.request_id)));
    INSERT INTO private.public_contract_declaration_reviews(declaration_id) VALUES (declaration.id);
  END IF;
  RETURN QUERY SELECT declaration.id, declaration.submitted_at;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_public_contract_declaration(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_contract_declaration(uuid, jsonb) TO service_role;

CREATE FUNCTION public.list_public_contract_declarations_for_review(p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
RETURNS TABLE (declaration_id uuid, submitted_at timestamptz, kind text, review_status text, receipt_delivery_status text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT d.id, d.submitted_at, d.payload->>'kind', r.status, receipt.delivery_status
  FROM private.public_contract_declarations d
  JOIN private.public_contract_declaration_reviews r ON r.declaration_id = d.id
  JOIN private.public_contract_declaration_receipts receipt ON receipt.declaration_id = d.id
  WHERE r.status <> 'resolved'
  ORDER BY d.submitted_at, d.id LIMIT greatest(1, least(coalesce(p_limit, 100), 100))
  OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

CREATE FUNCTION public.get_public_contract_declaration_for_review(p_declaration_id uuid)
RETURNS TABLE (declaration_id uuid, submitted_at timestamptz, payload jsonb, review_status text, receipt_delivery_status text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT d.id, d.submitted_at, d.payload, r.status, receipt.delivery_status
  FROM private.public_contract_declarations d
  JOIN private.public_contract_declaration_reviews r ON r.declaration_id = d.id
  JOIN private.public_contract_declaration_receipts receipt ON receipt.declaration_id = d.id
  WHERE d.id = p_declaration_id;
$$;
REVOKE ALL ON FUNCTION public.list_public_contract_declarations_for_review(integer, integer), public.get_public_contract_declaration_for_review(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_contract_declarations_for_review(integer, integer), public.get_public_contract_declaration_for_review(uuid) TO service_role;
