import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  validateProductIntakeApprovalPayload,
  type ProductIntakeReviewCategoryKey,
} from "../src/lib/product-intake/category-validators"
import {
  PRODUCT_INTAKE_NON_TERMINAL_JOB_STATUSES,
  PRODUCT_INTAKE_OPEN_SUBMISSION_STATUSES,
  PRODUCT_INTAKE_RETRYABLE_JOB_STATUSES,
  PRODUCT_INTAKE_TERMINAL_JOB_STATUSES,
  normalizeCodexConcurrency,
} from "../packages/product-intake-core/src/jobs"
import {
  buildResearchedPayloadWithFinalImage,
  finalImageUploadDecisionFromArtifacts,
} from "../apps/product-intake-review/app/api/submissions/[submissionId]/publish/final-image-handoff"
import { buildReviewPropertyRows } from "../apps/product-intake-review/app/submissions/[submissionId]/review-property-rows"

const migration = readFileSync(
  "supabase/migrations/20260630120000_product_intake_research_jobs.sql",
  "utf8",
)
const artifactMigration = readFileSync(
  "supabase/migrations/20260630130000_product_intake_research_artifacts_decisions.sql",
  "utf8",
)
const reworkAttemptsMigration = readFileSync(
  "supabase/migrations/20260701090000_product_intake_rework_resets_attempts.sql",
  "utf8",
)
const autoEnqueueMigration = readFileSync(
  "supabase/migrations/20260701100000_product_intake_auto_enqueue.sql",
  "utf8",
)
const normalizedMigration = migration.toLowerCase().replace(/\s+/g, " ")
const normalizedArtifactMigration = artifactMigration.toLowerCase().replace(/\s+/g, " ")
const normalizedReworkAttemptsMigration = reworkAttemptsMigration.toLowerCase().replace(/\s+/g, " ")
const normalizedAutoEnqueueMigration = autoEnqueueMigration.toLowerCase().replace(/\s+/g, " ")
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  workspaces?: string[]
  scripts: Record<string, string>
}
const rootTsconfig = JSON.parse(readFileSync("tsconfig.json", "utf8")) as {
  exclude?: string[]
}
const corePackageJson = JSON.parse(
  readFileSync("packages/product-intake-core/package.json", "utf8"),
) as {
  name: string
  exports: Record<string, string>
}
const appPackageJson = JSON.parse(
  readFileSync("apps/product-intake-review/package.json", "utf8"),
) as {
  name: string
  dependencies: Record<string, string>
  scripts: Record<string, string>
}
const eslintConfig = readFileSync("eslint.config.mjs", "utf8")
const workerScript = readFileSync("scripts/product-intake/codex-research-worker.ts", "utf8")
const repositorySource = readFileSync("packages/product-intake-core/src/repository.ts", "utf8")
const serviceClientSource = readFileSync(
  "apps/product-intake-review/app/api/_lib/service-client.ts",
  "utf8",
)
const workerKickSource = readFileSync(
  "apps/product-intake-review/app/api/_lib/local-worker-kick.ts",
  "utf8",
)
const queueRouteSource = readFileSync("apps/product-intake-review/app/api/queue/route.ts", "utf8")
const queuePageSource = readFileSync("apps/product-intake-review/app/page.tsx", "utf8")
const researchRouteSource = readFileSync(
  "apps/product-intake-review/app/api/submissions/[submissionId]/research/route.ts",
  "utf8",
)
const reworkRouteSource = readFileSync(
  "apps/product-intake-review/app/api/submissions/[submissionId]/rework/route.ts",
  "utf8",
)
const reviewDecisionRouteSource = readFileSync(
  "apps/product-intake-review/app/api/submissions/[submissionId]/review-decision/route.ts",
  "utf8",
)
const retryRouteSource = readFileSync(
  "apps/product-intake-review/app/api/jobs/[jobId]/retry/route.ts",
  "utf8",
)
const submissionQueueRouteSource = readFileSync(
  "apps/product-intake-review/app/api/submissions/[submissionId]/queue/route.ts",
  "utf8",
)
const detailPageSource = readFileSync(
  "apps/product-intake-review/app/submissions/[submissionId]/page.tsx",
  "utf8",
)
const reviewCockpitCss = readFileSync("apps/product-intake-review/app/globals.css", "utf8")
const submissionActionsSource = readFileSync(
  "apps/product-intake-review/app/submissions/[submissionId]/submission-actions.tsx",
  "utf8",
)

const REVIEW_CATEGORY_KEYS: ProductIntakeReviewCategoryKey[] = [
  "shampoo",
  "conditioner",
  "mask",
  "leave_in",
  "oil",
  "dry_shampoo",
  "deep_cleansing_shampoo",
  "bondbuilder",
]

const ARRAY_SPEC_TABLES = new Set([
  "product_shampoo_specs",
  "product_conditioner_specs",
  "product_leave_in_eligibility",
  "product_oil_eligibility",
])

function approvalReadyPayload(
  categoryKey: ProductIntakeReviewCategoryKey,
  categorySpecs: Record<string, unknown>,
) {
  const fieldRationales = Object.fromEntries(
    [
      "product.canonical_brand",
      "product.clean_name",
      "product.category_key",
      "product.affiliate_link",
      "product.image_url",
      "product.price_eur",
      "product.purchase_link_status",
      ...Object.keys(categorySpecs).flatMap((key) => [
        `category_specs.${key}`,
        `category_specs.${key}.audit_child`,
      ]),
    ].map((key) => [key, `Reviewed evidence supports ${key}.`]),
  )

  return {
    final: {
      product: {
        canonical_brand: "Audit Brand",
        product_line: null,
        clean_name: `Audit ${categoryKey} Product`,
        category_key: categoryKey,
        affiliate_link: "https://example.test/product",
        image_url: "https://example.test/raw-image.png",
        price_eur: 9.95,
        currency: "EUR",
        purchase_link_status: "available",
        purchase_link_checked_at: "2026-07-02T10:00:00.000Z",
        price_checked_at: "2026-07-02T10:00:00.000Z",
      },
      identifiers: [
        { type: "EAN", value: " 4063528086280 ", source: "https://example.test/product" },
        {
          identifier_type: "manufacturer_no",
          identifier_value: "NQ-HO-RO-201",
          source: "https://example.test/product",
        },
      ],
      category_specs: categorySpecs,
      sources: [
        {
          url: "https://example.test/product",
          title: "Audit product page",
          evidence: "Source supports the reviewed product fields and category specs.",
        },
      ],
      field_rationales: fieldRationales,
      review: {
        manual_reviewed: false,
        reviewed_by: null,
        reviewed_at: null,
        notes: "Worker preview only.",
      },
    },
  }
}

function legacyRowsWrappedSpecs(specs: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(specs).map(([table, value]) => {
      if (Array.isArray(value)) return [table, { rows: value }]
      if (value && typeof value === "object") return [table, { rows: [value] }]
      return [table, value]
    }),
  )
}

