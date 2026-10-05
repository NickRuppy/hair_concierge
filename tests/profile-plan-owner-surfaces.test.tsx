import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"

import { RetainedPersonalPlanProducts } from "../src/components/profile/retained-personal-plan-products"
import { Badge } from "../src/components/ui/badge"
import { Button } from "../src/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "../src/components/ui/card"
import { Skeleton } from "../src/components/ui/skeleton"
import {
  getProductCompletionLabel,
  selectPlanProductRows,
} from "../src/lib/profile/product-usage-rows"
import { PROFILE_FIELD_CONFIG, PROFILE_SECTION_META } from "../src/lib/profile/section-config"
import { cn } from "../src/lib/utils"

const files = [
  "src/app/profile/page.tsx",
  "src/lib/profile/section-config.ts",
  "src/lib/profile/product-usage-rows.ts",
  "src/components/routine/routine-page-client.tsx",
]
const sources = files.map((path) =>
  ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  ),
)

function findNode(predicate: (node: ts.Node) => boolean): ts.Node {
  let found: ts.Node | undefined
  function visit(node: ts.Node) {
    if (predicate(node)) found = node
    else ts.forEachChild(node, visit)
  }
  sources.forEach(visit)
  assert.ok(found, "expected production surface node")
  return found
}

function functionSource(name: string) {
  return findNode((node) => ts.isFunctionDeclaration(node) && node.name?.text === name)
    .getText()
    .replace(/^export /, "")
}

function variableSource(name: string) {
  return `const ${findNode((node) => ts.isVariableDeclaration(node) && node.name.getText() === name).getText()};`
}

