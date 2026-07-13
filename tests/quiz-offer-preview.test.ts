import assert from "node:assert/strict"
import test from "node:test"

import { buildQuizOfferPreview, deriveOfferPreviewNeedProfile } from "../src/lib/quiz/offer-preview"
import {
  OFFER_PREVIEW_PRODUCT_MODULES,
  selectOfferPreviewProduct,
} from "../src/lib/quiz/offer-preview-products"
import type { OfferPreviewNeedProfile } from "../src/lib/quiz/offer-preview-types"

test("the curated registry is coverage-driven and every record has a product identity and image", () => {
  assert.equal(OFFER_PREVIEW_PRODUCT_MODULES.length, 27)
  for (const module of OFFER_PREVIEW_PRODUCT_MODULES) {
    assert.ok(module.catalogProductId)
    assert.ok(module.name)
    assert.match(module.imageUrl, /^https:\/\//)
    assert.ok(module.approvedCopy.provenance)
  }
})

test("all scalp-route and thickness profiles select a deterministic shampoo example", () => {
  const routes: OfferPreviewNeedProfile["shampoo"]["scalpRoute"][] = [
    "balanced",
    "oily",
    "dry",
    "dandruff",
    "irritated",
  ]
  const thicknesses: OfferPreviewNeedProfile["shampoo"]["thickness"][] = [
    "fine",
    "normal",
    "coarse",
  ]

  for (const scalpRoute of routes) {
    for (const thickness of thicknesses) {
      const needs: OfferPreviewNeedProfile = {
        shampoo: {
          scalpRoute,
          thickness,
          cleansingIntensity:
            scalpRoute === "dry" || scalpRoute === "irritated" ? "gentle" : "regular",
          cadence: { label: "2x/Woche" },
        },
        conditioner: {
          weight: "medium",
          balance: "balanced",
          cadence: { label: "Bei jeder Haarwäsche" },
        },
        extra: null,
      }
      const product = selectOfferPreviewProduct("shampoo", needs)
      assert.ok(product.name)
      if (!(scalpRoute === "oily" && thickness === "coarse")) {
        assert.ok(product.shampooFit?.scalpRoutes.includes(scalpRoute))
        assert.ok(product.shampooFit?.thicknesses.includes(thickness))
      } else {
        assert.match(product.approvedCopy.productNote, /finalisiert/i)
      }
    }
  }
})

test("fine oily profiles use a regular shampoo example without deep-cleansing naming", () => {
  const needs: OfferPreviewNeedProfile = {
    shampoo: {
      scalpRoute: "oily",
      thickness: "fine",
      cleansingIntensity: "regular",
      cadence: { label: "3x/Woche" },
    },
    conditioner: {
      weight: "light",
      balance: "balanced",
      cadence: { label: "Bei jeder Haarwäsche" },
    },
    extra: null,
  }
  const product = selectOfferPreviewProduct("shampoo", needs)

  assert.equal(product.name, "Pantene Pro-V Volumen Pur")
  assert.equal(product.shampooFit?.cleansingIntensity, "regular")
  assert.doesNotMatch(product.name, /Tiefenreinigung/i)
})

test("all thickness and balance profiles select a conditioner without crossing those hard axes", () => {
  const thicknesses = ["fine", "normal", "coarse"] as const
  const balances = ["balanced", "moisture", "protein"] as const
  const weights = ["light", "medium", "rich"] as const

  for (const thickness of thicknesses) {
    for (const balance of balances) {
      for (const weight of weights) {
        const needs: OfferPreviewNeedProfile = {
          shampoo: {
            scalpRoute: "balanced",
            thickness,
            cleansingIntensity: "regular",
            cadence: { label: "2x/Woche" },
          },
          conditioner: {
            weight,
            balance,
            cadence: { label: "Bei jeder Haarwäsche" },
          },
          extra: null,
        }
        const product = selectOfferPreviewProduct("conditioner", needs)
        assert.ok(product.conditionerFit?.thicknesses.includes(thickness))
        assert.ok(product.conditionerFit?.balances.includes(balance))
      }
    }
  }
})

test("conditioner signal exposes thickness and balance direction without claiming a density-matched weight", () => {
  const preview = buildQuizOfferPreview({
    thickness: "normal",
    density: "high",
    pulltest: "snaps",
    scalp_type: "ausgeglichen",
    concerns: ["dryness"],
    goals: ["moisture"],
  })

  assert.equal(preview.signals[1]?.label, "Mittlere Haarstärke")
  assert.match(preview.signals[1]?.conclusion ?? "", /Feuchtigkeits-Fokus/i)
  assert.doesNotMatch(
    preview.signals[1]?.conclusion ?? "",
    /leichte|mittlere|reichhaltigere|Dichte/i,
  )
})

test("a surface-led result shows two foundation examples and one leave-in suggestion", () => {
  const preview = buildQuizOfferPreview({
    structure: "wavy",
    thickness: "normal",
    density: "medium",
    fingertest: "rau",
    pulltest: "stretches_bounces",
    scalp_type: "ausgeglichen",
    concerns: ["frizz"],
    treatment: ["natur"],
    goals: ["less_frizz"],
  })

  assert.equal(preview.lane, "surface_support")
  assert.equal(preview.products.length, 3)
  assert.deepEqual(
    preview.products.map((product) => product.category),
    ["shampoo", "conditioner", "leave_in"],
  )
  assert.equal(preview.products[2]?.suggested, true)
  assert.match(
    preview.products[0]?.name ?? "",
    /Balea|Neqi|Cantu|Monday|Pantene|Hask|Schätze|Shoulders/i,
  )
})

test("a neutral or colored-only result stays at shampoo and conditioner", () => {
  const preview = buildQuizOfferPreview({
    structure: "straight",
    thickness: "fine",
    density: "low",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    scalp_type: "ausgeglichen",
    concerns: [],
    treatment: ["gefaerbt"],
    goals: ["color_protection"],
  })

  assert.equal(preview.lane, "base")
  assert.equal(preview.products.length, 2)
  assert.doesNotMatch(JSON.stringify(preview), /Farbschutz|farbsicher|Bondbuilder|Dry.Shampoo/i)
})

test("curl definition chooses the curl leave-in example without claiming a universal pattern fit", () => {
  const preview = buildQuizOfferPreview({
    structure: "curly",
    thickness: "coarse",
    density: "high",
    fingertest: "leicht_uneben",
    pulltest: "stretches_bounces",
    scalp_type: "trocken",
    concerns: ["frizz"],
    treatment: ["natur"],
    goals: ["curl_definition"],
  })

  assert.equal(preview.needs.extra?.variant, "curl")
  assert.match(preview.products[2]?.name ?? "", /Coils & Curls/i)
})

test("cadence uses the canonical base scalp target and labels it as a starting point", () => {
  const needs = deriveOfferPreviewNeedProfile({
    scalp_type: "fettig",
    scalp_condition: "schuppen",
    thickness: "normal",
    density: "medium",
  })

  assert.equal(needs.shampoo.cadence.label, "3-4x/Woche")
  assert.match(needs.shampoo.cadence.qualifier ?? "", /Startpunkt/i)
  assert.equal(needs.conditioner.cadence.label, "Bei jeder Haarwäsche")
})
