import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { NeedCard } from "../src/components/personal-plan-start/need-card"
import {
  isNeedCardGroup,
  needCardProductBadges,
  type NeedCardViewModel,
} from "../src/components/personal-plan-start/plan-start-cards"
import type { PlanStartReadyViewModel } from "../src/components/personal-plan-start/plan-start-flow"
import { ProductDetailSheetBody } from "../src/components/personal-plan-start/product-detail-sheet"
import {
  adaptInitialNeedSnapshotToPlanStartViewModel,
  applyStage1ProductExamplePreviews,
} from "../src/components/personal-plan-start/snapshot-adapter"
import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import type {
  Stage1ProductExampleCommerce,
  Stage1ProductExamplePreviewResponse,
} from "../src/lib/personal-plan/product-preview-contract"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

/*
 * C15: the Stage-1 card transport for „Über deinem Budget“ and the Drogerie/Profi tier. Both
 * badges render only when the preview carried the optional field — never otherwise.
 */

function card(product: NeedCardViewModel["product"]): NeedCardViewModel {
  return {
    id: "conditioner",
    category: "conditioner",
    tone: "basis",
    categoryLabel: "Conditioner",
    statusLabel: "Basis",
    targetType: "Leichte Pflege",
    purpose: "Pflegt die Längen.",
    pills: [],
    frequency: "nach jeder Haarwäsche",
    imageUrl: "https://example.com/c.webp",
    product,
    fallbackNote: null,
    detailBlocks: [{ title: "Worauf es beim Produkt ankommt", body: "x" }],
  }
}

const product = {
  name: "Conditioner Aqua",
  priceLabel: "19,90 €",
  netContentLabel: "250 ml",
  availabilityLabel: null,
  purchaseLinkStatus: "available" as const,
  productUrl: null,
}

test("badge order: tier first, then over budget; nothing without the fields", () => {
  assert.deepEqual(needCardProductBadges(product), [])
  assert.deepEqual(needCardProductBadges(null), [])
  assert.deepEqual(
    needCardProductBadges({ ...product, overBudget: true, marketSegment: "professional" }),
    ["Profi", "Über deinem Budget"],
  )
  assert.deepEqual(needCardProductBadges({ ...product, marketSegment: "drugstore" }), ["Drogerie"])
  assert.deepEqual(needCardProductBadges({ ...product, overBudget: false }), [])
})

test("the card and its detail sheet render the badges only when present", () => {
  const plain = renderToStaticMarkup(<NeedCard card={card(product)} />)
  assert.doesNotMatch(plain, /data-plan-start-card-badges/)
  assert.doesNotMatch(plain, /Über deinem Budget|Drogerie|Profi</)

  const badged = { ...product, overBudget: true, marketSegment: "professional" as const }
  const cardHtml = renderToStaticMarkup(<NeedCard card={card(badged)} />)
  assert.match(cardHtml, /data-plan-start-card-badge="Profi"/)
  assert.match(cardHtml, /data-plan-start-card-badge="Über deinem Budget"/)

  const sheetHtml = renderToStaticMarkup(<ProductDetailSheetBody card={card(badged)} />)
  assert.match(sheetHtml, /data-plan-start-detail-badge="Profi"/)
  assert.match(sheetHtml, /data-plan-start-detail-badge="Über deinem Budget"/)
  assert.doesNotMatch(
    renderToStaticMarkup(<ProductDetailSheetBody card={card(product)} />),
    /data-plan-start-detail-badges/,
  )
})

function readyPlan() {
  const result = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-14T10:00:00.000Z",
  })
  assert.equal(result.status, "ready")
  if (result.status !== "ready") throw new Error("expected ready snapshot")
  const plan = adaptInitialNeedSnapshotToPlanStartViewModel(result.snapshot)
  assert.ok(plan)
  return { ...plan, personalPlanId: "plan-1" }
}

function response(
  commerce: Partial<Stage1ProductExampleCommerce>,
  sourceInputHash: string,
): Stage1ProductExamplePreviewResponse {
  return {
    schemaVersion: 2,
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    sourceInputHash,
    directAcceptance: { available: true },
    previews: [
      {
        kind: "recommendation",
        category: "conditioner",
        role: "conditioner_rinse_out",
        decisionKey: "decision:conditioner:conditioner_rinse_out:gap",
        productId: "cond",
        productName: "Conditioner Aqua",
        imageUrl: "https://example.com/c.webp",
        verdict: "ideal",
        authorityVersion: "personal-plan.conditioner.v3",
        factFingerprint: "facts-cond",
        commerce: {
          priceEur: 19.9,
          purchaseLinkStatus: "available",
          netContentValue: null,
          netContentUnit: null,
          priceLabel: "19,90 €",
          netContentLabel: null,
          availabilityLabel: null,
          productUrl: null,
          affiliateDisclosure: null,
          ...commerce,
        },
        reasoning: { productCriteria: "a", fit: "b", frequency: "c" },
      },
    ],
  }
}

function conditionerProduct(plan: PlanStartReadyViewModel) {
  const cards = [...plan.basis.cards, ...(plan.optional?.cards ?? [])].flatMap((item) =>
    isNeedCardGroup(item) ? item.members : [item],
  )
  return cards.find((item) => item.category === "conditioner")?.product
}

test("the card adapter maps overBudget and marketSegment only when the preview carried them", () => {
  const plan = readyPlan()
  const hash = plan.sourceInputHash!

  const plain = conditionerProduct(applyStage1ProductExamplePreviews(plan, response({}, hash)))
  assert.ok(plain)
  assert.equal("overBudget" in plain, false)
  assert.equal("marketSegment" in plain, false)

  const withinBudget = conditionerProduct(
    applyStage1ProductExamplePreviews(plan, response({ overBudget: false }, hash)),
  )
  assert.equal("overBudget" in withinBudget!, false)

  const badged = conditionerProduct(
    applyStage1ProductExamplePreviews(
      plan,
      response({ overBudget: true, marketSegment: "professional" }, hash),
    ),
  )
  assert.equal(badged?.overBudget, true)
  assert.equal(badged?.marketSegment, "professional")
})
