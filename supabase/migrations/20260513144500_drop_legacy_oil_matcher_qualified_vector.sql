-- Follow-up for environments where vector lives outside the default search path.

DROP FUNCTION IF EXISTS public.match_oil_products(extensions.vector, text, text, integer, text[]);
