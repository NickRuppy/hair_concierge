import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { setTimeout } from "node:timers/promises"
import {
  ACCOUNT_DELETION_COVERED_PARENTS,
  ACCOUNT_DELETION_FK_EDGES,
  ACCOUNT_DELETION_RETENTION,
  ACCOUNT_DELETION_TABLE_CLASSES,
} from "../src/lib/account-deletion/inventory"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import { currentLegacyAnswers } from "../src/lib/scan/scanner-context"
import { localReplayMigrations } from "../scripts/mobile/local-migrations.mjs"

// Real Supabase PostgreSQL with the full migration chain (same replay as the isolated
// mobile stack). Opt-in: ACCOUNT_DELETION_POSTGRES_TEST=1 (Docker context colima-chaarlie).
const enabled = process.env.ACCOUNT_DELETION_POSTGRES_TEST === "1"
const IMAGE = "public.ecr.aws/supabase/postgres:17.6.1.106"

const A = "a0000000-0000-4000-8000-00000000000a" // web user, trial + one-time purchase
const B = "b0000000-0000-4000-8000-00000000000b" // app-only user
const C = "c0000000-0000-4000-8000-00000000000c" // web user, erase-policy branch
const D = "d0000000-0000-4000-8000-00000000000d" // bystander
const EMAIL = {
  A: "hanna.webkundin@example.com",
  B: "ben.appnutzer@example.com",
  C: "clara.loeschtest@example.com",
  D: "dora.bleibt@example.com",
}
const NAME = { A: "Hanna Webkundin", B: "Ben Appnutzer", C: "Clara Loeschtest", D: "Dora Bleibt" }
const REQ = {
  A: "a1000000-0000-4000-8000-000000000001",
  B: "b1000000-0000-4000-8000-000000000001",
  C: "c1000000-0000-4000-8000-000000000001",
  G: "e1000000-0000-4000-8000-000000000001",
}
const id = (prefix: string, n: number) =>
  `${prefix}${String(n).padStart(6, "0")}-0000-4000-8000-000000000000`
const LA = id("1a", 1),
  LA2 = id("1a", 2),
  SA = id("2a", 1),
  TA = id("3a", 1),
  TA2 = id("3a", 2)
const CA = id("4a", 1),
  PA = id("5a", 1),
  PIA = id("6a", 1),
  OA = id("7a", 1),
  DA = id("8a", 1)
const PPA = id("ba", 1),
  NVA = id("ca", 1),
  UPA = id("da", 1),
  SUB_A = id("ea", 1),
  PDA = id("9a", 1),
  ATA = id("aa", 1),
  SUB_B = id("1b", 1),
  LB = id("2b", 1)
const TC = id("3c", 1),
  LC = id("2c", 1),
  LD = id("2d", 1),
  SD = id("3d", 1),
  TD = id("4d", 1)
const DD = id("5d", 1),
  CD = id("6d", 1),
  OD = id("7d", 1),
  AUD = id("8d", 1),
  PSD = id("9d", 1)
const hex = (c: string) => c.repeat(64)
const offer = JSON.stringify(
  createTrialOfferSnapshot("month", {
    monthPriceId: "price_month",
    yearPriceId: "price_year",
    annualCouponId: "coupon",
  }),
)

function docker(args: string[], input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["--context", "colima-chaarlie", ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    })
    let output = ""
    let error = ""
    child.stdout.on("data", (chunk) => (output += chunk.toString()))
    child.stderr.on("data", (chunk) => (error += chunk.toString()))
    child.on("error", reject)
    child.on("close", (code) =>
      code === 0 ? resolve(output.trim()) : reject(new Error(error || `docker exited ${code}`)),
    )
    child.stdin.end(input)
  })
}

