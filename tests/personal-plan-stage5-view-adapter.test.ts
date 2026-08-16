import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import type { CompiledApplicationViewV1 } from "../src/lib/routines/personal-plan/application/compiler"
import { ApplicationPage } from "../src/components/application/application-page"
import type { ApplicationPageView } from "../src/components/application/application-types"
import { toApplicationPageView } from "../src/components/application/application-view-adapter"

const shampooId = "11111111-1111-4111-8111-111111111111"

function compiledView(): CompiledApplicationViewV1 {
  const shampoo = {
    productId: shampooId,
    productName: "Mildes Shampoo",
    imageUrl:
      "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/mildes-shampoo.webp",
    category: "shampoo" as const,
    roles: ["cleanse" as const],
    applicationInstanceKey: `${shampooId}:wet_cleanse`,
    anchor: "wet_cleanse",
    steps: [
      {
        stepKey: "apply",
        action: "apply_product" as const,
        copyDe: "Auf die nasse Kopfhaut geben und sanft einmassieren.",
      },
    ],
    noteDe: null,
    status: "confirmed" as const,
  }

  return {
    days: [
      {
        key: "wash_day",
        productBlocks: [shampoo],
        outerSequence: [
          {
            kind: "state_transition",
            fromAnchor: "dry",
            toAnchor: "wet_cleanse",
            copyDe: "Haare gründlich mit Wasser anfeuchten.",
          },
          { kind: "product", block: shampoo },
        ],
      },
      { key: "rest_day", productBlocks: [], outerSequence: [] },
    ],
    failures: [],
  }
}

const definitions = [
  {
    key: "wash_day" as const,
    definitionVersion: 1,
    locale: "de" as const,
    label: "Waschtag",
    summary: "Deine vollständige Basiswäsche.",
    sortOrder: 10,
  },
  {
    key: "rest_day" as const,
    definitionVersion: 1,
    locale: "de" as const,
    label: "Pausentag",
    summary: "An einem Pausentag ist keine Anwendung nötig.",
    sortOrder: 80,
  },
]

test("adapts compiler output into the product-led Anwendung view", () => {
  const view = toApplicationPageView({
    compiled: compiledView(),
    dayDefinitions: definitions,
    cadenceByDay: { wash_day: "Bei deiner nächsten Haarwäsche" },
  })

  assert.equal(view.state, "ready")
  if (view.state !== "ready") return

  assert.deepEqual(
    view.days.map(({ dayType, labelDe, sortOrder }) => ({ dayType, labelDe, sortOrder })),
    [
      { dayType: "wash_day", labelDe: "Waschtag", sortOrder: 10 },
      { dayType: "rest_day", labelDe: "Pausentag", sortOrder: 80 },
    ],
  )
  assert.equal(view.days[0].cadenceDe, "Bei deiner nächsten Haarwäsche")
  assert.equal(view.days[0].shelf[0]?.category, "shampoo")
  assert.equal(
    view.days[0].steps.find((step) => step.kind === "product")?.imageUrl,
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/mildes-shampoo.webp",
  )
  const overviewHtml = renderToStaticMarkup(createElement(ApplicationPage, { view }))
  const detailHtml = renderToStaticMarkup(
    createElement(ApplicationPage, { view: { ...view, selectedDayType: "wash_day" } }),
  )
  assert.match(overviewHtml, /Bei deiner nächsten Haarwäsche/)
  assert.match(overviewHtml, /mildes-shampoo\.webp/)
  assert.match(overviewHtml, /data-application-silhouette="shampoo"/)
  assert.doesNotMatch(overviewHtml, /snap-x|overflow-x-auto|w-\[82vw\]/)
  assert.match(detailHtml, /Bei deiner nächsten Haarwäsche/)
  assert.equal(view.days[0].steps[0].kind, "transition")
  assert.equal(view.days[0].steps[1].kind, "product")
  if (view.days[0].steps[1].kind !== "product") return
  assert.equal(view.days[0].steps[1].categoryLabelDe, "Shampoo")
  assert.equal(view.days[0].steps[1].purposeDe, "Reinigt Kopfhaut und Ansatz.")
  assert.equal(
    view.days[0].steps[1].actions[0].copyDe,
    "Auf die nasse Kopfhaut geben und sanft einmassieren.",
  )
})