function validCategorySpecsForAudit(
  categoryKey: ProductIntakeReviewCategoryKey,
): Record<string, unknown> {
  switch (categoryKey) {
    case "shampoo":
      return {
        product_shampoo_specs: [
          {
            thickness: "fine",
            shampoo_bucket: "normal",
            scalp_route: "balanced",
            cleansing_intensity: "regular",
          },
          {
            thickness: "normal",
            shampoo_bucket: "trocken",
            scalp_route: "dry",
            cleansing_intensity: "gentle",
          },
        ],
      }
    case "conditioner":
      return {
        product_conditioner_specs: [
          { thickness: "fine", protein_moisture_balance: "snaps" },
          { thickness: "normal", protein_moisture_balance: "stretches_bounces" },
        ],
        product_conditioner_rerank_specs: {
          weight: "light",
          repair_level: "medium",
          balance_direction: null,
          ingredient_flags: ["humectants"],
        },
      }
    case "mask":
      return {
        product_mask_specs: {
          weight: "medium",
          concentration: "high",
          balance_direction: "moisture",
          ingredient_flags: ["humectants", "oils"],
        },
      }
    case "leave_in":
      return {
        product_leave_in_specs: {
          format: "spray",
          weight: "light",
          roles: ["styling_prep"],
          provides_heat_protection: true,
          heat_protection_max_c: 220,
          heat_activation_required: false,
          care_benefits: ["moisture", "anti_frizz"],
          ingredient_flags: ["polymers"],
          application_stage: ["pre_heat"],
        },
        product_leave_in_fit_specs: {
          weight: "light",
          conditioner_relationship: "booster_only",
          care_benefits: ["heat_protect", "detangle_smooth"],
        },
        product_leave_in_eligibility: [
          { thickness: "fine", need_bucket: "heat_protect", styling_context: "heat_style" },
          { thickness: "normal", need_bucket: "moisture_anti_frizz", styling_context: "air_dry" },
        ],
      }
    case "oil":
      return {
        product_oil_eligibility: [
          {
            thickness: "fine",
            oil_subtype: "trocken-oel",
            oil_purpose: "light_finish",
            ingredient_flags: ["silicones"],
          },
          {
            thickness: "coarse",
            oil_subtype: "natuerliches-oel",
            oil_purpose: null,
            ingredient_flags: ["oils"],
          },
        ],
      }
    case "dry_shampoo":
      return {
        product_dry_shampoo_specs: {
          primary_effect: "classic_refresh",
          hair_color_fit: "universal",
          scalp_sensitivity_fit: "sensitive_ok",
          format: "aerosol_spray",
        },
      }
    case "deep_cleansing_shampoo":
      return {
        product_deep_cleansing_shampoo_specs: {
          scalp_type_focus: "oily",
          reset_intensity: "medium",
          reset_focus: "product_sebum_buildup",
          color_treated_suitability: "suitable",
        },
      }
    case "bondbuilder":
      return {
        product_bondbuilder_specs: {
          bond_repair_intensity: "intensive",
          application_mode: "post_wash_leave_in",
          bond_repair_axis: "peptide_chain",
          treatment_mode: "leave_in",
          product_format: "leave_in_mask",
          usage_protocol: "k18_leave_in",
        },
      }
  }
}

test("workspace wiring keeps review cockpit separate from root app checks", () => {
  assert.deepEqual(packageJson.workspaces, ["apps/*", "packages/*"])
  assert.equal(
    packageJson.scripts["products:intake:review-cockpit:dev"],
    "npm run dev --workspace @chaarlie/product-intake-review",
  )
  assert.equal(
    packageJson.scripts["products:intake:review-cockpit:verify"],
    "npm run typecheck --workspace @chaarlie/product-intake-review && npm run lint --workspace @chaarlie/product-intake-review && npm run build --workspace @chaarlie/product-intake-review",
  )
  assert.equal(
    packageJson.scripts["products:intake:codex-worker"],
    "tsx scripts/product-intake/codex-research-worker.ts",
  )
  assert.ok(rootTsconfig.exclude?.includes("apps"))
  assert.ok(rootTsconfig.exclude?.includes("packages"))
  assert.match(eslintConfig, /"apps\/\*\*"/)
  assert.match(eslintConfig, /"packages\/\*\*"/)
})

test("internal app and shared package expose the expected workspace contracts", () => {
  assert.equal(corePackageJson.name, "@chaarlie/product-intake-core")
  assert.equal(corePackageJson.exports["."], "./src/index.ts")

  assert.equal(appPackageJson.name, "@chaarlie/product-intake-review")
  assert.equal(appPackageJson.dependencies["@chaarlie/product-intake-core"], "*")
  assert.equal(appPackageJson.scripts.dev, "next dev --webpack")
  assert.equal(appPackageJson.scripts.lint, "eslint . --config ../../eslint.config.mjs")
})

test("research job status constants keep terminal and non-terminal sets explicit", () => {
  assert.deepEqual(PRODUCT_INTAKE_TERMINAL_JOB_STATUSES, ["done", "cancelled"])
  assert.deepEqual(PRODUCT_INTAKE_RETRYABLE_JOB_STATUSES, ["blocked", "failed"])
  assert.deepEqual(PRODUCT_INTAKE_OPEN_SUBMISSION_STATUSES, [
    "pending_review",
    "researching",
    "ready_for_review",
    "needs_more_info",
  ])
  assert.deepEqual(PRODUCT_INTAKE_NON_TERMINAL_JOB_STATUSES, [
    "queued",
    "running",
    "waiting_for_review",
    "waiting_for_rework",
    "publish_preflight",
    "publishing",
    "blocked",
    "failed",
  ])
  assert.equal(normalizeCodexConcurrency(undefined), 2)
  assert.equal(normalizeCodexConcurrency("1"), 1)
  assert.equal(normalizeCodexConcurrency("10"), 4)
  assert.equal(normalizeCodexConcurrency("nope"), 2)
})

test("research jobs migration is service-role protected and claim-safe", () => {
  assert.match(
    normalizedMigration,
    /create table if not exists public\.product_intake_research_jobs/,
  )
  assert.match(normalizedMigration, /enable row level security/)
  assert.match(normalizedMigration, /to service_role using \(true\) with check \(true\)/)
  assert.match(normalizedMigration, /revoke all on table public\.product_intake_research_jobs/)
  assert.match(normalizedMigration, /security definer/)
  assert.match(normalizedMigration, /set search_path to 'public'/)
  assert.match(normalizedMigration, /for update skip locked/)
  assert.match(normalizedMigration, /jobs\.status in \('queued', 'waiting_for_rework'\)/)
  assert.match(
    normalizedMigration,
    /locked_at = case when next_status = 'running' then now\(\) else null end/,
  )
  assert.match(normalizedMigration, /return job_row/)
  assert.doesNotMatch(normalizedMigration, /do update set status = 'queued'/)
  assert.match(normalizedMigration, /product_intake_retry_research_job/)
  assert.match(normalizedMigration, /set_updated_at_product_intake_research_jobs/)
  assert.match(normalizedMigration, /public\.update_updated_at_column\(\)/)
})

