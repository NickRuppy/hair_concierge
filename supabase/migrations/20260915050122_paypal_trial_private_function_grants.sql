-- The PayPal trial RPCs are SECURITY INVOKER and run as service_role, but their
-- migrations never granted EXECUTE on the private helpers they call. The private
-- schema does not grant EXECUTE by default, so every PayPal trial checkout failed
-- with 42501 at private.paypal_trial_offer_is_valid before writing anything.
GRANT EXECUTE ON FUNCTION
  private.paypal_trial_offer_is_valid(jsonb),
  private.paypal_trial_attempt_row(private.paypal_trial_checkout_attempts),
  private.prevent_paypal_trial_checkout_attempt_rewrite(),
  private.prevent_paypal_trial_activation_clock_rewrite(),
  private.prevent_paypal_trial_management_request_rewrite(),
  private.prevent_paypal_trial_paid_recovery_request_rewrite()
TO service_role;