test("retains Pausentag as the recovery route when no complete product day exists", () => {
  const view = toApplicationPageView({
    compiled: {
      days: [{ key: "rest_day", productBlocks: [], outerSequence: [] }],
      failures: [{ dayType: "wash_day", reason: "incomplete_guidance" }],
    },
    dayDefinitions: definitions,
  })

  assert.equal(view.state, "no_complete_day")
  if (view.state === "no_complete_day") {
    assert.equal(view.restDay.labelDe, "Pausentag")
  }
})

test("renders an unresolved-only day as explicitly partial rather than claiming complete guidance", () => {
  const unresolved = {
    productId: "33333333-3333-4333-8333-333333333333",
    productName: "Produkt mit offener Anleitung",
    category: "shampoo" as const,
    role: "cleanse" as const,
    applicationInstanceKey: "shampoo:unresolved",
    status: "unresolved" as const,
  }
  const view = toApplicationPageView({
    compiled: {
      days: [
        {
          key: "wash_day",
          productBlocks: [],
          outerSequence: [{ kind: "unresolved_product", block: unresolved }],
          isPartial: true,
        },
        { key: "rest_day", productBlocks: [], outerSequence: [] },
      ],
      failures: [],
    },
    dayDefinitions: definitions,
  })

  assert.equal(view.state, "ready")
  if (view.state !== "ready") return
  assert.equal(view.days[0]?.isPartial, true)
  assert.equal(view.days[0]?.unresolvedProductCount, 1)
  const overviewHtml = renderToStaticMarkup(createElement(ApplicationPage, { view }))
  assert.match(overviewHtml, /Teilweise bereit/)
  const detailHtml = renderToStaticMarkup(
    createElement(ApplicationPage, {
      view: { ...view, selectedDayType: "wash_day" },
    }),
  )
  assert.match(detailHtml, /Produkt mit offener Anleitung/)
  assert.match(detailHtml, /Die Anwendung für dieses Produkt wird noch geprüft/)
})

test("names a demoted catalog product as temporarily unavailable, not as an open decision", () => {
  const unresolved = {
    productId: null,
    productName: null,
    category: "shampoo" as const,
    role: "cleanse" as const,
    applicationInstanceKey: "shampoo:catalog-unavailable",
    status: "unresolved" as const,
    reason: "catalog_unavailable" as const,
  }
  const view = toApplicationPageView({
    compiled: {
      days: [
        {
          key: "wash_day",
          productBlocks: [],
          outerSequence: [{ kind: "unresolved_product", block: unresolved }],
          isPartial: true,
        },
        { key: "rest_day", productBlocks: [], outerSequence: [] },
      ],
      failures: [],
    },
    dayDefinitions: definitions,
  })

  assert.equal(view.state, "ready")
  if (view.state !== "ready") return
  assert.equal(
    view.days[0]?.steps[0]?.kind === "unresolved_product"
      ? view.days[0].steps[0].reason
      : undefined,
    "catalog_unavailable",
  )
  const overviewHtml = renderToStaticMarkup(createElement(ApplicationPage, { view }))
  assert.match(overviewHtml, /Regal: Shampoo: Produkt gerade nicht verfügbar/)
  assert.doesNotMatch(overviewHtml, /Produkt noch offen/)
  // The sighted badge must agree with the aria-label, not read "Offen".
  assert.match(overviewHtml, />Nicht verfügbar</)
  assert.doesNotMatch(overviewHtml, />Offen</)
  const detailHtml = renderToStaticMarkup(
    createElement(ApplicationPage, { view: { ...view, selectedDayType: "wash_day" } }),
  )
  assert.match(detailHtml, /Produkt gerade nicht verfügbar/)
  assert.match(
    detailHtml,
    /Dein gewähltes Produkt ist im Katalog gerade nicht verfügbar\. Deine Routine bleibt gespeichert\./,
  )
  assert.doesNotMatch(detailHtml, /Für diese Kategorie fehlen noch ein bestätigtes Produkt/)
})

