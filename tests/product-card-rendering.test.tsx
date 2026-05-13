import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { ProductCard } from "@/components/chat/product-card"
import type { Product } from "@/lib/types"

function createWellaLikeLeaveIn(): Product {
  return {
    id: "product-wella-leave-in",
    name: "Wella Ultimate Repair Leave-In",
    brand: "Wella",
    description: null,
    short_description: null,
    category: "Leave-in",
    affiliate_link: "https://www.dm.de/wella-ultimate-repair-leave-in-p4064666338183.html",
    image_url: null,
    price_eur: 18.51,
    currency: "EUR",
    tags: ["internal:leave-in", "heat_style"],
    suitable_thicknesses: [],
    suitable_concerns: [],
    is_active: true,
    lifecycle_status: "active",
    sort_order: 0,
    recommendation_meta: {
      category: "leave_in",
      score: 0.91,
      top_reasons: [
        "Passt in grossen Teilen zu deinem Leave-in-Zielprofil",
        "Routine-Rolle: Booster nach dem Conditioner",
      ],
      tradeoffs: [],
      usage_hint:
        "Sehr sparsam ins handtuchtrockene Haar geben und vor dem Föhnen oder Hitzestyling gleichmäßig in Längen und Spitzen verteilen.",
      matched_profile: {
        hair_texture: "wavy",
        thickness: "fine",
        density: "medium",
        cuticle_condition: null,
        chemical_treatment: [],
      },
      need_bucket: "shine_protect",
      styling_context: "heat_style",
      conditioner_relationship: "booster_only",
      matched_weight: "medium",
      fit_status: "ideal",
      product_format: "lotion",
      product_weight: "medium",
      product_roles: ["extension_conditioner"],
      product_care_benefits: ["shine", "repair"],
      provides_heat_protection: true,
      product_application_stage: ["towel_dry", "pre_heat"],
      heat_protection_need: "high",
      styling_prep_need: "heat_style",
      product_balance_direction: "balanced",
    },
    created_at: "2026-05-13T00:00:00.000Z",
    updated_at: "2026-05-13T00:00:00.000Z",
  }
}

test("compact product card renders identity, price, whitelisted facts, and a quiet tap affordance", () => {
  const html = renderToStaticMarkup(
    <ProductCard product={createWellaLikeLeaveIn()} onClick={() => {}} />,
  )

  assert.match(html, /Wella Ultimate Repair Leave-In/)
  assert.match(html, /Wella/)
  assert.match(html, /Lotion/)
  assert.match(html, /Hitzeschutz/)
  assert.match(html, /Pflege: ausgewogen/)
  assert.match(html, /lucide-sparkles/)
  assert.doesNotMatch(html, /lucide-shower-head/)

  assert.match(html, /18,51\s*€/)
  assert.doesNotMatch(html, /Zielprofil|grossen Teilen|Routine-Rolle/)
  assert.doesNotMatch(html, /score|0\.91/i)
  assert.doesNotMatch(html, /Tags|Profil-Match|Zielprofil/i)
  assert.doesNotMatch(html, /internal:leave-in|heat_style|booster_only|matched_profile|leave_in/)

  assert.match(html, /Produktdetails öffnen/)
  assert.match(html, /lucide-chevron-right[\s\S]*aria-hidden="true"/)
})

test("compact product card does not surface unmapped raw category values", () => {
  const product = createWellaLikeLeaveIn()
  product.category = "internal_shampoo_bucket"
  product.recommendation_meta = null
  product.leave_in_specs = null

  const html = renderToStaticMarkup(<ProductCard product={product} onClick={() => {}} />)

  assert.doesNotMatch(html, /internal_shampoo_bucket|shampoo_bucket/)
})

test("compact product card maps known category variants to their icons", () => {
  const product = createWellaLikeLeaveIn()
  product.category = "Bondbuilder"
  product.recommendation_meta = null
  product.leave_in_specs = null

  const html = renderToStaticMarkup(<ProductCard product={product} onClick={() => {}} />)

  assert.match(html, /lucide-atom/)
  assert.doesNotMatch(html, /lucide-shower-head/)
})
