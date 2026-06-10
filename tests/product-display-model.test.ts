import assert from "node:assert/strict"
import test from "node:test"

import {
  buildCompactProductFacts,
  buildDrawerProductProfileRows,
  buildProductApplicationSentence,
  buildProductMatchSummary,
  formatProductPrice,
  getProductCategoryLabel,
  getShopLabel,
  getValidAffiliateLink,
  shouldShowAffiliateDisclosure,
} from "@/components/chat/product-display-model"
import type { HairProfile, Product } from "@/lib/types"

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
    tags: ["internal:leave-in"],
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

function createNonLeaveInShampoo(): Product {
  return {
    id: "product-shampoo-1",
    name: "Sensitive Balance Shampoo",
    brand: "Beispiel",
    description:
      "Mildes Shampoo fuer eine ruhige Kopfhaut und Laengen, die nicht zusaetzlich beschwert werden sollen.",
    short_description: "Mildes Shampoo fuer feines Haar und schuppige Kopfhaut.",
    category: "Shampoo",
    affiliate_link: null,
    image_url: null,
    price_eur: 8.95,
    currency: "EUR",
    tags: ["internal:shampoo_bucket", "matched_profile:fine"],
    suitable_thicknesses: ["fine"],
    suitable_concerns: ["schuppen", "dryness", "raw_unknown_code"],
    is_active: true,
    lifecycle_status: "active",
    sort_order: 1,
    recommendation_meta: {
      category: "shampoo",
      score: 0.87,
      top_reasons: ["Profil-Match: fine", "Shampoo-Bucket: schuppen"],
      tradeoffs: ["Trade-offs: raw fallback"],
      usage_hint: "In die nasse Kopfhaut einmassieren und gruendlich ausspuelen.",
      matched_profile: {
        thickness: "fine",
        scalp_type: "dry",
        scalp_condition: "dandruff",
      },
      matched_bucket: "schuppen",
      matched_concern_code: "schuppen",
    },
    created_at: "2026-05-13T00:00:00.000Z",
    updated_at: "2026-05-13T00:00:00.000Z",
  }
}

function createFineHairProfile(): HairProfile {
  return {
    id: "hair-profile-1",
    user_id: "user-1",
    hair_texture: "wavy",
    thickness: "fine",
    density: "medium",
    concerns: [],
    products_used: null,
    shampoo_frequency: null,
    heat_styling: "several_weekly",
    styling_tools: ["blow_dryer", "flat_iron"],
    goals: ["shine"],
    cuticle_condition: null,
    protein_moisture_balance: null,
    scalp_type: null,
    scalp_condition: null,
    chemical_treatment: [],
    desired_volume: null,
    routine_preference: null,
    current_routine_products: ["conditioner"],
    towel_material: null,
    towel_technique: null,
    drying_method: null,
    brush_type: null,
    night_protection: null,
    uses_heat_protection: false,
    additional_notes: null,
    conversation_memory: null,
    created_at: "2026-05-13T00:00:00.000Z",
    updated_at: "2026-05-13T00:00:00.000Z",
  }
}

test("buildCompactProductFacts returns whitelisted leave-in facts for a Wella-like product", () => {
  assert.deepEqual(buildCompactProductFacts(createWellaLikeLeaveIn()), [
    { label: "Lotion", source: "format" },
    { label: "Hitzeschutz", source: "heat_protection" },
    { label: "Pflege: ausgewogen", source: "care_focus" },
  ])
})

test("buildDrawerProductProfileRows maps leave-in metadata to user-facing profile rows", () => {
  assert.deepEqual(buildDrawerProductProfileRows(createWellaLikeLeaveIn()), [
    { label: "Textur/Form", value: "Lotion" },
    { label: "Gefühl", value: "Mittel" },
    { label: "Wirkung", value: "Ausgewogene Pflege" },
    { label: "Hitzeschutz", value: "Ja" },
    { label: "Rolle", value: "Booster nach dem Conditioner" },
  ])
})