test("fails closed when a compiled day has no active canonical definition", () => {
  assert.throws(
    () => toApplicationPageView({ compiled: compiledView(), dayDefinitions: definitions.slice(1) }),
    /missing active day definition for wash_day/,
  )
})

test("passes a provisional-status block through the adapter without special visual treatment, plus a local unresolved product gap", () => {
  const compiled = compiledView()
  const washDay = compiled.days[0]!
  const provisional = {
    ...washDay.productBlocks[0]!,
    productId: "22222222-2222-4222-8222-222222222222",
    productName: "Vorgemerkter Conditioner",
    imageUrl:
      "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/vorgemerkter-conditioner.webp",
    category: "conditioner" as const,
    roles: ["condition" as const],
    applicationInstanceKey: "conditioner:application",
    anchor: "post_cleanse_rinse_off",
    status: "provisional" as const,
  }
  const unresolved = {
    productId: null,
    productName: null,
    category: "leave_in" as const,
    role: "leave_in" as const,
    applicationInstanceKey: "leave-in:unresolved",
    status: "unresolved" as const,
  }
  washDay.productBlocks.push(provisional)
  washDay.outerSequence.push(
    { kind: "product", block: provisional },
    { kind: "unresolved_product", block: unresolved },
  )
  washDay.isPartial = true

  const view = toApplicationPageView({ compiled, dayDefinitions: definitions })
  assert.equal(view.state, "ready")
  if (view.state !== "ready") return
  assert.deepEqual(
    view.days[0]!.steps.map((step) => step.kind),
    ["transition", "product", "product", "unresolved_product"],
  )
  assert.equal(view.days[0]!.provisionalProductCount, 1)
  assert.equal(view.days[0]!.unresolvedProductCount, 1)
  assert.deepEqual(
    view.days[0]!.shelf.map((slot) => (slot.kind === "product" ? slot.status : slot.kind)),
    ["confirmed", "provisional", "open"],
  )
  assert.deepEqual(
    view.days[0]!.shelf.map((slot) => slot.category),
    ["shampoo", "conditioner", "leave_in"],
  )

  const html = renderToStaticMarkup(createElement(ApplicationPage, { view }))
  assert.match(html, /teilweise bereit/i)
  assert.doesNotMatch(html, /rounded-full[^>]*>Plan teilweise bereit/)
  assert.match(html, /Teilweise bereit/)
  assert.match(html, /data-application-shelf-scene="true"/)
  // The status field still flows through untouched (only the rendering
  // branches that differentiated it visually were removed).
  assert.match(html, /data-application-shelf-slot="provisional"/)
  assert.match(html, /vorgemerkter-conditioner\.webp/)
  assert.match(html, /data-application-shelf-slot="open"/)
  // A selected catalog product is instantly a full routine member: the shelf
  // summary names products plainly, with no "(bestätigt)"/"(vorläufig)" split.
  assert.match(
    html,
    /Regal: Shampoo: Mildes Shampoo; Conditioner: Vorgemerkter Conditioner; Leave-in: Produkt noch offen/,
  )
  assert.doesNotMatch(html, /Du kannst die bekannten Schritte bereits nutzen/)
  assert.doesNotMatch(html, /Vorläufig/)

  const selectedHtml = renderToStaticMarkup(
    createElement(ApplicationPage, {
      view: { ...view, selectedDayType: "wash_day" },
    }),
  )
  assert.doesNotMatch(selectedHtml, /Vorläufig/)
  assert.doesNotMatch(selectedHtml, /seine Anwendung ist bereits bekannt/)
  assert.match(selectedHtml, /Produkt noch offen/)
  assert.match(selectedHtml, /Für diese Kategorie fehlen noch ein bestätigtes Produkt/)
})

