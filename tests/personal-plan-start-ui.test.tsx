import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import {
  resolvePlanStartPageState,
  Stage1ProductExamplePreviewWarmup,
} from "../src/app/plan-start/page"
import {
  NeedCard,
  PlanStartFlow,
  PlanStartLoading,
  PlanStartRetryableError,
  PlanStartUnavailable,
  adaptInitialNeedSnapshotToPlanStartViewModel,
  applyStage1ProductExamplePreviews,
  interpretPlanStartApiResponse,
  type NeedCardViewModel,
  type PlanStartReadyViewModel,
} from "../src/components/personal-plan-start"
import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import {
  STAGE1_PRODUCT_EXAMPLE_PREVIEW_CACHE_CONTROL,
  stage1ProductExamplePreviewRequestUrl,
} from "../src/lib/personal-plan/product-preview-contract"
import type { InitialNeedPlanSnapshot, InitialProductPreview } from "../src/lib/personal-plan/types"
import type { PersonalPlanQuizSubmissionEnvelope } from "../src/lib/personal-plan-quiz/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

const baseDetailBlocks: NeedCardViewModel["detailBlocks"] = [
  {
    title: "Worauf es beim Produkt ankommt",
    body: "Sanft und zuverlässig reinigen, ohne stark entfettend zu sein.",
  },
  {
    title: "Warum das zu deinem Haar passt",
    body: "Deine Kopfhaut reagiert empfindlich und braucht eine sanfte Reinigungsrichtung.",
  },
  { title: "Empfohlener Rhythmus", body: "Zwei- bis dreimal pro Woche." },
]

function card(overrides: Partial<NeedCardViewModel> = {}): NeedCardViewModel {
  return {
    id: "shampoo",
    tone: "basis",
    categoryLabel: "Shampoo",
    statusLabel: "Basis",
    targetType: "Sanft reinigend",
    purpose: "Entfernt Talg und Rückstände, ohne deine empfindliche Kopfhaut unnötig zu reizen.",
    pills: ["sanft", "sensible Kopfhaut"],
    frequency: "2-3x pro Woche",
    imageUrl:
      "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/test.webp",
    detailBlocks: baseDetailBlocks,
    ...overrides,
  }
}

const readyPlan: PlanStartReadyViewModel = {
  personalPlanId: "plan-1",
  sourceInputHash: "input-1",
  basis: {
    kind: "basis",
    overline: "Dein persönlicher Plan",
    title: "Deine Basis",
    lead: "Basierend auf deiner Haaranalyse sind das die Grundlagen für deine Routine.",
    sectionTitle: "Von uns klar empfohlen",
    countLabel: "2 Kategorien",
    progress: 50,
    cards: [card(), card({ id: "conditioner", categoryLabel: "Conditioner", imageUrl: null })],
  },
  optional: {
    kind: "optional",
    overline: "Optionale Empfehlungen",
    title: "Zusätzlich sinnvoll",
    lead: "Basierend auf deiner Haaranalyse können diese Ergänzungen deine Ziele zusätzlich unterstützen.",
    sectionTitle: "Für deine Ziele",
    countLabel: "1 Vorschlag",
    progress: 100,
    cards: [
      card({
        id: "dry_shampoo",
        tone: "optional",
        categoryLabel: "Trockenshampoo",
        statusLabel: "Pausiert",
        targetType: "Aktuell nicht anwenden",
        paused: true,
        initiallyOpen: true,
        frequency: "später: bei Bedarf",
      }),
    ],
  },
}

test("warms only the image origin in server-rendered Stage 1 HTML, without a wasted no-store preload", () => {
  const previewUrl = stage1ProductExamplePreviewRequestUrl({
    personalPlanId: "plan-1",
    sourceInputHash: "input-1",
  })
  const html = renderToStaticMarkup(
    <Stage1ProductExamplePreviewWarmup
      initialJourney={{ stage: "stage1" }}
      initialPlan={readyPlan}
    />,
  )

  assert.equal(
    previewUrl,
    "/api/personal-plan/stage-1/previews?personalPlanId=plan-1&sourceInputHash=input-1",
  )
  assert.match(html, /rel="preconnect" href="https:\/\/pqdkhefxsxkyeqelqegq\.supabase\.co"/)
  // The preview response is Cache-Control: no-store (see below), so a
  // rel=preload as=fetch hint for it can never be reused by the client's
  // real fetch — it would only add a second, wasted request. Product
  // images stay cacheable, so only the storage-origin preconnect remains.
  assert.doesNotMatch(html, /rel="preload"/)
  assert.equal(STAGE1_PRODUCT_EXAMPLE_PREVIEW_CACHE_CONTROL, "no-store")
})

