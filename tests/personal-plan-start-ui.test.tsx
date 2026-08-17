import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import {
  resolvePlanStartPageState,
  Stage1ProductExamplePreviewWarmup,
} from "../src/app/plan-start/page"
import {
  NEED_CARD_FALLBACK_NOTE,
  NeedCard,
  NeedPlanScreen,
  PLAN_START_CATALOG_DISCLAIMER,
  PLAN_START_PENDING_DISCLAIMER,
  PRODUCT_REFINEMENT_HINT,
  PlanStartFlow,
  PlanStartLoading,
  PlanStartRetryableError,
  PlanStartUnavailable,
  ProductDetailSheetBody,
  adaptInitialNeedSnapshotToPlanStartViewModel,
  applyStage1ProductExamplePreviews,
  interpretPlanStartApiResponse,
  isNeedCardGroup,
  planStartProductDisclaimer,
  type NeedCardGroupViewModel,
  type NeedCardViewModel,
  type PlanStartCardViewModel,
  type PlanStartReadyViewModel,
} from "../src/components/personal-plan-start"
import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import { roleFrequencyLabel } from "../src/lib/personal-plan/decision-presentation"
import {
  STAGE1_PRODUCT_EXAMPLE_PREVIEW_CACHE_CONTROL,
  stage1ProductExamplePreviewRequestUrl,
} from "../src/lib/personal-plan/product-preview-contract"
import type { InitialNeedPlanSnapshot, InitialProductPreview } from "../src/lib/personal-plan/types"
import type { PersonalPlanQuizSubmissionEnvelope } from "../src/lib/personal-plan-quiz/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

/** Narrows a `PlanStartCardViewModel`, failing loudly if it turns out to be a group. */
function asCard(item: PlanStartCardViewModel | undefined | null): NeedCardViewModel {
  assert.ok(item, "expected a card")
  assert.ok(!isNeedCardGroup(item), "expected a single card, not a group")
  return item
}

/** Narrows a `PlanStartCardViewModel`, failing loudly if it turns out to be a single card. */
function asGroup(item: PlanStartCardViewModel | undefined | null): NeedCardGroupViewModel {
  assert.ok(item, "expected a group")
  assert.ok(isNeedCardGroup(item), "expected a group, not a single card")
  return item
}

/** Finds a single (non-group) card among a screen's cards by predicate. */
function findCard(
  cards: PlanStartCardViewModel[],
  predicate: (item: PlanStartCardViewModel) => boolean,
): NeedCardViewModel | undefined {
  const found = cards.find(predicate)
  return found ? asCard(found) : undefined
}

test("roleFrequencyLabel renders role cadence for role_based_wash_linked", () => {
  const basisFrequency = {
    kind: "role_based_wash_linked" as const,
    roleFrequencies: [
      {
        role: "pre_wash_fibre_treatment" as const,
        tier: "basis" as const,
        cadence: "before_every_compatible_wash" as const,
      },
      {
        role: "leave_on_fibre_conditioning" as const,
        tier: "basis" as const,
        cadence: "after_every_compatible_wash" as const,
      },
      {
        role: "dry_finish" as const,
        tier: "basis" as const,
        cadence: "finish_after_every_compatible_wash" as const,
      },
    ],
  }
  const optionalFrequency = {
    kind: "role_based_wash_linked" as const,
    roleFrequencies: [
      {
        role: "dry_finish" as const,
        tier: "optional" as const,
        cadence: "optional_allocation_deferred_to_day_type" as const,
      },
    ],
  }
  assert.equal(
    roleFrequencyLabel(basisFrequency, "pre_wash_fibre_treatment", false),
    "vor jeder passenden Haarwäsche",
  )
  assert.equal(
    roleFrequencyLabel(basisFrequency, "leave_on_fibre_conditioning", false),
    "nach jeder passenden Haarwäsche",
  )
  assert.equal(
    roleFrequencyLabel(basisFrequency, "dry_finish", false),
    "als Finish nach jeder Haarwäsche",
  )
  assert.equal(roleFrequencyLabel(optionalFrequency, "dry_finish", false), "nach Bedarf")
  // A role this frequency's `roleFrequencies` doesn't cover at all falls
  // back to the category-level label (which is also "nach Bedarf" for this
  // frequency kind) — a real `PlanProductRole`, just not one of the three
  // this particular oil decision resolved.
  assert.equal(roleFrequencyLabel(basisFrequency, "scalp_comfort", false), "nach Bedarf")
  assert.equal(roleFrequencyLabel(null, "dry_finish", true), "später: nach Klärung")
})

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

const productFixture: NonNullable<NeedCardViewModel["product"]> = {
  name: "Redken All Soft Shampoo",
  priceLabel: "17,95 €",
  netContentLabel: "300 ml",
  availabilityLabel: "Aktuell verfügbar",
  purchaseLinkStatus: "available",
  productUrl: "https://example.com/redken",
}

function card(overrides: Partial<NeedCardViewModel> = {}): NeedCardViewModel {
  return {
    id: "shampoo",
    category: "shampoo",
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
    cards: [
      card(),
      card({
        id: "conditioner",
        category: "conditioner",
        categoryLabel: "Conditioner",
        imageUrl: null,
        frequencyTarget: {
          kind: "after_each_eligible_wash",
          roles: ["conditioner_rinse_out"],
          dependsOn: "wet_wash_total",
          placementState: "known",
        },
      }),
    ],
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
        category: "dry_shampoo",
        tone: "optional",
        categoryLabel: "Trockenshampoo",
        statusLabel: "Pausiert",
        targetType: "Aktuell nicht anwenden",
        paused: true,
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
    directAcceptance: { available: true as const },
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
  const conditioner = findCard(applied.basis.cards, (item) => item.id === "conditioner")
  assert.equal(conditioner?.imageUrl, "https://example.com/conditioner-light.webp")
  assert.equal(conditioner?.imageAlt, "Produktbild: Leichter Conditioner")
  assert.deepEqual(conditioner?.product, {
    name: "Leichter Conditioner",
    priceLabel: "9,90 €",
    netContentLabel: "200 ml",
    availabilityLabel: "Aktuell verfügbar",
    purchaseLinkStatus: "available",
    productUrl: "https://example.com/conditioner-light",
  })
  // The card reasoning now comes from the recommended product, not from the
  // generic category presentation.
  assert.deepEqual(conditioner?.detailBlocks, [
    {
      title: "Worauf es beim Produkt ankommt",
      body: "Pflege, Glättung und Kämmbarkeit passend zum Gewicht deines Haars.",
    },
    {
      title: "Warum das zu deinem Haar passt",
      body: "Deine Längen brauchen nach der Wäsche eine verlässliche Basispflege.",
    },
    { title: "Empfohlener Rhythmus", body: "nach jeder Haarwäsche" },
  ])
  // Categories without a payload entry keep no stale product.
  assert.equal(
    findCard(applied.basis.cards, (item) => item.id === "shampoo")?.product ?? null,
    null,
  )
  assert.equal(
    applyStage1ProductExamplePreviews(readyPlan, {
      ...response,
      sourceInputHash: "stale-input",
    }),
    readyPlan,
  )
})