test("uses a neutral shelf fallback when a confirmed catalog image is missing", () => {
  const compiled = compiledView()
  compiled.days[0]!.productBlocks[0]!.imageUrl = null
  const productStep = compiled.days[0]!.outerSequence.find((step) => step.kind === "product")
  if (productStep?.kind === "product") productStep.block.imageUrl = null

  const view = toApplicationPageView({ compiled, dayDefinitions: definitions })
  assert.equal(view.state, "ready")
  if (view.state !== "ready") return

  const html = renderToStaticMarkup(createElement(ApplicationPage, { view }))
  assert.match(html, /data-application-image-treatment="fallback"/)
  assert.match(html, /Regal: Shampoo: Mildes Shampoo/)
  assert.doesNotMatch(html, /\(bestätigt\)/)
})

test("uses a neutral contained fallback for nonstandard product imagery", () => {
  const compiled = compiledView()
  compiled.days[0]!.productBlocks[0]!.imageUrl = "https://owner.example/uploads/shampoo.jpg"
  const productStep = compiled.days[0]!.outerSequence.find((step) => step.kind === "product")
  if (productStep?.kind === "product") {
    productStep.block.imageUrl = "https://owner.example/uploads/shampoo.jpg"
  }

  const view = toApplicationPageView({ compiled, dayDefinitions: definitions })
  assert.equal(view.state, "ready")
  if (view.state !== "ready") return

  const html = renderToStaticMarkup(createElement(ApplicationPage, { view }))
  assert.match(html, /data-application-image-treatment="fallback"/)
  assert.match(html, /src="https:\/\/owner\.example\/uploads\/shampoo\.jpg"/)
  assert.doesNotMatch(html, /data-application-silhouette="shampoo"/)
})

test("keeps the provisional status data hook accessible for nonstandard product imagery", () => {
  const compiled = compiledView()
  compiled.days[0]!.productBlocks[0]!.status = "provisional"
  compiled.days[0]!.productBlocks[0]!.provisionalReason = "product_selection"
  compiled.days[0]!.productBlocks[0]!.imageUrl = "https://owner.example/uploads/shampoo.jpg"
  const productStep = compiled.days[0]!.outerSequence.find((step) => step.kind === "product")
  if (productStep?.kind === "product") {
    productStep.block.status = "provisional"
    productStep.block.provisionalReason = "product_selection"
    productStep.block.imageUrl = "https://owner.example/uploads/shampoo.jpg"
  }

  const view = toApplicationPageView({ compiled, dayDefinitions: definitions })
  assert.equal(view.state, "ready")
  if (view.state !== "ready") return

  const html = renderToStaticMarkup(createElement(ApplicationPage, { view }))
  assert.match(html, /data-application-shelf-slot="provisional"/)
  assert.match(html, /Regal: Shampoo: Mildes Shampoo/)
  assert.doesNotMatch(html, /\(vorläufig\)/)
})