test("research job RPCs guard terminal submissions and non-retryable states", () => {
  assert.match(
    normalizedMigration,
    /submission_status not in \( 'pending_review', 'researching', 'ready_for_review', 'needs_more_info' \)/,
  )
  assert.match(
    normalizedMigration,
    /raise exception 'product submission % is not open for research: %'/,
  )
  assert.match(normalizedMigration, /current_job_status not in \('blocked', 'failed'\)/)
  assert.match(normalizedMigration, /attempt_count < jobs\.max_attempts/)
  assert.match(normalizedMigration, /expected_locked_by text default null/)
  assert.match(normalizedMigration, /expected_locked_at timestamptz default null/)
  assert.match(normalizedMigration, /jobs\.locked_by = expected_locked_by/)
  assert.match(normalizedMigration, /jobs\.locked_at = expected_locked_at/)
  assert.match(
    normalizedMigration,
    /raise exception 'product intake research job % is not retryable from status %'/,
  )
  assert.match(
    normalizedMigration,
    /grant execute on function public\.product_intake_retry_research_job/,
  )
})

test("pending product submissions automatically enqueue durable research jobs", () => {
  assert.match(
    normalizedAutoEnqueueMigration,
    /create or replace function public\.product_intake_auto_enqueue_research_job/,
  )
  assert.match(normalizedAutoEnqueueMigration, /after insert or update of status/)
  assert.match(normalizedAutoEnqueueMigration, /on public\.product_submissions/)
  assert.match(normalizedAutoEnqueueMigration, /when \(new\.status = 'pending_review'\)/)
  assert.match(
    normalizedAutoEnqueueMigration,
    /public\.product_intake_enqueue_research_job\(new\.id, 'source_research'\)/,
  )
  assert.match(normalizedAutoEnqueueMigration, /insert into public\.product_intake_research_jobs/)
  assert.match(normalizedAutoEnqueueMigration, /submissions\.status = 'pending_review'/)
  assert.match(normalizedAutoEnqueueMigration, /not exists/)
  assert.doesNotMatch(normalizedAutoEnqueueMigration, /spawn/)
  assert.doesNotMatch(normalizedAutoEnqueueMigration, /execute program/)
  assert.doesNotMatch(normalizedAutoEnqueueMigration, /net\.http|pg_net|http_post/)
})