function recommendation(overrides: Record<string, unknown> = {}) {
  return {
    kind: "recommendation" as const,
    category: "shampoo" as const,
    role: "shampoo_everyday" as const,
    decisionKey: "decision:shampoo:shampoo_everyday:gap",
    productId: "redken-all-soft",
    productName: "Redken All Soft Shampoo",
    imageUrl: "https://example.com/redken.webp",
    verdict: "ideal" as const,
    authorityVersion: "personal-plan.shampoo.v3",
    factFingerprint: "facts-redken",
    commerce: {
      priceEur: 17.95,
      purchaseLinkStatus: "available" as const,
      netContentValue: 300,
      netContentUnit: "ml" as const,
      priceLabel: "17,95 €",
      netContentLabel: "300 ml",
      availabilityLabel: "Aktuell verfügbar",
      productUrl: "https://example.com/redken",
      affiliateDisclosure: null,
    },
    reasoning: {
      productCriteria: "Sanfte Tenside, die reinigen, ohne die Kopfhaut auszutrocknen.",
      fit: "Deine Kopfhaut braucht sanfte Reinigung.",
      frequency: "2x pro Woche",
    },
    ...overrides,
  }
}

function previewResponse(previews: unknown[]) {
  return {
    schemaVersion: 2 as const,
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    sourceInputHash: "input-1",
    directAcceptance: { available: true },
    previews,
  } as Parameters<typeof applyStage1ProductExamplePreviews>[1]
}

test("a fallback role turns the category card into the honest post-refinement state", () => {
  const applied = applyStage1ProductExamplePreviews(
    readyPlan,
    previewResponse([
      {
        kind: "fallback",
        category: "shampoo",
        role: "shampoo_everyday",
        decisionKey: "decision:shampoo:shampoo_everyday:gap",
        authorityVersion: "personal-plan.shampoo.v3",
        fallback: "post_refinement",
      },
    ]),
  )
  const shampoo = findCard(applied.basis.cards, (item) => item.id === "shampoo")

  assert.equal(shampoo?.product ?? null, null)
  assert.equal(shampoo?.fallbackNote, NEED_CARD_FALLBACK_NOTE)
  assert.equal(shampoo?.imageUrl, null)
  assert.equal(shampoo?.imageAlt, "Noch kein Produktbild für Shampoo.")
  // The generic category reasoning survives so the sheet still explains the need.
  assert.deepEqual(shampoo?.detailBlocks, baseDetailBlocks)
})

test("a real recommendation for any role beats a fallback for the same category", () => {
  const applied = applyStage1ProductExamplePreviews(
    readyPlan,
    previewResponse([
      {
        kind: "fallback",
        category: "shampoo",
        role: "shampoo_everyday",
        decisionKey: "decision:shampoo:shampoo_everyday:gap",
        authorityVersion: "personal-plan.shampoo.v3",
        fallback: "post_refinement",
      },
      recommendation({
        role: "shampoo_dandruff",
        decisionKey: "decision:shampoo:shampoo_dandruff:gap",
        productName: "Anti-Schuppen Shampoo",
      }),
    ]),
  )

  assert.equal(
    findCard(applied.basis.cards, (item) => item.id === "shampoo")?.product?.name,
    "Anti-Schuppen Shampoo",
  )
})

test("same-tier roles of a multi-role category group into one card, each wearing its own role copy", () => {
  const applied = applyStage1ProductExamplePreviews(
    readyPlan,
    previewResponse([
      recommendation({
        role: "shampoo_dandruff",
        decisionKey: "decision:shampoo:shampoo_dandruff:gap",
        productName: "Anti-Schuppen Shampoo",
      }),
      recommendation(),
    ]),
  )

  // Both shampoo roles resolved to a product and share the same tier
  // ("basis"), so they collapse into one group card instead of two siblings.
  assert.deepEqual(
    applied.basis.cards.map((item) => item.id),
    ["shampoo:group:basis", "conditioner"],
  )
  const shampooGroup = asGroup(applied.basis.cards[0])
  assert.equal(shampooGroup.category, "shampoo")
  assert.equal(shampooGroup.statusLabel, "Basis")
  assert.equal(shampooGroup.members.length, 2)

  const [lead, secondary] = shampooGroup.members
  // Canonical role order (shampoo_everyday before shampoo_dandruff), not
  // input order — and once siblings exist, every member wears its own role
  // copy, including the one that used to be the sole "lead".
  assert.equal(lead?.id, "shampoo:shampoo_everyday")
  assert.equal(lead?.product?.name, "Redken All Soft Shampoo")
  assert.equal(lead?.targetType, "Regelmäßige Reinigung")
  assert.equal(secondary?.id, "shampoo:shampoo_dandruff")
  assert.equal(secondary?.product?.name, "Anti-Schuppen Shampoo")
  assert.equal(secondary?.targetType, "Schuppenpflege")
})

const oilPreWash = recommendation({
  category: "oil",
  role: "pre_wash_fibre_treatment",
  decisionKey: "decision:oil:pre_wash_fibre_treatment:gap",
  productId: "oil-pre-wash",
  productName: "Reichhaltiges Vorwäsche-Öl",
  imageUrl: "https://example.com/oil-pre-wash.webp",
  authorityVersion: "personal-plan.oil.v2",
  factFingerprint: "facts-oil-pre-wash",
  reasoning: {
    productCriteria: "Vor der Wäsche in die Längen einziehen und Struktur stützen.",
    fit: "Deine Längen vertragen vor der Wäsche eine reichhaltigere Pflege.",
    frequency: "jede 2. Haarwäsche",
  },
})