const SEED = `
SET session_replication_role = replica;
UPDATE public.profiles SET full_name = email_name.full_name, stripe_customer_id = 'cus_' || upper(substr(email_name.full_name, 1, 4))
  FROM (VALUES ('${A}'::uuid, '${NAME.A}'), ('${B}'::uuid, '${NAME.B}'), ('${C}'::uuid, '${NAME.C}'), ('${D}'::uuid, '${NAME.D}')) email_name(id, full_name)
  WHERE profiles.id = email_name.id;

-- A: web user. Leads (linked + unlinked same email), session, events, profile, trials, billing.
INSERT INTO public.leads(id, user_id, name, email, quiz_answers, quiz_kind, ai_insight) VALUES
  ('${LA}', '${A}', '${NAME.A}', '${EMAIL.A}', '{"structure":"wavy","concerns_other_text":"Hanna schreibt frei"}', 'personal_plan', 'Liebe Hanna'),
  ('${LA2}', NULL, 'Hanna W', ' Hanna.Webkundin@Example.com ', '{}', 'legacy', NULL),
  ('${LD}', '${D}', '${NAME.D}', '${EMAIL.D}', '{"structure":"curly"}', 'legacy', NULL);
INSERT INTO public.customerio_profile_sync_outbox(lead_id) VALUES ('${LA}');
INSERT INTO public.funnel_sessions(id, visitor_id, package_key, channel, quiz_variant, lead_id, user_id, entry_url, referrer, first_touch) VALUES
  ('${SA}', gen_random_uuid(), 'default_organic', 'organic', 'default', '${LA}', '${A}', 'https://chaarlie.de/?email=${EMAIL.A}', 'https://hanna-blog.example', '{"ref":"hanna-blog"}'),
  ('${SD}', gen_random_uuid(), 'default_organic', 'organic', 'default', '${LD}', '${D}', 'https://chaarlie.de/', NULL, '{}');
INSERT INTO public.funnel_events(event_id, funnel_session_id, package_key, event_name, lead_id, properties) VALUES
  ('evA', '${SA}', 'default_organic', 'quiz_completed', '${LA}', '{"email":"${EMAIL.A}"}'),
  ('evD', '${SD}', 'default_organic', 'quiz_completed', '${LD}', '{}');
INSERT INTO public.hair_profiles(user_id, hair_texture, thickness, density, hair_length, cuticle_condition, protein_moisture_balance,
    scalp_type, scalp_condition, chemical_treatment, goals, concerns, additional_notes, products_used, created_at) VALUES
  ('${A}', 'wavy', 'fine', 'medium', 'long', 'rough', 'stretches_breaks', 'oily', 'dandruff', '{colored,natural}', '{shine}', '{frizz}',
    'Hanna mag Kokos', 'Hannas Shampoo', '2026-05-14T10:00:00Z'),
  ('${B}', 'curly', 'coarse', NULL, NULL, NULL, NULL, 'dry', NULL, NULL, NULL, '{dryness}', NULL, NULL, '2026-08-02T10:00:00Z'),
  ('${D}', 'straight', 'normal', NULL, NULL, NULL, NULL, 'balanced', NULL, NULL, NULL, NULL, 'Dora notiert', NULL, now());
INSERT INTO public.trial_enrollments(id, user_id, accepted_offer, provider, provider_agreement_id, admission_status,
    authorization_succeeded_at, original_trial_end_at) VALUES
  ('${TA}', '${A}', '${offer}', 'paypal', 'I-HANNA1', 'active', '2026-09-01T10:00:00Z', '2026-09-08T10:00:00Z'),
  ('${TA2}', '${A}', '${offer}', 'stripe', NULL, 'reserved', NULL, NULL),
  ('${TC}', '${C}', '${offer}', 'stripe', NULL, 'reserved', NULL, NULL),
  ('${TD}', '${D}', '${offer}', 'paypal', 'I-DORA1', 'active', '2026-09-01T10:00:00Z', '2026-09-08T10:00:00Z');
INSERT INTO private.trial_analytics_contexts(enrollment_id, acquisition, marketing_consent, meta_context) VALUES
  ('${TA}', '{"funnel_session_id":"${SA}"}', true, '{"fbp":"fb.1.1700000000.4242","client_user_agent":"HannaPhone UA"}'),
  ('${TD}', '{}', true, '{"fbp":"fb.1.1700000000.7777"}');
INSERT INTO public.trial_checkout_attempts(scope_kind, scope_id, client_attempt_id, enrollment_id, accepted_offer, provider,
    stripe_account_id, stripe_livemode, stripe_params, expires_at) VALUES
  ('user', '${A}', gen_random_uuid(), '${TA2}', '${offer}', 'stripe', 'acct_1', false,
    '{"customer_email":"${EMAIL.A}","metadata":{"user_id":"${A}","trial_cohort":"trial_v1"},"subscription_data":{"metadata":{"lead_id":"${LA}"}}}', now() + interval '1 hour');
INSERT INTO public.paypal_checkout_intents(id, token, interval, source, lead_id, email, user_id, provider_subscription_id, status, expires_at, metadata) VALUES
  ('${PIA}', 'tokA', 'month', 'pricing_page', '${LA}', '${EMAIL.A}', '${A}', 'I-HANNA1', 'activated', now() + interval '1 day',
    '{"payer_email":"${EMAIL.A}","funnel_package_key":"default_organic"}'),
  (gen_random_uuid(), 'tokA2', 'year', 'pricing_page', NULL, 'HANNA.WEBKUNDIN@example.com', NULL, NULL, 'expired', now(), '{}');
INSERT INTO private.paypal_trial_checkout_attempts(id, scope_kind, scope_id, client_attempt_id, enrollment_id, intent_id, accepted_offer) VALUES
  ('${ATA}', 'user', '${A}', gen_random_uuid(), '${TA}', '${PIA}', '${offer}');
INSERT INTO private.trial_cancellation_declarations(id, enrollment_id, user_id, request_id, effective_end_at) VALUES
  ('${DA}', '${TA}', '${A}', gen_random_uuid(), '2026-09-08T10:00:00Z'),
  ('${DD}', '${TD}', '${D}', gen_random_uuid(), '2026-09-08T10:00:00Z');
INSERT INTO private.trial_cancellation_receipts(declaration_id, user_id) VALUES ('${DA}', '${A}'), ('${DD}', '${D}');
INSERT INTO private.trial_cancellation_provider_operations(declaration_id) VALUES ('${DA}');
INSERT INTO private.trial_required_notices(enrollment_id, user_id, event_key, kind, snapshot) VALUES
  ('${TA}', '${A}', 'contract:${TA}', 'contract_confirmation', '{"contractId":"${TA}"}'),
  ('${TA}', '${A}', 'cancel:${DA}', 'cancellation_receipt', '{"contractId":"${TA}"}');
INSERT INTO private.trial_payment_events(enrollment_id, provider, source_event_id, source_object_id, outcome, occurred_at,
    amount_minor, currency, period_start_at, period_end_at, result, phase) VALUES
  ('${TA}', 'paypal', 'WH-A1', 'S-A1', 'succeeded', '2026-09-08T10:00:00Z', 499, 'EUR', '2026-09-08T10:00:00Z', '2026-10-08T10:00:00Z', 'applied', 'first_paid');
INSERT INTO public.trial_identity_claims(kind, key_version, namespace, claim_digest, enrollment_id) VALUES
  ('verified_email', 1, 'chaarlie', '${hex("a")}', '${TA}'),
  ('verified_email', 1, 'chaarlie', '${hex("c")}', '${TC}'),
  ('verified_email', 1, 'chaarlie', '${hex("d")}', '${TD}');
INSERT INTO private.trial_identity_sources(kind, source_id) VALUES ('enrollment', '${TA}'), ('enrollment', '${TC}'), ('enrollment', '${TD}');
INSERT INTO private.trial_identity_source_claims(source_kind, source_id, kind, key_version, namespace, claim_digest) VALUES
  ('enrollment', '${TA}', 'verified_email', 1, 'chaarlie', '${hex("a")}'),
  ('enrollment', '${TC}', 'verified_email', 1, 'chaarlie', '${hex("c")}'),
  ('enrollment', '${TD}', 'verified_email', 1, 'chaarlie', '${hex("d")}');
INSERT INTO public.personal_plan_one_time_checkout_consents(id, lead_id, funnel_session_id, user_id, product_kind, offer_variant, copy_version,
    consent_text, consent_text_sha256, accepted_at) VALUES
  ('${CA}', '${LA}', '${SA}', '${A}', 'personal_plan_once', 'v1', 'v1', 'Ich stimme zu', '${hex("1")}', now()),
  ('${CD}', '${LD}', '${SD}', '${D}', 'personal_plan_once', 'v1', 'v1', 'Ich stimme zu', '${hex("2")}', now());
INSERT INTO public.billing_one_time_purchases(id, user_id, provider, product_kind, provider_transaction_id, amount_minor, currency, status, paid_at, consent_id, metadata) VALUES
  ('${PA}', '${A}', 'paypal', 'personal_plan_once', 'CAP-A1', 2999, 'eur', 'paid', now(), '${CA}', '{"payer_email":"${EMAIL.A}","order":"O-A1"}'),
  (gen_random_uuid(), '${D}', 'paypal', 'personal_plan_once', 'CAP-D1', 2999, 'eur', 'paid', now(), '${CD}', '{}');
INSERT INTO public.paypal_order_intents(id, token, lead_id, funnel_session_id, consent_id, email, checkout_attempt_id, product_kind, expires_at, user_id,
    status, provider_order_id, provider_capture_id) VALUES
  ('${OA}', 'otokA', '${LA}', '${SA}', '${CA}', '${EMAIL.A}', gen_random_uuid(), 'personal_plan_once', now(), '${A}', 'captured', 'O-A1', 'CAP-A1'),
  ('${OD}', 'otokD', '${LD}', '${SD}', '${CD}', '${EMAIL.D}', gen_random_uuid(), 'personal_plan_once', now(), '${D}', 'expired', NULL, NULL);
INSERT INTO public.paypal_expired_order_reset_audit(id, consent_id, intent_id, prior_provider_order_id, provider_state, provider_verified_at, requested_by) VALUES
  ('${AUD}', '${CD}', '${OD}', 'O-D0', 'voided', now(), 'operator');
INSERT INTO public.billing_subscriptions(user_id, provider, provider_subscription_id, provider_status, entitlement_status, trial_enrollment_id, provider_subscriber_email) VALUES
  ('${A}', 'paypal', 'I-HANNA1', 'ACTIVE', 'active', '${TA}', '${EMAIL.A}'),
  ('${D}', 'paypal', 'I-DORA1', 'ACTIVE', 'active', '${TD}', '${EMAIL.D}');
INSERT INTO private.public_contract_declarations(id, request_id, payload) VALUES
  ('${PDA}', gen_random_uuid(), '{"kind":"extraordinary_cancellation","name":"${NAME.A}","email":"${EMAIL.A}","contract":"Chaarlie Abo von Hanna","requestedEnd":"2026-10-01","reason":"Hanna zieht um"}');
INSERT INTO private.public_contract_declaration_receipts(declaration_id, receipt_payload) VALUES
  ('${PDA}', '{"declarationId":"${PDA}","declaration":{"kind":"extraordinary_cancellation","name":"${NAME.A}","email":"${EMAIL.A}","contract":"Chaarlie Abo von Hanna","requestedEnd":"2026-10-01","reason":"Hanna zieht um"}}');
INSERT INTO private.public_contract_declaration_reviews(declaration_id) VALUES ('${PDA}');
INSERT INTO private.public_contract_declaration_matches(declaration_id, user_id, enrollment_id, submitted_at, verification_reference) VALUES
  ('${PDA}', '${A}', '${TA}', now(), 'ver-1');
INSERT INTO public.payment_support_cases(report_code, user_id, checkout_attempt_id, reported_checkout_context, reported_feedback_kind,
    reported_provider, reported_method, reported_payment_family, reported_payment_truth, reported_retryable, dedupe_key) VALUES
  ('PAY-ABCDEFGH', '${A}', 'attempt_hanna_1', 'result_membership', 'card_declined', 'stripe', 'card', 'decline', 'failed', true, 'dk-a');
INSERT INTO public.payment_support_cases(report_code, lead_id, checkout_attempt_id, reported_checkout_context, reported_feedback_kind,
    reported_provider, reported_method, reported_payment_family, reported_payment_truth, reported_retryable, dedupe_key) VALUES
  ('PAY-BCDEFGHJ', '${LA}', 'attempt_hanna_2', 'result_one_time', 'card_declined', 'stripe', 'card', 'decline', 'failed', true, 'dk-a2');
UPDATE public.payment_support_cases SET resolution_note = 'Hanna hat angerufen' WHERE report_code = 'PAY-ABCDEFGH';
INSERT INTO public.beta_feedback(user_id, message, user_agent) VALUES ('${A}', 'Hanna findet es super', 'HannaPhone UA');
INSERT INTO public.manual_access_grants(email, reason) VALUES ('${EMAIL.A}', 'tester');
INSERT INTO public.discovery_enrollments(display_name, normalized_email, claimed_user_id, claimed_at) VALUES ('${NAME.A}', '${EMAIL.A}', '${A}', now());
INSERT INTO public.partner_access_invitations(display_name, normalized_email, claimed_user_id, claimed_at) VALUES ('${NAME.A}', '${EMAIL.A}', '${A}', now());
INSERT INTO public.mobile_auth_attempts(email) VALUES ('${EMAIL.A}'), ('${EMAIL.D}');
INSERT INTO public.waitlist_signups(campaign, normalized_email, first_name, survey_token_hash) VALUES ('scan', '${EMAIL.A}', 'Hanna', 'h1');
INSERT INTO public.rate_limits(key, window_id, count, expires_at) VALUES ('chat:${A}', 'w', 1, now() + interval '1 hour');
INSERT INTO auth.audit_log_entries(id, payload) VALUES (gen_random_uuid(), '{"actor_id":"${A}","actor_username":"${EMAIL.A}"}');
INSERT INTO public.conversations(id, user_id, title) VALUES (gen_random_uuid(), '${A}', 'Hannas Frage');
INSERT INTO public.personal_plans(id, user_id) VALUES ('${PPA}', '${A}');
INSERT INTO public.personal_plan_need_versions(id, user_id, personal_plan_id, kind, schema_version, computation_version, input_hash,
    input_snapshot, output_snapshot, stage1_source_kind, stage1_source_lead_id) VALUES
  ('${NVA}', '${A}', '${PPA}', 'initial', 1, 'v1', '${hex("b")}', '{}', '{}', 'legacy_quiz_lead', '${LA}');
UPDATE public.personal_plans SET current_initial_need_version_id = '${NVA}' WHERE id = '${PPA}';
INSERT INTO public.user_products(id, user_id, category, brand_text, product_name_text) VALUES ('${UPA}', '${A}', 'shampoo', 'Hannas Marke', 'Hannas Produkt');
INSERT INTO public.product_submissions(id, user_id, source, intake_method, category, user_product_id, frequency_range, brand_text, product_name_text) VALUES
  ('${SUB_A}', '${A}', 'personal_plan', 'manual', 'shampoo', '${UPA}', 'weekly_1x', 'Balea', 'Hannas Wunschprodukt');
INSERT INTO storage.buckets(id, name) VALUES ('product-intake', 'product-intake') ON CONFLICT DO NOTHING;

-- B: app-only user (iOS registration, scanner, submission, App Store).
INSERT INTO public.mobile_registration_enrollments(user_id, email) VALUES ('${B}', '${EMAIL.B}');
INSERT INTO public.leads(id, user_id, name, email, quiz_kind) VALUES ('${LB}', '${B}', '${NAME.B}', '${EMAIL.B}', 'legacy');
INSERT INTO public.scanner_context_sources(user_id) VALUES ('${B}') ON CONFLICT DO NOTHING;
INSERT INTO public.scan_resolve_events(user_id, identifier_type, raw_value, outcome) VALUES
  ('${B}', 'ean', '4005900000019', 'miss'), ('${D}', 'ean', '4005900000026', 'hit');
INSERT INTO public.product_submissions(id, user_id, source, intake_method, category, scanned_identifier_type, scanned_identifier_value,
    front_image_path, review_notes, intake_history, brand_text, product_name_text) VALUES
  ('${SUB_B}', '${B}', 'scan', 'photo', 'shampoo', 'ean', '4005900000019', '${B}/${SUB_B}/front.jpg', 'Ben hat geschrieben',
    '[{"note":"Ben Appnutzer"}]', 'Balea', 'Pflegeshampoo'),
  ('${PSD}', '${D}', 'scan', 'photo', 'shampoo', 'ean', '4005900000026', NULL, NULL, '[]', 'Dove', 'Repair');
INSERT INTO public.user_product_usage(user_id, category, product_name, front_image_path, product_submission_id, frequency_range, match_status) VALUES
  ('${B}', 'shampoo', 'Bens Shampoo', '${B}/usage/front.jpg', '${SUB_B}', 'weekly_2x', 'pending_review');
INSERT INTO public.mobile_scan_history(user_id, barcode_ean, submission_id) VALUES ('${B}', '4005900000019', '${SUB_B}');
INSERT INTO public.app_store_transactions(transaction_id, original_transaction_id, user_id, app_account_token, product_id, environment,
    purchase_date, expires_date, signed_date) VALUES
  ('t-B1', 'o-B1', '${B}', '${B}', 'de.chaarlie.scanner.monthly', 'Sandbox', now(), now() + interval '1 month', now());
INSERT INTO public.app_store_subscription_status(original_transaction_id, user_id, environment, auto_renew_status, in_billing_retry, signed_date) VALUES
  ('o-B1', '${B}', 'Sandbox', true, false, now());
INSERT INTO private.mobile_push_installations(installation_id, user_id, apns_token, environment, topic, lease_expires_at) VALUES
  (gen_random_uuid(), '${B}', 'apns-token-ben-0001', 'sandbox', 'de.chaarlie.app', now() + interval '1 day');
INSERT INTO storage.objects(bucket_id, name) VALUES
  ('product-intake', '${B}/${SUB_B}/front.jpg'), ('product-intake', '${B}/usage/front.jpg'), ('product-intake', 'tmp/${B}/draft.jpg');

-- C: erase-policy branch. D: bystander product submission is above.
INSERT INTO public.leads(id, user_id, name, email, quiz_kind) VALUES ('${LC}', '${C}', '${NAME.C}', '${EMAIL.C}', 'legacy');
SET session_replication_role = origin;
`