test("repository uses the real product_submissions schema and tolerates missing phase-one job table", () => {
  assert.match(repositorySource, /brand:brand_text/)
  assert.match(repositorySource, /product_name:product_name_text/)
  assert.match(repositorySource, /payload:researched_payload/)
  assert.doesNotMatch(
    repositorySource,
    /\.select\("id,status,category,brand,product_name,source,payload/,
  )
  assert.match(repositorySource, /isMissingResearchJobsTableError/)
  assert.match(repositorySource, /PGRST205/)
  assert.match(repositorySource, /saveSubmissionResearchPreview/)
  assert.match(repositorySource, /status: nextStatus/)
  assert.match(repositorySource, /resolveReviewDecisionsForSubmission/)
})

test("service-role review routes are local-only unless explicitly overridden", () => {
  assert.match(serviceClientSource, /assertLocalServiceRoute/)
  assert.match(serviceClientSource, /assertLocalServiceHeaders/)
  assert.match(serviceClientSource, /PRODUCT_INTAKE_REVIEW_ALLOW_REMOTE/)
  assert.match(serviceClientSource, /localhost/)
  assert.match(queueRouteSource, /assertLocalServiceRoute\(request\)/)
})

test("review cockpit kicks the local Codex worker after enqueueing work", () => {
  assert.match(workerKickSource, /ready: boolean/)
  assert.match(workerKickSource, /alreadyRunning/)
  assert.match(workerKickSource, /findRunningWorkerProcess/)
  assert.match(workerKickSource, /execFileSync\("ps"/)
  assert.match(workerKickSource, /spawn\("npm"/)
  assert.match(workerKickSource, /products:intake:codex-worker/)
  assert.match(workerKickSource, /--execute-codex/)
  assert.match(workerKickSource, /detached: true/)
  assert.match(workerKickSource, /findRepoRoot/)
  assert.match(workerKickSource, /PRODUCT_INTAKE_CODEX_CONCURRENCY/)
  assert.match(workerKickSource, /PRODUCT_INTAKE_CODEX_WORKER_POLL_MS/)

  for (const source of [
    researchRouteSource,
    reworkRouteSource,
    reviewDecisionRouteSource,
    retryRouteSource,
    submissionQueueRouteSource,
  ]) {
    assert.match(source, /kickLocalCodexWorker/)
    assert.match(source, /workerKick/)
    assert.match(source, /workerKick\.ready|workerKick\?\.ready/)
  }
})

test("research job migration keeps one open job per submission and terminal statuses outside the partial index", () => {
  assert.match(normalizedMigration, /product_intake_research_jobs_one_open_per_submission/)
  const indexStart = normalizedMigration.indexOf(
    "product_intake_research_jobs_one_open_per_submission",
  )
  const indexClause = normalizedMigration.slice(
    indexStart,
    normalizedMigration.indexOf(";", indexStart),
  )

  for (const status of PRODUCT_INTAKE_NON_TERMINAL_JOB_STATUSES) {
    assert.match(indexClause, new RegExp(`'${status}'`))
  }
  for (const status of PRODUCT_INTAKE_TERMINAL_JOB_STATUSES) {
    assert.doesNotMatch(indexClause, new RegExp(`'${status}'`))
  }
})

test("artifact and review decision migration is service-role protected", () => {
  assert.match(
    normalizedArtifactMigration,
    /create table if not exists public\.product_intake_research_artifacts/,
  )
  assert.match(
    normalizedArtifactMigration,
    /create table if not exists public\.product_intake_review_decisions/,
  )
  assert.match(normalizedArtifactMigration, /enable row level security/)
  assert.match(
    normalizedArtifactMigration,
    /revoke all on table public\.product_intake_research_artifacts/,
  )
  assert.match(
    normalizedArtifactMigration,
    /revoke all on table public\.product_intake_review_decisions/,
  )
  assert.match(normalizedArtifactMigration, /product_intake_request_rework_job/)
  assert.match(normalizedArtifactMigration, /attempt_count = 0/)
  assert.match(normalizedReworkAttemptsMigration, /product_intake_request_rework_job/)
  assert.match(normalizedReworkAttemptsMigration, /attempt_count = 0/)
  assert.match(
    normalizedReworkAttemptsMigration,
    /grant execute on function public\.product_intake_request_rework_job/,
  )
  assert.match(normalizedArtifactMigration, /decision in \( 'approved', 'change_requested'/)
})

test("detail page exposes research artifacts, comments, rework, and preflight controls", () => {
  assert.match(detailPageSource, /Statusleiste/)
  assert.match(detailPageSource, /Review-Fortschritt/)
  assert.match(detailPageSource, /brandReview/)
  assert.match(detailPageSource, /Marke/)
  assert.match(detailPageSource, /buildBrandReview/)
  assert.match(detailPageSource, /WorkerQueueSnapshot/)
  assert.match(detailPageSource, /Worker-Arbeitsstatus/)
  assert.match(detailPageSource, /Aktuell arbeitet der Worker an/)
  assert.match(detailPageSource, /Der Worker arbeitet gerade an keiner Aufgabe/)
  assert.match(
    detailPageSource,
    /Dieser Job ist eingereiht und wartet auf den naechsten Worker-Poll/,
  )
  assert.match(detailPageSource, /Noch nicht vom Worker abgeholt/)
  assert.match(detailPageSource, /Dieser Job wird gerade vom Worker bearbeitet/)
  assert.match(detailPageSource, /Naechste Jobs/)
  assert.match(detailPageSource, /Aktueller Job/)
  assert.match(detailPageSource, /Aktiver Research-Status/)
  assert.match(detailPageSource, /jobActivityPanel/)
  assert.match(detailPageSource, /describeJobActivity/)
  assert.match(detailPageSource, /imageSearchRequested/)
  assert.match(detailPageSource, /Wartet auf Worker/)
  assert.match(detailPageSource, /Worker arbeitet gerade/)
  assert.match(detailPageSource, /describeJobProgress/)
  assert.match(detailPageSource, /handoffMilestones/)
  assert.match(detailPageSource, /Produkt freigegeben/)
  assert.match(detailPageSource, /Research-Artefakte/)
  assert.match(detailPageSource, /Review-Kommentare/)
  assert.match(detailPageSource, /processedImageReady/)
  assert.match(detailPageSource, /processedImageNeedsWork/)
  assert.match(detailPageSource, /processedImageValid/)
  assert.match(detailPageSource, /isProcessedImageArtifact/)
  assert.match(detailPageSource, /qualityGateReason/)
  assert.match(detailPageSource, /Bild-QA braucht ein besseres Bild/)
  assert.match(detailPageSource, /Bild-QA braucht Arbeit/)
  assert.match(detailPageSource, /isReadyProcessedImageArtifact/)
  assert.match(detailPageSource, /artifact\.status === "pending_review"/)
  assert.match(detailPageSource, /rawImageRejected/)
  assert.match(detailPageSource, /latestDecisionRow/)
  assert.match(detailPageSource, /latestDecisionRowAtOrAfter/)
  assert.match(detailPageSource, /imageCandidateCreatedAt/)
  assert.match(detailPageSource, /processedQaUrl/)
  assert.match(detailPageSource, /Magenta-QA/)
  assert.match(detailPageSource, /Bildverarbeitung ist eingereiht/)
  assert.match(detailPageSource, /Bildverarbeitung laeuft/)
  assert.match(detailPageSource, /Verarbeitetes Bild pruefen/)
  assert.match(detailPageSource, /publish_result/)
  assert.match(detailPageSource, /publishCompleted/)
  assert.match(detailPageSource, /approved_product_id/)
  assert.match(detailPageSource, /describeReviewProgress/)
  assert.match(detailPageSource, /Bereit fuer finalen Supabase-Handoff/)
  assert.match(detailPageSource, /Finaler Handoff fehlgeschlagen/)
  assert.match(detailPageSource, /transparent_background_detected/)
  assert.match(detailPageSource, /final_image_ready/)
  assert.match(detailPageSource, /Bereit fuer Schritt 2/)
  assert.match(detailPageSource, /buildReviewPropertyRows/)
  assert.doesNotMatch(detailPageSource, /Hitzeschutz max\./)
  assert.doesNotMatch(detailPageSource, /Waermeaktivierung/)
  assert.doesNotMatch(detailPageSource, /Ja, bis/)
  assert.doesNotMatch(reviewCockpitCss, /progressOverviewPanel\s*{[\s\S]*?position:\s*sticky/)
  assert.match(reviewCockpitCss, /cardProgress/)
  assert.match(reviewCockpitCss, /actionMessage-error/)
  assert.match(submissionActionsSource, /busyAction/)
  assert.match(submissionActionsSource, /CLI-Handoff erforderlich/)
  assert.match(submissionActionsSource, /actionMessage-error/)
  assert.match(submissionActionsSource, /workflowCard-busy/)
  assert.match(submissionActionsSource, /completedButton/)
  assert.match(submissionActionsSource, /publishCompleted\s*\?\s*"completedButton"/)
  assert.match(submissionActionsSource, /Entscheidung speichern/)
  assert.match(submissionActionsSource, /Bild passt/)
  assert.match(submissionActionsSource, /Rohbild freigegeben/)
  assert.match(submissionActionsSource, /Bild passt nicht/)
  assert.match(submissionActionsSource, /neues Bild suchen/)
  assert.match(submissionActionsSource, /requestImageSearchRework/)
  assert.match(submissionActionsSource, /ImageSearchProgress/)
  assert.match(submissionActionsSource, /ImageProcessingProgress/)
  assert.match(submissionActionsSource, /Bildverarbeitung starten/)
  assert.match(submissionActionsSource, /Bildverarbeitung neu starten/)
  assert.match(submissionActionsSource, /Bildsuche eingereiht/)
  assert.match(submissionActionsSource, /Worker sucht neues Bild/)
  assert.match(submissionActionsSource, /Neuen Bildvorschlag pruefen/)
  assert.match(submissionActionsSource, /Bildverarbeitung eingereiht/)
  assert.match(submissionActionsSource, /Bildverarbeitung braucht Arbeit/)
  assert.match(submissionActionsSource, /die Bild-QA braucht ein besseres Bild/)
  assert.match(submissionActionsSource, /Finalbild trotzdem freigeben/)
  assert.match(submissionActionsSource, /Besseres Bild suchen/)
  assert.match(submissionActionsSource, /Worker verarbeitet das Bild/)
  assert.match(submissionActionsSource, /Verarbeitetes Bild pruefen/)
  assert.match(submissionActionsSource, /Naechster Schritt: Bild passt nicht - neues Bild suchen/)
  assert.match(submissionActionsSource, /product-only front-facing packshot/)
  assert.match(submissionActionsSource, /Korrekturen und neuer Research-Lauf/)
  assert.match(submissionActionsSource, /Aenderungen neu recherchieren/)
  assert.match(submissionActionsSource, /requestProductRework/)
  assert.match(
    submissionActionsSource,
    /Feedback wird gespeichert und Rework wird sichtbar eingereiht/,
  )
  assert.match(submissionActionsSource, /Nick hat Review-Feedback fuer \$\{fieldPath\} markiert/)
  assert.match(submissionActionsSource, /\/api\/submissions\/\$\{submissionId\}\/review-decision/)
  assert.match(submissionActionsSource, /reworkType: "product_rework"/)
  assert.doesNotMatch(submissionActionsSource, /<details className="utilityActions">/)
  assert.doesNotMatch(submissionActionsSource, /Weitere Aktionen/)
  assert.match(submissionActionsSource, /Finales Bild passt/)
  assert.match(submissionActionsSource, /saveQuickDecision/)
  assert.match(submissionActionsSource, /final\.image/)
  assert.match(submissionActionsSource, /Finaler Supabase-Handoff passiert per CLI/)
  assert.match(submissionActionsSource, /Publish-Preflight/)
  assert.match(submissionActionsSource, /reviewActionPanel/)
  assert.match(reviewCockpitCss, /cardActions/)
  assert.match(reviewCockpitCss, /reviewActionPanel/)
  assert.match(reviewCockpitCss, /completedButton/)
  assert.match(reviewCockpitCss, /jobActivityPanel/)
  assert.match(reviewCockpitCss, /jobActivity-running/)
  assert.match(reviewCockpitCss, /workerSnapshotPanel/)
  assert.match(reviewCockpitCss, /workerSnapshotCard/)
  assert.match(reviewCockpitCss, /workerSnapshot-current/)
  assert.match(reviewCockpitCss, /imageSearchProgress/)
  assert.match(reviewCockpitCss, /imageProcessingProgress/)
  assert.match(reviewCockpitCss, /progressStep-active/)
  assert.match(reviewCockpitCss, /progressStep-error/)
  assert.match(submissionActionsSource, /activeRefreshStatuses/)
  assert.match(submissionActionsSource, /router\.refresh\(\)/)
  assert.match(submissionActionsSource, /Produkt wurde in Supabase freigegeben/)
  assert.match(submissionActionsSource, /if \(result\.message\) return result\.message/)
  assert.match(submissionActionsSource, /brandReview/)
  assert.match(submissionActionsSource, /saveProductIdentity/)
  assert.match(submissionActionsSource, /Produktidentitaet pruefen/)
  assert.match(submissionActionsSource, /Kanonische Marke/)
  assert.match(submissionActionsSource, /Linie/)
  assert.match(submissionActionsSource, /Produktname/)
  assert.match(submissionActionsSource, /Identitaet speichern/)
  assert.match(submissionActionsSource, /Speichern & neu recherchieren/)
  assert.match(submissionActionsSource, /product\.canonical_brand/)
  assert.match(submissionActionsSource, /product\.product_line/)
  assert.match(submissionActionsSource, /product\.clean_name/)
  assert.match(reviewCockpitCss, /brandReviewCard/)
  assert.match(reviewCockpitCss, /identityEditor/)
  assert.match(reviewCockpitCss, /identityCandidate/)
})

test("local worker kick starts a persistent watched worker", () => {
  assert.match(workerKickSource, /"--execute-codex",\s*"--watch"/)
  assert.match(workerKickSource, /"--concurrency",\s*"2"/)
  assert.match(workerKickSource, /"--poll-ms",\s*"5000"/)
  assert.match(
    workerKickSource,
    /npm run products:intake:codex-worker -- --execute-codex --watch --concurrency=2 --poll-ms=5000/,
  )
})

test("review property rows show exact database field paths and raw approval values", () => {
  const rows = buildReviewPropertyRows(
    {
      canonical_brand: "Balea Professional",
      product_line: "Brilliant Blond",
      clean_name: "Hair Sealer Leave-in Serum",
      category_key: "leave_in",
      affiliate_link: "https://example.test/pdp",
      image_url: "https://example.test/image.webp",
      price_eur: 3.95,
      currency: "EUR",
      purchase_link_status: "available",
      purchase_link_checked_at: "2026-07-01T08:00:00.000Z",
      price_checked_at: "2026-07-01T08:00:00.000Z",
    },
    {
      product_shampoo_specs: [
        {
          thickness: "fine",
          shampoo_bucket: "normal",
          scalp_route: "balanced",
          cleansing_intensity: "regular",
        },
      ],
      product_conditioner_specs: [{ thickness: "fine", protein_moisture_balance: "snaps" }],
      product_conditioner_rerank_specs: {
        weight: "light",
        repair_level: "medium",
        balance_direction: null,
        ingredient_flags: ["humectants"],
      },
      product_mask_specs: {
        weight: "medium",
        concentration: "high",
        balance_direction: "moisture",
        ingredient_flags: ["humectants", "oils"],
      },
      product_leave_in_specs: {
        format: "serum",
        weight: "medium",
        roles: ["styling_prep", "extension_conditioner"],
        provides_heat_protection: true,
        heat_protection_max_c: 230,
        heat_activation_required: false,
        care_benefits: ["repair", "protein", "shine", "anti_frizz"],
        ingredient_flags: ["silicones", "oils", "proteins", "humectants"],
        application_stage: ["towel_dry", "pre_heat"],
      },
      product_leave_in_fit_specs: {
        weight: "medium",
        conditioner_relationship: "booster_only",
        care_benefits: ["heat_protect", "repair"],
      },
      product_leave_in_eligibility: [
        { thickness: "fine", need_bucket: "heat_protect", styling_context: "heat_style" },
      ],
      product_oil_eligibility: {
        rows: [
          {
            thickness: "coarse",
            oil_subtype: "natuerliches-oel",
            oil_purpose: null,
            ingredient_flags: ["oils"],
          },
        ],
      },
      product_dry_shampoo_specs: {
        primary_effect: "classic_refresh",
        hair_color_fit: "universal",
        scalp_sensitivity_fit: "sensitive_ok",
        format: "aerosol_spray",
      },
      product_deep_cleansing_shampoo_specs: {
        scalp_type_focus: "oily",
        reset_intensity: "medium",
        reset_focus: "product_sebum_buildup",
        color_treated_suitability: "suitable",
      },
      product_bondbuilder_specs: {
        bond_repair_intensity: "intensive",
        application_mode: "post_wash_leave_in",
        bond_repair_axis: "peptide_chain",
        treatment_mode: "leave_in",
        product_format: "leave_in_mask",
        usage_protocol: "k18_leave_in",
      },
    },
    [{ type: "ean", value: "4015100860429", source: "dm" }],
  )

  const valuesByPath = new Map(rows.map((row) => [row.label, row.value]))

  assert.equal(
    valuesByPath.get("products.name"),
    "Balea Professional Brilliant Blond Hair Sealer Leave-in Serum",
  )
  assert.equal(valuesByPath.get("products.brand"), "Balea Professional")
  assert.equal(valuesByPath.get("products.category_key"), "leave_in")
  assert.equal(valuesByPath.get("products.price_eur"), "3.95")
  assert.equal(valuesByPath.get("product_identifiers[0].identifier_type"), "ean")
  assert.equal(valuesByPath.get("product_identifiers[0].identifier_value"), "4015100860429")
  assert.equal(valuesByPath.get("product_shampoo_specs[0].cleansing_intensity"), "regular")
  assert.equal(valuesByPath.get("product_conditioner_specs[0].protein_moisture_balance"), "snaps")
  assert.equal(valuesByPath.get("product_conditioner_rerank_specs[0].balance_direction"), "null")
  assert.equal(valuesByPath.get("product_mask_specs[0].ingredient_flags"), '["humectants","oils"]')
  assert.equal(valuesByPath.get("product_leave_in_specs[0].provides_heat_protection"), "true")
  assert.equal(valuesByPath.get("product_leave_in_specs[0].heat_protection_max_c"), "230")
  assert.equal(valuesByPath.get("product_leave_in_specs[0].heat_activation_required"), "false")
  assert.equal(
    valuesByPath.get("product_leave_in_specs[0].roles"),
    '["styling_prep","extension_conditioner"]',
  )
  assert.equal(
    valuesByPath.get("product_leave_in_fit_specs[0].conditioner_relationship"),
    "booster_only",
  )
  assert.equal(valuesByPath.get("product_leave_in_eligibility[0].need_bucket"), "heat_protect")
  assert.equal(valuesByPath.get("product_oil_eligibility[0].oil_purpose"), "null")
  assert.equal(valuesByPath.get("product_dry_shampoo_specs[0].primary_effect"), "classic_refresh")
  assert.equal(
    valuesByPath.get("product_deep_cleansing_shampoo_specs[0].reset_focus"),
    "product_sebum_buildup",
  )
  assert.equal(valuesByPath.get("product_bondbuilder_specs[0].usage_protocol"), "k18_leave_in")

  assert.equal(valuesByPath.has("Hitzeschutz"), false)
  assert.equal(valuesByPath.has("Rollen"), false)
  assert.equal(valuesByPath.has("Pflegewirkung"), false)
  assert.equal(
    Array.from(valuesByPath.values()).some((value) => value.includes("Ja, bis")),
    false,
  )
})

test("shampoo approval specs require explicit scalp routes", () => {
  const payload = buildResearchedPayloadWithFinalImage(
    approvalReadyPayload("shampoo", {
      product_shampoo_specs: [
        {
          thickness: "normal",
          shampoo_bucket: "trocken",
          scalp_route: null,
          cleansing_intensity: "regular",
        },
      ],
    }),
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/product-intake/audit/final.webp",
    {
      reviewedBy: "nick",
      reviewedAt: "2026-07-02T10:30:00.000Z",
      notes: "Audit approval-shape normalization.",
    },
  )
  const validation = validateProductIntakeApprovalPayload(payload)

  assert.equal(validation.ok, false)
  assert.deepEqual(validation.missingFields, [
    "final.category_specs.product_shampoo_specs.0.scalp_route",
  ])
})

test("final handoff normalizes every category into approval-validator shape", () => {
  for (const categoryKey of REVIEW_CATEGORY_KEYS) {
    const originalSpecs = validCategorySpecsForAudit(categoryKey)
    const legacySpecs = legacyRowsWrappedSpecs(originalSpecs)
    const updated = buildResearchedPayloadWithFinalImage(
      approvalReadyPayload(categoryKey, legacySpecs),
      "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/product-intake/audit/final.webp",
      {
        reviewedBy: "nick",
        reviewedAt: "2026-07-02T10:30:00.000Z",
        notes: "Audit approval-shape normalization.",
      },
    )
    const validation = validateProductIntakeApprovalPayload(updated)

    assert.equal(
      validation.ok,
      true,
      `${categoryKey} should validate after final handoff normalization: ${
        validation.ok ? "" : validation.missingFields.join(", ")
      }`,
    )
    assert.deepEqual(updated.final.identifiers, [
      {
        type: "ean",
        value: "4063528086280",
        source: "https://example.test/product",
      },
      {
        type: "retailer_sku",
        value: "NQ-HO-RO-201",
        source: "https://example.test/product",
      },
    ])

    const updatedCategorySpecs = updated.final.category_specs as Record<string, unknown>
    const updatedFieldRationales = updated.final.field_rationales as Record<string, unknown>
    for (const [table, expectedValue] of Object.entries(originalSpecs)) {
      const actualValue = updatedCategorySpecs[table]
      if (ARRAY_SPEC_TABLES.has(table)) {
        assert.equal(
          Array.isArray(actualValue),
          true,
          `${categoryKey}.${table} should stay an array`,
        )
      } else {
        assert.equal(
          Array.isArray(actualValue),
          false,
          `${categoryKey}.${table} should be one object`,
        )
      }
      assert.deepEqual(actualValue, expectedValue)
      assert.equal(
        typeof updatedFieldRationales[`category_specs.${table}`],
        "string",
        `${categoryKey}.${table} should have a parent rationale`,
      )
    }
  }
})

test("codex worker can run preview-only or explicit codex cli mode and persists review output", () => {
  assert.match(workerScript, /createSupabaseClientFromEnv/)
  assert.match(workerScript, /PRODUCT_INTAKE_CODEX_CONCURRENCY/)
  assert.match(workerScript, /appendResearchArtifact/)
  assert.match(workerScript, /saveSubmissionResearchPreview/)
  assert.match(workerScript, /resolveReviewDecisionsForSubmission/)
  assert.match(workerScript, /flagBool\(args, "watch"\)/)
  assert.match(workerScript, /flagInt\(args, "poll-ms"/)
  assert.match(workerScript, /PRODUCT_INTAKE_CODEX_WORKER_POLL_MS/)
  assert.match(workerScript, /sleep\(/)
  assert.match(workerScript, /while \(watch\)/)
  assert.match(workerScript, /PRODUCT_INTAKE_CODEX_BIN/)
  assert.match(workerScript, /Codex\.app\/Contents\/Resources\/codex/)
  assert.match(workerScript, /codexBinaryForWorker/)
  assert.match(workerScript, /spawnSync\(\s*codexBinary/)
  assert.match(workerScript, /Codex CLI terminated by/)
  assert.match(workerScript, /Codex CLI failed to start/)
  assert.match(workerScript, /refreshing worker lease before writes/)
  assert.match(workerScript, /--execute-codex/)
  assert.match(workerScript, /service_tier/)
  assert.match(workerScript, /PRODUCT_INTAKE_CODEX_SERVICE_TIER/)
  assert.match(workerScript, /--output-last-message/)
  assert.match(workerScript, /identity_candidate/)
  assert.match(workerScript, /property_synthesis/)
  assert.match(workerScript, /image_candidate/)
  assert.match(workerScript, /category_contract/)
  assert.match(workerScript, /job_progress/)
  assert.match(workerScript, /active_rework_request/)
  assert.match(workerScript, /activeReworkRequestFromProgress/)
  assert.match(workerScript, /reviewer_request_contract/)
  assert.match(
    workerScript,
    /Treat active_rework_request\.message as the latest reviewer instruction/,
  )
  assert.match(workerScript, /verify that URL directly before returning no-result/)
  assert.match(workerScript, /approval_payload_schema/)
  assert.match(workerScript, /approvalPayloadContract/)
  assert.match(workerScript, /categoryApprovalContract/)
  assert.match(workerScript, /loadBrandResolutionCatalogForWorker/)
  assert.match(workerScript, /brand_resolution_context/)
  assert.match(workerScript, /resolveBrandFromText/)
  assert.match(workerScript, /brands"\)\.select\("id, canonical_name, normalized_name"\)/)
  assert.match(
    workerScript,
    /product_lines"\)\.select\("id, brand_id, canonical_name, normalized_name"\)/,
  )
  assert.match(
    workerScript,
    /brand_aliases"\)\.select\("brand_id, product_line_id, alias, normalized_alias"\)/,
  )
  assert.match(workerScript, /Use resolved_brand\.canonical_brand exactly/)
  assert.match(workerScript, /enforceCanonicalBrandResolution/)
  assert.match(workerScript, /canonicalBrandResolutionBlocker/)
  assert.match(workerScript, /approvedCanonicalBrandFromReview/)
  assert.match(workerScript, /applyApprovedCanonicalBrand/)
  assert.match(workerScript, /applyApprovedProductIdentity/)
  assert.match(workerScript, /approvedProductIdentityFromReview/)
  assert.match(workerScript, /product\.canonical_brand/)
  assert.match(workerScript, /product\.product_line/)
  assert.match(workerScript, /product\.clean_name/)
  assert.match(
    workerScript,
    /If resolved_brand is null and review_decisions includes an approved product\.canonical_brand/,
  )
  assert.match(
    workerScript,
    /If review_decisions includes approved product\.product_line or product\.clean_name/,
  )
  assert.match(workerScript, /Use reviewer-approved product identity fields exactly/)
  assert.match(workerScript, /canonical brand table resolution missing/)
  assert.match(workerScript, /LEAVE_IN_APPLICATION_STAGES/)
  assert.match(workerScript, /post_wash/)
  assert.match(workerScript, /towel_dry/)
  assert.match(workerScript, /image_source_contract/)
  assert.match(workerScript, /commercial_source_contract/)
  assert.match(workerScript, /Official brand\/manufacturer product page/)
  assert.match(workerScript, /dm > Rossmann > Müller > brand-direct > Amazon DE/)
  assert.match(workerScript, /brand-direct > Amazon DE > dm > Rossmann/)
  assert.match(workerScript, /targeted_preferred_retailer_searches/)
  assert.match(workerScript, /site:dm\.de/)
  assert.match(workerScript, /site:rossmann\.de/)
  assert.match(workerScript, /site:mueller\.de/)
  assert.match(workerScript, /site:douglas\.de/)
  assert.match(workerScript, /site:hagel-shop\.de/)
  assert.match(workerScript, /site:flaconi\.de/)
  assert.match(workerScript, /site:notino\.de/)
  assert.match(workerScript, /site:otto\.de/)
  assert.match(workerScript, /site:amazon\.de/)
  assert.match(workerScript, /submitted brand and submitted product name/)
  assert.match(workerScript, /every host in host_allowlist/)
  assert.match(workerScript, /mandatory search audit/)
  assert.match(workerScript, /Before declaring no acceptable affiliate_link/)
  assert.match(workerScript, /Reject price comparison pages/)
  assert.match(workerScript, /amazon\.com for German market/)
  assert.match(
    workerScript,
    /Do not use search, category, brand listing, or price-comparison pages as affiliate_link/,
  )
  assert.match(workerScript, /No visible shadow, halo, base reflection/)
  assert.match(workerScript, /selection_priority/)
  assert.match(workerScript, /Only accept a mild removable base reflection/)
  assert.match(workerScript, /mild_removable_reflection/)
  assert.match(workerScript, /Transparent alpha PNG\/WebP/)
  assert.match(workerScript, /single saleable product unit/i)
  assert.match(workerScript, /Reject images with outer boxes/)
  assert.match(workerScript, /bottle-plus-box/)
  assert.match(workerScript, /rejected_alternatives/)
  assert.match(workerScript, /Do not choose a mediocre image/)
  assert.match(workerScript, /normalizeResearchOutputForCategory/)
  assert.match(workerScript, /hoistCategorySpecsFromRecord/)
  assert.match(workerScript, /missingCategorySpecTables/)
  assert.match(workerScript, /missingFinalProductFields/)
  assert.match(workerScript, /missingFinalApprovalSections/)
  assert.match(workerScript, /canonical_brand/)
  assert.match(workerScript, /affiliate_link/)
  assert.match(workerScript, /price_eur/)
  assert.match(workerScript, /Do not put source URLs as final\.product\.sources/)
  assert.match(workerScript, /Do not wrap category spec arrays in \{rows: \.\.\.\}/)
  assert.match(workerScript, /Use only approval-safe identifier types/)
  assert.match(workerScript, /field_rationales/)
  assert.match(workerScript, /researched_payload\.final\.category_specs/)
  assert.match(workerScript, /product_shampoo_specs/)
  assert.match(workerScript, /product_conditioner_specs/)
  assert.match(workerScript, /product_conditioner_rerank_specs/)
  assert.match(workerScript, /product_mask_specs/)
  assert.match(workerScript, /product_oil_eligibility/)
  assert.match(
    workerScript,
    /product_oil_eligibility:\s*\n\s*"array with one or more user-fit rows/,
  )
  assert.doesNotMatch(workerScript, /product_oil_eligibility:\s*\{\s*rows:/)
  assert.match(workerScript, /product_dry_shampoo_specs/)
  assert.match(workerScript, /product_deep_cleansing_shampoo_specs/)
  assert.match(workerScript, /product_bondbuilder_specs/)
  assert.match(workerScript, /sanitizeCategorySpecs/)
  assert.match(workerScript, /normalizeCategorySpecTableShapes/)
  assert.match(workerScript, /ARRAY_CATEGORY_SPEC_TABLES/)
  assert.match(workerScript, /source_transparent_background_detected/)
  assert.match(workerScript, /source_already_transparent/)
  assert.match(workerScript, /background_removal_required/)
  assert.match(workerScript, /final_image_ready/)
  assert.match(workerScript, /final_review_url/)
  assert.match(workerScript, /qa_review_url/)
  assert.match(workerScript, /chaarlie_neutral_background/)
  assert.doesNotMatch(workerScript, /image\/avif,image\/webp,image\/png,image\/jpeg/)
  assert.match(workerScript, /finalizeProductImageAsset/)
  assert.match(workerScript, /Codex CLI research was not executed/)
  assert.match(workerScript, /expectedLockedBy: job\.locked_by/)
  assert.match(workerScript, /expectedLockedAt: job\.locked_at/)
  assert.match(workerScript, /--fail-test/)
  assert.doesNotMatch(workerScript, /createAdminClient/)
})

test("publish route is fail-closed and leaves final writes to the CLI handoff", () => {
  const publishRouteSource = readFileSync(
    "apps/product-intake-review/app/api/submissions/[submissionId]/publish/route.ts",
    "utf8",
  )
  const preflightRouteSource = readFileSync(
    "apps/product-intake-review/app/api/submissions/[submissionId]/publish-preflight/route.ts",
    "utf8",
  )

  assert.match(repositorySource, /latest_image_decision/)
  assert.match(repositorySource, /latest_publish_decision/)
  assert.match(repositorySource, /Finales Bild wurde noch nicht freigegeben/)
  assert.match(repositorySource, /Finaler Produkt-Handoff wurde noch nicht freigegeben/)
  assert.match(publishRouteSource, /Finaler Supabase-Handoff ist im Review Center gesperrt/)
  assert.match(publishRouteSource, /products:intake:approve-package/)
  assert.doesNotMatch(publishRouteSource, /approveSubmissionById/)
  assert.doesNotMatch(publishRouteSource, /apply: true/)
  assert.doesNotMatch(publishRouteSource, /confirm: true/)
  assert.doesNotMatch(publishRouteSource, /appendResearchArtifact/)
  assert.doesNotMatch(publishRouteSource, /Produkt wurde in Supabase freigegeben/)
  assert.match(preflightRouteSource, /publishRouteEnabled: false/)
  assert.match(preflightRouteSource, /validateSubmissionReady/)
  assert.match(preflightRouteSource, /approval_validation_failed/)
})

test("cockpit publish handoff promotes the processed image storage URL into the approval payload", () => {
  const sourceImageUrl = "https://retailer.example.test/raw-image.jpg"
  const finalPublicUrl =
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/product-intake/2026-07-01/submission-1/final.webp"
  const storagePath = "product-intake/2026-07-01/submission-1/final.webp"
  const artifact = {
    id: "artifact-1",
    kind: "processed_image" as const,
    status: "pending_review",
    confidence: 0.9,
    source_urls: [],
    model: null,
    prompt_version: null,
    job_id: "job-1",
    submission_id: "submission-1",
    created_at: "2026-07-01T09:00:00.000Z",
    payload: {
      final_file: "/tmp/final.webp",
      asset_sha256: "a".repeat(64),
      storage_bucket: "product-images",
      storage_path: storagePath,
      planned_public_url: finalPublicUrl,
      final_image_ready: true,
      transparent_background_detected: true,
    },
  }
  const staleArtifact = {
    ...artifact,
    id: "artifact-stale",
    status: "needs_image_work",
    created_at: "2026-07-01T09:05:00.000Z",
    payload: {
      ...artifact.payload,
      final_image_ready: false,
      transparent_background_detected: false,
    },
  }
  const existingPayload = {
    spec_operations: [{ table: "product_conditioner_specs" }],
    final: {
      review: {
        manual_reviewed: false,
        reviewed_by: null,
        reviewed_at: null,
        notes: "Prepared for Product Intake Review Cockpit only.",
      },
      product: {
        canonical_brand: "Balea Professional",
        clean_name: "Hair Sealer Leave-in Serum",
        category_key: "leave_in",
        image_url: sourceImageUrl,
        product_mask_specs: {
          weight: "medium",
          concentration: "high",
          balance_direction: "moisture",
          ingredient_flags: ["humectants", "oils"],
        },
      },
      identifiers: [
        {
          identifier_type: "manufacturer_product_number",
          identifier_value: "2900101127",
          source: "https://retailer.example.test/product",
        },
        {
          identifier_type: "retailer_item_no",
          identifier_value: "NF-NQ-HO-RO-201",
          source: "https://retailer.example.test/product",
        },
      ],
      category_specs: {
        product_oil_eligibility: {
          rows: [
            {
              thickness: "fine",
              oil_subtype: "natuerliches-oel",
              oil_purpose: "pre_wash_oiling",
              ingredient_flags: ["oils"],
            },
          ],
        },
      },
      field_rationales: {
        "category_specs.product_mask_specs.weight":
          "Mask texture and conditioning base indicate medium weight.",
        "category_specs.product_oil_eligibility.0.oil_purpose":
          "Official use is a rinse-out rosemary oil treatment before washing.",
      },
    },
  }

  const decision = finalImageUploadDecisionFromArtifacts([staleArtifact, artifact])
  assert.equal(decision.ok, true)
  assert.equal(decision.ok ? decision.publicUrl : null, finalPublicUrl)
  assert.equal(decision.ok ? decision.storagePath : null, storagePath)
  assert.equal(decision.ok ? decision.artifact.id : null, "artifact-1")

  const updated = buildResearchedPayloadWithFinalImage(existingPayload, finalPublicUrl, {
    reviewedBy: "nick",
    reviewedAt: "2026-07-02T08:30:00.000Z",
    notes: "Approved from Product Intake Review Cockpit.",
  })

  assert.equal(updated.final.product.image_url, finalPublicUrl)
  assert.deepEqual(updated.final.identifiers, [
    {
      type: "retailer_sku",
      value: "2900101127",
      source: "https://retailer.example.test/product",
    },
    {
      type: "retailer_sku",
      value: "NF-NQ-HO-RO-201",
      source: "https://retailer.example.test/product",
    },
  ])
  assert.deepEqual(updated.final.category_specs, {
    product_oil_eligibility: [
      {
        thickness: "fine",
        oil_subtype: "natuerliches-oel",
        oil_purpose: "pre_wash_oiling",
        ingredient_flags: ["oils"],
      },
    ],
    product_mask_specs: {
      weight: "medium",
      concentration: "high",
      balance_direction: "moisture",
      ingredient_flags: ["humectants", "oils"],
    },
  })
  assert.equal(
    (updated.final.field_rationales as Record<string, unknown>)[
      "category_specs.product_mask_specs"
    ],
    "Mask texture and conditioning base indicate medium weight.",
  )
  assert.equal(
    (updated.final.field_rationales as Record<string, unknown>)[
      "category_specs.product_oil_eligibility"
    ],
    "Official use is a rinse-out rosemary oil treatment before washing.",
  )
  assert.equal("product_mask_specs" in updated.final.product, false)
  assert.deepEqual(updated.final.review, {
    manual_reviewed: true,
    reviewed_by: "nick",
    reviewed_at: "2026-07-02T08:30:00.000Z",
    notes: "Approved from Product Intake Review Cockpit.",
  })
  assert.equal("spec_operations" in updated, false)
  assert.equal(existingPayload.final.product.image_url, sourceImageUrl)
  assert.equal(existingPayload.final.review.manual_reviewed, false)
})

test("review decisions validate image and publish field paths", () => {
  assert.match(reviewDecisionRouteSource, /validateDecisionFieldPath/)
  assert.match(reviewDecisionRouteSource, /raw\.image/)
  assert.match(reviewDecisionRouteSource, /final\.image/)
  assert.match(reviewDecisionRouteSource, /final\.product/)
  assert.match(reviewDecisionRouteSource, /final_image_ready/)
  assert.match(reviewDecisionRouteSource, /transparent_background_detected/)
  assert.match(reviewDecisionRouteSource, /booleanValue/)
  assert.match(reviewDecisionRouteSource, /kickLocalCodexWorker/)
  assert.match(reviewDecisionRouteSource, /workerKick/)
  assert.match(
    reviewDecisionRouteSource,
    /Bildverarbeitung ist eingereiht und der lokale Worker ist bereit/,
  )
  assert.match(reviewDecisionRouteSource, /markLatestProcessedImageAccepted/)
  assert.match(reviewDecisionRouteSource, /finalImageOverride/)
  assert.match(reviewDecisionRouteSource, /human_qa_override/)
  assert.match(reviewDecisionRouteSource, /Nick accepted the processed image/)
  assert.match(
    reviewDecisionRouteSource,
    /Bild-Entscheidungen muessen auf raw\.image oder final\.image/,
  )
})

test("queue overview keeps active and completed submissions filterable", () => {
  assert.match(queueRouteSource, /waiting_for_review/)
  assert.match(
    queueRouteSource,
    /!\["done", "cancelled", "waiting_for_review"\]\.includes\(status\)/,
  )
  assert.match(queuePageSource, /type QueueFilter = "active" \| "done" \| "all"/)
  assert.match(queuePageSource, /const completedSubmissionStatuses = new Set/)
  assert.match(queuePageSource, /isCompletedQueueRow/)
  assert.match(queuePageSource, /filteredRows/)
  assert.match(queuePageSource, /Aktiv/)
  assert.match(queuePageSource, /Erledigt/)
  assert.match(queuePageSource, /Alle/)
  assert.match(queuePageSource, /filteredRows\.map/)
  assert.doesNotMatch(queuePageSource, /queue\.rows\.map/)
  assert.match(reviewCockpitCss, /queueFilters/)
  assert.match(reviewCockpitCss, /filterButton-active/)
})
