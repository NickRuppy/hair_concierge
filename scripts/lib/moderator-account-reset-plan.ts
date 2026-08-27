import { MODERATOR_RESET_CUTOFF_KEY } from "../../src/lib/billing/moderator-reset-cutoff"
import {
  EXCLUDED_OWNER_VIEWS,
  RESET_TABLES,
  REQUIRED_AUTH_APP_METADATA_KEYS_ALLOWLIST,
  REQUIRED_AUTH_USER_METADATA_KEYS_ALLOWLIST,
  REQUIRED_AUTH_USERS_COLUMNS,
  REQUIRED_PROFILE_RETAIN_COLUMNS,
  requiredExpectedCountTables,
  resetInventoryTableNames,
} from "./moderator-account-reset-inventory"
import {
  PRODUCTION_PROJECT_REF,
  ResetManifest,
  fingerprintManifest,
  normalizeEmail,
  resetManifestSchema,
  stableSha256,
} from "./moderator-account-reset-types"

export type ResetPlan = {
  manifest: ResetManifest
  blockers: string[]
  warnings: string[]
  contentFingerprint: string
  sql: string | null
}

export function parseResetManifest(input: unknown): ResetManifest {
  return resetManifestSchema.parse(input)
}

export function buildModeratorResetPlan(input: unknown): ResetPlan {
  const manifest = parseResetManifest(input)
  const blockers = validateManifestForExecution(manifest)
  const warnings = buildWarnings(manifest)
  const contentFingerprint = stableSha256({
    operation: manifest.operation,
    batchId: manifest.batchId,
    inventory: RESET_TABLES,
    accounts: manifest.accounts.map((account) => ({
      userId: account.userId,
      email: normalizeEmail(account.email),
      expectedCounts: account.expectedCounts,
      expectedRuntimeFingerprint: account.expectedRuntimeFingerprint,
      revokeManualAccessGrantIds: account.revokeManualAccessGrantIds,
      authAppMetadataKeysToRemove: account.authAppMetadataKeysToRemove,
      authUserMetadataKeysToRemove: account.authUserMetadataKeysToRemove ?? [],
    })),
    profileResetValues: manifest.profileResetValues,
  })
  return {
    manifest,
    blockers,
    warnings,
    contentFingerprint,
    sql: blockers.length === 0 ? buildGuardedResetSql(manifest, contentFingerprint) : null,
  }
}

export function validateManifestForExecution(manifest: ResetManifest): string[] {
  const blockers: string[] = []
  const expectedFingerprint = fingerprintManifest(manifest)
  if (manifest.manifestFingerprint !== expectedFingerprint) {
    blockers.push(
      `manifest fingerprint mismatch: expected ${expectedFingerprint}, got ${manifest.manifestFingerprint}`,
    )
  }
  if (manifest.accounts.length !== manifest.operatorApprovedTargetCount) {
    blockers.push(
      `approved target count ${manifest.operatorApprovedTargetCount} does not match manifest account count ${manifest.accounts.length}`,
    )
  }
  if (manifest.environment === "production") {
    if (manifest.projectRef !== PRODUCTION_PROJECT_REF) {
      blockers.push(`production projectRef must be ${PRODUCTION_PROJECT_REF}`)
    }
    if (manifest.externalProof.productionOperationApproval !== "approved_exact_batch") {
      blockers.push("production reset requires separate exact-batch approval")
    }
  }
  if (
    manifest.environment === "local_test" &&
    manifest.externalProof.productionOperationApproval !== "not_required_local_test"
  ) {
    blockers.push("local_test manifest must not claim production approval")
  }
  for (const [field, value] of Object.entries(manifest.externalProof)) {
    if (field === "productionOperationApproval") continue
    if (value !== true) {
      blockers.push(`external proof incomplete: ${field}`)
    }
  }
  validateSchemaInventory(manifest, blockers)
  validateProfileBaseline(manifest, blockers)
  validateAccounts(manifest, blockers)
  return blockers
}

