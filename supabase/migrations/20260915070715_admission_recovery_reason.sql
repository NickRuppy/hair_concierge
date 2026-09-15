-- Recovery presentation is distinct from the immutable eligibility denial reason.
-- Existing rows remain null and retain the conservative closed-attempt fallback.
ALTER TABLE public.trial_enrollments
  ADD COLUMN admission_recovery_reason text;

ALTER TABLE public.trial_enrollments
  ADD CONSTRAINT trial_enrollments_admission_recovery_reason_check
  CHECK (admission_recovery_reason IS NULL OR admission_recovery_reason = 'existing_access');