test("buildProductMatchSummary synthesizes product facts and profile signals without internal labels", () => {
  const summary = buildProductMatchSummary(createWellaLikeLeaveIn(), createFineHairProfile())

  assert.match(summary, /stylst regelmäßig mit Hitze/)
  assert.match(summary, /mehr Glanz/)
  assert.match(summary, /feines Haar/)
  assert.match(summary, /schnell beschwert/)
  assert.match(summary, /Leave-in-Lotion/)
  assert.match(summary, /Hitzeschutz/)
  assert.match(summary, /Booster nach dem Conditioner/)
  assert.match(summary, /weil sie Hitzeschutz mit ausgewogener Pflege verbindet/)
  assert.doesNotMatch(summary, /Dein Styling|Deine Haardicke|Dein Ziel|Routine-Rolle/)
  assert.doesNotMatch(summary, /Leave-in-Zielprofil|grossen Teilen|Passt zum/)
  assert.equal(summary.split(/\n+/).length, 1)
})

test("non-leave-in products get drawer profile rows and a match summary without leaking metadata", () => {
  const product = createNonLeaveInShampoo()
  const summary = buildProductMatchSummary(product, createFineHairProfile())
  const rows = buildDrawerProductProfileRows(product)
  const rendered = `${summary} ${rows.map((row) => `${row.label}: ${row.value}`).join(" ")}`

  assert.notEqual(summary, "")
  assert.ok(rows.length >= 3)
  assert.match(summary, /Dieses Shampoo passt/)
  assert.match(summary, /feines Haar/)
  assert.match(summary, /Schuppen/)
  assert.deepEqual(rows.slice(0, 3), [
    { label: "Kategorie", value: "Shampoo" },
    { label: "Geeignet für", value: "Feines Haar" },
    { label: "Fokus", value: "Schuppen, Trockenheit" },
  ])
  assert.equal(
    rows.some((row) => row.label === "Kurzprofil"),
    false,
  )

  assert.doesNotMatch(
    rendered,
    /Score|Profil-Match|Empfehlungskontext|Shampoo-Bucket|Trade-offs|recommendation_meta/i,
  )
  assert.doesNotMatch(
    rendered,
    /internal:|matched_profile|raw_unknown_code|schuppen|dryness|fine|0\.87/,
  )
  assert.doesNotMatch(rendered, /[a-z]+_[a-z]+/)
})

test("formatProductPrice formats EUR prices for German UI", () => {
  assert.equal(formatProductPrice(18.51, "EUR"), "18,51 €")
})

test("formatProductPrice falls back to EUR for unexpected currency values", () => {
  assert.equal(formatProductPrice(18.51, "NOT_A_CURRENCY"), "18,51 €")
})

test("buildProductApplicationSentence returns a complete usage sentence", () => {
  const sentence = buildProductApplicationSentence(
    createWellaLikeLeaveIn(),
    createFineHairProfile(),
  )

  assert.match(sentence, /^Sehr sparsam ins handtuchtrockene Haar geben/)
  assert.doesNotMatch(sentence, /Bei feinem Haar lieber mit wenig Produkt starten/)
  assert.match(sentence, /\.$/)
})

test("buildProductApplicationSentence does not duplicate existing fine-hair sparing guidance", () => {
  const product = createWellaLikeLeaveIn()
  product.recommendation_meta = product.recommendation_meta
    ? {
        ...product.recommendation_meta,
        usage_hint: "Bei feinem Haar sparsam dosieren.",
      }
    : null

  assert.equal(
    buildProductApplicationSentence(product, createFineHairProfile()),
    "Bei feinem Haar sparsam dosieren.",
  )
})

test("buildProductMatchSummary falls back to Leave-in for leave-in specs without a category", () => {
  const product = createWellaLikeLeaveIn()
  product.category = null
  product.recommendation_meta = null
  product.leave_in_specs = {
    product_id: product.id,
    format: "lotion",
    weight: "medium",
    conditioner_relationship: "booster_only",
    roles: ["extension_conditioner"],
    provides_heat_protection: true,
    heat_protection_max_c: null,
    heat_activation_required: false,
    care_benefits: ["shine"],
    ingredient_flags: [],
    application_stage: ["towel_dry"],
  }

  const summary = buildProductMatchSummary(product, createFineHairProfile())

  assert.match(summary, /Diese Leave-in-Lotion passt/)
  assert.doesNotMatch(summary, /Diese -Lotion/)
})

