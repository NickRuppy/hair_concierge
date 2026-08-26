-- Add canonical GTIN-14 ownership facts without enforcing global uniqueness yet.
-- Invalid legacy barcode rows intentionally produce NULL canonical_gtin14 and stay
-- outside the future partial unique index until an operator reviews them.

CREATE OR REPLACE FUNCTION public.product_identifier_has_valid_gs1_check_digit(p_digits text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $function$
  -- Keep this algorithm in parity with hasValidGs1CheckDigit in
  -- src/lib/product-identity/normalize.ts.
  WITH valid AS (
    SELECT p_digits AS digits
    WHERE coalesce(p_digits, '') ~ '^[0-9]{2,}$'
  ),
  parts AS (
    SELECT
      digits,
      left(digits, length(digits) - 1) AS body,
      right(digits, 1) AS check_digit
    FROM valid
  ),
  weighted AS (
    SELECT
      parts.digits,
      parts.check_digit,
      coalesce(
        sum(
          substring(parts.body from length(parts.body) - series.position + 1 for 1)::integer
          * CASE WHEN series.position % 2 = 1 THEN 3 ELSE 1 END
        ),
        0
      ) AS weighted_sum
    FROM parts
    CROSS JOIN LATERAL generate_series(1, length(parts.body)) AS series(position)
    GROUP BY parts.digits, parts.check_digit
  )
  SELECT coalesce(
    (
      SELECT ((10 - (weighted_sum % 10)) % 10) = check_digit::integer
      FROM weighted
    ),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION public.product_identifier_canonical_gtin14(
  p_type text,
  p_value text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  WITH cleaned AS (
    SELECT
      lower(btrim(coalesce(p_type, ''))) AS identifier_type,
      regexp_replace(btrim(coalesce(p_value, '')), '[[:space:]-]+', '', 'g') AS digits
  )
  SELECT CASE
    WHEN identifier_type IN ('ean', 'gtin', 'barcode')
      AND length(digits) IN (8, 12, 13, 14)
      AND public.product_identifier_has_valid_gs1_check_digit(digits)
      THEN lpad(digits, 14, '0')
    ELSE NULL
  END
  FROM cleaned;
$function$;

ALTER TABLE public.product_identifiers
  ADD COLUMN IF NOT EXISTS canonical_gtin14 text GENERATED ALWAYS AS (
    public.product_identifier_canonical_gtin14(identifier_type, identifier_value)
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_product_identifiers_canonical_gtin14_lookup
  ON public.product_identifiers (canonical_gtin14)
  WHERE canonical_gtin14 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_identifiers_invalid_gtin_hold
  ON public.product_identifiers (identifier_type, normalized_identifier_value)
  WHERE identifier_type IN ('ean', 'gtin', 'barcode')
    AND canonical_gtin14 IS NULL;