function validateSchemaInventory(manifest: ResetManifest, blockers: string[]): void {
  const expectedTables = new Set(resetInventoryTableNames())
  const discoveredTables = new Set(manifest.expectedSchema.discoveredOwnerTables)
  for (const table of expectedTables) {
    if (!discoveredTables.has(table)) {
      blockers.push(`live-schema inventory missing required owner table ${table}`)
    }
  }
  for (const table of discoveredTables) {
    if (!expectedTables.has(table)) {
      if (EXCLUDED_OWNER_VIEWS.includes(table as (typeof EXCLUDED_OWNER_VIEWS)[number])) {
        blockers.push(`live-schema owner inventory must exclude view ${table}`)
        continue
      }
      blockers.push(`unclassified live owner table ${table}`)
    }
  }
  for (const column of REQUIRED_AUTH_USERS_COLUMNS) {
    if (!manifest.expectedSchema.authUsersColumns.includes(column)) {
      blockers.push(`auth.users column ${column} must be present in the manifest schema proof`)
    }
  }
}

function validateProfileBaseline(manifest: ResetManifest, blockers: string[]): void {
  const profileColumns = new Set(manifest.expectedSchema.profileColumns)
  for (const retained of REQUIRED_PROFILE_RETAIN_COLUMNS) {
    if (!profileColumns.has(retained)) {
      blockers.push(`profiles retained identity/security column ${retained} is missing`)
    }
  }
  for (const retained of REQUIRED_PROFILE_RETAIN_COLUMNS) {
    if (Object.prototype.hasOwnProperty.call(manifest.profileResetValues, retained)) {
      blockers.push(`profiles.${retained} must be retained, not reset by this tool`)
    }
  }
  for (const [column, value] of Object.entries(manifest.profileResetValues)) {
    if (!profileColumns.has(column)) {
      blockers.push(`profiles.${column} is not present in the manifest schema proof`)
    }
    if (column === "updated_at" && value === "$now") {
      continue
    }
    if (Array.isArray(value) || (value && typeof value === "object")) {
      blockers.push(
        `profiles.${column} reset value must be primitive; do not guess SQL casts for profile baselines`,
      )
    }
  }
  for (const column of profileColumns) {
    if (
      REQUIRED_PROFILE_RETAIN_COLUMNS.includes(
        column as (typeof REQUIRED_PROFILE_RETAIN_COLUMNS)[number],
      )
    ) {
      continue
    }
    if (!Object.prototype.hasOwnProperty.call(manifest.profileResetValues, column)) {
      blockers.push(`profiles.${column} has no fresh-account reset value`)
    }
  }
  if (
    profileColumns.has("onboarding_completed") &&
    manifest.profileResetValues.onboarding_completed !== false
  ) {
    blockers.push("profiles.onboarding_completed must reset to false")
  }
  if (
    profileColumns.has("onboarding_step") &&
    manifest.profileResetValues.onboarding_step !== "welcome"
  ) {
    blockers.push(
      "profiles.onboarding_step must reset to the current fresh-account value 'welcome'",
    )
  }
}

