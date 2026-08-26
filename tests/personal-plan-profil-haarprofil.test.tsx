import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { HairProfileSection } from "../src/components/profile/hair-profile-section"
import {
  buildHairProfileSection,
  hasRefinementDeferredRoles,
  parseHairProfileStatus,
  type HairProfileSectionRow,
} from "../src/lib/personal-plan/refinement/hair-profile-section"
import type { RefinementStatusResponse } from "../src/lib/personal-plan/refinement/refinement-status"

function statusResponse(
  products: "open" | "complete",
  habits: "open" | "complete",
  overrides: Partial<RefinementStatusResponse> = {},
): RefinementStatusResponse {
  const completedModules = [products, habits].filter((entry) => entry === "complete").length
  return {
    modules: [
      { module: "products", status: products, openQuestionCount: products === "open" ? 2 : 0 },
      { module: "habits", status: habits, openQuestionCount: habits === "open" ? 4 : 0 },
    ],
    progress: { completedSteps: 2 + completedModules, totalSteps: 4 },
    module1HandedOff: products === "complete",
    banner: { visible: false, module: null, dismissed: false },
    ...overrides,
  }
}

function rowByKey(rows: HairProfileSectionRow[], key: HairProfileSectionRow["key"]) {
  const row = rows.find((entry) => entry.key === key)
  assert.ok(row, `row ${key} missing`)
  return row
}

test("fresh auto-accept: 2 von 4 with both module rows open and deep-linked", () => {
  const view = buildHairProfileSection({ status: statusResponse("open", "open") })

  assert.equal(view.completedSteps, 2)
  assert.equal(view.totalSteps, 4)
  assert.equal(view.progressPercent, 50)
  assert.deepEqual(
    view.rows.map((row) => [row.key, row.label, row.status, row.step]),
    [
      ["hair_analysis", "Haar-Analyse", "done", 1],
      ["ideal_plan", "Dein Idealplan", "done", 2],
      ["products", "Deine Produkte", "open", 3],
      ["habits", "Deine Gewohnheiten", "open", 4],
    ],
  )
  assert.equal(rowByKey(view.rows, "hair_analysis").href, null)
  assert.equal(rowByKey(view.rows, "ideal_plan").href, "/routine")
  assert.equal(rowByKey(view.rows, "products").href, "/plan-start?refine=products")
  assert.equal(rowByKey(view.rows, "habits").href, "/plan-start?refine=habits")
  assert.deepEqual(
    view.rows.map((row) => row.editHref),
    [null, null, null, null],
  )
  assert.deepEqual(
    view.rows.map((row) => row.note),
    [null, null, null, null],
  )
})

test("products done: 3 von 4, and the finished module row is an edit visit, not a re-walk link", () => {
  const view = buildHairProfileSection({ status: statusResponse("complete", "open") })

  assert.equal(view.completedSteps, 3)
  assert.equal(view.progressPercent, 75)
  const products = rowByKey(view.rows, "products")
  assert.equal(products.status, "done")
  // 2.4 M4: a finished module must not be a chevron row into re-walking it.
  assert.equal(products.href, null)
  assert.equal(products.editHref, "/plan-start?refine=products")
  assert.equal(rowByKey(view.rows, "habits").status, "open")
  assert.equal(rowByKey(view.rows, "habits").href, "/plan-start?refine=habits")
})

test("all done: 4 von 4, full bar, section kept as the durable edit home", () => {
  const view = buildHairProfileSection({ status: statusResponse("complete", "complete") })

  assert.equal(view.completedSteps, 4)
  assert.equal(view.progressPercent, 100)
  assert.deepEqual(
    view.rows.map((row) => row.status),
    ["done", "done", "done", "done"],
  )
  assert.equal(rowByKey(view.rows, "products").editHref, "/plan-start?refine=products")
  assert.equal(rowByKey(view.rows, "habits").editHref, "/plan-start?refine=habits")
  assert.equal(rowByKey(view.rows, "ideal_plan").href, "/routine")
})

test("progress percent is clamped and never divides by zero", () => {
  const overflow = buildHairProfileSection({
    status: statusResponse("complete", "complete", {
      progress: { completedSteps: 9, totalSteps: 4 },
    }),
  })
  assert.equal(overflow.progressPercent, 100)

  const empty = buildHairProfileSection({
    status: statusResponse("open", "open", {
      progress: {
        completedSteps: 0,
        totalSteps: 0,
      } as unknown as RefinementStatusResponse["progress"],
    }),
  })
  assert.equal(empty.progressPercent, 0)
})