test("buildProductMatchSummary uses the right article for leave-in spray summaries", () => {
  const product = createWellaLikeLeaveIn()
  const meta = product.recommendation_meta
  assert.equal(meta?.category, "leave_in")
  product.recommendation_meta = {
    ...meta,
    product_format: "spray",
    product_weight: "light",
  }

  const summary = buildProductMatchSummary(product, createFineHairProfile())

  assert.match(summary, /Dieses Leave-in-Spray passt/)
  assert.match(summary, /weil es Hitzeschutz mit ausgewogener Pflege verbindet/)
  assert.doesNotMatch(summary, /Diese Leave-in-Spray/)
  assert.doesNotMatch(summary, /Hitzeschutz und ausgewogener Pflege/)
})

test("getShopLabel derives a shop-aware buy label from affiliate hosts", () => {
  assert.equal(
    getShopLabel("https://www.dm.de/wella-ultimate-repair-leave-in-p4064666338183.html"),
    "Bei dm kaufen",
  )
})

test("getShopLabel recognizes brand-direct hosts", () => {
  assert.equal(getShopLabel("https://marianila.com/products/x"), "Bei Maria Nila kaufen")
  assert.equal(getShopLabel("https://urban-alchemy.com/products/x"), "Bei Urban Alchemy kaufen")
  assert.equal(
    getShopLabel("https://innersensebeauty.com/products/x"),
    "Bei Innersense Beauty kaufen",
  )
  assert.equal(
    getShopLabel("https://authenticbeautyconcept.de/products/x"),
    "Bei Authentic Beauty Concept kaufen",
  )
  assert.equal(getShopLabel("https://k18hair.com/products/x"), "Bei K18 kaufen")
  assert.equal(getShopLabel("https://olaplex.com/products/x"), "Bei Olaplex kaufen")
})

test("getShopLabel strips locale subdomains before host lookup", () => {
  assert.equal(getShopLabel("https://de.nuxe.com/products/x"), "Bei Nuxe kaufen")
  assert.equal(getShopLabel("https://de.curlsmith.com/products/x"), "Bei Curlsmith kaufen")
  assert.equal(getShopLabel("https://en.neqi-hair.com/products/x"), "Bei Neqi kaufen")
})

test("affiliate links are trimmed and validated before display", () => {
  const product = createWellaLikeLeaveIn()

  product.affiliate_link = "  https://www.amazon.de/example-product?tag=test  "
  assert.equal(
    getValidAffiliateLink(product.affiliate_link),
    "https://www.amazon.de/example-product?tag=test",
  )
  assert.equal(getShopLabel(product.affiliate_link), "Bei Amazon kaufen")
  assert.equal(shouldShowAffiliateDisclosure(product), true)

  product.affiliate_link = "javascript:alert(1)"
  assert.equal(getValidAffiliateLink(product.affiliate_link), "")
  assert.equal(getShopLabel(product.affiliate_link), "Kaufen")
  assert.equal(shouldShowAffiliateDisclosure(product), false)

  product.affiliate_link = "   "
  assert.equal(getValidAffiliateLink(product.affiliate_link), "")
  assert.equal(shouldShowAffiliateDisclosure(product), false)
})

test("category labels are public whitelist only", () => {
  assert.equal(getProductCategoryLabel("Conditioner (Drogerie)"), "Conditioner")
  assert.equal(getProductCategoryLabel("Öle"), "Öl")
  assert.equal(getProductCategoryLabel("deep_cleansing_shampoo"), "Tiefenreinigung")
  assert.equal(getProductCategoryLabel("internal_shampoo_bucket"), "")
})

test("fallback summaries drop internal-looking description text", () => {
  const product = createNonLeaveInShampoo()
  product.short_description = "internal:leave-in matched-profile:fine raw_code"

  const summary = buildProductMatchSummary(product, createFineHairProfile())

  assert.match(summary, /Dieses Shampoo passt/)
  assert.doesNotMatch(summary, /internal:leave-in|matched-profile|raw_code/)
})
