/**
 * Kill switch for every server path that touches the account-deletion / App Store schema.
 *
 * That schema (anonymized_at columns, account_deletion_* RPCs, app_store_* tables) lands via
 * Supabase migrations after the code is deployed, so those paths must stay inert until
 * `db push` has run. Set ACCOUNT_DELETION_ENABLED=true only after the migrations are applied;
 * any other value, or unset, keeps the paths off.
 */
export function accountDeletionEnabled(): boolean {
  return process.env.ACCOUNT_DELETION_ENABLED === "true"
}
