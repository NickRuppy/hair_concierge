-- Discovery invites may be created with just a name (Nick, 2026-09-23): the
-- participant types their e-mail on the invite page and the claim binds it.
-- Until the claim completes the address may be re-bound (typo fix); once
-- claimed, the enrollment is bound to that account as before.
--
-- The CHECK on normalized_email stays as is: a NULL passes a CHECK, a non-null
-- value must still be lower/trimmed and address-shaped. The one-live-invite-
-- per-address index is rebuilt with an explicit non-null predicate so its
-- intent is readable (NULLs never collided in a unique index anyway).
--
-- Reverse: re-add NOT NULL once no current row carries a NULL email.

ALTER TABLE public.discovery_enrollments
  ALTER COLUMN normalized_email DROP NOT NULL;

DROP INDEX public.discovery_enrollments_one_current_email;

CREATE UNIQUE INDEX discovery_enrollments_one_current_email
  ON public.discovery_enrollments (normalized_email)
  WHERE normalized_email IS NOT NULL AND revoked_at IS NULL;

-- A claimed enrollment always knows its address: the claim binds it first.
ALTER TABLE public.discovery_enrollments
  ADD CONSTRAINT discovery_enrollments_claim_has_email CHECK (
    claimed_user_id IS NULL OR normalized_email IS NOT NULL
  );