test("binds only source-matched authority previews to their exact category cards", () => {
  const response = {
    schemaVersion: 2 as const,
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    sourceInputHash: "input-1",
    previews: [
      {
        kind: "recommendation" as const,
        category: "conditioner" as const,
        role: "conditioner_rinse_out" as const,
        decisionKey: "decision:conditioner:conditioner_rinse_out:gap",
        productId: "conditioner-light",
        productName: "Leichter Conditioner",
        imageUrl: "https://example.com/conditioner-light.webp",
        verdict: "ideal" as const,
        authorityVersion: "personal-plan.conditioner.v3",
        factFingerprint: "facts-conditioner-light",
        commerce: {
          priceEur: 9.9,
          purchaseLinkStatus: "available" as const,
          netContentValue: 200,
          netContentUnit: "ml" as const,
          priceLabel: "9,90 €",
          netContentLabel: "200 ml",
          availabilityLabel: "Aktuell verfügbar",
          productUrl: "https://example.com/conditioner-light",
          affiliateDisclosure:
            "Affiliate-Hinweis: Bei einem Kauf über diesen Link erhalten wir möglicherweise eine Provision.",
        },
        reasoning: {
          productCriteria: "Pflege, Glättung und Kämmbarkeit passend zum Gewicht deines Haars.",
          fit: "Deine Längen brauchen nach der Wäsche eine verlässliche Basispflege.",
          frequency: "nach jeder Haarwäsche",
        },
      },
    ],
  }

  const applied = applyStage1ProductExamplePreviews(readyPlan, response)
  assert.equal(
    applied.basis.cards.find((item) => item.id === "conditioner")?.imageUrl,
    "https://example.com/conditioner-light.webp",
  )
  assert.match(
    applied.basis.cards.find((item) => item.id === "conditioner")?.imageAlt ?? "",
    /Leichter Conditioner.*finale Produktauswahl/,
  )
  assert.equal(
    applyStage1ProductExamplePreviews(readyPlan, {
      ...response,
      sourceInputHash: "stale-input",
    }),
    readyPlan,
  )
})

function computedSnapshot(
  answers: PersonalPlanQuizSubmissionEnvelope["answers"] = COMPLETE_V3_PLAN_ENVELOPE.answers,
): InitialNeedPlanSnapshot {
  const result = computeNeedPlan({
    rawEnvelope: { ...COMPLETE_V3_PLAN_ENVELOPE, answers },
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-07T12:00:00.000Z",
  })
  assert.equal(result.status, "ready")
  if (result.status !== "ready") throw new Error("expected ready Stage-1 snapshot")
  return result.snapshot
}

function withPreviews(
  snapshot: InitialNeedPlanSnapshot,
  productPreviews: InitialProductPreview[],
): InitialNeedPlanSnapshot {
  return { ...snapshot, productPreviews }
}

test("renders the signed-off Basis shell with folded cards and example-preview geometry", () => {
  const html = renderToStaticMarkup(<PlanStartFlow state="ready" plan={readyPlan} />)

  assert.match(html, /data-plan-start-screen="basis"/)
  assert.match(html, /Deine Basis/)
  assert.match(html, /Basierend auf deiner Haaranalyse sind das die Grundlagen/)
  assert.match(html, /Optionale Empfehlungen/)
  assert.match(html, /data-plan-start-card-preview="example"/)
  assert.match(
    html,
    /Bilder zeigen nur Beispiele für die Produktart\. Ein konkretes Produkt wählen wir später\./,
  )
  assert.match(html, />Beispiel<\/span>/)
  assert.match(html, /data-plan-start-card-preview="absent"/)
  assert.match(html, /data-plan-start-card-image-slot="reserved"/)
  assert.match(html, /aria-expanded="false"/)
  assert.doesNotMatch(html, /Zusätzlich sinnvoll/)
  assert.match(
    html,
    /<link rel="preload" as="image" href="https:\/\/pqdkhefxsxkyeqelqegq\.supabase\.co\/storage\/v1\/object\/public\/product-images\/test\.webp"/,
  )
})