function validateAccounts(manifest: ResetManifest, blockers: string[]): void {
  const seenUsers = new Set<string>()
  const seenEmails = new Set<string>()
  for (const account of manifest.accounts) {
    const normalizedEmail = normalizeEmail(account.email)
    if (normalizeEmail(account.expectedAuthEmail) !== normalizedEmail) {
      blockers.push(`account ${account.userId} expectedAuthEmail does not match normalized email`)
    }
    if (seenUsers.has(account.userId)) {
      blockers.push(`duplicate userId ${account.userId}`)
    }
    seenUsers.add(account.userId)
    if (seenEmails.has(normalizedEmail)) {
      blockers.push(`duplicate normalized email ${normalizedEmail}`)
    }
    seenEmails.add(normalizedEmail)
    for (const table of requiredExpectedCountTables()) {
      if (!Object.prototype.hasOwnProperty.call(account.expectedCounts, table)) {
        blockers.push(`account ${account.userId} missing expected count for ${table}`)
      }
    }
    for (const table of Object.keys(account.expectedCounts)) {
      if (!requiredExpectedCountTables().includes(table)) {
        blockers.push(
          `account ${account.userId} has expected count for unclassified table ${table}`,
        )
      }
    }
    for (const table of RESET_TABLES.filter((entry) => entry.disposition === "retain_zero")) {
      if ((account.expectedCounts[table.table] ?? 0) !== 0) {
        blockers.push(
          `account ${account.userId} has ${table.table} rows; billing/audit reconciliation must happen outside reset tooling`,
        )
      }
    }
    const expectedGrantCount = account.revokeManualAccessGrantIds.length
    if (account.expectedCounts["public.manual_access_grants"] !== expectedGrantCount) {
      blockers.push(
        `account ${account.userId} manual_access_grants count must equal the exact approved grant id count ${expectedGrantCount}`,
      )
    }
    for (const key of account.authAppMetadataKeysToRemove) {
      if (
        !REQUIRED_AUTH_APP_METADATA_KEYS_ALLOWLIST.includes(
          key as (typeof REQUIRED_AUTH_APP_METADATA_KEYS_ALLOWLIST)[number],
        )
      ) {
        blockers.push(
          `account ${account.userId} auth app metadata key ${key} is not in the app-owned reset allowlist`,
        )
      }
    }
    for (const key of account.authUserMetadataKeysToRemove ?? []) {
      if (
        !REQUIRED_AUTH_USER_METADATA_KEYS_ALLOWLIST.includes(
          key as (typeof REQUIRED_AUTH_USER_METADATA_KEYS_ALLOWLIST)[number],
        )
      ) {
        blockers.push(
          `account ${account.userId} auth user metadata key ${key} is not in the app-owned reset allowlist`,
        )
      }
    }
    validateAuthMaintenanceProof(manifest, account.userId, account.authMaintenanceProof, blockers)
  }
}

function validateAuthMaintenanceProof(
  manifest: ResetManifest,
  userId: string,
  proof: ResetManifest["accounts"][number]["authMaintenanceProof"],
  blockers: string[],
): void {
  if (!proof) {
    blockers.push(`account ${userId} missing auth maintenance proof`)
    return
  }
  if (manifest.environment === "production" && !proof.paymentReplayCutoffAt) {
    blockers.push(`account ${userId} missing payment replay cutoff proof`)
  }
  const loginRestrictedAt = Date.parse(proof.loginRestrictedAt)
  const sessionsRevokedAt = Date.parse(proof.sessionsRevokedAt)
  const queueDrainedAt = Date.parse(proof.workerQueueDrainedAt)
  const earliestResetAt = Date.parse(proof.earliestResetAt)
  const manifestCreatedAt = Date.parse(manifest.createdAt)
  // A fresh token may be issued after logout but before Auth confirms the ban.
  const jwtWaitUntil =
    Math.max(sessionsRevokedAt, loginRestrictedAt) + proof.jwtExpiresAfterSeconds * 1000
  const drainWaitUntil =
    Math.max(jwtWaitUntil, loginRestrictedAt, queueDrainedAt) + proof.inFlightDrainSeconds * 1000
  if (earliestResetAt < jwtWaitUntil) {
    blockers.push(
      `account ${userId} earliestResetAt does not wait out the actual JWT lifetime after session revocation and login restriction`,
    )
  }
  if (earliestResetAt < drainWaitUntil) {
    blockers.push(
      `account ${userId} earliestResetAt does not wait out the worker/request drain after the last JWT expiry`,
    )
  }
  if (manifestCreatedAt < earliestResetAt) {
    blockers.push(`account ${userId} manifest was created before the earliest safe reset time`)
  }
}

function buildWarnings(manifest: ResetManifest): string[] {
  const warnings = [
    "CLI apply is intentionally disabled for production until the root agent wires an approved transport and live proof capture.",
    "Supabase Auth maintenance and Storage object deletion are non-transactional and are represented only as manifest proofs in this slice.",
  ]
  if (manifest.environment === "local_test") {
    warnings.push(
      "local_test SQL only proves transaction/order/count guards on synthetic schema; it does not prove Supabase Auth runtime behavior.",
    )
  }
  return warnings
}

