import { expect, test, type Locator, type Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { execFileSync } from "node:child_process"

import { expectedShampooBucket } from "../src/lib/personal-plan/products/authority/categories/shampoo"
import type { PlanCategoryTarget, PlanProductRole } from "../src/lib/personal-plan/types"

const password = "Stage15Browser!2026"
const paidAt = "2026-08-08T12:00:00.000Z"

const quizEnvelope = {
  kind: "personal_plan",
  version: 3,
  answers: {
    texture: "wavy",
    thickness: "fine",
    density: "medium",
    goals: ["moisture", "shine"],
    routineClarity: "partial",
    resultReliability: "sometimes",
    adaptationConfidence: "partly",
    currentConcerns: ["dry_lengths", "split_ends"],
    concernRecurrence: { concernId: "dry_lengths", frequency: "often" },
    hairLength: "long",
    hairSurface: "rough",
    elasticResponse: "stretches_stays",
    chemicalTreatments: ["colored"],
    scalpOiliness: "balanced",
    scalpConcerns: ["irritated"],
    previousAttempts: "some_steps_helped",
    blockers: ["product_fit"],
    routineStyle: "simple_reliable",
    meaningfulMoment: "everyday",
  },
}

// The readiness route deliberately projects this persisted, canonical diagnostic
// envelope into hair_profiles when external fulfillment completes. It is separate
// from the Stage-1 v3 envelope, whose shape is intentionally not legacy profile data.
const canonicalDiagnostics = {
  structure: "wavy",
  thickness: "fine",
  density: "medium",
  hair_length: "long",
  fingertest: "rau",
  pulltest: "stretches_stays",
  scalp_type: "ausgeglichen",
  has_scalp_issue: true,
  scalp_condition: "gereizt",
  concerns: ["dryness", "split_ends"],
  treatment: ["gefaerbt"],
  goals: ["moisture", "shine"],
}

function requiredEnvironment(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required for the isolated Stage 1–5 browser test`)
  return value
}

function seedProductGuidanceViaLocalPostgres(
  rows: Array<{
    productId: string
    sourceGuidanceKey: string
    guidanceKey: string
    role: "shampoo_everyday" | "conditioner_rinse_out"
  }>,
) {
  const container = requiredEnvironment("PERSONAL_PLAN_STAGE1_5_DB_CONTAINER")
  const literal = (value: string) => value.replaceAll("'", "''")
  const sql = rows
    .map(
      ({ productId, sourceGuidanceKey, guidanceKey, role }) => `
DO $seed$
DECLARE
  inserted_count integer;
BEGIN
  INSERT INTO public.application_guidance_protocols (
    id, guidance_key, protocol_version, locale, scope_kind, category_key, role_key,
    product_id, application_family, payload, status, verified_at
  )
  SELECT
    gen_random_uuid(),
    '${literal(guidanceKey)}',
    source.protocol_version,
    source.locale,
    'product',
    source.category_key,
    NULL,
    '${literal(productId)}'::uuid,
    source.application_family,
    jsonb_set(
      jsonb_set(
        jsonb_set(source.payload, '{guidanceKey}', to_jsonb('${literal(guidanceKey)}'::text)),
        '{scope}',
        jsonb_build_object(
          'kind', 'product',
          'category', source.category_key,
          'productId', '${literal(productId)}'
        )
      ),
      '{role}',
      'null'::jsonb
    ),
    source.status,
    source.verified_at
  FROM public.application_guidance_protocols AS source
  WHERE source.guidance_key = '${literal(sourceGuidanceKey)}'
    AND source.scope_kind = 'application_family'
    AND source.status = 'active';

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count <> 1 THEN
    RAISE EXCEPTION 'expected one source guidance row for ${literal(sourceGuidanceKey)}';
  END IF;

  INSERT INTO public.product_application_protocols (
    product_id, category, role, source_url, source_text, guidance_payload
  )
  SELECT
    '${literal(productId)}'::uuid,
    source.category_key,
    '${literal(role)}',
    source.payload#>>'{evidence,0,sourceUrl}',
    'Canonical browser-test protocol derived from the verified family guidance.',
    jsonb_set(
      jsonb_set(
        jsonb_set(source.payload, '{guidanceKey}', to_jsonb('${literal(guidanceKey)}'::text)),
        '{scope}',
        jsonb_build_object(
          'kind', 'product',
          'category', source.category_key,
          'productId', '${literal(productId)}'
        )
      ),
      '{role}',
      to_jsonb('${literal(role)}'::text)
    )
  FROM public.application_guidance_protocols AS source
  WHERE source.guidance_key = '${literal(sourceGuidanceKey)}'
    AND source.scope_kind = 'application_family'
    AND source.status = 'active';

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count <> 1 THEN
    RAISE EXCEPTION 'expected one canonical protocol row for ${literal(sourceGuidanceKey)}';
  END IF;
END
$seed$;
`,
    )
    .join("\n")

  execFileSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
    { input: sql, stdio: ["pipe", "pipe", "pipe"] },
  )
}

function adminClient() {
  return createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

async function requireWrite(operation: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await operation
  if (error) throw new Error(error.message)
}

async function seedBuyer(input: { email: string; active: boolean; internal?: boolean }) {
  const admin = adminClient()
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Personal Plan Browser" },
  })
  if (createError || !created.user) throw new Error(createError?.message ?? "browser user missing")

  const userId = created.user.id
  const leadId = crypto.randomUUID()
  const sessionId = crypto.randomUUID()
  const consentId = crypto.randomUUID()
  const artifactId = crypto.randomUUID()
  const artifactHash = crypto.randomUUID().replaceAll("-", "").padEnd(64, "0")
  await requireWrite(
    admin.from("profiles").upsert({
      id: userId,
      email: input.email,
      full_name: "Personal Plan Browser",
      onboarding_completed: true,
      onboarding_step: "celebration",
      is_admin: input.internal === true,
      subscription_status: input.active ? "active" : null,
      subscription_interval: input.active ? "month" : null,
      current_period_end: input.active ? "2027-08-08T12:00:00.000Z" : null,
    }),
  )
  await requireWrite(
    admin.from("leads").insert({
      id: leadId,
      name: "Personal Plan Browser",
      email: input.email,
      user_id: userId,
      quiz_kind: "personal_plan",
      quiz_answers: quizEnvelope,
    }),
  )
  await requireWrite(
    admin.from("funnel_sessions").insert({
      id: sessionId,
      visitor_id: crypto.randomUUID(),
      package_key: "personal_plan_once",
      channel: "test",
      quiz_variant: "personal_plan",
      lead_id: leadId,
      user_id: userId,
      is_internal_test: true,
    }),
  )
  const delivered = input.active ? paidAt : null
  await requireWrite(
    admin.from("personal_plan_one_time_checkout_consents").insert({
      id: consentId,
      lead_id: leadId,
      funnel_session_id: sessionId,
      user_id: userId,
      product_kind: "personal_plan_once",
      offer_variant: "test",
      copy_version: "test",
      consent_text: "Test consent",
      consent_text_sha256: "a".repeat(64),
      accepted_at: paidAt,
      confirmation_provider: input.active ? "test" : null,
      confirmation_reference: input.active ? "confirmation-test" : null,
      confirmation_status: input.active ? "delivered" : "pending",
      confirmation_sent_at: delivered,
      confirmation_delivered_at: delivered,
      generation_started_at: delivered,
      generation_completed_at: delivered,
      generated_content_sha256: input.active ? "b".repeat(64) : null,
      delivery_provider: input.active ? "test" : null,
      delivery_reference: input.active ? "delivery-test" : null,
      delivered_at: delivered,
    }),
  )
  await requireWrite(
    admin.from("billing_one_time_purchases").insert({
      user_id: userId,
      provider: "stripe",
      product_kind: "personal_plan_once",
      provider_transaction_id: `stage15-${crypto.randomUUID()}`,
      amount_minor: 2999,
      currency: "eur",
      status: "paid",
      paid_at: paidAt,
      consent_id: consentId,
    }),
  )
  await requireWrite(
    admin.from("personal_plan_prepared_artifacts").insert({
      id: artifactId,
      answer_hash: artifactHash,
      claim_token_hash: artifactHash.replace(/0$/, "1"),
      quiz_answers: quizEnvelope,
      canonical_profile: canonicalDiagnostics,
      fallback_metadata: {},
      priorities: {},
      diagnostic_scores: {},
      public_offer_model: {},
      locked_plan: {},
      status: input.active ? "attached" : "prepared",
      lead_id: input.active ? leadId : null,
      user_id: userId,
      expires_at: "2027-08-08T12:00:00.000Z",
      attached_at: input.active ? paidAt : null,
      user_attached_at: input.active ? paidAt : null,
    }),
  )
  return { admin, userId, leadId, consentId, artifactId }
}

async function completeDisposableFulfillment(
  admin: ReturnType<typeof adminClient>,
  input: { userId: string; leadId: string; consentId: string; artifactId: string },
) {
  await requireWrite(
    admin
      .from("personal_plan_one_time_checkout_consents")
      .update({
        confirmation_provider: "test",
        confirmation_reference: "confirmation-test",
        confirmation_status: "delivered",
        confirmation_sent_at: paidAt,
        confirmation_delivered_at: paidAt,
        generation_started_at: paidAt,
        generation_completed_at: paidAt,
        generated_content_sha256: "e".repeat(64),
        delivery_provider: "test",
        delivery_reference: "delivery-test",
        delivered_at: paidAt,
      })
      .eq("id", input.consentId),
  )
  await requireWrite(
    admin
      .from("personal_plan_prepared_artifacts")
      .update({
        status: "attached",
        lead_id: input.leadId,
        user_id: input.userId,
        attached_at: paidAt,
        user_attached_at: paidAt,
      })
      .eq("id", input.artifactId),
  )
}

async function login(page: Page, email: string, next: string) {
  await page.goto(`/auth?next=${encodeURIComponent(next)}`)
  const cookieDialog = page.getByRole("dialog", { name: "Cookie-Einstellungen" })
  await cookieDialog.waitFor({ state: "visible", timeout: 2_000 }).catch(() => undefined)
  if (await cookieDialog.isVisible()) {
    await cookieDialog.getByRole("button", { name: "Nur essentielle" }).click()
  }
  const loginTab = page.getByRole("tab", { name: "Anmelden" })
  if (await loginTab.isVisible()) await loginTab.click()
  await page.locator('input[type="email"]:visible').fill(email)
  await page.locator('input[type="password"]:visible').fill(password)
  await page.getByRole("button", { name: "Anmelden", exact: true }).click()
}

async function assertNoLabs(page: Page) {
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/labs/")) {
      throw new Error(`production journey requested Labs route: ${request.url()}`)
    }
  })
}

async function chooseAndContinue(page: Page, label: string | RegExp) {
  await page.getByRole("button", { name: label }).click()
  await page.getByRole("button", { name: "Weiter", exact: true }).click()
}

async function chooseNoneAndContinue(page: Page) {
  const none = page.getByRole("button", {
    name: /Keine weiteren; ersetzt die Auswahl unter Weitere Kategorien|^Nichts davon$/,
  })
  await none.click()
  await expect(none).toHaveAttribute("aria-pressed", "true")
  const continueButton = page.getByRole("button", { name: "Weiter", exact: true })
  await expect(continueButton).toBeEnabled()
  await continueButton.click()
}

type Stage3AuthoritySeed = {
  requirements: Array<{ category: string }>
  draft: {
    personalPlanId: string
    refinedVersionId: string
    completedCaptureCategories: string[]
    authoritySnapshot: {
      orderedCategories: string[]
      categoryDecisions: Array<{
        category: string
        roles: string[]
        target: Record<string, string> | null
      }>
    }
  }
}

async function seedStage3Catalog(
  admin: ReturnType<typeof adminClient>,
  journey: Stage3AuthoritySeed,
  userId: string,
) {
  const decisions = journey.draft.authoritySnapshot.categoryDecisions
  const decision = (category: string): { roles: string[]; target: Record<string, string> } => {
    const value = decisions.find((candidate) => candidate.category === category)
    if (!value?.target)
      throw new Error(`Stage 3 requirement ${category} is missing from the refined plan`)
    return { roles: value.roles, target: value.target }
  }
  const shampoo = decision("shampoo")
  const conditioner = decision("conditioner")
  decision("scalp_care")
  decision("mask")
  const shampooId = crypto.randomUUID()
  const conditionerId = crypto.randomUUID()
  const unknownMaskId = crypto.randomUUID()
  const shampooRole = shampoo.roles[0]
  if (!shampooRole) throw new Error("shampoo role is missing")
  const shampooBucket = expectedShampooBucket({
    role: shampooRole as PlanProductRole,
    target: shampoo.target as unknown as Extract<PlanCategoryTarget, { category: "shampoo" }>,
  })
  if (!shampooBucket) throw new Error("shampoo target cannot be resolved to a signed bucket")
  await requireWrite(
    admin.from("product_categories").upsert({
      key: "mask",
      display_name_de: "Maske",
      is_catalog_supported: true,
      is_intake_supported: true,
      sort_order: 50,
    }),
  )
  await requireWrite(
    admin.from("products").insert([
      {
        id: shampooId,
        name: "E2E Sanftes Shampoo",
        brand: "E2E",
        category: "shampoo",
        category_key: "shampoo",
        origin: "curated",
        is_active: false,
        lifecycle_status: "active",
        is_chaarlie_recommended: false,
        suitable_thicknesses: [quizEnvelope.answers.thickness],
        sort_order: 10,
      },
      {
        id: conditionerId,
        name: "E2E Leichter Conditioner",
        brand: "E2E",
        category: "conditioner",
        category_key: "conditioner",
        origin: "curated",
        is_active: false,
        lifecycle_status: "active",
        is_chaarlie_recommended: false,
        suitable_thicknesses: [quizEnvelope.answers.thickness],
        suitable_concerns: [
          conditioner.target.careDirection === "protein"
            ? "protein"
            : conditioner.target.careDirection === "balanced"
              ? "performance"
              : "feuchtigkeit",
        ],
        sort_order: 20,
      },
      {
        id: unknownMaskId,
        name: "E2E Unbekannte Maske",
        brand: "E2E",
        category: "mask",
        category_key: "mask",
        origin: "user_submitted",
        is_active: true,
        lifecycle_status: "active",
        is_chaarlie_recommended: false,
        sort_order: 30,
      },
    ]),
  )
  await requireWrite(
    admin.from("product_shampoo_specs").insert({
      product_id: shampooId,
      thickness: quizEnvelope.answers.thickness,
      shampoo_bucket: shampooBucket,
      scalp_route: shampoo.target.scalpRoute,
      cleansing_intensity: "regular",
    }),
  )
  await requireWrite(
    admin.from("product_conditioner_specs").upsert({
      product_id: conditionerId,
      thickness: quizEnvelope.answers.thickness,
      protein_moisture_balance:
        conditioner.target.careDirection === "protein"
          ? "stretches_stays"
          : conditioner.target.careDirection === "balanced"
            ? "stretches_bounces"
            : "snaps",
    }),
  )
  await requireWrite(
    admin.from("product_conditioner_rerank_specs").insert({
      product_id: conditionerId,
      weight: conditioner.target.weight,
      repair_level: conditioner.target.repairSupportLevel,
      balance_direction: conditioner.target.careDirection,
    }),
  )
  await requireWrite(
    admin.from("user_products").insert({
      user_id: userId,
      category: "mask",
      catalog_product_id: unknownMaskId,
      brand_text: "E2E",
      product_name_text: "E2E Unbekannte Maske",
      identity_status: "matched",
      ownership_status: "owned",
      intake_source: "catalog_search",
    }),
  )
  seedProductGuidanceViaLocalPostgres([
    {
      productId: shampooId,
      sourceGuidanceKey: "shampoo-standard-rinse-out-cleanse",
      guidanceKey: `e2e-shampoo-${shampooId}`,
      role: "shampoo_everyday",
    },
    {
      productId: conditionerId,
      sourceGuidanceKey: "conditioner-standard-rinse-out-conditioning",
      guidanceKey: `e2e-conditioner-${conditionerId}`,
      role: "conditioner_rinse_out",
    },
  ])
  await requireWrite(
    admin
      .from("products")
      .update({ is_active: true, is_chaarlie_recommended: true })
      .eq("id", conditionerId),
  )
  await requireWrite(admin.from("products").update({ is_active: true }).eq("id", shampooId))
  return { shampooId, conditionerId, unknownMaskId }
}

async function searchCaptureAndAssign(
  page: Page,
  query: string,
  productName: string,
  frequencyLabel = "2x/Woche",
  pendingAnalysis = false,
) {
  await page.getByRole("searchbox", { name: "Produkt suchen" }).fill(query)
  const selectedProduct = page.getByRole("option", {
    name: pendingAnalysis ? `${productName}: Analyse ausstehend` : `${productName} auswählen`,
    exact: true,
  })
  await selectedProduct.click()
  await expect(selectedProduct).toHaveAttribute("aria-selected", "true")
  const frequency = page.getByRole("slider", { name: "Nutzungshäufigkeit" })
  await page.getByRole("button", { name: frequencyLabel, exact: true }).click()
  await expect(frequency).toHaveAttribute("aria-valuetext", frequencyLabel)
  // Product and cadence stay local until this explicit category boundary.
  await clickAndWaitForStage3Save(page, pendingAnalysis ? "Auf Analyse warten" : "Weiter")
}

function waitForStage3Save(page: Page) {
  return page.waitForResponse((response) => {
    const request = response.request()
    return (
      request.method() === "PATCH" &&
      new URL(response.url()).pathname === "/api/personal-plan/stage-3"
    )
  })
}

async function clickAndWaitForStage3Save(page: Page, name: string | RegExp) {
  const saved = waitForStage3Save(page)
  const button =
    typeof name === "string"
      ? page.getByRole("button", { name, exact: true })
      : page.getByRole("button", { name })
  await button.click()
  expect((await saved).status()).toBe(200)
}

async function clickAndWaitForStage3AuthorityDecision(page: Page, currentAction: Locator) {
  // Authority cards rerender after each saved decision. Hold this exact button
  // identity, then prove the server accepted its PATCH before selecting the
  // next card. Accessible labels describe the user-facing action; only the
  // decision key is stable enough to prevent rebinding to a successor card.
  await expect(currentAction).toBeVisible()
  const decisionKey = await currentAction.getAttribute("data-stage3-decision-key")
  const actionKind = await currentAction.getAttribute("data-stage3-action-kind")
  if (!decisionKey || !actionKind)
    throw new Error("Stage 3 authority action needs a stable decision identity")
  const action = page.locator(
    `button[data-stage3-decision-key=${JSON.stringify(decisionKey)}][data-stage3-action-kind=${JSON.stringify(actionKind)}]`,
  )
  await expect(action).toBeVisible()
  const saved = page.waitForResponse((response) => {
    const request = response.request()
    return (
      request.method() === "PATCH" &&
      new URL(response.url()).pathname === "/api/personal-plan/stage-3"
    )
  })
  await action.click()
  expect((await saved).status()).toBe(200)
  await expect(action).toBeHidden()
}

async function waitForStage3AuthorityState(page: Page) {
  const authorityAction = page.locator("article button[data-stage3-action-kind]").first()
  const groupedClearFitAction = page.getByRole("button", {
    name: /\d+ passende Produkte übernehmen/,
  })
  const routineHandoff = page.getByRole("heading", { name: "Deine Routine steht", exact: true })
  const stageState = async () => {
    if (new URL(page.url()).pathname === "/routine" || (await routineHandoff.isVisible())) {
      return "complete"
    }
    if (await groupedClearFitAction.isVisible()) return "grouped-clear-fits"
    return (await authorityAction.isVisible()) ? "decision" : "transitioning"
  }

  await expect
    .poll(stageState, {
      message: "Stage 3 should render its next decision or portfolio handoff",
      timeout: 15_000,
    })
    .not.toBe("transitioning")
  return stageState()
}

const stage3CategoryHeading: Record<string, string> = {
  shampoo: "Dein Shampoo",
  conditioner: "Dein Conditioner",
  leave_in: "Dein Leave-in",
  heat_protectant: "Dein Hitzeschutz",
  oil: "Dein Öl",
  mask: "Deine Maske",
  scalp_care: "Dein Kopfhautprodukt",
  dry_shampoo: "Dein Trockenshampoo",
  bondbuilder: "Dein Bondbuilder",
  deep_cleansing_shampoo: "Deine Tiefenreinigung",
}

async function expectStage3Category(page: Page, category: string) {
  const heading = stage3CategoryHeading[category]
  if (!heading) throw new Error(`Stage 3 test has no heading contract for ${category}`)
  await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible()
}

async function currentVisibleStage3Category(page: Page, categories: string[]) {
  const visibleCategory = async () => {
    for (const category of categories) {
      const heading = stage3CategoryHeading[category]
      if (
        heading &&
        (await page.getByRole("heading", { name: heading, exact: true }).isVisible())
      ) {
        return category
      }
    }
    return null
  }
  await expect.poll(visibleCategory, { timeout: 15_000 }).not.toBeNull()
  const category = await visibleCategory()
  if (!category) throw new Error("Stage 3 did not expose a capture category")
  return category
}

async function confirmStage3ProductKinds(page: Page) {
  await expect(page.getByRole("heading", { name: "Deine Produktarten", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Produktarten bestätigen", exact: true }).click()
}

type NavigationTimingReceipt = {
  coldMs: number
  warm: { samples: number[]; p75Ms: number; p95Ms: number; maxMs: number }
}

function nearestRank(samples: number[], percentile: number) {
  const sorted = [...samples].sort((left, right) => left - right)
  return sorted[Math.max(0, Math.ceil(percentile * sorted.length) - 1)]!
}

async function sampleNavigationToVisible(input: {
  page: Page
  url: string
  ready: () => Locator
  warmSamples?: number
}): Promise<NavigationTimingReceipt> {
  const durations: number[] = []
  for (let sample = 0; sample <= (input.warmSamples ?? 8); sample += 1) {
    const startedAt = performance.now()
    await input.page.goto(input.url)
    await expect(input.ready()).toBeVisible()
    durations.push(Math.round(performance.now() - startedAt))
  }
  const [coldMs, ...warmSamples] = durations
  return {
    coldMs: coldMs!,
    warm: {
      samples: warmSamples,
      p75Ms: nearestRank(warmSamples, 0.75),
      p95Ms: nearestRank(warmSamples, 0.95),
      maxMs: Math.max(...warmSamples),
    },
  }
}

async function completeCurrentCategory(page: Page, category: string) {
  if (category === "shampoo") {
    await searchCaptureAndAssign(page, "E2E Sanftes", "E2E Sanftes Shampoo")
    return
  }
  if (category === "conditioner") {
    await searchCaptureAndAssign(page, "E2E Leichter", "E2E Leichter Conditioner")
    return
  }
  if (category === "mask") {
    await searchCaptureAndAssign(page, "E2E Unbekannte", "E2E Unbekannte Maske", "2x/Woche", true)
    return
  }
  if (category === "scalp_care") {
    await page.getByRole("searchbox", { name: "Produkt suchen" }).fill("E2E nicht gefundenes Tonic")
    await page.getByRole("button", { name: "Nicht dabei? Produkt hinzufügen" }).click()
    await page.getByRole("textbox", { name: "Produktname" }).fill("E2E Kopfhaut-Tonic")
    await page.getByRole("button", { name: "2x/Woche" }).click()
    await page.getByRole("button", { name: "Produkt speichern", exact: true }).click()
    await expect(page.getByText("Analyse läuft", { exact: true })).toBeVisible()
    await clickAndWaitForStage3Save(page, "Weiter")
    return
  }
  await page
    .getByRole("searchbox", { name: "Produkt suchen" })
    .fill(`E2E nicht gefundenes ${category}`)
  await page.getByRole("button", { name: "Nicht dabei? Produkt hinzufügen" }).click()
  await page.getByRole("textbox", { name: "Produktname" }).fill(`E2E ${category}`)
  await page.getByRole("button", { name: "2x/Woche" }).click()
  await page.getByRole("button", { name: "Produkt speichern", exact: true }).click()
  await expect(page.getByText("Analyse läuft", { exact: true })).toBeVisible()
  await clickAndWaitForStage3Save(page, "Weiter")
}

test.describe("persisted production Personal Plan Stage 1 to 5", () => {
  test("ready buyer enters the real Stage 1 surface and persists its initial need", async ({
    page,
    browser,
  }) => {
    test.skip(
      process.env.PERSONAL_PLAN_STAGE1_5_ISOLATED_BROWSER !== "1",
      "run through the isolated Stage 1–5 browser harness",
    )
    page.setDefaultTimeout(15_000)
    let stage3CompletionRequests = 0
    let routineProposalResolves = 0
    let stage1ClientReads = 0
    let stage3ClientReads = 0
    page.on("request", (request) => {
      const pathname = new URL(request.url()).pathname
      if (request.method() === "GET" && pathname === "/api/personal-plan/stage-1") {
        stage1ClientReads += 1
      }
      if (request.method() === "GET" && pathname === "/api/personal-plan/stage-3") {
        stage3ClientReads += 1
      }
      if (request.method() === "POST" && pathname === "/api/personal-plan/stage-3/complete") {
        stage3CompletionRequests += 1
      }
      if (
        request.method() === "POST" &&
        /^\/api\/personal-plan\/routine\/proposals\/[^/]+\/resolve$/.test(pathname)
      ) {
        routineProposalResolves += 1
      }
    })
    await assertNoLabs(page)
    const email = "stage15-ready@hairconscierge.test"
    const { admin, userId, leadId } = await seedBuyer({ email, active: true, internal: true })

    await login(page, email, "/plan-start")
    await page.waitForURL("**/plan-start")
    await expect(page.getByRole("heading", { name: "Deine Basis" })).toBeVisible()
    const readyFirstPollTiming = await sampleNavigationToVisible({
      page,
      url: `/plan-bereit?lead=${leadId}`,
      ready: () => page.getByRole("link", { name: "Plan ansehen" }),
    })
    expect(readyFirstPollTiming.warm.p95Ms).toBeLessThanOrEqual(1_800)
    const stage1Timing = await sampleNavigationToVisible({
      page,
      url: "/plan-start",
      ready: () => page.getByRole("heading", { name: "Deine Basis" }),
    })
    expect(stage1Timing.warm.p75Ms).toBeLessThanOrEqual(1_000)
    expect(stage1Timing.warm.p95Ms).toBeLessThanOrEqual(2_000)
    expect(stage1ClientReads).toBe(0)
    const optional = page.getByRole("button", { name: "Optionale Empfehlungen" })
    if (await optional.isVisible()) {
      await optional.click()
      await expect(page.getByRole("heading", { name: "Zusätzlich sinnvoll" })).toBeVisible()
    }
    await page.getByRole("button", { name: "Jetzt auf meine Produkte abstimmen" }).click()
    await expect(page.getByRole("heading", { name: "Welche Produkte nutzt du?" })).toBeVisible()
    for (const category of ["Shampoo", "Conditioner", "Maske", "Kopfhautpflege"]) {
      await page.getByRole("button", { name: category, exact: true }).click()
    }
    const firstStage2Save = page.waitForResponse((response) => {
      const request = response.request()
      return (
        request.method() === "PATCH" &&
        new URL(response.url()).pathname === "/api/personal-plan/stage-2"
      )
    })
    await page.getByRole("button", { name: "Weiter", exact: true }).click()
    await expect(page.getByRole("button", { name: "2x/Woche" })).toBeVisible()
    expect((await firstStage2Save).status()).toBe(200)
    await page.reload()
    await expect(page.getByText("Wir laden deine Verfeinerung.", { exact: true })).toBeVisible()
    await expect(page.getByText("Nasswasch-Rhythmus", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Bei der offenen Frage fortfahren →" }).click()
    await expect(page.getByRole("button", { name: "2x/Woche" })).toBeVisible()
    await chooseAndContinue(page, "2x/Woche")
    await chooseAndContinue(page, "Leicht empfindlich oder juckend")
    await page.getByRole("button", { name: "Mikrofaser-Handtuch" }).click()
    await page.getByRole("button", { name: "Rubbeln" }).click()
    await page.getByRole("button", { name: "Weiter" }).click()
    await page.getByRole("button", { name: "Gewöhnlich föhnen" }).click()
    await page.getByRole("button", { name: "Weiter" }).click()
    await expect(
      page.getByRole("heading", { name: "Welche weiteren Hitze-Tools nutzt du?" }),
    ).toBeVisible()
    await chooseNoneAndContinue(page)
    await expect(page.getByRole("heading", { name: /Wie oft nutzt du.*Föhn/i })).toBeVisible()
    await chooseAndContinue(page, "2x/Woche")
    await chooseNoneAndContinue(page)
    await expectStage3Category(page, "shampoo")
    const stage3ReadsBeforeSampling = stage3ClientReads
    const stage3Timing = await sampleNavigationToVisible({
      page,
      url: "/plan-start",
      ready: () => page.getByRole("heading", { name: "Dein Shampoo", exact: true }),
    })
    expect(stage3Timing.warm.p75Ms).toBeLessThanOrEqual(1_500)
    expect(stage3Timing.warm.p95Ms).toBeLessThanOrEqual(3_000)
    expect(stage3ClientReads - stage3ReadsBeforeSampling).toBe(9)
    await expectStage3Category(page, "shampoo")
    console.info(
      `personal_plan_seeded_local_timing ${JSON.stringify({
        environment: "isolated local Supabase + Next production server + Chromium",
        coldSamples: 1,
        warmSamples: 8,
        readyFirstPollTiming,
        stage1Timing,
        stage1ClientReads,
        stage3Timing,
        stage3ClientReadsPerNavigation: 1,
      })}`,
    )
    const { data: planBeforeStage3, error: planBeforeStage3Error } = await admin
      .from("personal_plans")
      .select("id,current_refined_need_version_id")
      .eq("user_id", userId)
      .single()
    if (planBeforeStage3Error || !planBeforeStage3.current_refined_need_version_id) {
      throw new Error(planBeforeStage3Error?.message ?? "refined plan pointer missing")
    }
    const stage3Response = await page.request.get(
      `/api/personal-plan/stage-3?${new URLSearchParams({
        personalPlanId: planBeforeStage3.id,
        refinedVersionId: planBeforeStage3.current_refined_need_version_id,
      })}`,
    )
    expect(stage3Response.status()).toBe(200)
    const stage3Journey = (await stage3Response.json()) as Stage3AuthoritySeed
    expect(stage3Journey.draft.authoritySnapshot.orderedCategories).toEqual(
      expect.arrayContaining(["shampoo", "conditioner", "scalp_care", "mask"]),
    )
    expect(stage3Journey.draft.authoritySnapshot.orderedCategories).not.toContain("heat_protectant")
    await seedStage3Catalog(admin, stage3Journey, userId)

    const captureCategories = stage3Journey.requirements
      .map(({ category }) => category)
      .filter((category) => !stage3Journey.draft.completedCaptureCategories.includes(category))
    const capturedCategories = new Set<string>()
    while (capturedCategories.size < captureCategories.length) {
      const category = await currentVisibleStage3Category(page, captureCategories)
      expect(capturedCategories.has(category)).toBe(false)
      await completeCurrentCategory(page, category)
      capturedCategories.add(category)
      if (capturedCategories.size === 1) {
        await page.reload()
        const resumedCategory = await currentVisibleStage3Category(page, captureCategories)
        expect(capturedCategories.has(resumedCategory)).toBe(false)
      }
    }
    expect([...capturedCategories].sort()).toEqual([...captureCategories].sort())

    const seen = new Set<string>()
    for (let decisions = 0; decisions < 24; decisions += 1) {
      const authorityState = await waitForStage3AuthorityState(page)
      if (authorityState === "complete") break
      if (authorityState === "grouped-clear-fits") {
        seen.add("owned")
        await expect(page.getByRole("heading", { name: "Diese Produkte passen" })).toBeVisible()
        await clickAndWaitForStage3Save(page, /\d+ passende Produkte übernehmen/)
        continue
      }
      const ownedAction = page.locator('button[data-stage3-action-kind="keep"]').first()
      const plannedAction = page.locator('button[data-stage3-action-kind="plan_purchase"]').first()
      const pendingAction = page.locator('button[data-stage3-action-kind="pending"]').first()
      if (await ownedAction.isVisible()) {
        seen.add("owned")
        await expect(
          page.getByText(/Passt (sehr gut|mit Einschränkung)/, { exact: true }),
        ).toBeVisible()
        await clickAndWaitForStage3AuthorityDecision(page, ownedAction)
      } else if (await plannedAction.isVisible()) {
        seen.add("planned")
        await clickAndWaitForStage3AuthorityDecision(page, plannedAction)
      } else if (await pendingAction.isVisible()) {
        seen.add("pending")
        await expect(page.getByText("Noch in Prüfung", { exact: true })).toBeVisible()
        await clickAndWaitForStage3AuthorityDecision(page, pendingAction)
      } else {
        const skipOrOverride = page
          .locator(
            'button[data-stage3-action-kind="skip"], button[data-stage3-action-kind="override"]',
          )
          .first()
        await expect(skipOrOverride).toBeVisible()
        const fallbackActionKind = await skipOrOverride.getAttribute("data-stage3-action-kind")
        const unknownVerdict = page.getByText("Noch nicht beurteilbar", { exact: true })
        if (await unknownVerdict.isVisible()) {
          seen.add("unknown")
          await expect(unknownVerdict).toBeVisible()
        } else if (fallbackActionKind === "skip") {
          await expect(
            page.getByText("Dieser Bedarf ist noch offen", { exact: true }),
          ).toBeVisible()
        } else {
          await expect(
            page.getByText("Passt nicht zu deinem Bedarf", { exact: true }),
          ).toBeVisible()
        }
        await clickAndWaitForStage3AuthorityDecision(page, skipOrOverride)
      }
    }
    expect(seen.has("owned")).toBe(true)
    expect(seen.has("pending")).toBe(true)

    await page.waitForURL("**/routine")
    expect(stage3CompletionRequests).toBe(1)
    await expect(page.getByRole("heading", { name: "Deine Routine ist bereit." })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Routine bestätigen" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Routine bestätigen", exact: true })).toHaveCount(
      0,
    )
    const shampooRoutineItem = page.getByRole("group", {
      name: /Kategorie: Shampoo; Produkt: E2E Sanftes Shampoo;.*Rhythmus: 2× pro Woche/,
    })
    const conditionerRoutineItem = page.getByRole("group", {
      name: /Kategorie: Conditioner; Produkt: E2E Leichter Conditioner;.*Rhythmus: Nach jeder passenden Haarwäsche/,
    })
    await expect(shampooRoutineItem).toBeVisible()
    await expect(conditionerRoutineItem).toBeVisible()
    await expect(shampooRoutineItem.getByText("Rhythmus", { exact: true })).toBeVisible()
    await expect(conditionerRoutineItem.getByText("Rhythmus", { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole("heading", { name: "Deine Routine ist bereit." })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole("heading", { name: "Routine bestätigen" })).toHaveCount(0)
    expect(routineProposalResolves).toBe(0)
    await expect(
      page.getByRole("group", {
        name: /Kategorie: Shampoo; Produkt: E2E Sanftes Shampoo;.*Rhythmus: 2× pro Woche/,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole("group", {
        name: /Kategorie: Conditioner; Produkt: E2E Leichter Conditioner;.*Rhythmus: Nach jeder passenden Haarwäsche/,
      }),
    ).toBeVisible()

    const { data: persisted, error } = await admin
      .from("personal_plans")
      .select(
        "id,current_initial_need_version_id,revision,pending_routine_proposal_id,active_routine_version_id",
      )
      .eq("user_id", userId)
      .single()
    if (error) throw new Error(error.message)
    expect(persisted.current_initial_need_version_id).toBeTruthy()
    expect(persisted.pending_routine_proposal_id).toBeNull()
    expect(persisted.active_routine_version_id).toBeTruthy()

    const applicationPointer = {
      revision: persisted.revision,
      active_routine_version_id: persisted.active_routine_version_id,
    }
    await page.getByRole("link", { name: "Anwendung", exact: true }).click()
    await page.waitForURL("**/anwendung")
    await expect(page.getByRole("heading", { name: "Anwendung", exact: true })).toBeVisible()
    await expect(page.getByRole("link", { name: "Waschtag" })).toBeVisible()
    await page.reload()
    await expect(page.getByRole("heading", { name: "Anwendung", exact: true })).toBeVisible()
    await expect(page.getByRole("link", { name: "Waschtag" })).toBeVisible()
    await page.goto("/anwendung/wash_day")
    await expect(page.getByRole("heading", { name: "Waschtag", exact: true })).toBeVisible()
    await expect(page.getByText("E2E Sanftes Shampoo", { exact: true }).first()).toBeVisible()
    await expect(page.getByText("E2E Leichter Conditioner", { exact: true }).first()).toBeVisible()
    await page.reload()
    await expect(page.getByRole("heading", { name: "Waschtag", exact: true })).toBeVisible()
    await expect(page.getByText("E2E Sanftes Shampoo", { exact: true }).first()).toBeVisible()
    await expect(page.getByText("E2E Leichter Conditioner", { exact: true }).first()).toBeVisible()
    await page.goto("/anwendung/intensive_care_day")
    await expect(
      page.getByRole("heading", { name: "Dieser Anwendungstag ist gerade nicht verfügbar" }),
    ).toBeVisible()
    await page.getByRole("link", { name: "Zur Übersicht" }).click()
    await expect(page.getByRole("heading", { name: "Anwendung", exact: true })).toBeVisible()
    const { data: afterApplication, error: afterApplicationError } = await admin
      .from("personal_plans")
      .select("revision,active_routine_version_id")
      .eq("user_id", userId)
      .single()
    if (afterApplicationError) throw new Error(afterApplicationError.message)
    expect(afterApplication).toEqual(applicationPointer)

    const foreign = await seedBuyer({ email: "stage15-foreign@hairconscierge.test", active: true })
    const foreignContext = await browser.newContext()
    try {
      const foreignPage = await foreignContext.newPage()
      await assertNoLabs(foreignPage)
      await login(foreignPage, "stage15-foreign@hairconscierge.test", "/plan-start")
      await foreignPage.waitForURL("**/plan-start")
      const deniedForeignRead = await foreignPage.request.get(
        `/api/personal-plan/stage-3?${new URLSearchParams({
          personalPlanId: persisted.id,
          refinedVersionId: planBeforeStage3.current_refined_need_version_id,
        })}`,
      )
      expect(deniedForeignRead.status()).toBe(409)
      await expect(deniedForeignRead.json()).resolves.toEqual({ error: "stage_not_ready" })
      const { data: foreignPlan, error: foreignPlanError } = await foreign.admin
        .from("personal_plans")
        .select("id,current_refined_need_version_id,active_routine_version_id")
        .eq("user_id", foreign.userId)
        .maybeSingle()
      if (foreignPlanError) throw new Error(foreignPlanError.message)
      expect(foreignPlan?.current_refined_need_version_id ?? null).toBeNull()
      expect(foreignPlan?.active_routine_version_id ?? null).toBeNull()
    } finally {
      await foreignContext.close()
    }
  })

  test("paid-pending buyer remains on the compact ready page and cannot reach a later stage", async ({
    page,
  }) => {
    test.skip(
      process.env.PERSONAL_PLAN_STAGE1_5_ISOLATED_BROWSER !== "1",
      "run through the isolated Stage 1–5 browser harness",
    )
    await assertNoLabs(page)
    const email = "stage15-pending@hairconscierge.test"
    const pending = await seedBuyer({ email, active: false, internal: true })

    await login(page, email, `/plan-bereit?lead=${pending.leadId}`)
    await page.waitForURL("**/plan-bereit**")
    const retryLink = page.getByRole("link", { name: "Status erneut prüfen" })
    await expect(retryLink).toBeVisible()
    const denied = await page.request.get("/api/personal-plan/stage-2")
    expect(denied.status()).toBe(409)
    await expect(denied.json()).resolves.toEqual({ error: "activation_pending" })

    await completeDisposableFulfillment(pending.admin, pending)
    await retryLink.click()
    await page.getByRole("link", { name: "Plan ansehen" }).click({ timeout: 15_000 })
    await page.waitForURL("**/plan-start")
  })
})
