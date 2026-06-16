import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const migrationsDir = join(process.cwd(), "supabase", "migrations")
const migrationFiles = readdirSync(migrationsDir).filter((file) => file.includes("product_intake"))

assert.ok(migrationFiles.length > 0, "product intake migrations are missing")

const migrationSql = migrationFiles
  .sort()
  .map((file) => readFileSync(join(migrationsDir, file), "utf8"))
  .join("\n")
const normalizedSql = migrationSql.replace(/\s+/g, " ").toLowerCase()

function assertIncludes(fragment: string) {
  const escapedFragment = fragment
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+")

  assert.match(normalizedSql, new RegExp(escapedFragment, "i"))
}

test("product intake migration extends user product usage without changing MVP slot shape", () => {
  assertIncludes("alter table public.user_product_usage add column if not exists brand_text")
  assertIncludes(
    "add column if not exists product_id uuid references public.products(id) on delete restrict",
  )
  assertIncludes("add column if not exists product_submission_id uuid")
  assertIncludes("add column if not exists match_status text not null default 'text_only'")
  assertIncludes("add column if not exists intake_method text")
  assertIncludes("add column if not exists source text")
  assertIncludes("add column if not exists front_image_path text")

  assertIncludes("drop constraint if exists user_product_usage_category_check")
  assertIncludes("add constraint user_product_usage_match_status_check")
  assertIncludes(
    "check (match_status in ('text_only', 'matched', 'pending_review', 'needs_more_info'))",
  )
  assertIncludes("add constraint user_product_usage_match_status_link_check")
  assertIncludes("match_status = 'text_only'")
  assertIncludes("and product_id is null")
  assertIncludes("and product_submission_id is null")
  assertIncludes("match_status in ('pending_review', 'needs_more_info')")
  assertIncludes("and product_id is null")
  assertIncludes("and product_submission_id is not null")
  assertIncludes("match_status = 'matched'")
  assertIncludes("and product_id is not null")
  assertIncludes("add constraint user_product_usage_intake_method_check")
  assertIncludes("add constraint user_product_usage_source_check")
  assertIncludes("add constraint user_product_usage_category_fkey")
  assertIncludes("references public.product_categories(key)")
  assertIncludes("validate constraint user_product_usage_category_fkey")

  assert.match(normalizedSql, /unique\s+\(user_id,\s*category\)/)
  assert.doesNotMatch(normalizedSql, /drop\s+table\s+(if\s+exists\s+)?public\.user_product_usage/)
  assert.doesNotMatch(
    normalizedSql,
    /create\s+table\s+(if\s+not\s+exists\s+)?public\.user_product_usage/,
  )
})

test("product intake migration contracts product usage frequency after legacy normalization", () => {
  for (const legacyMapping of [
    "when 'rarely' then 'less_than_monthly'",
    "when '1_2x' then 'weekly_1x'",
    "when '3_4x' then 'weekly_3_4x'",
    "when '5_6x' then 'weekly_5_6x'",
    "when 'daily' then 'daily_1x'",
  ]) {
    assertIncludes(legacyMapping)
  }

  assertIncludes("add constraint user_product_usage_frequency_range_check")
  assertIncludes("add constraint user_product_usage_added_product_frequency_check")
  assertIncludes("user_product_usage has % routine product rows without frequency_range")
  assertIncludes("frequency_range is not null")
  assertIncludes("product_name is null")
  assertIncludes("brand_text is null")
  assert.match(
    normalizedSql,
    /frequency_range\s+is\s+null\s+or\s+frequency_range\s+in\s+\(\s*'less_than_monthly',\s*'monthly_1x',\s*'biweekly_1x',\s*'weekly_1x',\s*'weekly_2x',\s*'weekly_3_4x',\s*'weekly_5_6x',\s*'daily_1x'\s*\)/,
  )
})