export function buildGuardedResetSql(manifest: ResetManifest, contentFingerprint: string): string {
  const blocks = manifest.accounts.map((account) =>
    buildAccountBlock(manifest, account, contentFingerprint),
  )
  return [
    "-- Chaarlie moderator Personal Plan full application reset",
    `-- batch_id: ${manifest.batchId}`,
    `-- content_fingerprint: sha256:${contentFingerprint}`,
    "-- Generated only from a private exact-ID manifest. Do not commit a production manifest or output containing real users.",
    "",
    "BEGIN;",
    "SET LOCAL lock_timeout = '5s';",
    "SET LOCAL statement_timeout = '60s';",
    "",
    ...blocks,
    "COMMIT;",
    "",
  ].join("\n")
}

function buildAccountBlock(
  manifest: ResetManifest,
  account: ResetManifest["accounts"][number],
  contentFingerprint: string,
): string {
  const lines: string[] = [
    `-- reset account ${account.userId} / ${normalizeEmail(account.email)}`,
    "DO $$",
    "DECLARE",
    `  v_user_id uuid := ${sqlLiteral(account.userId)}::uuid;`,
    `  v_email text := ${sqlLiteral(normalizeEmail(account.email))};`,
    `  v_expected_auth_email text := ${sqlLiteral(normalizeEmail(account.expectedAuthEmail))};`,
    `  v_expected_runtime_fingerprint text := ${sqlLiteral(account.expectedRuntimeFingerprint)};`,
    `  v_manual_grant_ids uuid[] := ARRAY[${account.revokeManualAccessGrantIds.map((id) => `${sqlLiteral(id)}::uuid`).join(", ")}]::uuid[];`,
    "  v_owned_lead_ids uuid[] := ARRAY[]::uuid[];",
    "  v_owned_funnel_session_ids uuid[] := ARRAY[]::uuid[];",
    "  v_owned_conversation_ids uuid[] := ARRAY[]::uuid[];",
    "  v_owned_routine_log_ids uuid[] := ARRAY[]::uuid[];",
    "  v_actual integer;",
    "  v_runtime_fingerprint text;",
    "BEGIN",
    `  IF v_email <> v_expected_auth_email THEN RAISE EXCEPTION 'manifest email mismatch for %', v_user_id; END IF;`,
    `  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id AND lower(email) = v_email FOR UPDATE) THEN RAISE EXCEPTION 'auth identity mismatch for %', v_user_id; END IF;`,
    `  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND lower(email) = v_email FOR UPDATE) THEN RAISE EXCEPTION 'profile identity mismatch for %', v_user_id; END IF;`,
    ...(manifest.environment === "production"
      ? [
          `  IF pg_catalog.clock_timestamp() < ${sqlLiteral(account.authMaintenanceProof!.earliestResetAt)}::timestamptz THEN RAISE EXCEPTION 'safe reset time has not elapsed for %', v_user_id; END IF;`,
          "  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id AND banned_until > pg_catalog.clock_timestamp() + interval '5 minutes') THEN RAISE EXCEPTION 'active maintenance ban required for %', v_user_id; END IF;",
          `  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id AND raw_app_meta_data->>${sqlLiteral(MODERATOR_RESET_CUTOFF_KEY)} = ${sqlLiteral(account.authMaintenanceProof!.paymentReplayCutoffAt!)}) THEN RAISE EXCEPTION 'payment replay cutoff mismatch for %', v_user_id; END IF;`,
          "  IF EXISTS (SELECT 1 FROM auth.sessions WHERE user_id = v_user_id) THEN RAISE EXCEPTION 'remaining Auth sessions for %', v_user_id; END IF;",
          "  IF EXISTS (SELECT 1 FROM auth.refresh_tokens WHERE user_id = v_user_id::text AND revoked IS NOT TRUE) THEN RAISE EXCEPTION 'unrevoked refresh tokens for %', v_user_id; END IF;",
        ]
      : []),
    "  IF EXISTS (SELECT 1 FROM public.leads WHERE lower(email) = v_email AND user_id IS NOT NULL AND user_id <> v_user_id) THEN RAISE EXCEPTION 'cross-owner exact-email lead blocks reset for %', v_user_id; END IF;",
    "  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[]) INTO v_owned_lead_ids FROM public.leads WHERE user_id = v_user_id OR lower(email) = v_email;",
    "  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[]) INTO v_owned_funnel_session_ids FROM public.funnel_sessions WHERE user_id = v_user_id OR lead_id = ANY(v_owned_lead_ids);",
    "  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[]) INTO v_owned_conversation_ids FROM public.conversations WHERE user_id = v_user_id;",
    "  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[]) INTO v_owned_routine_log_ids FROM public.routine_logs WHERE user_id = v_user_id;",
    "  IF EXISTS (SELECT 1 FROM public.funnel_sessions WHERE lead_id = ANY(v_owned_lead_ids) AND user_id IS NOT NULL AND user_id <> v_user_id) THEN RAISE EXCEPTION 'cross-owner funnel session blocks reset for %', v_user_id; END IF;",
    "  IF EXISTS (SELECT 1 FROM public.personal_plan_prepared_artifacts WHERE lead_id = ANY(v_owned_lead_ids) AND user_id IS NOT NULL AND user_id <> v_user_id) THEN RAISE EXCEPTION 'cross-owner prepared artifact blocks reset for %', v_user_id; END IF;",
    buildRuntimeFingerprintAssignmentSql("v_user_id", "v_email", "v_manual_grant_ids"),
    "  IF v_runtime_fingerprint <> v_expected_runtime_fingerprint THEN",
    "    RAISE EXCEPTION 'runtime fingerprint mismatch for %: expected %, got %', v_user_id, v_expected_runtime_fingerprint, v_runtime_fingerprint;",
    "  END IF;",
  ]
  for (const entry of RESET_TABLES) {
    const expected = account.expectedCounts[entry.table] ?? 0
    lines.push(...buildCountAssertion(entry.table, entry.selectorSql, expected))
  }
  lines.push(
    "  PERFORM pg_catalog.set_config('app.personal_plan_erasure_user_id', v_user_id::text, true);",
  )
  lines.push("  UPDATE public.personal_plans")
  lines.push("     SET current_initial_need_version_id = NULL,")
  lines.push("         current_refined_need_version_id = NULL,")
  lines.push("         active_routine_version_id = NULL,")
  lines.push("         pending_routine_proposal_id = NULL")
  lines.push("   WHERE user_id = v_user_id;")
  for (const entry of RESET_TABLES) {
    if (entry.disposition !== "delete") continue
    lines.push(`  DELETE FROM ${entry.table} WHERE ${entry.selectorSql};`)
  }
  if (account.revokeManualAccessGrantIds.length > 0) {
    lines.push(
      "  UPDATE public.manual_access_grants SET revoked_at = COALESCE(revoked_at, pg_catalog.now()), updated_at = pg_catalog.now()",
    )
    lines.push(
      "   WHERE id = ANY(v_manual_grant_ids) AND (user_id = v_user_id OR lower(email) = v_email) AND revoked_at IS NULL;",
    )
  }
  lines.push(buildProfileUpdateSql(manifest.profileResetValues))
  if (account.authAppMetadataKeysToRemove.length > 0) {
    lines.push(
      `  UPDATE auth.users SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) - ARRAY[${account.authAppMetadataKeysToRemove.map(sqlLiteral).join(", ")}]::text[] WHERE id = v_user_id;`,
    )
  }
  if ((account.authUserMetadataKeysToRemove ?? []).length > 0) {
    lines.push(
      `  UPDATE auth.users SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) - ARRAY[${(account.authUserMetadataKeysToRemove ?? []).map(sqlLiteral).join(", ")}]::text[] WHERE id = v_user_id;`,
    )
  }
  lines.push("  PERFORM pg_catalog.set_config('app.personal_plan_erasure_user_id', '', true);")
  for (const entry of RESET_TABLES.filter((entry) => entry.disposition === "delete")) {
    lines.push(...buildCountAssertion(entry.table, entry.selectorSql, 0, "residual"))
  }
  lines.push(
    ...buildCountAssertion(
      "public.manual_access_grants",
      "id = ANY(v_manual_grant_ids) AND revoked_at IS NULL",
      0,
      "residual active",
    ),
  )
  lines.push(
    `  RAISE NOTICE 'moderator reset account % complete, batch %, content sha256:%', v_user_id, ${sqlLiteral(manifest.batchId)}, ${sqlLiteral(contentFingerprint)};`,
  )
  lines.push("END $$;")
  lines.push("")
  return lines.join("\n")
}