test("omits the Optional page and progress step when no optional categories exist", () => {
  const html = renderToStaticMarkup(
    <PlanStartFlow
      state="ready"
      plan={{ basis: { ...readyPlan.basis, progress: 100 }, optional: null }}
      onContinueToRefinement={() => {}}
    />,
  )

  assert.match(html, /data-plan-start-has-optional="false"/)
  assert.match(html, /Auf meine Produkte abstimmen/)
  assert.doesNotMatch(html, /Optionale Empfehlungen/)

  const withoutContinuation = renderToStaticMarkup(
    <PlanStartFlow
      state="ready"
      plan={{ basis: { ...readyPlan.basis, progress: 100 }, optional: null }}
    />,
  )
  assert.doesNotMatch(withoutContinuation, /Jetzt auf meine Produkte abstimmen/)
  assert.doesNotMatch(withoutContinuation, /aria-label="Idealplan-Seiten"/)
})

test("Optional Idealplan uses the shared header Back and a forward-only safe-area dock", () => {
  const html = renderToStaticMarkup(
    <PlanStartFlow
      state="ready"
      plan={readyPlan}
      initialStep="optional"
      onContinueToRefinement={() => {}}
    />,
  )

  assert.match(html, /data-plan-start-screen="optional"/)
  assert.match(html, /aria-label="Zur Basis"/)
  assert.doesNotMatch(html, />Zur Basis</)
  assert.match(html, /pb-\[calc\(0\.625rem\+env\(safe-area-inset-bottom\)\)\]/)
  assert.match(html, /min-w-0 w-full whitespace-normal/)
})

test("Stage 1-only keeps signed Basis and Optional pages but removes the refinement transition", () => {
  const basis = renderToStaticMarkup(
    <PlanStartFlow state="ready" plan={readyPlan} refinementAvailable={false} />,
  )
  const terminalBasis = renderToStaticMarkup(
    <PlanStartFlow
      state="ready"
      plan={{ basis: { ...readyPlan.basis, progress: 100 }, optional: null }}
      refinementAvailable={false}
    />,
  )

  assert.match(basis, /Optionale Empfehlungen/)
  assert.doesNotMatch(
    basis,
    /Plan wirklich zu meinem machen|Plan verfeinern|Auf meine Produkte abstimmen/,
  )
  assert.doesNotMatch(
    terminalBasis,
    /Plan wirklich zu meinem machen|Plan verfeinern|Auf meine Produkte abstimmen/,
  )
})

test("renders paused cards as visible included categories with need details", () => {
  const html = renderToStaticMarkup(<NeedCard card={readyPlan.optional!.cards[0]!} />)

  assert.match(html, /data-plan-start-card-paused="true"/)
  assert.match(html, /Pausiert/)
  assert.match(html, /Aktuell nicht anwenden/)
  assert.match(html, /Was dein Haar braucht/)
  assert.match(html, /aria-expanded="true"/)
})

test("renders every Stage 1 category with its approved shell and dot palette", () => {
  const categoryStyles = {
    shampoo: ["bg-[#F5F0E5]", "border-[#E2D4B8]", "bg-[#A77D31]"],
    conditioner: ["bg-[#EDF3F5]", "border-[#CFDEE3]", "bg-[#4C8EA8]"],
    leave_in: ["bg-[#EDF4F0]", "border-[#CEDFD5]", "bg-[#56866B]"],
    heat_protectant: ["bg-[#F5F0EA]", "border-[#E5D6C8]", "bg-[#B76A3E]"],
    oil: ["bg-[#F5EDEF]", "border-[#E2D0D4]", "bg-[#A85F70]"],
    mask: ["bg-[#F1EEF5]", "border-[#DCD3E5]", "bg-[#7D67A8]"],
    scalp_care: ["bg-[#EBF3F2]", "border-[#CADEDB]", "bg-[#2F817A]"],
    dry_shampoo: ["bg-[#F1F3E9]", "border-[#DCE2C6]", "bg-[#7D913F]"],
    bondbuilder: ["bg-[#F4EDF3]", "border-[#E2D1DF]", "bg-[#985D8F]"],
    deep_cleansing_shampoo: ["bg-[#F5F2E5]", "border-[#E2DBC0]", "bg-[#998323]"],
  } as const

  for (const [id, expectedClasses] of Object.entries(categoryStyles)) {
    const html = renderToStaticMarkup(<NeedCard card={card({ id, imageUrl: null })} />)
    for (const expectedClass of expectedClasses) {
      assert.ok(html.includes(expectedClass), `expected ${id} to include ${expectedClass}`)
    }
  }
})

