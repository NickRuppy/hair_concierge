-- Historical/test profiles predate the quiz density question.
-- Backfill to a neutral value so recommendation logic receives a complete
-- physical-hair profile, but do not add a permanent default for future rows.
UPDATE public.hair_profiles
SET density = 'medium'
WHERE density IS NULL;

-- Historical captured/analyzed leads may not have been linked into profiles
-- yet. Give those otherwise-complete legacy quiz answers the same neutral
-- density so post-payment/auth lead linking does not send users back to quiz.
UPDATE public.leads
SET quiz_answers = jsonb_set(quiz_answers, '{density}', '"medium"'::jsonb, true)
WHERE quiz_answers IS NOT NULL
  AND NOT (quiz_answers ? 'density')
  AND quiz_answers ? 'structure'
  AND quiz_answers ? 'thickness'
  AND quiz_answers ? 'fingertest'
  AND quiz_answers ? 'pulltest'
  AND quiz_answers ? 'scalp_type'
  AND quiz_answers ? 'has_scalp_issue'
  AND quiz_answers ? 'treatment'
  AND quiz_answers ? 'concerns';
