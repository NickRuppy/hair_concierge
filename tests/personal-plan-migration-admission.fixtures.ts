const corePrerequisitesSql = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS private;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;

CREATE OR REPLACE FUNCTION public.gen_random_uuid()
RETURNS uuid
LANGUAGE sql
AS $$
  SELECT extensions.uuid_generate_v4();
$$;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text,
  email_confirmed_at timestamptz
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text,
  subscription_status text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);
`

export const commercePrerequisitesSql = `CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT public.gen_random_uuid(),
  name text,
  email text NOT NULL,
  marketing_consent boolean NOT NULL DEFAULT false,
  quiz_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  quiz_kind text NOT NULL DEFAULT 'legacy' CHECK (quiz_kind IN ('legacy', 'personal_plan')),
  status text NOT NULL DEFAULT 'captured',
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  moderator_campaign_id uuid,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.funnel_sessions (
  id uuid PRIMARY KEY,
  visitor_id uuid NOT NULL DEFAULT public.gen_random_uuid(),
  package_key text NOT NULL DEFAULT 'default_organic',
  channel text NOT NULL DEFAULT 'test',
  lead_id uuid REFERENCES public.leads(id),
  user_id uuid REFERENCES public.profiles(id),
  purchase_completed_at timestamptz,
  purchase_provider text,
  purchase_reference text,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.personal_plan_one_time_checkout_consents (
  id uuid PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id),
  funnel_session_id uuid NOT NULL REFERENCES public.funnel_sessions(id),
  user_id uuid REFERENCES public.profiles(id),
  product_kind text NOT NULL DEFAULT 'personal_plan_once',
  confirmation_status text NOT NULL DEFAULT 'delivered',
  generation_started_at timestamptz,
  generation_completed_at timestamptz,
  generated_content_sha256 text,
  delivery_provider text,
  delivery_reference text,
  delivered_at timestamptz
);

CREATE TABLE public.billing_one_time_purchases (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  provider text NOT NULL DEFAULT 'stripe',
  product_kind text NOT NULL DEFAULT 'personal_plan_once',
  provider_transaction_id text NOT NULL,
  amount_minor integer NOT NULL DEFAULT 2999,
  currency text NOT NULL DEFAULT 'eur',
  status text NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  consent_id uuid REFERENCES public.personal_plan_one_time_checkout_consents(id),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.billing_subscriptions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  provider text NOT NULL,
  provider_subscription_id text NOT NULL,
  provider_status text NOT NULL,
  entitlement_status text NOT NULL,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.manual_access_grants (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id),
  reason text NOT NULL,
  expires_at timestamptz,
  revoked_at timestamptz
);

CREATE TABLE public.personal_plan_test_enrollments (
  id uuid PRIMARY KEY,
  campaign_id uuid,
  lead_id uuid NOT NULL REFERENCES public.leads(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  manual_access_grant_id uuid NOT NULL REFERENCES public.manual_access_grants(id),
  prepared_artifact_id uuid,
  quiz_source_kind text NOT NULL DEFAULT 'personal_plan',
  status text NOT NULL DEFAULT 'active',
  activated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  expires_at timestamptz NOT NULL DEFAULT '2100-01-01T00:00:00Z',
  revoked_at timestamptz
);

CREATE TABLE public.personal_plan_test_members (
  id uuid PRIMARY KEY DEFAULT public.gen_random_uuid(),
  campaign_id uuid,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  enrollment_id uuid REFERENCES public.personal_plan_test_enrollments(id),
  status text NOT NULL DEFAULT 'ready',
  revoked_at timestamptz
);

CREATE TABLE public.regular_quiz_test_enrollments (
  id uuid PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  manual_access_grant_id uuid NOT NULL REFERENCES public.manual_access_grants(id),
  status text NOT NULL DEFAULT 'active',
  activated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  expires_at timestamptz NOT NULL DEFAULT '2100-01-01T00:00:00Z',
  revoked_at timestamptz
);

CREATE TABLE public.personal_plan_prepared_artifacts (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id),
  lead_id uuid REFERENCES public.leads(id),
  status text NOT NULL
);
`

const personalPlanFoundationPrerequisitesSql = `CREATE TABLE public.personal_plans (
  id uuid PRIMARY KEY DEFAULT public.gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrollment_purchase_source_id uuid,
  current_initial_need_version_id uuid,
  current_refined_need_version_id uuid,
  pending_routine_proposal_id uuid,
  active_routine_version_id uuid,
  revision bigint NOT NULL DEFAULT 0,
  source_revision bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  UNIQUE (id, user_id)
);

CREATE TABLE public.personal_plan_need_versions (
  id uuid PRIMARY KEY DEFAULT public.gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  personal_plan_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('initial', 'refined')),
  parent_need_version_id uuid,
  prepared_artifact_source_id uuid,
  stage1_source_kind text,
  stage1_source_lead_id uuid REFERENCES public.leads(id),
  schema_version integer NOT NULL CHECK (schema_version > 0),
  computation_version text NOT NULL CHECK (length(computation_version) > 0),
  input_hash text NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  input_snapshot jsonb NOT NULL,
  output_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  UNIQUE (id, user_id, personal_plan_id),
  UNIQUE (personal_plan_id, input_hash)
);

CREATE TABLE public.personal_plan_refinement_drafts (
  id uuid PRIMARY KEY DEFAULT public.gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  personal_plan_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.personal_plan_product_drafts (
  id uuid PRIMARY KEY DEFAULT public.gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  personal_plan_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);
`

export const predecessorSchemaSql = `${corePrerequisitesSql}
${commercePrerequisitesSql}
${personalPlanFoundationPrerequisitesSql}`