test(
  "account deletion: full-schema erasure, anonymized retention, guards, replay, purge",
  { skip: !enabled, timeout: 600_000 },
  async (t) => {
    const container = `chaarlie-account-deletion-${crypto.randomUUID()}`
    await docker([
      "run",
      "--rm",
      "--detach",
      "--name",
      container,
      "-e",
      "POSTGRES_PASSWORD=postgres",
      IMAGE,
    ])
    t.after(() => docker(["rm", "--force", container]))
    const psql = (user: string, input: string, single = false) =>
      docker(
        [
          "exec",
          "-i",
          "-e",
          "PGPASSWORD=postgres",
          container,
          "psql",
          "-h",
          "127.0.0.1",
          "-X",
          "-qAt",
          "-F",
          "|",
          ...(single ? ["-1"] : []),
          "-v",
          "ON_ERROR_STOP=1",
          "-U",
          user,
          "-d",
          "postgres",
        ],
        input,
      )
    for (let attempt = 0; ; attempt++) {
      try {
        await psql("supabase_admin", "SELECT 1")
        break
      } catch (error) {
        if (attempt === 150) throw error
        await setTimeout(200)
      }
    }
    // Supabase-managed pieces the repository migrations reference but do not create.
    await psql(
      "supabase_admin",
      `
      CREATE SCHEMA IF NOT EXISTS storage;
      CREATE TABLE storage.buckets(id text PRIMARY KEY, name text NOT NULL, owner uuid, public boolean DEFAULT false,
        file_size_limit bigint, allowed_mime_types text[], created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
      CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets(id),
        name text, owner uuid, metadata jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql AS
        $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
      GRANT ALL ON SCHEMA storage TO postgres; GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
      ALTER TABLE storage.objects OWNER TO postgres; ALTER TABLE storage.buckets OWNER TO postgres;
      CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
        $$ SELECT coalesce(nullif(current_setting('request.jwt.claim', true), ''), nullif(current_setting('request.jwt.claims', true), ''))::jsonb $$;
    `,
    )
    for (const { file, sql } of localReplayMigrations(process.cwd()) as {
      file: string
      sql: string
    }[]) {
      await psql("postgres", sql, true).catch((error: Error) => {
        throw new Error(`${file}: ${error.message}`)
      })
    }
    const admin = (input: string) => psql("supabase_admin", input)
    const service = (input: string) => psql("postgres", `SET ROLE service_role; ${input}`)
    const rejects = async (input: string, pattern: RegExp) =>
      assert.rejects(admin(input), pattern, `expected rejection: ${input.slice(0, 160)}`)

    await admin(`INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES
      ('${A}', '${EMAIL.A}', '{"full_name":"${NAME.A}"}'), ('${B}', '${EMAIL.B}', '{"full_name":"${NAME.B}"}'),
      ('${C}', '${EMAIL.C}', '{"full_name":"${NAME.C}"}'), ('${D}', '${EMAIL.D}', '{"full_name":"${NAME.D}"}');`)
    await admin(SEED)

    // Full-schema text scan helper (every table in every schema).
    await admin(`CREATE FUNCTION public.test_scan(p_needle text) RETURNS TABLE(tbl text, n bigint) LANGUAGE plpgsql AS $$
      DECLARE r record; c bigint;
      BEGIN
        FOR r IN SELECT ns.nspname, cl.relname FROM pg_class cl JOIN pg_namespace ns ON ns.oid = cl.relnamespace
          WHERE cl.relkind IN ('r', 'p') AND ns.nspname NOT IN ('pg_catalog', 'information_schema')
            AND ns.nspname NOT LIKE 'pg_toast%' AND ns.nspname NOT LIKE 'pg_temp%'
            AND NOT (ns.nspname = 'public' AND cl.relname = 'test_fingerprints') LOOP
          EXECUTE format('SELECT count(*) FROM %I.%I t WHERE strpos(lower(t::text), %L) > 0', r.nspname, r.relname, lower(p_needle)) INTO c;
          IF c > 0 THEN tbl := r.nspname || '.' || r.relname; n := c; RETURN NEXT; END IF;
        END LOOP;
      END $$;
      CREATE FUNCTION public.test_fingerprint(p_needle text) RETURNS text LANGUAGE plpgsql AS $$
      DECLARE r record; parts text := '';  h text;
      BEGIN
        FOR r IN SELECT ns.nspname, cl.relname FROM pg_class cl JOIN pg_namespace ns ON ns.oid = cl.relnamespace
          WHERE cl.relkind IN ('r', 'p') AND ns.nspname IN ('public', 'private', 'auth', 'storage') ORDER BY 1, 2 LOOP
          EXECUTE format('SELECT md5(coalesce(string_agg(t::text, %L ORDER BY t::text), %L)) FROM %I.%I t WHERE strpos(lower(t::text), %L) > 0',
            chr(10), '', r.nspname, r.relname, lower(p_needle)) INTO h;
          parts := parts || r.nspname || '.' || r.relname || '=' || h || chr(10);
        END LOOP;
        RETURN md5(parts);
      END $$;`)
    const scan = async (needle: string) =>
      (await admin(`SELECT tbl || ':' || n FROM public.test_scan('${needle}') ORDER BY 1`))
        .split("\n")
        .filter(Boolean)
    const needles = (who: "A" | "B" | "C") =>
      ({
        A: [A, EMAIL.A, NAME.A, "Webkundin", "fb.1.1700000000.4242", "HannaPhone"],
        B: [B, EMAIL.B, NAME.B, "Appnutzer", "apns-token-ben"],
        C: [C, EMAIL.C, NAME.C, "Loeschtest"],
      })[who]
    const bystanderBefore = await admin(
      `SELECT public.test_fingerprint('${D}') || public.test_fingerprint('${EMAIL.D}')`,
    )
    for (const needle of needles("A"))
      assert.ok((await scan(needle)).length > 0, `seed contains ${needle}`)

    // ---------- FK-classification guard (inventory constant ↔ migrated schema). ----------
    const edges = (
      await admin(`WITH RECURSIVE fk AS (
        SELECT format('%s.%s', cn.nspname, cc.relname) AS child, format('%s.%s', pn.nspname, pc.relname) AS parent,
          (SELECT string_agg(a.attname::text, ',' ORDER BY k.o) FROM unnest(c.conkey) WITH ORDINALITY k(n, o)
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.n) AS cols,
          CASE c.confdeltype WHEN 'c' THEN 'cascade' WHEN 'n' THEN 'set_null' WHEN 'r' THEN 'restrict' WHEN 'a' THEN 'no_action' ELSE 'set_default' END AS action
        FROM pg_constraint c JOIN pg_class cc ON cc.oid = c.conrelid JOIN pg_namespace cn ON cn.oid = cc.relnamespace
        JOIN pg_class pc ON pc.oid = c.confrelid JOIN pg_namespace pn ON pn.oid = pc.relnamespace WHERE c.contype = 'f'),
      reach(t) AS (SELECT unnest(ARRAY[${ACCOUNT_DELETION_COVERED_PARENTS.map((p) => `'${p}'`).join(",")}]) COLLATE "C"
        UNION SELECT fk.child FROM fk JOIN reach ON fk.parent = reach.t)
      SELECT DISTINCT format('%s(%s) -> %s [%s]', child, cols, parent, action) FROM fk WHERE parent IN (SELECT t FROM reach) ORDER BY 1`)
    ).split("\n")
    assert.deepEqual(
      edges.filter((edge) => !ACCOUNT_DELETION_FK_EDGES.includes(edge)),
      [],
      "every FK into the covered parents must be classified in src/lib/account-deletion/inventory.ts",
    )
    assert.deepEqual(
      ACCOUNT_DELETION_FK_EDGES.filter((edge) => !edges.includes(edge)),
      [],
      "stale inventory edges",
    )
    for (const edge of edges) {
      const child = edge.split("(")[0]
      assert.ok(ACCOUNT_DELETION_TABLE_CLASSES[child], `unclassified table ${child}`)
    }
    const tagged = (
      await admin(`SELECT DISTINCT table_schema || '.' || table_name FROM information_schema.columns
      WHERE column_name = 'anonymous_subject_id' AND table_schema IN ('public', 'private') AND table_name <> 'anonymous_quiz_answer_archive' ORDER BY 1`)
    ).split("\n")
    assert.deepEqual(
      tagged,
      Object.entries(ACCOUNT_DELETION_TABLE_CLASSES)
        .filter(([, value]) => value.startsWith("anonymize") || value === "keep_anonymous")
        .map(([table]) => table)
        .sort(),
    )
    const doc = readFileSync("plans/ios-paywall/deletion-inventory.md", "utf8")
    for (const table of Object.keys(ACCOUNT_DELETION_TABLE_CLASSES))
      assert.ok(doc.includes(table.split(".")[1]), `inventory doc must list ${table}`)
    assert.equal(
      await admin(
        `SELECT private.account_deletion_retention('billing')::text || ',' || private.account_deletion_retention('cancellation_evidence')::text`,
      ),
      `${ACCOUNT_DELETION_RETENTION.billing},${ACCOUNT_DELETION_RETENTION.cancellation_evidence}`,
    )
    assert.equal(await admin(`SELECT private.account_deletion_policy()`), "keep_hashed")

    // ---------- Guards: unchanged without the flag, anonymization-only with it. ----------
    await admin(
      `INSERT INTO private.account_deletion_operations(request_id, user_id, state) VALUES ('${REQ.G}', '${D}', 'web_billing_cancelled')`,
    )
    const tag = `anonymous_subject_id = gen_random_uuid(), anonymized_at = now()`
    const flagged = (body: string, flag = REQ.G) =>
      `BEGIN; SELECT set_config('chaarlie.account_deletion', '${flag}', true); ${body}; ROLLBACK;`
    await rejects(
      `BEGIN; UPDATE private.trial_cancellation_declarations SET user_id = NULL, ${tag} WHERE id = '${DD}'; ROLLBACK;`,
      /immutable/,
    )
    await rejects(
      flagged(
        `UPDATE private.trial_cancellation_declarations SET user_id = NULL, ${tag}, effective_end_at = effective_end_at + interval '1 day' WHERE id = '${DD}'`,
      ),
      /immutable/,
    )
    await rejects(
      flagged(
        `UPDATE private.trial_cancellation_declarations SET user_id = NULL WHERE id = '${DD}'`,
      ),
      /immutable/,
    )
    await rejects(
      flagged(
        `UPDATE private.trial_cancellation_declarations SET user_id = NULL, ${tag} WHERE id = '${DD}'`,
        REQ.A,
      ),
      /immutable/,
    )
    await admin(
      flagged(
        `UPDATE private.trial_cancellation_declarations SET user_id = NULL, ${tag} WHERE id = '${DD}'`,
      ),
    )
    await rejects(
      `BEGIN; UPDATE public.billing_one_time_purchases SET user_id = NULL, ${tag} WHERE consent_id = '${CD}'; ROLLBACK;`,
      /immutable/,
    )
    await rejects(
      flagged(
        `UPDATE public.billing_one_time_purchases SET user_id = NULL, ${tag}, provider_transaction_id = 'X' WHERE consent_id = '${CD}'`,
      ),
      /immutable/,
    )
    await admin(
      flagged(
        `UPDATE public.billing_one_time_purchases SET user_id = NULL, ${tag}, metadata = '{}' WHERE consent_id = '${CD}'`,
      ),
    )
    await rejects(
      `BEGIN; UPDATE public.personal_plan_one_time_checkout_consents SET user_id = NULL, ${tag} WHERE id = '${CD}'; ROLLBACK;`,
      /immutable/,
    )
    await rejects(
      flagged(
        `UPDATE public.personal_plan_one_time_checkout_consents SET user_id = NULL, ${tag}, consent_text = 'X' WHERE id = '${CD}'`,
      ),
      /immutable/,
    )
    await admin(
      flagged(
        `UPDATE public.personal_plan_one_time_checkout_consents SET user_id = NULL, ${tag} WHERE id = '${CD}'`,
      ),
    )
    await rejects(
      `BEGIN; UPDATE private.trial_analytics_contexts SET meta_context = '{}', ${tag} WHERE enrollment_id = '${TD}'; ROLLBACK;`,
      /immutable/,
    )
    await rejects(
      flagged(
        `UPDATE private.trial_analytics_contexts SET acquisition = '{"x":1}', ${tag} WHERE enrollment_id = '${TD}'`,
      ),
      /immutable/,
    )
    await admin(
      flagged(
        `UPDATE private.trial_analytics_contexts SET meta_context = '{}', ${tag} WHERE enrollment_id = '${TD}'`,
      ),
    )
    await rejects(
      `BEGIN; UPDATE public.trial_identity_claims SET ${tag} WHERE enrollment_id = '${TD}'; ROLLBACK;`,
      /not authorized/,
    )
    await admin(
      flagged(`UPDATE public.trial_identity_claims SET ${tag} WHERE enrollment_id = '${TD}'`),
    )
    // Purge exception: only past-retention rows, only inside the purge function's flag.
    await rejects(
      `BEGIN; SELECT set_config('chaarlie.account_purge', 'on', true); DELETE FROM public.paypal_expired_order_reset_audit WHERE id = '${AUD}'; ROLLBACK;`,
      /append-only/,
    )
    await rejects(
      `BEGIN; SET LOCAL session_replication_role = replica; UPDATE public.paypal_expired_order_reset_audit SET purge_after = now() - interval '1 second' WHERE id = '${AUD}';
      SET LOCAL session_replication_role = origin; DELETE FROM public.paypal_expired_order_reset_audit WHERE id = '${AUD}'; ROLLBACK;`,
      /append-only/,
    )
    await admin(`BEGIN; SET LOCAL session_replication_role = replica; UPDATE public.paypal_expired_order_reset_audit SET purge_after = now() - interval '1 second' WHERE id = '${AUD}';
      SET LOCAL session_replication_role = origin; SELECT set_config('chaarlie.account_purge', 'on', true);
      DELETE FROM public.paypal_expired_order_reset_audit WHERE id = '${AUD}'; ROLLBACK;`)
    await admin(`DELETE FROM private.account_deletion_operations WHERE request_id = '${REQ.G}'`)

    // Service-only surface (catalog check: a denied EXECUTE under SET ROLE crashes this image).
    assert.equal(
      await admin(`SELECT bool_or(has_function_privilege(r, f, 'EXECUTE')) FROM unnest(ARRAY['anon', 'authenticated']) r,
        unnest(ARRAY['public.account_deletion_begin(uuid,uuid)', 'public.account_deletion_mark_billing_cancelled(uuid)',
          'public.delete_account_data(uuid,uuid)', 'public.account_deletion_record_external_failure(uuid,text)',
          'public.account_deletion_complete(uuid)', 'public.account_deletion_status(uuid)',
          'public.account_deletion_pending_cleanup(integer,uuid)', 'public.purge_anonymized_records()',
          'private.delete_account(uuid,uuid)', 'private.purge_anonymized_records()']) f`),
      "f",
    )
    assert.equal(
      await admin(`SELECT bool_or(has_table_privilege(r, t, p)) FROM unnest(ARRAY['anon', 'authenticated']) r,
        unnest(ARRAY['private.account_deletion_operations', 'private.anonymous_quiz_answer_archive']) t,
        unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p`),
      "f",
    )
    assert.equal(
      await admin(`SELECT string_agg(relname || ':' || relrowsecurity, ',' ORDER BY relname) FROM pg_class
        WHERE relname IN ('account_deletion_operations', 'anonymous_quiz_answer_archive')`),
      "account_deletion_operations:true,anonymous_quiz_answer_archive:true",
    )

    // ---------- Web user A (keep_hashed). ----------
    await assert.rejects(
      service(`SELECT public.delete_account_data('${A}', '${REQ.A}')`),
      /operation_not_found/,
    )
    assert.equal(
      await service(`SELECT public.account_deletion_begin('${A}', '${REQ.A}')->>'state'`),
      "requested",
    )
    await assert.rejects(
      service(`SELECT public.account_deletion_begin('${D}', '${REQ.A}')`),
      /request_id_conflict/,
    )
    await assert.rejects(
      service(`SELECT public.delete_account_data('${A}', '${REQ.A}')`),
      /web_billing_not_cancelled/,
    )
    assert.equal(
      await service(`SELECT public.account_deletion_mark_billing_cancelled('${REQ.A}')->>'state'`),
      "web_billing_cancelled",
    )
    await assert.rejects(
      service(`SELECT public.delete_account_data('${D}', '${REQ.A}')`),
      /request_id_conflict/,
    )
    const resultA = JSON.parse(
      await service(`SELECT public.delete_account_data('${A}', '${REQ.A}')`),
    )
    assert.equal(resultA.state, "data_deleted")
    assert.deepEqual(resultA.storagePaths, [])
    assert.equal(await service(`SELECT public.account_deletion_status('${REQ.A}')`), "data_deleted")

    const subjectsAfter = async () =>
      Number(
        await admin(
          `SELECT count(DISTINCT s) FROM (${tagged.map((table) => `SELECT anonymous_subject_id s FROM ${table}`).join(" UNION ALL ")}) x WHERE s IS NOT NULL`,
        ),
      )
    assert.equal(await subjectsAfter(), 1, "one anonymous subject for all of A's retained rows")
    const subjectA = await admin(`SELECT anonymous_subject_id FROM public.leads WHERE id = '${LA}'`)
    assert.notEqual(subjectA, A)
    const retention = async (table: string, where: string) =>
      admin(
        `SELECT anonymous_subject_id || ',' || round(extract(epoch FROM purge_after - anonymized_at) / 86400 / 365.25) FROM ${table} WHERE ${where}`,
      )
    for (const [table, where, years] of [
      ["public.leads", `id IN ('${LA}', '${LA2}')`, 10],
      ["public.funnel_sessions", `id = '${SA}'`, 10],
      ["public.trial_enrollments", `id IN ('${TA}', '${TA2}')`, 10],
      ["public.billing_one_time_purchases", `id = '${PA}'`, 10],
      ["public.personal_plan_one_time_checkout_consents", `id = '${CA}'`, 10],
      ["public.paypal_order_intents", `id = '${OA}'`, 10],
      ["public.paypal_checkout_intents", `token IN ('tokA', 'tokA2')`, 10],
      ["private.paypal_trial_checkout_attempts", `id = '${ATA}'`, 10],
      ["public.trial_checkout_attempts", `enrollment_id = '${TA2}'`, 10],
      ["private.trial_analytics_contexts", `enrollment_id = '${TA}'`, 10],
      ["private.trial_payment_events", `enrollment_id = '${TA}'`, 10],
      ["private.trial_cancellation_declarations", `id = '${DA}'`, 3],
      ["private.trial_cancellation_receipts", `declaration_id = '${DA}'`, 3],
      ["private.trial_cancellation_provider_operations", `declaration_id = '${DA}'`, 3],
      ["private.trial_required_notices", `enrollment_id = '${TA}'`, 3],
      ["private.public_contract_declarations", `id = '${PDA}'`, 3],
      ["private.public_contract_declaration_receipts", `declaration_id = '${PDA}'`, 3],
      ["private.public_contract_declaration_reviews", `declaration_id = '${PDA}'`, 3],
      ["private.public_contract_declaration_matches", `declaration_id = '${PDA}'`, 3],
      ["public.payment_support_cases", `dedupe_key IN ('dk-a', 'dk-a2')`, 3],
      ["public.trial_identity_claims", `enrollment_id = '${TA}'`, 3],
      ["private.trial_identity_sources", `source_id = '${TA}'`, 3],
    ] as const) {
      const rows = (await retention(table, where)).split("\n")
      assert.ok(rows.length >= 1 && rows[0] !== "", `${table} retained`)
      for (const row of rows)
        assert.equal(row, `${subjectA},${years}`, `${table} subject + retention`)
    }
    assert.equal(
      await admin(
        `SELECT count(*) FROM public.trial_identity_claims WHERE enrollment_id = '${TA}' AND claim_digest = '${hex("a")}'`,
      ),
      "1",
    )
    assert.deepEqual(
      JSON.parse(
        await admin(
          `SELECT jsonb_build_object('params', stripe_params, 'scope', scope_id = '${subjectA}') FROM public.trial_checkout_attempts WHERE enrollment_id = '${TA2}'`,
        ),
      ),
      {
        scope: true,
        params: { metadata: { trial_cohort: "trial_v1" }, subscription_data: { metadata: {} } },
      },
    )
    assert.equal(
      await admin(
        `SELECT concat_ws(',', user_id IS NULL, user_product_id IS NULL, anonymous_subject_id = '${subjectA}', product_name_text) FROM public.product_submissions WHERE id = '${SUB_A}'`,
      ),
      "t,t,t,Hannas Wunschprodukt",
    )
    assert.equal(await admin(`SELECT count(*) FROM public.personal_plans WHERE id = '${PPA}'`), "0")
    // Cascaded tables hold nothing of A; subscription records cascade (Q2).
    for (const table of [
      "public.profiles",
      "public.hair_profiles",
      "public.billing_subscriptions",
      "public.conversations",
      "public.customerio_profile_sync_outbox",
      "public.funnel_events",
    ])
      assert.equal(
        await admin(
          `SELECT count(*) FROM ${table} t WHERE strpos(t::text, '${A}') > 0 OR strpos(lower(t::text), '${EMAIL.A}') > 0`,
        ),
        "0",
        table,
      )
    assert.equal(
      await admin(`SELECT count(*) FROM public.billing_subscriptions`),
      "1",
      "only D's subscription remains",
    )
    // Archive: canonical keys, month, channel.
    const archiveA = JSON.parse(
      await admin(
        `SELECT jsonb_build_object('answers', answers, 'month', answered_month, 'channel', channel) FROM private.anonymous_quiz_answer_archive WHERE anonymous_subject_id = '${subjectA}'`,
      ),
    )
    const expectedA = JSON.parse(
      JSON.stringify(
        currentLegacyAnswers({
          hair_texture: "wavy",
          thickness: "fine",
          density: "medium",
          hair_length: "long",
          cuticle_condition: "rough",
          protein_moisture_balance: "stretches_breaks",
          scalp_type: "oily",
          scalp_condition: "dandruff",
          chemical_treatment: ["colored", "natural"],
          goals: ["shine"],
          concerns: ["frizz"],
        }),
      ),
    )
    assert.deepEqual(archiveA, { answers: expectedA, month: "2026-05-01", channel: "web" })

    // Replay: same request id is a no-op, response loss → status lookup.
    const before = await admin(
      `SELECT md5(string_agg(x, '')) FROM (${tagged.map((table) => `SELECT md5(coalesce(string_agg(t::text, '' ORDER BY t::text), '')) x FROM ${table} t`).join(" UNION ALL ")}) f`,
    )
    assert.equal(
      JSON.parse(await service(`SELECT public.delete_account_data('${A}', '${REQ.A}')`)).state,
      "data_deleted",
    )
    assert.equal(
      JSON.parse(await service(`SELECT public.account_deletion_begin('${A}', '${REQ.A}')`)).state,
      "data_deleted",
    )
    assert.equal(
      await admin(
        `SELECT md5(string_agg(x, '')) FROM (${tagged.map((table) => `SELECT md5(coalesce(string_agg(t::text, '' ORDER BY t::text), '')) x FROM ${table} t`).join(" UNION ALL ")}) f`,
      ),
      before,
    )
    assert.equal(
      JSON.parse(
        await service(
          `SELECT public.account_deletion_record_external_failure('${REQ.A}', 'posthog_unavailable')`,
        ),
      ).externalAttempts,
      1,
    )
    assert.equal(
      JSON.parse(await service(`SELECT public.account_deletion_complete('${REQ.A}')`)).state,
      "external_cleanup_done",
    )
    // A completed request id cannot be claimed by another live account.
    await assert.rejects(
      service(`SELECT public.account_deletion_begin('${D}', '${REQ.A}')`),
      /request_id_conflict/,
    )
    for (const needle of needles("A"))
      assert.deepEqual(await scan(needle), [], `no row anywhere contains ${needle}`)

    // ---------- App-only user B. ----------
    await service(
      `SELECT public.account_deletion_begin('${B}', '${REQ.B}'); SELECT public.account_deletion_mark_billing_cancelled('${REQ.B}')`,
    )
    const resultB = JSON.parse(
      await service(`SELECT public.delete_account_data('${B}', '${REQ.B}')`),
    )
    assert.deepEqual(resultB.storagePaths, [
      `${B}/${SUB_B}/front.jpg`,
      `${B}/usage/front.jpg`,
      `tmp/${B}/draft.jpg`,
    ])
    assert.equal(await subjectsAfter(), 2)
    const subjectB = await admin(`SELECT anonymous_subject_id FROM public.leads WHERE id = '${LB}'`)
    assert.equal(
      await admin(
        `SELECT string_agg(concat_ws(',', user_id IS NULL, anonymous_subject_id = '${subjectB}', purge_after IS NULL, front_image_path IS NULL, review_notes IS NULL, brand_text), ';') FROM public.product_submissions WHERE id = '${SUB_B}'`,
      ),
      "t,t,t,t,t,Balea",
    )
    assert.equal(
      await admin(
        `SELECT count(*) || ',' || bool_and(user_id IS NULL AND anonymous_subject_id = '${subjectB}' AND purge_after IS NULL) FROM public.scan_resolve_events WHERE raw_value = '4005900000019'`,
      ),
      "1,true",
    )
    assert.equal(
      await admin(
        `SELECT channel FROM private.anonymous_quiz_answer_archive WHERE anonymous_subject_id = '${subjectB}'`,
      ),
      "app",
    )
    for (const table of [
      "public.app_store_transactions",
      "public.app_store_subscription_status",
      "public.mobile_scan_history",
      "public.user_product_usage",
      "private.mobile_push_installations",
      "public.mobile_registration_enrollments",
    ])
      assert.equal(await admin(`SELECT count(*) FROM ${table}`), "0", `${table} cascaded`)
    assert.deepEqual(
      JSON.parse(await service(`SELECT public.account_deletion_pending_cleanup(20, '${REQ.B}')`)),
      [
        {
          requestId: REQ.B,
          userId: B,
          email: EMAIL.B,
          storagePaths: resultB.storagePaths,
          externalAttempts: 0,
        },
      ],
    )
    // The service removes the storage objects after the transaction; simulate that here.
    await admin(
      `DELETE FROM storage.objects WHERE name = ANY(ARRAY[${resultB.storagePaths.map((p: string) => `'${p}'`).join(",")}])`,
    )
    await service(`SELECT public.account_deletion_complete('${REQ.B}')`)
    for (const needle of needles("B"))
      assert.deepEqual(await scan(needle), [], `no row anywhere contains ${needle}`)

    // ---------- User C under the erase policy (Q3 switch). ----------
    await admin(
      `CREATE OR REPLACE FUNCTION private.account_deletion_policy() RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT 'erase'::text $$`,
    )
    await service(
      `SELECT public.account_deletion_begin('${C}', '${REQ.C}'); SELECT public.account_deletion_mark_billing_cancelled('${REQ.C}'); SELECT public.delete_account_data('${C}', '${REQ.C}'); SELECT public.account_deletion_complete('${REQ.C}')`,
    )
    assert.equal(
      await admin(
        `SELECT count(*) FROM public.trial_identity_claims WHERE claim_digest = '${hex("c")}'`,
      ),
      "0",
    )
    assert.equal(
      await admin(
        `SELECT count(*) FROM private.trial_identity_source_claims WHERE claim_digest = '${hex("c")}'`,
      ),
      "0",
    )
    assert.equal(
      await admin(`SELECT status FROM private.trial_identity_sources WHERE source_id = '${TC}'`),
      "erased",
    )
    assert.equal(
      await admin(
        `SELECT count(*) FROM public.trial_identity_claims WHERE claim_digest = '${hex("a")}'`,
      ),
      "1",
      "A's hashed claim kept",
    )
    for (const needle of needles("C"))
      assert.deepEqual(await scan(needle), [], `no row anywhere contains ${needle}`)

    // ---------- Bystander untouched. ----------
    assert.equal(
      await admin(
        `SELECT public.test_fingerprint('${D}') || public.test_fingerprint('${EMAIL.D}')`,
      ),
      bystanderBefore,
    )
    assert.equal(await admin(`SELECT count(*) FROM auth.users WHERE id = '${D}'`), "1")

    // ---------- Purge: past-retention rows go, children first; kept anonymous data stays. ----------
    const subjectC = await admin(`SELECT anonymous_subject_id FROM public.leads WHERE id = '${LC}'`)
    await admin(
      `SET session_replication_role = replica; ${tagged.map((table) => `UPDATE ${table} SET purge_after = now() - interval '1 second' WHERE anonymous_subject_id IN ('${subjectA}', '${subjectC}') AND purge_after IS NOT NULL;`).join(" ")}`,
    )
    const purged = JSON.parse(await service(`SELECT public.purge_anonymized_records()`))
    assert.ok(
      purged["public.leads"] >= 3 && purged["private.trial_cancellation_declarations"] === 1,
      JSON.stringify(purged),
    )
    assert.equal(
      await admin(
        `SELECT count(*) FROM (${tagged.map((table) => `SELECT 1 FROM ${table} WHERE anonymous_subject_id IN ('${subjectA}', '${subjectC}') AND purge_after IS NOT NULL`).join(" UNION ALL ")}) x`,
      ),
      "0",
    )
    assert.equal(
      await admin(`SELECT count(*) FROM public.leads WHERE anonymous_subject_id = '${subjectB}'`),
      "1",
      "unexpired subject kept",
    )
    assert.equal(
      await admin(
        `SELECT count(*) FROM public.product_submissions WHERE anonymous_subject_id = '${subjectB}'`,
      ),
      "1",
      "no purge for kept anonymous data",
    )
    assert.deepEqual(JSON.parse(await service(`SELECT public.purge_anonymized_records()`)), {})
  },
)