test("keeps Optional and Pausiert as explicit status text without replacing category styling", () => {
  const optional = renderToStaticMarkup(
    <NeedCard
      card={card({
        id: "oil",
        tone: "optional",
        statusLabel: "Optional",
        imageUrl: card().imageUrl,
      })}
    />,
  )
  const paused = renderToStaticMarkup(<NeedCard card={readyPlan.optional!.cards[0]!} />)

  assert.match(optional, /Optional/)
  assert.match(optional, /bg-\[#F5EDEF\]/)
  assert.match(optional, /border-\[#E2D0D4\]/)
  assert.match(optional, /bg-\[#A85F70\]/)
  assert.doesNotMatch(optional, /opacity-75|saturate-\[0\.72\]/)

  assert.match(paused, /Pausiert/)
  assert.match(paused, /Aktuell nicht anwenden/)
  assert.match(paused, /bg-\[#F1F3E9\]/)
  assert.match(paused, /border-\[#DCE2C6\]/)
  assert.match(paused, /bg-\[#7D913F\]/)
  assert.doesNotMatch(paused, /bg-\[rgba\(220,180,60,0\.12\)\]|bg-\[#C8A038\]/)
})

test("uses a neutral shell and dot for malformed legacy category IDs", () => {
  const html = renderToStaticMarkup(
    <NeedCard card={card({ id: "legacy-category", imageUrl: null })} />,
  )

  assert.match(html, /border-\[rgba\(31,26,20,0\.07\)\] bg-white/)
  assert.match(html, /rounded-full bg-\[#6B50A0\]/)
})

test("renders loading and retry states without questions or legacy destinations", () => {
  const loading = renderToStaticMarkup(<PlanStartLoading />)
  const retry = renderToStaticMarkup(<PlanStartRetryableError />)

  assert.match(loading, /Dein Idealplan entsteht/)
  assert.match(retry, /Dein Plan lädt gerade nicht/)
  assert.match(retry, /Erneut versuchen/)
  assert.doesNotMatch(`${loading}${retry}`, /Quiz starten|href="\/chat"|href="\/routine"/)
})

test("the customer path has no redundant Stage 1 transition before the Stage 2 invitation", () => {
  const source = readFileSync("src/components/personal-plan-start/plan-start-flow.tsx", "utf8")
  const barrel = readFileSync("src/components/personal-plan-start/index.tsx", "utf8")

  assert.doesNotMatch(source, /PlanStartTransition|step === ["']transition["']/)
  assert.doesNotMatch(barrel, /PlanStartTransition/)
})

test("renders compact unavailable state H with profile and support exits", () => {
  const html = renderToStaticMarkup(<PlanStartUnavailable />)

  assert.match(html, /data-plan-start-state="unavailable"/)
  assert.match(html, /Dieser Planbereich ist gerade nicht verfügbar/)
  assert.match(html, /href="\/profile"/)
  assert.match(html, /Zum Profil/)
  assert.match(html, /href="\/kontakt"/)
  assert.match(html, /Support kontaktieren/)
  assert.doesNotMatch(html, /\/chat|\/routine|\/onboarding|\/quiz/)
})

test("the production page uses released defaults instead of reading a launch flag", () => {
  const source = readFileSync("src/app/plan-start/page.tsx", "utf8")
  assert.match(source, /enabled: isPersonalPlanAppV1Enabled/)
  assert.match(source, /stage2Enabled: isPersonalPlanStage2Enabled/)
  assert.doesNotMatch(source, /process\.env\.PERSONAL_PLAN_(?:APP_V1|STAGE2)/)
})

test("the production page exposes only the admitted Stage 1 gate and sends delayed provisioning to its compact wait page", async () => {
  assert.deepEqual(
    await resolvePlanStartPageState({
      enabled: () => true,
      stage2Enabled: () => true,
      getUserId: async () => "owner-1",
      loadJourneyAccess: async () => ({ kind: "paid_pending", recoveryHref: "/plan-bereit" }),
      loadExistingRefinementSession: async () => null,
    }),
    { state: "paid_pending" },
  )
  assert.deepEqual(
    await resolvePlanStartPageState({
      enabled: () => true,
      stage2Enabled: () => true,
      getUserId: async () => "owner-1",
      loadJourneyAccess: async () => ({ kind: "legacy" }),
      loadExistingRefinementSession: async () => null,
    }),
    { state: "unavailable" },
  )
  assert.deepEqual(
    await resolvePlanStartPageState({
      enabled: () => true,
      stage2Enabled: () => true,
      getUserId: async () => "owner-1",
      loadJourneyAccess: async () => ({
        kind: "personal_plan_start",
        frontier: "stage1",
        nextHref: "/plan-start",
        allowed: { stage1: true, stage2: false, stage3: false, stage4: false, stage5: false },
      }),
      loadExistingRefinementSession: async () => null,
    }),
    { state: "production", initialJourney: { stage: "stage1" } },
  )
})

test("the production page passes the Stage 2 gate independently of Stage 1 plan creation", async () => {
  assert.deepEqual(
    await resolvePlanStartPageState({
      enabled: () => true,
      stage2Enabled: () => false,
      getUserId: async () => "owner-1",
      loadJourneyAccess: async () => ({
        kind: "personal_plan_start",
        frontier: "stage1",
        nextHref: "/plan-start",
        allowed: { stage1: true, stage2: false, stage3: false, stage4: false, stage5: false },
      }),
      loadExistingRefinementSession: async () => null,
    }),
    { state: "production", initialJourney: { stage: "stage1", refinementAvailable: false } },
  )
})

test("the production page resolves the idempotent Stage 1 view model before hydration", async () => {
  let stage1Loads = 0
  const result = await resolvePlanStartPageState({
    enabled: () => true,
    stage2Enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => ({
      kind: "personal_plan_start",
      frontier: "stage1",
      nextHref: "/plan-start",
      allowed: { stage1: true, stage2: false, stage3: false, stage4: false, stage5: false },
    }),
    loadExistingRefinementSession: async () => null,
    loadStage1Plan: async () => {
      stage1Loads += 1
      return readyPlan
    },
  })

  assert.equal(stage1Loads, 1)
  assert.match(
    readFileSync("src/app/plan-start/page.tsx", "utf8"),
    /createStage1PersistenceService[\s\S]*\.loadOrCreate\(\{ userId \}\)/,
  )
  assert.deepEqual(result, {
    state: "production",
    initialJourney: { stage: "stage1" },
    initialPlan: readyPlan,
  })
})

test("the enabled production gate maps ineligible API responses to unavailable H", () => {
  assert.equal(
    interpretPlanStartApiResponse(404, { error: "personal_plan_not_available" }).state,
    "unavailable",
  )
  assert.equal(
    interpretPlanStartApiResponse(409, { error: "activation_pending" }).state,
    "retryable_error",
  )
  assert.equal(
    interpretPlanStartApiResponse(503, { error: "temporarily_unavailable" }).state,
    "retryable_error",
  )
  assert.equal(
    interpretPlanStartApiResponse(200, { status: "completed", outputSnapshot: {} }).state,
    "retryable_error",
  )
})

test("does not substitute category-only images for live authority previews", () => {
  const snapshot = withPreviews(
    computedSnapshot({
      ...COMPLETE_V3_PLAN_ENVELOPE.answers,
      scalpOiliness: "oily",
      scalpConcerns: ["irritated"],
    }),
    [
      {
        category: "conditioner",
        state: "absent",
        reason: "image_missing",
        selectionRuleIds: ["test.absent"],
        selectionVersion: "test-v1",
      },
      {
        category: "shampoo",
        state: "selected",
        productId: "product-shampoo",
        productName: "Salthouse Anti-Juckreiz Shampoo",
        imageUrl:
          "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/test-shampoo.webp",
        previewRole: "shampoo_everyday",
        verdict: "ideal",
        selectionRuleIds: ["test.selected"],
        selectionVersion: "test-v1",
      },
    ],
  )

  const plan = adaptInitialNeedSnapshotToPlanStartViewModel(snapshot)
  assert.ok(plan)
  assert.equal(plan.basis.title, "Deine Basis")
  const shampoo = plan.basis.cards.find((item) => item.categoryLabel === "Shampoo")
  const conditioner = plan.basis.cards.find((item) => item.categoryLabel === "Conditioner")
  assert.equal(shampoo?.imageUrl, null)
  assert.equal(conditioner?.imageUrl, null)
  assert.ok(plan.optional)
  assert.ok(plan.optional.cards.some((item) => item.id === "bondbuilder"))
  assert.ok(plan.optional.cards.some((item) => item.paused))

  const interpreted = interpretPlanStartApiResponse(200, {
    status: "completed",
    outputSnapshot: snapshot,
  })
  assert.equal(interpreted.state, "ready")
  if (interpreted.state !== "ready") return
  const html = renderToStaticMarkup(<PlanStartFlow state="ready" plan={interpreted.plan} />)
  assert.match(html, /Deine Basis/)
  assert.doesNotMatch(html, /data-plan-start-card-preview="example"/)
  assert.match(html, /data-plan-start-card-preview="absent"/)
})

test("adapts Basis-only snapshots without an empty Optional page", () => {
  const snapshot = computedSnapshot({
    ...COMPLETE_V3_PLAN_ENVELOPE.answers,
    texture: "straight",
    thickness: "normal",
    density: "medium",
    goals: ["scalp_balance"],
    currentConcerns: [],
    concernRecurrence: undefined,
    hairLength: "medium",
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
    scalpOiliness: "balanced",
    scalpConcerns: [],
  })
  const plan = adaptInitialNeedSnapshotToPlanStartViewModel(snapshot)

  assert.ok(plan)
  assert.equal(plan.optional, null)
  assert.equal(plan.basis.progress, 100)
  const html = renderToStaticMarkup(
    <PlanStartFlow state="ready" plan={plan} onContinueToRefinement={() => {}} />,
  )
  assert.match(html, /Auf meine Produkte abstimmen/)
  assert.doesNotMatch(html, /Optionale Empfehlungen/)
})

test("a missing Optional page normalizes an Optional return to Basis", () => {
  const snapshot = computedSnapshot({
    ...COMPLETE_V3_PLAN_ENVELOPE.answers,
    texture: "straight",
    thickness: "normal",
    density: "medium",
    goals: ["scalp_balance"],
    currentConcerns: [],
    concernRecurrence: undefined,
    hairLength: "medium",
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
    scalpOiliness: "balanced",
    scalpConcerns: [],
  })
  const plan = adaptInitialNeedSnapshotToPlanStartViewModel(snapshot)

  assert.ok(plan)
  assert.equal(plan.optional, null)
  const html = renderToStaticMarkup(
    <PlanStartFlow state="ready" plan={plan} initialStep="optional" />,
  )
  assert.match(html, /Deine Basis/)
  assert.doesNotMatch(html, /aria-label="Zur Basis"/)
})

test("the final Stage 1 CTA enters the first Stage 2 question without an invitation screen", () => {
  const componentSource = readFileSync(
    "src/components/personal-plan-start/plan-start-flow.tsx",
    "utf8",
  )
  assert.doesNotMatch(componentSource, /setStep\("transition"\)/)
  assert.match(componentSource, /props\.onContinueToRefinement\?\.\("optional"\)/)
  assert.match(componentSource, /props\.onContinueToRefinement\?\.\("basis"\)/)
  assert.match(componentSource, /directEntry/)
})

test("preserves paused included categories from the saved snapshot", () => {
  const snapshot = computedSnapshot({
    ...COMPLETE_V3_PLAN_ENVELOPE.answers,
    scalpOiliness: "oily",
    scalpConcerns: ["irritated"],
  })
  const plan = adaptInitialNeedSnapshotToPlanStartViewModel(snapshot)

  assert.ok(plan)
  assert.ok(plan.optional)
  const paused = plan.optional.cards.find((item) => item.paused)
  assert.ok(paused)
  assert.equal(paused.statusLabel, "Pausiert")
  assert.equal(paused.targetType, "Aktuell nicht anwenden")
})

test("untreated rough-surface Lea gets no Bondbuilder card or chemical-stress presentation", () => {
  const snapshot = computedSnapshot({
    ...COMPLETE_V3_PLAN_ENVELOPE.answers,
    chemicalTreatments: ["natural"],
    currentConcerns: [],
    concernRecurrence: undefined,
    hairSurface: "rough",
    elasticResponse: "stretches_bounces",
  })
  const plan = adaptInitialNeedSnapshotToPlanStartViewModel(snapshot)

  assert.ok(plan)
  const html = renderToStaticMarkup(<PlanStartFlow state="ready" plan={plan} />)
  assert.doesNotMatch(html, /data-plan-start-card="bondbuilder"/)
  assert.doesNotMatch(html, /chemisch beansprucht|chemisch gestresst/i)
})

test("Bondbuilder presentation names chemical stress only for chemical-treatment reasons", () => {
  const untreated = adaptInitialNeedSnapshotToPlanStartViewModel(
    computedSnapshot({
      ...COMPLETE_V3_PLAN_ENVELOPE.answers,
      chemicalTreatments: ["natural"],
      currentConcerns: ["breakage"],
      concernRecurrence: { concernId: "breakage", frequency: "often" },
      hairSurface: "smooth",
      elasticResponse: "stretches_bounces",
    }),
  )
  const treated = adaptInitialNeedSnapshotToPlanStartViewModel(
    computedSnapshot({
      ...COMPLETE_V3_PLAN_ENVELOPE.answers,
      chemicalTreatments: ["colored"],
      currentConcerns: [],
      concernRecurrence: undefined,
      hairSurface: "smooth",
      elasticResponse: "stretches_bounces",
    }),
  )

  assert.ok(untreated)
  assert.ok(treated)
  const untreatedCard = [...untreated.basis.cards, ...(untreated.optional?.cards ?? [])].find(
    (item) => item.id === "bondbuilder",
  )
  const treatedCard = [...treated.basis.cards, ...(treated.optional?.cards ?? [])].find(
    (item) => item.id === "bondbuilder",
  )
  assert.ok(untreatedCard)
  assert.ok(treatedCard)
  assert.doesNotMatch(JSON.stringify(untreatedCard), /chemisch/i)
  assert.match(JSON.stringify(treatedCard), /chemisch/i)
})

test("invalid or unsupported snapshots fail closed to retryable error", () => {
  assert.equal(adaptInitialNeedSnapshotToPlanStartViewModel({}), null)
  assert.equal(
    adaptInitialNeedSnapshotToPlanStartViewModel({
      ...computedSnapshot(),
      schemaVersion: 999,
    }),
    null,
  )
  assert.equal(
    interpretPlanStartApiResponse(200, {
      status: "completed",
      outputSnapshot: { ...computedSnapshot(), snapshotKind: "unexpected" },
    }).state,
    "retryable_error",
  )
})

test("mobile containment is guarded by fixed card tracks and bounded text", () => {
  const cardSource = readFileSync("src/components/personal-plan-start/need-card.tsx", "utf8")
  const screenSource = readFileSync(
    "src/components/personal-plan-start/need-plan-screen.tsx",
    "utf8",
  )
  const componentSource = readFileSync(
    "src/components/personal-plan-start/plan-start-flow.tsx",
    "utf8",
  )
  const adapterSource = readFileSync(
    "src/components/personal-plan-start/snapshot-adapter.ts",
    "utf8",
  )
  const pageSource = readFileSync("src/app/plan-start/page.tsx", "utf8")

  assert.match(cardSource, /grid-cols-\[66px_minmax\(0,1fr\)_16px\]/)
  assert.match(cardSource, /max-\[360px\]:h-\[76px\]/)
  assert.match(cardSource, /line-clamp-2/)
  assert.match(cardSource, /truncate/)
  assert.match(screenSource, /max-w-\[430px\]/)
  assert.match(screenSource, /fixed inset-x-0 bottom-0/)
  assert.doesNotMatch(screenSource, /segmented|tablist|Basis\/Optional/)
  assert.doesNotMatch(pageSource, /stage-1\/route|handleStage1LoadOrCreate|computeNeedPlan/)
  assert.match(pageSource, /PlanStartProductionGate/)
  assert.doesNotMatch(
    `${componentSource}${adapterSource}`,
    /labs\/personal-plan|STAGE1_STAGE2|fixture/i,
  )
})