export function buildRuntimeFingerprintSelectSql(
  userIdSql: string,
  emailSql: string,
  manualGrantIdsSql = "ARRAY[]::uuid[]",
): string {
  const pieces = [
    `SELECT 'auth.users:' || to_jsonb(auth_user)::text AS piece FROM auth.users AS auth_user WHERE id = ${userIdSql}`,
    ...RESET_TABLES.map((entry) => {
      return `SELECT ${sqlLiteral(`${entry.table}:`)} || to_jsonb(runtime_row)::text AS piece FROM ${entry.table} AS runtime_row WHERE ${runtimeSelectorSql(
        entry.selectorSql,
        userIdSql,
        emailSql,
      )
        .replaceAll("v_user_id", userIdSql)
        .replaceAll("v_email", emailSql)
        .replaceAll("v_manual_grant_ids", manualGrantIdsSql)}`
    }),
  ]
  return `SELECT 'md5:' || md5(COALESCE(string_agg(piece, E'\\n' ORDER BY piece), '')) AS runtime_fingerprint FROM (${pieces.join("\nUNION ALL\n")}) AS runtime`
}

function runtimeSelectorSql(selectorSql: string, userIdSql: string, emailSql: string): string {
  const ownedLeadIds = `ARRAY(SELECT id FROM public.leads WHERE user_id = ${userIdSql} OR lower(email) = ${emailSql})`
  const ownedFunnelSessionIds = `ARRAY(SELECT id FROM public.funnel_sessions WHERE user_id = ${userIdSql} OR lead_id = ANY(${ownedLeadIds}))`
  const ownedConversationIds = `ARRAY(SELECT id FROM public.conversations WHERE user_id = ${userIdSql})`
  const ownedRoutineLogIds = `ARRAY(SELECT id FROM public.routine_logs WHERE user_id = ${userIdSql})`
  return selectorSql
    .replaceAll("v_owned_lead_ids", ownedLeadIds)
    .replaceAll("v_owned_funnel_session_ids", ownedFunnelSessionIds)
    .replaceAll("v_owned_conversation_ids", ownedConversationIds)
    .replaceAll("v_owned_routine_log_ids", ownedRoutineLogIds)
}

