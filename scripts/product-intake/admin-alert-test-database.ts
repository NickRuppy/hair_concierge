// Synthetic, offline-only Product Intake database for the explicit admin-alert
// test command. It runs the real migrations and never contacts Supabase.

import { readFile } from "node:fs/promises"

import { PGlite } from "@electric-sql/pglite"

const ROOT = new URL("../../", import.meta.url)
const MIGRATIONS = [
  "20260612130000_product_intake_submissions.sql",
  "20260630120000_product_intake_research_jobs.sql",
  "20260630130000_product_intake_research_artifacts_decisions.sql",
  "20260701090000_product_intake_rework_resets_attempts.sql",
  "20260701100000_product_intake_auto_enqueue.sql",
  "20261006112322_product_intake_job_attempt_hygiene.sql",
  "20261006112337_product_intake_worker_heartbeats.sql",
  "20261006141653_product_intake_job_engine_binding.sql",
  "20261007062729_product_intake_stage_artifact_kinds.sql",
  "20261015200636_product_intake_admin_notifications.sql",
] as const

const PREREQUISITES = `
  CREATE ROLE anon;
  CREATE ROLE authenticated;
  CREATE ROLE service_role BYPASSRLS;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'service_role'::text $$;
  CREATE SCHEMA storage;
  CREATE TABLE storage.buckets (
    id text PRIMARY KEY, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]
  );
  CREATE TABLE storage.objects (id uuid PRIMARY KEY, bucket_id text);
  CREATE TABLE public.profiles (id uuid PRIMARY KEY, is_admin boolean DEFAULT false);
  CREATE TABLE public.product_categories (key text PRIMARY KEY, is_intake_supported boolean);
  CREATE TABLE public.products (id uuid PRIMARY KEY, category_key text);
  CREATE TABLE public.conversations (id uuid PRIMARY KEY, user_id uuid, UNIQUE (id, user_id));
  CREATE TABLE public.user_product_usage (
    id uuid PRIMARY KEY, user_id uuid, category text,
    frequency_range text, product_name text, UNIQUE (user_id, category)
  );
  CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN NEW.updated_at = now(); RETURN NEW; END;
  $$;
  INSERT INTO public.profiles (id) VALUES ('11111111-1111-4111-8111-111111111111');
  INSERT INTO public.product_categories VALUES ('conditioner', true);
  INSERT INTO public.products VALUES ('22222222-2222-4222-8222-222222222222', 'conditioner');
`

export async function createAdminAlertTestDatabase(dataDir?: string): Promise<PGlite> {
  const pg = new PGlite(dataDir)
  await pg.exec(PREREQUISITES)
  for (const migration of MIGRATIONS) {
    await pg.exec(await readFile(new URL(`supabase/migrations/${migration}`, ROOT), "utf8"))
  }
  // Reapplying the replacement migration remains part of the compatibility proof.
  await pg.exec(await readFile(new URL(`supabase/migrations/${MIGRATIONS.at(-1)}`, ROOT), "utf8"))
  await pg.exec("SET ROLE service_role")
  return pg
}