const oilDryFinish = recommendation({
  category: "oil",
  role: "dry_finish",
  decisionKey: "decision:oil:dry_finish:gap",
  productId: "oil-dry-finish",
  productName: "Leichtes Finish-Öl",
  imageUrl: "https://example.com/oil-dry-finish.webp",
  authorityVersion: "personal-plan.oil.v2",
  factFingerprint: "facts-oil-dry-finish",
  commerce: {
    priceEur: 24.9,
    purchaseLinkStatus: "available" as const,
    netContentValue: 50,
    netContentUnit: "ml" as const,
    priceLabel: "24,90 €",
    netContentLabel: "50 ml",
    availabilityLabel: "Aktuell verfügbar",
    productUrl: "https://example.com/oil-dry-finish",
    affiliateDisclosure: null,
  },
  reasoning: {
    productCriteria: "Mit kleiner Dosierung glätten und Glanz geben, ohne schwer zu wirken.",
    fit: "Deine raueren Spitzen profitieren von einem gezielten Finish.",
    frequency: "bei Bedarf",
  },
})

const oilFrequencyTarget = {
  kind: "role_based_wash_linked" as const,
  roleFrequencies: [
    {
      role: "pre_wash_fibre_treatment" as const,
      tier: "basis" as const,
      cadence: "before_every_compatible_wash" as const,
    },
    {
      role: "leave_on_fibre_conditioning" as const,
      tier: "basis" as const,
      cadence: "after_every_compatible_wash" as const,
    },
    {
      role: "dry_finish" as const,
      tier: "basis" as const,
      cadence: "finish_after_every_compatible_wash" as const,
    },
  ],
}

const oilPlan: PlanStartReadyViewModel = {
  ...readyPlan,
  basis: {
    ...readyPlan.basis,
    cards: [
      card({
        id: "oil",
        category: "oil",
        categoryLabel: "Haaröl",
        targetType: "Reichhaltige Vorwäsche",
        purpose: "Glättet Frizz und gibt Glanz, ohne unnötig zu beschweren.",
        pills: ["Vorwäsche", "Finish & Glanz"],
        frequency: "jede 2. Haarwäsche",
        imageUrl: null,
        frequencyTarget: oilFrequencyTarget,
      }),
    ],
  },
  optional: null,
}

test("two same-tier oil roles group into one card, each with its own role cadence", () => {
  const applied = applyStage1ProductExamplePreviews(
    oilPlan,
    previewResponse([oilPreWash, oilDryFinish]),
  )

  // Neither role has its own per-role tier here (this fixture has no
  // `roleTones`), so both fall back to the category's aggregate tone
  // ("basis") and land in one group, in canonical role order.
  assert.deepEqual(
    applied.basis.cards.map((item) => item.id),
    ["oil:group:basis"],
  )
  const oilGroup = asGroup(applied.basis.cards[0])
  assert.equal(oilGroup.category, "oil")
  assert.equal(oilGroup.statusLabel, "Basis")
  assert.equal(oilGroup.members.length, 2)

  const [primary, secondary] = oilGroup.members
  assert.equal(primary?.id, "oil:pre_wash_fibre_treatment")
  assert.equal(primary?.product?.name, "Reichhaltiges Vorwäsche-Öl")
  assert.equal(primary?.targetType, "Pflege vor der Haarwäsche")
  assert.equal(primary?.frequency, "vor jeder passenden Haarwäsche")

  // Same card pattern, same category identity — only the role changes.
  assert.equal(secondary?.id, "oil:dry_finish")
  assert.equal(secondary?.category, "oil")
  assert.equal(secondary?.categoryLabel, "Haaröl")
  assert.equal(secondary?.tone, "basis")
  assert.equal(secondary?.statusLabel, "Basis")
  assert.equal(secondary?.product?.name, "Leichtes Finish-Öl")
  assert.equal(secondary?.product?.priceLabel, "24,90 €")
  assert.equal(secondary?.imageUrl, "https://example.com/oil-dry-finish.webp")
  assert.equal(secondary?.imageAlt, "Produktbild: Leichtes Finish-Öl")
  assert.equal(secondary?.fallbackNote ?? null, null)

  // The role is what makes the second card readable: type subline, purpose and
  // pill all name this role instead of repeating the category's lead role.
  // The frequency line is this role's own cadence, not the payload's generic
  // reasoning text ("bei Bedarf") or the category's aggregate cadence.
  assert.equal(secondary?.targetType, "Finish")
  assert.equal(secondary?.purpose, "Schließt die Routine als Finish für die Längen ab.")
  assert.deepEqual(secondary?.pills, ["Finish & Glanz"])
  assert.equal(secondary?.frequency, "als Finish nach jeder Haarwäsche")
  assert.deepEqual(secondary?.detailBlocks, [
    {
      title: "Worauf es beim Produkt ankommt",
      body: "Mit kleiner Dosierung glätten und Glanz geben, ohne schwer zu wirken.",
    },
    {
      title: "Warum das zu deinem Haar passt",
      body: "Deine raueren Spitzen profitieren von einem gezielten Finish.",
    },
    { title: "Empfohlener Rhythmus", body: "als Finish nach jeder Haarwäsche" },
  ])
})

test("the optional count names the cards on the page, not the categories behind them", () => {
  const optionalOilPlan: PlanStartReadyViewModel = {
    ...readyPlan,
    optional: {
      ...readyPlan.optional!,
      countLabel: "1 Vorschlag",
      cards: [
        card({
          id: "oil",
          category: "oil",
          tone: "optional",
          statusLabel: "Optional",
          categoryLabel: "Haaröl",
          targetType: "Reichhaltige Vorwäsche",
          imageUrl: null,
        }),
      ],
    },
  }

  const applied = applyStage1ProductExamplePreviews(
    optionalOilPlan,
    previewResponse([oilPreWash, oilDryFinish]),
  )

  // Both oil roles resolve and share the optional tier, so they group into
  // one card — but the count label still names the two suggestions inside it.
  assert.equal(applied.optional?.cards.length, 1)
  assert.equal(asGroup(applied.optional?.cards[0]).members.length, 2)
  assert.equal(applied.optional?.countLabel, "2 Vorschläge")
  // A single suggestion keeps the singular.
  assert.equal(
    applyStage1ProductExamplePreviews(optionalOilPlan, previewResponse([oilPreWash])).optional
      ?.countLabel,
    "1 Vorschlag",
  )
})