function buildRuntimeFingerprintAssignmentSql(
  userIdSql: string,
  emailSql: string,
  manualGrantIdsSql: string,
): string {
  return `  SELECT runtime_fingerprint INTO v_runtime_fingerprint FROM (${buildRuntimeFingerprintSelectSql(userIdSql, emailSql, manualGrantIdsSql)}) AS runtime_fingerprint_query;`
}

function buildCountAssertion(
  table: string,
  selectorSql: string,
  expected: number,
  label = "precondition",
): string[] {
  return [
    `  SELECT pg_catalog.count(*)::integer INTO v_actual FROM ${table} WHERE ${selectorSql};`,
    `  IF v_actual <> ${expected} THEN`,
    `    RAISE EXCEPTION '${label} count mismatch for ${table}: expected ${expected}, got %', v_actual;`,
    "  END IF;",
  ]
}

function buildProfileUpdateSql(values: Record<string, unknown>): string {
  const assignments = Object.entries(values)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([column, value]) => {
      if (column === "updated_at" && value === "$now") {
        return `${quoteIdent(column)} = pg_catalog.now()`
      }
      return `${quoteIdent(column)} = ${sqlValue(value)}`
    })
  return `  UPDATE public.profiles SET ${assignments.join(", ")} WHERE id = v_user_id AND lower(email) = v_email;`
}

export function sqlValue(value: unknown): string {
  if (value === null) return "NULL"
  if (typeof value === "string") return sqlLiteral(value)
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("cannot encode non-finite SQL number")
    return String(value)
  }
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE"
  throw new Error(
    "profile reset values may only be string, number, boolean, null, or updated_at '$now'",
  )
}

export function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function quoteIdent(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`unsafe SQL identifier ${identifier}`)
  }
  return `"${identifier}"`
}