test("product intake migration creates product submissions for raw review workflow", () => {
  assertIncludes("create table if not exists public.product_submissions")

  for (const column of [
    "user_id uuid not null references public.profiles(id)",
    "user_product_usage_id uuid",
    "source text not null check (source in ('onboarding', 'chat'))",
    "source_conversation_id uuid",
    "intake_method text not null check (intake_method in ('manual', 'photo'))",
    "category text not null references public.product_categories(key)",
    "brand_text text",
    "product_name_text text",
    "frequency_range text not null",
    "front_image_path text",
    "barcode_image_path text",
    "front_image_validation_status text",
    "front_image_validation_metadata jsonb not null default '{}'::jsonb",
    "barcode_image_validation_status text",
    "barcode_image_validation_metadata jsonb not null default '{}'::jsonb",
    "previous_product_id uuid references public.products(id)",
    "previous_product_snapshot jsonb not null default '{}'::jsonb",
    "researched_payload jsonb not null default '{}'::jsonb",
    "intake_history jsonb not null default '[]'::jsonb",
    "approved_product_id uuid references public.products(id) on delete restrict",
    "reviewed_at timestamptz",
    "reviewed_by text",
    "review_notes text",
    "user_facing_resolution_reason text",
    "user_facing_next_step text",
    "user_facing_missing_fields jsonb not null default '[]'::jsonb",
    "notification_sent_at timestamptz",
    "cleanup_after timestamptz",
    "photos_deleted_at timestamptz",
  ]) {
    assertIncludes(column)
  }

  for (const status of [
    "pending_review",
    "researching",
    "ready_for_review",
    "needs_more_info",
    "matched_existing",
    "approved",
    "rejected",
    "cancelled_by_user",
  ]) {
    assert.match(normalizedSql, new RegExp(`'${status}'`))
  }

  assertIncludes("constraint product_submissions_front_image_validation_status_check")
  assertIncludes("constraint product_submissions_barcode_image_validation_status_check")
  assertIncludes("constraint product_submissions_success_product_check")
  assertIncludes("or approved_product_id is not null")
  for (const frontStatus of [
    "valid_product_front",
    "uncertain",
    "not_a_product_photo",
    "unsafe_or_inappropriate",
  ]) {
    assert.match(normalizedSql, new RegExp(`'${frontStatus}'`))
  }

  assert.match(normalizedSql, /barcode_image_validation_status\s+in\s+\(\s*'valid_barcode'/)
  assert.doesNotMatch(
    normalizedSql,
    /front_image_validation_status\s+is\s+null\s+or\s+front_image_validation_status\s+in\s+\([^)]*'valid_barcode'/,
  )
  assert.doesNotMatch(
    normalizedSql,
    /barcode_image_validation_status\s+is\s+null\s+or\s+barcode_image_validation_status\s+in\s+\([^)]*'valid_product_front'/,
  )
})

test("product intake migration enforces ownership and current pending-link integrity", () => {
  assertIncludes("foreign key (user_product_usage_id, user_id, category)")
  assertIncludes("references public.user_product_usage(id, user_id, category)")
  assertIncludes("foreign key (source_conversation_id, user_id)")
  assertIncludes("references public.conversations(id, user_id)")
  assertIncludes("foreign key (product_submission_id, user_id, category)")
  assertIncludes("references public.product_submissions(id, user_id, category)")

  assertIncludes("create unique index if not exists idx_product_submissions_one_open_per_usage")
  assertIncludes(
    "status in ('pending_review', 'researching', 'ready_for_review', 'needs_more_info')",
  )

  assertIncludes("create or replace function public.validate_product_submission_foundation()")
  assertIncludes("is_intake_supported")
  assertIncludes("front_image_path does not belong to product submission owner/path")
  assertIncludes("barcode_image_path does not belong to product submission owner/path")

  assertIncludes("create or replace function public.validate_user_product_usage_submission_link()")
  assertIncludes("user_product_usage.product_id must match usage category")
  assertIncludes("closed unsuccessful product submissions cannot remain linked")
  assertIncludes("matched user_product_usage links require a successful product submission")
  assertIncludes(
    "successful closed product submissions require user_product_usage.product_id to equal approved_product_id",
  )
  assert.doesNotMatch(normalizedSql, /submission\.user_product_usage_id\s+=\s+new\.id/)
  assert.doesNotMatch(
    normalizedSql,
    /successful product submissions traced to user_product_usage require product_id to equal approved_product_id/,
  )
  assertIncludes(
    "before insert or update of product_submission_id, user_id, category, product_id, match_status",
  )
  assertIncludes("create or replace function public.protect_user_product_usage_review_fields()")
  assertIncludes("review-managed product usage fields require service or admin access")
  assertIncludes("auth.role() = 'service_role'")
  assertIncludes("coalesce(current_setting('request.jwt.claims', true), '') = ''")
  assertIncludes("profiles.is_admin = true")
  assertIncludes("create or replace function public.validate_product_submission_status_link()")
  assertIncludes("create or replace function public.product_intake_cancel_usage_for_category")
  assertIncludes("delete from public.user_product_usage")
  assertIncludes("status = 'cancelled_by_user'")
  assertIncludes("cleanup_after = coalesce(cleanup_after, p_updated_at + interval '30 days')")
  assertIncludes(
    "create or replace function public.product_intake_replace_usage_with_matched_product",
  )
  assertIncludes("product_submission_id = null")
  assertIncludes("match_status = 'matched'")
  assertIncludes(
    "create or replace function public.product_intake_replace_usage_with_pending_submission",
  )
  assertIncludes("product_submission_id = p_submission_id")
  assertIncludes("match_status = 'pending_review'")
  assertIncludes("jsonb_build_object")
  assertIncludes(
    "grant execute on function public.product_intake_replace_usage_with_pending_submission",
  )
  assertIncludes("successful product submissions require approved_product_id")
  assertIncludes("from public.products")
  assertIncludes("category_key = new.category")
  assertIncludes(
    "successful product submissions require approved_product_id to match submission category",
  )
  assertIncludes(
    "successful product submissions must link user_product_usage.product_id to approved_product_id before closing",
  )
  assertIncludes("where usage.product_submission_id = new.id")
  assertIncludes(
    "before insert or update of status, approved_product_id, user_product_usage_id, category",
  )
})

test("product intake migration keeps raw submissions service/admin only and storage private", () => {
  assertIncludes("alter table public.product_submissions enable row level security")
  assertIncludes("revoke all on table public.product_submissions from anon, authenticated")
  assertIncludes("grant select, update on table public.product_submissions to authenticated")
  assertIncludes("grant all on table public.product_submissions to service_role")
  assertIncludes("create policy product_submissions_service_role_all")
  assertIncludes("create policy product_submissions_admin_select")
  assertIncludes("create policy product_submissions_admin_update")
  assertIncludes("profiles.is_admin = true")

  assert.doesNotMatch(
    normalizedSql,
    /create\s+policy\s+\w+\s+on\s+public\.product_submissions\s+for\s+select\s+to\s+anon/,
  )
  assert.doesNotMatch(
    normalizedSql,
    /create\s+policy\s+\w+\s+on\s+public\.product_submissions\s+for\s+select\s+to\s+authenticated\s+using\s+\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/,
  )
  assert.doesNotMatch(
    normalizedSql,
    /grant\s+(insert|all)\s+on\s+table\s+public\.product_submissions\s+to\s+authenticated/,
  )

  assertIncludes("insert into storage.buckets")
  assertIncludes("'product-intake'")
  assertIncludes("public = false")
  assertIncludes("create policy product_intake_service_role_all")
  assert.doesNotMatch(
    normalizedSql,
    /create\s+policy\s+\w+\s+on\s+storage\.objects\s+for\s+insert\s+to\s+authenticated/,
  )
  assert.doesNotMatch(
    normalizedSql,
    /create\s+policy\s+\w+\s+on\s+storage\.objects\s+for\s+delete\s+to\s+authenticated/,
  )
  assert.doesNotMatch(normalizedSql, /name\s+like\s+'tmp\/'\s+\|\|\s+auth\.uid\(\)::text/)
})

test("product intake migration stays inside the phase 1 schema boundary", () => {
  assert.doesNotMatch(normalizedSql, /insert\s+into\s+public\.products/)
  assert.doesNotMatch(normalizedSql, /create\s+or\s+replace\s+function\s+public\.match_products/)
  assert.doesNotMatch(normalizedSql, /alter\s+table\s+public\.product_\w+_specs/)
  assert.doesNotMatch(normalizedSql, /recommendation/)
  assert.doesNotMatch(normalizedSql, /notification_sent_at\s*=\s*now\(\)/)
})