test("the basis count keeps counting categories after the per-role expansion", () => {
  const applied = applyStage1ProductExamplePreviews(
    readyPlan,
    previewResponse([
      recommendation(),
      recommendation({
        role: "shampoo_dandruff",
        decisionKey: "decision:shampoo:shampoo_dandruff:gap",
        productName: "Anti-Schuppen Shampoo",
      }),
    ]),
  )

  // The two shampoo roles group into one card, plus the conditioner card.
  assert.equal(applied.basis.cards.length, 2)
  // "N Kategorien" stays literally true: two categories on the page.
  assert.equal(applied.basis.countLabel, "2 Kategorien")
})

test("a secondary role without a product adds no card at all", () => {
  const applied = applyStage1ProductExamplePreviews(
    oilPlan,
    previewResponse([
      oilPreWash,
      {
        kind: "fallback",
        category: "oil",
        role: "dry_finish",
        decisionKey: "decision:oil:dry_finish:gap",
        authorityVersion: "personal-plan.oil.v2",
        fallback: "post_refinement",
      },
    ]),
  )

  assert.deepEqual(
    applied.basis.cards.map((item) => item.id),
    ["oil"],
  )
})

test("the lead card is never duplicated as a secondary card", () => {
  const applied = applyStage1ProductExamplePreviews(
    oilPlan,
    previewResponse([
      {
        kind: "fallback",
        category: "oil",
        role: "pre_wash_fibre_treatment",
        decisionKey: "decision:oil:pre_wash_fibre_treatment:gap",
        authorityVersion: "personal-plan.oil.v2",
        fallback: "post_refinement",
      },
      oilDryFinish,
    ]),
  )

  // The only recommendation leads the category card; nothing repeats below it.
  assert.deepEqual(
    applied.basis.cards.map((item) => item.id),
    ["oil"],
  )
  assert.equal(asCard(applied.basis.cards[0]).product?.name, "Leichtes Finish-Öl")
})