test("deferred-role cohort: the open products row carries the unlock sub-note", () => {
  const view = buildHairProfileSection({
    status: statusResponse("open", "open"),
    deferredRolesPendingRefinement: true,
  })

  assert.equal(rowByKey(view.rows, "products").note, "Schaltet offene Empfehlungen frei.")
  assert.equal(rowByKey(view.rows, "habits").note, null)
  assert.equal(rowByKey(view.rows, "hair_analysis").note, null)
})

test("the unlock sub-note disappears once products is done", () => {
  const view = buildHairProfileSection({
    status: statusResponse("complete", "open"),
    deferredRolesPendingRefinement: true,
  })

  assert.equal(rowByKey(view.rows, "products").note, null)
})

test("only refinement_required deferrals count as the cohort signal", () => {
  assert.equal(hasRefinementDeferredRoles(null), false)
  assert.equal(hasRefinementDeferredRoles({ deferredRoleReasons: {} }), false)
  assert.equal(hasRefinementDeferredRoles({ deferredRoleReasons: { a: "no_product" } }), false)
  assert.equal(
    hasRefinementDeferredRoles({ deferredRoleReasons: { a: "preview_unavailable" } }),
    false,
  )
  assert.equal(
    hasRefinementDeferredRoles({
      deferredRoleReasons: { a: "no_product", b: "refinement_required" },
    }),
    true,
  )
  assert.equal(hasRefinementDeferredRoles({}), false)
})

test("a malformed status body leaves the section absent instead of throwing", () => {
  assert.equal(parseHairProfileStatus(null), null)
  assert.equal(parseHairProfileStatus("nope"), null)
  assert.equal(parseHairProfileStatus({ error: "no_personal_plan" }), null)
  assert.equal(parseHairProfileStatus({ modules: [], progress: { completedSteps: 2 } }), null)
  assert.equal(parseHairProfileStatus({ progress: { completedSteps: 2, totalSteps: 4 } }), null)

  const valid = statusResponse("open", "open")
  assert.deepEqual(parseHairProfileStatus(JSON.parse(JSON.stringify(valid))), valid)
})

test("the section renders the mockup's heading, count, rows and no minutes", () => {
  const html = renderToStaticMarkup(
    <HairProfileSection
      view={buildHairProfileSection({ status: statusResponse("open", "open") })}
    />,
  )

  assert.match(html, /Dein Haarprofil/)
  assert.match(html, /2 von 4/)
  assert.match(html, /Haar-Analyse/)
  assert.match(html, /Dein Idealplan/)
  assert.match(html, /Deine Produkte/)
  assert.match(html, /Deine Gewohnheiten/)
  // Decision 6: minutes live on the Routine banner button only.
  assert.doesNotMatch(html, /Min\./)
  assert.match(html, /href="\/plan-start\?refine=products"/)
  assert.match(html, /href="\/plan-start\?refine=habits"/)
  assert.match(html, /href="\/routine"/)
})

test("a finished module row renders the quiet edit link instead of a row link", () => {
  const html = renderToStaticMarkup(
    <HairProfileSection
      view={buildHairProfileSection({ status: statusResponse("complete", "complete") })}
    />,
  )

  assert.match(html, /Angaben ändern/)
  assert.equal(html.match(/href="\/plan-start\?refine=products"/g)?.length, 1)
  assert.match(html, /4 von 4/)
})

test("the progress bar exposes an accessible value", () => {
  const html = renderToStaticMarkup(
    <HairProfileSection
      view={buildHairProfileSection({ status: statusResponse("complete", "open") })}
    />,
  )

  assert.match(html, /role="progressbar"/)
  assert.match(html, /aria-valuenow="3"/)
  assert.match(html, /aria-valuemax="4"/)
})

test("the deferred sub-note reaches the rendered markup", () => {
  const html = renderToStaticMarkup(
    <HairProfileSection
      view={buildHairProfileSection({
        status: statusResponse("open", "open"),
        deferredRolesPendingRefinement: true,
      })}
    />,
  )

  assert.match(html, /Schaltet offene Empfehlungen frei\./)
})