function evaluate(code: string, scope: Record<string, unknown>) {
  const emitted = ts.transpileModule(code, {
    compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return new Function(...Object.keys(scope), emitted)(...Object.values(scope))
}

const planProduct = {
  categoryLabel: "Shampoo",
  name: "Plan Shampoo",
  purposeLabel: "Reinigung",
  state: "owned" as const,
  cadenceLabel: "2x pro Woche",
}
const legacyRow = {
  key: "legacy-1",
  category: "conditioner",
  categoryLabel: "Conditioner",
  productName: "Legacy Conditioner",
  frequencyLabel: null,
  reviewStatusLabel: "In Prüfung",
  needsUserDetails: true,
  isComplete: false,
}

// Render the actual three page sections and their local presentational helpers, without
// mounting the page's router/auth/fetch effects or adding test-only production exports.
function surface(overrides: Record<string, unknown> = {}) {
  const navigations: string[] = []
  const fields = PROFILE_FIELD_CONFIG.map((field) => ({ ...field, value: null }))
  const scope = {
    React,
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    Skeleton,
    RetainedPersonalPlanProducts,
    cn,
    getProductCompletionLabel,
    selectPlanProductRows,
    SECTION_META_BY_KEY: Object.fromEntries(PROFILE_SECTION_META.map((meta) => [meta.key, meta])),
    hasPersonalPlan: false,
    profile: null,
    profileLoading: false,
    productsLoading: false,
    refinementLoading: false,
    routineProducts: null,
    productRows: [legacyRow],
    selectedProductCategories: [legacyRow.categoryLabel],
    incompleteProductRows: [legacyRow],
    retainedPersonalPlanProducts: [],
    stylingFields: fields.filter((field) => field.sectionKey === "styling"),
    routineFields: fields.filter((field) => field.sectionKey === "routine"),
    stylingStatus: "Offen",
    routineStatus: "Offen",
    startQuizEditing: () => {},
    goToSectionStep: (_section: string, href: string) => navigations.push(href),
    ...overrides,
  }
  const helpers = [
    "refineHref",
    "getOpenItemsTitle",
    "SectionStatusBadge",
    "ProductReviewStatusBadge",
    "SectionHeader",
    "SectionGridSkeleton",
    "ProfileFieldCard",
    "ProfileFieldValue",
    "InlinePromptCard",
    "openTarget",
  ].map(functionSource)
  const sections = ["products", "styling", "routine"].map((key) =>
    findNode(
      (node) =>
        ts.isJsxElement(node) &&
        node.openingElement.attributes.properties.some(
          (attr) =>
            ts.isJsxAttribute(attr) &&
            attr.name.getText() === "id" &&
            attr.initializer?.getText() === `"profile-section-${key}"`,
        ),
    ).getText(),
  )
  const root = evaluate(
    [
      ...helpers,
      variableSource("ProductRow"),
      variableSource("planProductRows"),
      variableSource("productsAwaitingRefinement"),
      variableSource("productsStatus"),
      `return <>${sections.join("\n")}</>;`,
    ].join("\n"),
    scope,
  ) as ReactElement
  return { root, html: renderToStaticMarkup(root), navigations }
}

function clickHandlers(node: ReactNode, buttonLabel?: string): Array<() => void> {
  if (!React.isValidElement(node)) return []
  const props = (
    node as ReactElement<{
      children?: ReactNode
      controls?: ReactNode
      action?: ReactNode
      onClick?: () => void
    }>
  ).props
  return [
    ...(props.onClick && (!buttonLabel || (node.type === Button && props.children === buttonLabel))
      ? [props.onClick]
      : []),
    ...React.Children.toArray(props.children).flatMap((child) => clickHandlers(child, buttonLabel)),
    ...React.Children.toArray(props.controls).flatMap((child) => clickHandlers(child, buttonLabel)),
    ...React.Children.toArray(props.action).flatMap((child) => clickHandlers(child, buttonLabel)),
  ]
}

test("Styling and Alltag edit the habits module, except the single brush step", () => {
  for (const field of PROFILE_FIELD_CONFIG.filter((field) =>
    ["styling", "routine"].includes(field.sectionKey),
  )) {
    assert.deepEqual(
      field.editTarget,
      field.key === "brush_type"
        ? { kind: "onboarding-step", step: "brush_type" }
        : { kind: "refine", module: "habits" },
      field.key,
    )
  }
})

test("plan list wins over legacy rows; unavailable or empty plan list falls back", () => {
  assert.deepEqual(selectPlanProductRows([planProduct]), [planProduct])
  for (const routineProducts of [null, []]) {
    assert.equal(selectPlanProductRows(routineProducts), null)
  }
  const { html } = surface({ hasPersonalPlan: true, routineProducts: [planProduct] })
  assert.match(html, /Aus deinem Personal Plan/)
  assert.match(html, /Plan Shampoo/)
  assert.doesNotMatch(html, /Legacy Conditioner|Ausgewählte Kategorien|Details ergänzen/)
})

test("without a plan all three sections render static values with no edit navigation", () => {
  const { html, root } = surface()
  assert.doesNotMatch(
    html,
    /<button\b|<a\b|role="button"|tabindex=|\/plan-start|\/onboarding|bearbeiten|Details ergänzen|tippen zum Ergänzen/,
  )
  assert.match(html, /Legacy Conditioner/)
  assert.match(html, /Noch offen/)
  assert.equal(clickHandlers(root).length, 0)
})

test("open values look neutral without a plan and ask for attention with one", () => {
  const withoutPlan = surface().html
  assert.doesNotMatch(withoutPlan, /brand-coral|col-span-2|Details fehlen noch/)

  const owner = surface({ hasPersonalPlan: true }).html
  assert.match(owner, /brand-coral/)
  assert.match(owner, /col-span-2/)
  assert.match(owner, /Details fehlen noch/)
})

test("plan-owner headers and legacy cards open Feinschliff, with the brush exception", async (t) => {
  const { root, navigations } = surface({ hasPersonalPlan: true })
  const detailsHandlers = clickHandlers(root, "Details ergänzen")
  assert.equal(detailsHandlers.length, 1, "exactly one Details ergänzen button")
  detailsHandlers[0]()
  const detailsNavigations = navigations.splice(0)
  clickHandlers(root).forEach((click) => click())
  assert.ok(
    navigations.includes("/plan-start?refine=products"),
    "Produkte bearbeiten opens products",
  )
  assert.equal(
    navigations.filter((href) => href === "/plan-start?refine=habits").length,
    9,
    "both headers and seven habit cards open habits",
  )
  await t.test("Details ergänzen opens the products module", () => {
    assert.deepEqual(detailsNavigations, ["/plan-start?refine=products"])
  })
  await t.test("only the Bürste/Kamm card opens onboarding", () => {
    assert.equal(navigations.filter((href) => href.startsWith("/onboarding")).length, 1)
  })
  const brushHref = navigations.find((href) => href.startsWith("/onboarding?step=brush_type&"))
  assert.ok(brushHref)
  const brushParams = new URL(brushHref, "https://example.test").searchParams
  assert.equal(brushParams.get("step"), "brush_type")
  assert.equal(brushParams.get("returnTo"), "/profile")
  assert.equal(brushParams.get("editMode"), "single-step")
})

test("product empty states have the exact owner and no-plan copy and no second button", () => {
  const withoutPlan = surface({ productRows: [], incompleteProductRows: [] }).html
  assert.match(withoutPlan, /Noch keine Produktangaben/)
  assert.match(withoutPlan, /Hier ist noch nichts gespeichert\./)
  assert.doesNotMatch(withoutPlan, /<button\b/)
  const withPlan = surface({
    hasPersonalPlan: true,
    productRows: [],
    incompleteProductRows: [],
  }).html
  assert.match(withPlan, /Noch keine Produkte/)
  assert.match(withPlan, /Im Feinschliff kannst du angeben, welche Produkte du schon nutzt\./)
  assert.doesNotMatch(withPlan, /Produktteil öffnen/)
})

test("owners wait for plan products even with legacy rows; non-owners show legacy immediately", () => {
  assert.doesNotMatch(
    surface({ hasPersonalPlan: true, refinementLoading: true }).html,
    /Legacy Conditioner|Details ergänzen/,
  )
  assert.match(surface({ refinementLoading: true }).html, /Legacy Conditioner/)
})

test("the four surfaces contain no user-visible Onboarding strings", () => {
  for (const source of sources) {
    function visit(node: ts.Node) {
      if (ts.isStringLiteralLike(node) || ts.isJsxText(node)) {
        assert.doesNotMatch(node.text, /Onboarding/, `${source.fileName}: ${node.text}`)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
})