test("a role card inside a group renders the role in its subline and keeps the category styling", () => {
  const applied = applyStage1ProductExamplePreviews(
    oilPlan,
    previewResponse([oilPreWash, oilDryFinish]),
  )
  const oilGroup = asGroup(applied.basis.cards[0])
  const html = renderToStaticMarkup(<NeedCard card={oilGroup.members[1]!} />)

  assert.match(html, /Leichtes Finish-Öl/)
  assert.match(html, /Finish · 24,90 €/)
  assert.match(html, /Haaröl/)
  // The Oil category accent still applies even though the card id is per-role.
  assert.match(html, /bg-\[#A85F70\]/)
  assert.match(html, /data-plan-start-card="oil:dry_finish"/)
})

const oilSplitTierFrequencyTarget = {
  kind: "role_based_wash_linked" as const,
  roleFrequencies: [
    {
      role: "pre_wash_fibre_treatment" as const,
      tier: "basis" as const,
      cadence: "before_every_compatible_wash" as const,
    },
    {
      role: "leave_on_fibre_conditioning" as const,
      tier: "optional" as const,
      cadence: "optional_allocation_deferred_to_day_type" as const,
    },
    {
      role: "dry_finish" as const,
      tier: "optional" as const,
      cadence: "optional_allocation_deferred_to_day_type" as const,
    },
  ],
}

const oilLeaveOn = recommendation({
  category: "oil",
  role: "leave_on_fibre_conditioning",
  decisionKey: "decision:oil:leave_on_fibre_conditioning:gap",
  productId: "oil-leave-on",
  productName: "Leichtes Leave-on-Öl",
  imageUrl: "https://example.com/oil-leave-on.webp",
  authorityVersion: "personal-plan.oil.v2",
  factFingerprint: "facts-oil-leave-on",
})

// Oil's aggregate tier is "basis" (pre_wash is basis), but two of its three
// roles are individually tiered "optional" — the case per-role tiers exist
// to fix: those two roles belong on the Optional page, not the Basis page.
const planWithMixedOilTiers: PlanStartReadyViewModel = {
  ...readyPlan,
  basis: {
    ...readyPlan.basis,
    cards: [
      card({
        id: "oil",
        category: "oil",
        categoryLabel: "Haaröl",
        imageUrl: null,
        roleTones: {
          pre_wash_fibre_treatment: "basis",
          leave_on_fibre_conditioning: "optional",
          dry_finish: "optional",
        },
        frequencyTarget: oilSplitTierFrequencyTarget,
      }),
      card({
        id: "conditioner",
        category: "conditioner",
        categoryLabel: "Conditioner",
        imageUrl: null,
      }),
    ],
  },
  optional: {
    ...readyPlan.optional!,
    cards: [
      card({
        id: "dry_shampoo",
        category: "dry_shampoo",
        tone: "optional",
        statusLabel: "Optional",
        categoryLabel: "Trockenshampoo",
        imageUrl: null,
      }),
    ],
  },
}

test("oil role entries split across screens by their own tier", () => {
  const applied = applyStage1ProductExamplePreviews(
    planWithMixedOilTiers,
    previewResponse([
      oilPreWash,
      oilLeaveOn,
      oilDryFinish,
      recommendation({
        category: "conditioner",
        role: "conditioner_rinse_out",
        decisionKey: "decision:conditioner:conditioner_rinse_out:gap",
        productId: "conditioner-basic",
        productName: "Basis Conditioner",
      }),
      recommendation({
        category: "dry_shampoo",
        role: "root_refresh_bridge",
        decisionKey: "decision:dry_shampoo:root_refresh_bridge:gap",
        productId: "dry-shampoo-basic",
        productName: "Trockenshampoo Basis",
      }),
    ]),
  )

  const basisOil = applied.basis.cards.filter((card) => card.category === "oil")
  assert.equal(basisOil.length, 1)
  // A single role on this screen → standalone card, no group.
  assert.ok(!isNeedCardGroup(basisOil[0]!))
  assert.equal(asCard(basisOil[0]).frequency, "vor jeder passenden Haarwäsche")

  const optionalOil = applied.optional!.cards.filter((card) => card.category === "oil")
  assert.equal(optionalOil.length, 1)
  assert.ok(isNeedCardGroup(optionalOil[0]!))
  assert.equal(asGroup(optionalOil[0]).members.length, 2)
  assert.equal(asGroup(optionalOil[0]).statusLabel, "Optional")
})

// Oil's basis-tone role (`pre_wash_fibre_treatment`) falls back while its
// optional-tone role (`dry_finish`) gets a real recommendation. Without a
// placeholder, the category's only entry would be the optional one and the
// whole card relocates to Optional — silently dropping the basis-tone need
// from the Basis page even though the recomputed count keeps naming it.
const mixedTierBasisFallbackPlan: PlanStartReadyViewModel = {
  ...readyPlan,
  basis: {
    ...readyPlan.basis,
    cards: [
      card({
        id: "oil",
        category: "oil",
        categoryLabel: "Haaröl",
        imageUrl: null,
        roleTones: { pre_wash_fibre_treatment: "basis", dry_finish: "optional" },
        frequencyTarget: oilFrequencyTarget,
      }),
    ],
  },
  optional: null,
}

test("a basis-tone role that falls back while the optional-tone role recommends keeps a Basis placeholder", () => {
  const applied = applyStage1ProductExamplePreviews(
    mixedTierBasisFallbackPlan,
    previewResponse([
      {
        kind: "fallback",
        category: "oil",
        role: "pre_wash_fibre_treatment",
        decisionKey: "decision:oil:pre_wash_fibre_treatment:gap",
        authorityVersion: "personal-plan.oil.v2",
        fallback: "post_refinement",
      },
      oilDryFinish,
    ]),
  )

  const basisOil = findCard(applied.basis.cards, (item) => item.category === "oil")
  assert.ok(basisOil, "expected a Basis placeholder card for oil")
  assert.equal(basisOil?.product ?? null, null)
  assert.equal(basisOil?.imageUrl, null)
  assert.equal(basisOil?.fallbackNote, NEED_CARD_FALLBACK_NOTE)
  assert.equal(basisOil?.statusLabel, "Basis")
  assert.equal(basisOil?.frequency, "vor jeder passenden Haarwäsche")
  // The recomputed Basis count includes oil again — it is not dropped just
  // because its only concrete recommendation lives on Optional.
  assert.equal(applied.basis.countLabel, "1 Kategorie")

  assert.ok(applied.optional)
  const optionalOil = findCard(applied.optional!.cards, (item) => item.category === "oil")
  assert.equal(optionalOil?.product?.name, "Leichtes Finish-Öl")
})

test("group renders one shell with a single kicker and full member anatomy", () => {
  const applied = applyStage1ProductExamplePreviews(
    planWithMixedOilTiers,
    previewResponse([oilPreWash, oilLeaveOn, oilDryFinish]),
  )
  const oilGroup = asGroup(applied.optional!.cards.find((item) => item.category === "oil")!)
  assert.equal(oilGroup.id, "oil:group:optional")
  assert.equal(oilGroup.members.length, 2)
  const [primary, secondary] = oilGroup.members
  assert.equal(primary?.id, "oil:leave_on_fibre_conditioning")
  assert.equal(secondary?.id, "oil:dry_finish")

  const html = renderToStaticMarkup(
    <NeedPlanScreen screen={{ ...applied.optional!, cards: [oilGroup] }} hasOptionalPage />,
  )

  // Exactly one shell for the whole group, carrying the group id and tone.
  assert.equal(html.match(/data-plan-start-card-group="oil:group:optional"/g)?.length, 1)
  assert.ok(
    html.includes(
      'data-plan-start-card-group="oil:group:optional" data-plan-start-card-tone="optional"',
    ),
  )
  // One kicker row for the group ("Haaröl · Optional"), not one per member.
  assert.equal(html.match(/>Haaröl</g)?.length, 1)
  assert.equal(html.match(/>Optional</g)?.length, 1)
  // Both members still render as full, independently addressable cards.
  assert.ok(html.includes(`data-plan-start-card="${primary!.id}"`))
  assert.ok(html.includes(`data-plan-start-card="${secondary!.id}"`))
  assert.ok(html.includes(primary!.product!.name))
  assert.ok(html.includes(secondary!.product!.name))
  assert.ok(html.includes(`${primary!.targetType} · ${primary!.product!.priceLabel}`))
  assert.ok(html.includes(`${secondary!.targetType} · ${secondary!.product!.priceLabel}`))
  // A divider sits between the two stacked members, and only there.
  assert.equal(html.match(/mx-3 border-t border-\[rgba\(67,55,48,0\.12\)\]/g)?.length, 1)
})

test("each group member opens its own detail sheet", () => {
  const applied = applyStage1ProductExamplePreviews(
    planWithMixedOilTiers,
    previewResponse([oilPreWash, oilLeaveOn, oilDryFinish]),
  )
  const oilGroup = asGroup(applied.optional!.cards.find((item) => item.category === "oil")!)
  const [primary, secondary] = oilGroup.members

  const html = renderToStaticMarkup(
    <NeedPlanScreen screen={{ ...applied.optional!, cards: [oilGroup] }} hasOptionalPage />,
  )

  // Each member keeps its own dialog trigger — two independent buttons, not
  // one shared trigger for the whole group.
  assert.equal(html.match(/aria-haspopup="dialog"/g)?.length, 2)

  // Clicking either member's trigger must only ever be able to reveal that
  // member's own product facts, never the other member's.
  const primarySheet = renderToStaticMarkup(<ProductDetailSheetBody card={primary!} />)
  const secondarySheet = renderToStaticMarkup(<ProductDetailSheetBody card={secondary!} />)
  assert.ok(primarySheet.includes(primary!.product!.name))
  assert.ok(!primarySheet.includes(secondary!.product!.name))
  assert.ok(secondarySheet.includes(secondary!.product!.name))
  assert.ok(!secondarySheet.includes(primary!.product!.name))
})

const planWithoutOptionalPage: PlanStartReadyViewModel = {
  ...readyPlan,
  basis: {
    ...readyPlan.basis,
    progress: 100,
    cards: [
      card({
        id: "oil",
        category: "oil",
        categoryLabel: "Haaröl",
        imageUrl: null,
        roleTones: { pre_wash_fibre_treatment: "basis", dry_finish: "optional" },
        frequencyTarget: oilFrequencyTarget,
      }),
    ],
  },
  optional: null,
}

test("optional screen is created when it did not exist but optional-tier roles do", () => {
  const applied = applyStage1ProductExamplePreviews(
    planWithoutOptionalPage,
    previewResponse([oilPreWash, oilDryFinish]),
  )

  assert.ok(applied.optional)
  assert.equal(applied.basis.progress, 50)
  assert.equal(applied.optional!.countLabel, "1 Vorschlag")
})

test("optional count label counts group members individually", () => {
  const optionalOilAndDryShampooPlan: PlanStartReadyViewModel = {
    ...readyPlan,
    optional: {
      ...readyPlan.optional!,
      cards: [
        card({
          id: "oil",
          category: "oil",
          tone: "optional",
          statusLabel: "Optional",
          categoryLabel: "Haaröl",
          imageUrl: null,
        }),
        card({
          id: "dry_shampoo",
          category: "dry_shampoo",
          tone: "optional",
          statusLabel: "Optional",
          categoryLabel: "Trockenshampoo",
          imageUrl: null,
        }),
      ],
    },
  }

  const applied = applyStage1ProductExamplePreviews(
    optionalOilAndDryShampooPlan,
    previewResponse([
      oilPreWash,
      oilDryFinish,
      recommendation({
        category: "dry_shampoo",
        role: "root_refresh_bridge",
        decisionKey: "decision:dry_shampoo:root_refresh_bridge:gap",
        productId: "dry-shampoo-basic",
        productName: "Trockenshampoo Basis",
      }),
    ]),
  )

  // The two grouped oil roles plus the standalone dry_shampoo suggestion.
  assert.equal(applied.optional!.countLabel, "3 Vorschläge")
})

test("fallback-only previews keep the category card on its aggregate-tier screen, un-expanded", () => {
  const applied = applyStage1ProductExamplePreviews(
    oilPlan,
    previewResponse([
      {
        kind: "fallback",
        category: "oil",
        role: "pre_wash_fibre_treatment",
        decisionKey: "decision:oil:pre_wash_fibre_treatment:gap",
        authorityVersion: "personal-plan.oil.v2",
        fallback: "post_refinement",
      },
      {
        kind: "fallback",
        category: "oil",
        role: "dry_finish",
        decisionKey: "decision:oil:dry_finish:gap",
        authorityVersion: "personal-plan.oil.v2",
        fallback: "post_refinement",
      },
    ]),
  )

  assert.deepEqual(
    applied.basis.cards.map((item) => item.id),
    ["oil"],
  )
  const oilCard = asCard(applied.basis.cards[0])
  assert.equal(oilCard.product ?? null, null)
  assert.equal(oilCard.fallbackNote, NEED_CARD_FALLBACK_NOTE)
})

test("single-role categories are byte-identical to before: no id change, no group, category copy kept", () => {
  const applied = applyStage1ProductExamplePreviews(
    readyPlan,
    previewResponse([
      recommendation({
        category: "conditioner",
        role: "conditioner_rinse_out",
        decisionKey: "decision:conditioner:conditioner_rinse_out:gap",
        productId: "conditioner-light",
        productName: "Leichter Conditioner",
      }),
    ]),
  )

  assert.deepEqual(
    applied.basis.cards.map((item) => item.id),
    ["shampoo", "conditioner"],
  )
  const conditioner = asCard(applied.basis.cards[1])
  // Category-level copy (from `cardFromDecision`) survives untouched — only a
  // second role of the same category would ever replace it with role copy.
  assert.equal(conditioner.targetType, card().targetType)
  assert.equal(conditioner.product?.name, "Leichter Conditioner")
})

// `adaptInitialNeedSnapshotToPlanStartViewModel`'s paused-only-optional merge
// physically relocates a paused optional-tone card onto Basis but does not
// touch its `tone` field — it stays "optional" even though the card now lives
// in `basis.cards` and `optional` is null. Placement here must follow the
// screen the card is already on, not that stale tone, or applying previews
// would resurrect the very Optional page the merge suppressed.
const pausedOnlyOptionalPlan: PlanStartReadyViewModel = {
  ...readyPlan,
  basis: {
    ...readyPlan.basis,
    progress: 100,
    cards: [
      card(),
      card({
        id: "dry_shampoo",
        category: "dry_shampoo",
        tone: "optional",
        categoryLabel: "Trockenshampoo",
        statusLabel: "Pausiert",
        targetType: "Aktuell nicht anwenden",
        paused: true,
        frequency: "später: bei Bedarf",
        imageUrl: null,
      }),
    ],
  },
  optional: null,
}

test("a paused-merge card (optional tone, living on Basis) does not resurrect the Optional page", () => {
  const applied = applyStage1ProductExamplePreviews(pausedOnlyOptionalPlan, previewResponse([]))

  assert.equal(applied.optional, null)
  assert.equal(applied.basis.progress, 100)
  const dryShampoo = findCard(applied.basis.cards, (item) => item.id === "dry_shampoo")
  assert.ok(dryShampoo)
  assert.equal(dryShampoo?.statusLabel, "Pausiert")
  assert.equal(dryShampoo?.tone, "optional")
})

test("the paused-merge card still resurrects nothing once other categories get real previews", () => {
  const applied = applyStage1ProductExamplePreviews(
    pausedOnlyOptionalPlan,
    previewResponse([recommendation()]),
  )

  assert.equal(applied.optional, null)
  assert.equal(applied.basis.progress, 100)
  assert.deepEqual(
    applied.basis.cards.map((item) => item.id),
    ["shampoo", "dry_shampoo"],
  )
})

test("a paused-merge card whose own category gets a recommendation still does not resurrect the Optional page", () => {
  // The paused category itself (not some other category) resolves a real
  // recommendation. It has no `roleTones` entry for its role (dry_shampoo
  // never tiers per role), so the single placement rule must fall through to
  // `originScreen` ("basis", where the paused-merge physically put it) —
  // never to the card's stale `tone` ("optional"), which would resurrect the
  // suppressed Optional page and step `basis.progress` back to 50.
  const applied = applyStage1ProductExamplePreviews(
    pausedOnlyOptionalPlan,
    previewResponse([
      recommendation({
        category: "dry_shampoo",
        role: "root_refresh_bridge",
        decisionKey: "decision:dry_shampoo:root_refresh_bridge:gap",
        productName: "Trockenshampoo Sensitiv",
      }),
    ]),
  )

  assert.equal(applied.optional, null)
  assert.equal(applied.basis.progress, 100)
  const dryShampoo = findCard(applied.basis.cards, (item) => item.id === "dry_shampoo")
  assert.ok(dryShampoo)
  assert.equal(dryShampoo?.product?.name, "Trockenshampoo Sensitiv")
})

test("an optional screen that redistributes down to zero final cards is dropped", () => {
  // Artificial: `roleTones` pulls this optional-tone category's only role
  // back to "basis", so nothing is left to keep the Optional page alive.
  const drainingOptionalPlan: PlanStartReadyViewModel = {
    ...readyPlan,
    optional: {
      ...readyPlan.optional!,
      cards: [
        card({
          id: "oil",
          category: "oil",
          tone: "optional",
          statusLabel: "Optional",
          categoryLabel: "Haaröl",
          imageUrl: null,
          roleTones: { pre_wash_fibre_treatment: "basis" },
        }),
      ],
    },
  }

  const applied = applyStage1ProductExamplePreviews(
    drainingOptionalPlan,
    previewResponse([oilPreWash]),
  )

  assert.equal(applied.optional, null)
  assert.equal(applied.basis.progress, 100)
  // The role entry itself still renders — just relocated to Basis.
  const oilCard = findCard(applied.basis.cards, (item) => item.category === "oil")
  assert.equal(oilCard?.product?.name, "Reichhaltiges Vorwäsche-Öl")
})

test("a category whose basis role has no preview at all still keeps a Basis placeholder, not a full relocation", () => {
  // Oil's only resolved role is tiered "optional" via `roleTones`; its basis
  // role (`pre_wash_fibre_treatment`, listed here exactly as production's
  // `cardFromDecision` would emit it — every resolved role gets a
  // `roleTones` entry, not just the ones that differ from the origin
  // screen) has no preview at all in the response below — not even a
  // "fallback"-kind entry. The basis-placeholder rule treats "no preview"
  // identically to "fallback" for a basis-tone role: previously this test
  // encoded the whole category relocating off Basis and the recomputed
  // Basis count dropping it; now the basis-tone gap keeps one placeholder
  // card on Basis (and the count keeps naming it), while the optional-tone
  // role's real recommendation still renders on Optional exactly as before.
  const relocatingBasisPlan: PlanStartReadyViewModel = {
    ...readyPlan,
    basis: {
      ...readyPlan.basis,
      countLabel: "3 Kategorien",
      cards: [
        ...readyPlan.basis.cards,
        card({
          id: "oil",
          category: "oil",
          tone: "basis",
          categoryLabel: "Haaröl",
          imageUrl: null,
          roleTones: { pre_wash_fibre_treatment: "basis", leave_on_fibre_conditioning: "optional" },
          frequencyTarget: oilFrequencyTarget,
        }),
      ],
    },
  }

  const applied = applyStage1ProductExamplePreviews(
    relocatingBasisPlan,
    previewResponse([
      recommendation({
        category: "oil",
        role: "leave_on_fibre_conditioning",
        decisionKey: "decision:oil:leave_on_fibre_conditioning:gap",
        productName: "Leichtes Finish-Öl",
      }),
    ]),
  )

  assert.deepEqual(
    applied.basis.cards.map((item) => item.id),
    ["shampoo", "conditioner", "oil"],
  )
  const oilBasisCard = findCard(applied.basis.cards, (item) => item.category === "oil")
  assert.equal(oilBasisCard?.product ?? null, null)
  assert.equal(oilBasisCard?.fallbackNote, NEED_CARD_FALLBACK_NOTE)
  assert.equal(oilBasisCard?.statusLabel, "Basis")
  // Recomputed against the categories actually on the page — still three,
  // since the placeholder keeps oil represented.
  assert.equal(applied.basis.countLabel, "3 Kategorien")
  assert.ok(applied.optional)
  const oilCard = findCard(applied.optional!.cards, (item) => item.category === "oil")
  assert.equal(oilCard?.product?.name, "Leichtes Finish-Öl")
})

test("the screen disclaimer stays honest when no category has a product yet", () => {
  const withProduct = card({ product: { ...productFixture } })
  const withFallback = card({ id: "mask", category: "mask", fallbackNote: NEED_CARD_FALLBACK_NOTE })

  assert.equal(
    planStartProductDisclaimer([withProduct, withFallback]),
    PLAN_START_CATALOG_DISCLAIMER,
  )
  assert.equal(planStartProductDisclaimer([withFallback]), PLAN_START_PENDING_DISCLAIMER)
  // Before the previews land no card is a decided fallback — keep the catalog line.
  assert.equal(planStartProductDisclaimer([card()]), PLAN_START_CATALOG_DISCLAIMER)
})

test("the card leads with the product name and a type-plus-price subline", () => {
  const html = renderToStaticMarkup(<NeedCard card={card({ product: { ...productFixture } })} />)

  assert.match(html, /Redken All Soft Shampoo/)
  assert.match(html, /Sanft reinigend · 17,95 €/)
  assert.match(html, /aria-haspopup="dialog"/)
  assert.doesNotMatch(html, />Beispiel</)
  assert.doesNotMatch(html, /Was dein Haar braucht/)
})

test("a single card keeps all four data attributes on its outer article — no nested wrapper", () => {
  const html = renderToStaticMarkup(<NeedCard card={card({ product: { ...productFixture } })} />)

  // The root element must be the shell `<article>` itself — the same
  // element that carries the visual card class — not a `<div>` nested
  // one level inside it. A regression here breaks Playwright selectors
  // like `[data-plan-start-card-list] article[data-plan-start-card-preview]`.
  const articleOpenTag = html.match(/<article\b[^>]*>/)?.[0]
  assert.ok(articleOpenTag, "expected the card to render as an <article>")
  assert.match(articleOpenTag!, /rounded-\[19px\]/)
  assert.match(articleOpenTag!, /data-plan-start-card="shampoo"/)
  assert.match(articleOpenTag!, /data-plan-start-card-tone="basis"/)
  assert.match(articleOpenTag!, /data-plan-start-card-paused="false"/)
  assert.match(articleOpenTag!, /data-plan-start-card-preview="example"/)
  // No inner element duplicates the card's own data-plan-start-card hook.
  assert.equal(html.match(/data-plan-start-card="shampoo"/g)?.length, 1)
  // Not a group: no group-only attribute leaks onto a standalone card.
  assert.doesNotMatch(html, /data-plan-start-card-group/)
})

test("a fallback card keeps the category need and says the product follows later", () => {
  const html = renderToStaticMarkup(
    <NeedCard card={card({ imageUrl: null, fallbackNote: NEED_CARD_FALLBACK_NOTE })} />,
  )

  assert.match(html, /Sanft reinigend/)
  assert.match(html, /Produktempfehlung folgt nach dem Feinschliff/)
  assert.match(html, /data-plan-start-card-image-slot="reserved"/)
  assert.doesNotMatch(html, /€/)
})

test("the detail sheet shows product facts, the three reasoning blocks and the shop CTA", () => {
  const html = renderToStaticMarkup(
    <ProductDetailSheetBody card={card({ product: { ...productFixture } })} />,
  )

  assert.match(html, /Shampoo · Sanft reinigend/)
  assert.match(html, /Redken All Soft Shampoo/)
  assert.match(html, /17,95 €/)
  assert.match(html, /300 ml/)
  assert.match(html, /Aktuell verfügbar/)
  // Only a confirmed-available purchase link may read as green.
  assert.match(html, /data-availability-tone="available"/)
  assert.match(html, /text-\[#356b45\]/)
  for (const block of baseDetailBlocks) assert.ok(html.includes(block.title))
  assert.ok(html.includes(PRODUCT_REFINEMENT_HINT))
  assert.match(html, /Zum Produkt/)
  assert.doesNotMatch(html, /Ich habe es schon gekauft|Affiliate|Stand: /)
})

test("the detail sheet drops the CTA when no verified purchase link exists", () => {
  const html = renderToStaticMarkup(
    <ProductDetailSheetBody
      card={card({
        product: {
          ...productFixture,
          availabilityLabel: "Derzeit kein verifizierter Produktlink",
          purchaseLinkStatus: "unavailable",
          productUrl: null,
        },
      })}
    />,
  )

  assert.match(html, /Derzeit kein verifizierter Produktlink/)
  assert.doesNotMatch(html, /Zum Produkt/)
  // An unavailable (or unknown) purchase link must not be styled as available.
  assert.match(html, /data-availability-tone="muted"/)
  assert.doesNotMatch(html, /text-\[#356b45\]/)
})

test("an unknown availability renders no availability line at all", () => {
  const html = renderToStaticMarkup(
    <ProductDetailSheetBody
      card={card({
        product: {
          ...productFixture,
          // Unknown availability is null, not a guessed "nicht bestätigt" copy.
          availabilityLabel: null,
          purchaseLinkStatus: null,
        },
      })}
    />,
  )

  // No line beats an empty or invented one: the tone span must not render,
  // so there is neither a stray green line nor an empty tinted placeholder.
  assert.doesNotMatch(html, /data-availability-tone/)
  assert.doesNotMatch(html, /text-\[#356b45\]/)
  assert.doesNotMatch(html, /nicht bestätigt/)
  // The rest of the product line still renders.
  assert.match(html, /Redken All Soft Shampoo/)
})

test("the fallback sheet explains the need without commerce or CTA", () => {
  const html = renderToStaticMarkup(
    <ProductDetailSheetBody
      card={card({ imageUrl: null, fallbackNote: NEED_CARD_FALLBACK_NOTE })}
    />,
  )

  assert.match(html, /Sanft reinigend/)
  assert.match(html, /Produktempfehlung folgt nach dem Feinschliff/)
  for (const block of baseDetailBlocks) assert.ok(html.includes(block.title))
  assert.doesNotMatch(html, /Zum Produkt|€/)
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
  assert.ok(html.includes(PLAN_START_CATALOG_DISCLAIMER))
  assert.doesNotMatch(html, /Bilder zeigen nur Beispiele/)
  assert.doesNotMatch(html, />Beispiel<\/span>/)
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
  const html = renderToStaticMarkup(<NeedCard card={asCard(readyPlan.optional!.cards[0])} />)

  assert.match(html, /data-plan-start-card-paused="true"/)
  assert.match(html, /Pausiert/)
  assert.match(html, /Aktuell nicht anwenden/)
  assert.match(html, /aria-haspopup="dialog"/)
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
    const html = renderToStaticMarkup(
      <NeedCard
        card={card({ id, category: id as NeedCardViewModel["category"], imageUrl: null })}
      />,
    )
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
        category: "oil",
        tone: "optional",
        statusLabel: "Optional",
        imageUrl: card().imageUrl,
      })}
    />,
  )
  const paused = renderToStaticMarkup(<NeedCard card={asCard(readyPlan.optional!.cards[0])} />)

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
    <NeedCard
      card={card({
        id: "legacy-category",
        category: "legacy-category" as NeedCardViewModel["category"],
        imageUrl: null,
      })}
    />,
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
  const shampoo = findCard(plan.basis.cards, (item) => item.categoryLabel === "Shampoo")
  const conditioner = findCard(plan.basis.cards, (item) => item.categoryLabel === "Conditioner")
  assert.equal(shampoo?.imageUrl, null)
  assert.equal(conditioner?.imageUrl, null)
  assert.ok(plan.optional)
  assert.ok(plan.optional.cards.some((item) => item.id === "bondbuilder"))
  assert.ok(plan.optional.cards.some((item) => !isNeedCardGroup(item) && item.paused))

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
  const paused = findCard(
    plan.optional.cards,
    (item) => !isNeedCardGroup(item) && Boolean(item.paused),
  )
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
  // `need-card.tsx` is a "use client" module — a value import from it in a
  // server-reachable module like snapshot-adapter.ts turns that import into
  // a client reference and crashes an RSC render that calls the function
  // server-side. Type-only imports (e.g. from need-plan-screen) are fine.
  assert.doesNotMatch(adapterSource, /import\s*\{[^}]*\}\s*from\s*"\.\/need-card"/)
})