test("renders the ten approved category-specific product silhouettes", () => {
  // This table intentionally locks the signed-off geometry independently of production.
  // A path or safe-area change must therefore be reviewed and updated in both places.
  const silhouettes = [
    {
      category: "shampoo",
      path: "M2 178V76Q2 59 19 53L34 48V31H86V48L101 53Q118 59 118 76V178Z",
      image: { x: -5, y: 20, width: 130, height: 160 },
    },
    {
      category: "conditioner",
      path: "M20 178L13 49Q12 31 30 25H90Q108 31 107 49L100 178Z",
      image: { x: -4, y: 17, width: 128, height: 164 },
    },
    {
      category: "leave_in",
      path: "M28 178V73Q28 58 43 58H48V42H43V23H78L112 34L104 50H76L69 58H80Q94 58 94 73V178Z",
      image: { x: 4, y: 16, width: 112, height: 166 },
    },
    {
      category: "heat_protectant",
      path: "M24 178L33 101Q28 70 45 54V31H75V54Q92 70 87 101L96 178Z",
      image: { x: 16, y: 24, width: 88, height: 158 },
    },
    {
      category: "oil",
      path: "M24 178V88Q24 70 43 62V49L36 22Q35 9 50 8H70Q85 9 84 22L77 49V62Q96 70 96 88V178Z",
      image: { x: 3, y: 4, width: 114, height: 176 },
    },
    {
      category: "mask",
      path: "M10 178L17 91H23V72H97V91H103L110 178Z",
      image: { x: 14, y: 72, width: 92, height: 102 },
    },
    {
      category: "scalp_care",
      path: "M31 178V76Q31 61 46 61H50V46H48V28H69L92 10L101 18L78 49V61H84Q98 61 98 76V178Z",
      image: { x: 16, y: 8, width: 88, height: 170 },
    },
    {
      category: "dry_shampoo",
      path: "M28 178V42Q28 27 45 21V10H75V21Q92 27 92 42V178Z",
      image: { x: 18, y: 4, width: 84, height: 174 },
    },
    {
      category: "bondbuilder",
      path: "M18 25H102L94 148Q92 163 80 166V178H40V166Q28 163 26 148Z",
      image: { x: 8, y: 12, width: 104, height: 168 },
    },
    {
      category: "deep_cleansing_shampoo",
      path: "M23 178V73Q23 58 38 58H46V41H58V25H96L110 31L103 45H74V58H84Q98 58 98 73V178Z",
      image: { x: 13, y: 18, width: 94, height: 160 },
    },
  ] as const
  const imageUrl =
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-product.webp"
  const view: ApplicationPageView = {
    state: "ready",
    days: [
      {
        dayType: "wash_day",
        sortOrder: 10,
        labelDe: "Waschtag",
        summaryDe: "Alle Produktformen",
        cadenceDe: null,
        steps: [],
        isPartial: false,
        provisionalProductCount: 0,
        unresolvedProductCount: 0,
        shelf: silhouettes.map(({ category }, index) => ({
          kind: "product" as const,
          productId: `product-${index}`,
          productName: category,
          imageUrl,
          category,
          status: "confirmed" as const,
        })),
      },
    ],
  }

  const html = renderToStaticMarkup(createElement(ApplicationPage, { view }))
  for (const { category, path, image } of silhouettes) {
    assert.match(html, new RegExp(`data-application-silhouette="${category}"`))
    assert.ok(html.includes(`d="${path}"`), `${category} uses its approved path`)
    const imageTag = html.match(
      new RegExp(`<image\\b[^>]*data-application-silhouette-image="${category}"[^>]*>`),
    )
    assert.ok(imageTag, `${category} renders its standardized catalog image`)
    for (const [attribute, value] of Object.entries({
      x: image.x,
      y: image.y,
      width: image.width,
      height: image.height,
      preserveAspectRatio: "xMidYMid meet",
    })) {
      assert.match(imageTag[0], new RegExp(`${attribute}="${value}"`))
    }
  }
  assert.equal((html.match(/data-application-shelf-row="true"/g) ?? []).length, 2)
  assert.match(html, /bg-\[#e9e3ed\]/)
  assert.match(html, /fill="#f3f0e8"/)
  assert.doesNotMatch(html, /#fffdfb_0%,#f7efe7_100%/)
  assert.doesNotMatch(html, /preserveAspectRatio="xMidYMid slice"/)
})

test("counts open placeholders toward the five-slot shelf row cap", () => {
  const categories = [
    "shampoo",
    "conditioner",
    "leave_in",
    "heat_protectant",
    "oil",
    "mask",
  ] as const
  const view: ApplicationPageView = {
    state: "ready",
    days: [
      {
        dayType: "wash_day",
        sortOrder: 10,
        labelDe: "Waschtag",
        summaryDe: "Sechs offene Plätze",
        cadenceDe: null,
        steps: [],
        isPartial: true,
        provisionalProductCount: 0,
        unresolvedProductCount: categories.length,
        shelf: categories.map((category) => ({
          kind: "open" as const,
          category,
          categoryLabelDe: category,
          reason: "no_product_chosen" as const,
        })),
      },
    ],
  }

  const html = renderToStaticMarkup(createElement(ApplicationPage, { view }))
  assert.equal((html.match(/data-application-shelf-row="true"/g) ?? []).length, 2)
  assert.equal((html.match(/data-application-shelf-slot="open"/g) ?? []).length, 6)
})
