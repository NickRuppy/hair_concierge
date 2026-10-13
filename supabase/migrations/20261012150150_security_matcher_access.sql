-- RLS-3 / RLS-6, security audit 2026-10-09. Matchers are server/operator-only.
-- Enumerate pg_proc so historical overloads and deployed extra signatures are
-- covered without depending on the vector extension's installation schema.
BEGIN;

DO $migration$
DECLARE
  matcher record;
BEGIN
  FOR matcher IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname,
                  pg_get_function_identity_arguments(p.oid)) AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND (
        p.proname = ANY (ARRAY[
          'match_content_chunks',
          'match_content_chunks_lexical',
          'match_products',
          'match_shampoo_products',
          'match_conditioner_products',
          'match_leave_in_products',
          'match_oil_products',
          'match_public_contract_declaration'
        ])
        OR left(p.proname, 6) = 'match_'
      )
  LOOP
    -- Supabase default ACLs grant anon/authenticated explicitly: PUBLIC alone
    -- is insufficient. Keep the trusted service role able to call all overloads.
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', matcher.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', matcher.signature);
  END LOOP;
END;
$migration$;

-- No src/ client (or server) caller of content_chunks remains on d08f9a0d.
-- Corpus ingestion/evaluation scripts use the service role.
REVOKE SELECT ON TABLE public.content_chunks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.content_chunks TO service_role;
DROP POLICY IF EXISTS content_chunks_select_authenticated ON public.content_chunks;

COMMIT;
