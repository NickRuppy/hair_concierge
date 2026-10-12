import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"

import { TOOL_FAMILY_CARD_STYLES } from "../src/components/personal-plan-refinement/tool-checkpoint"
import { ToolThumb } from "../src/components/personal-plan-tools/tool-thumb"
import { HaarCheckEditControl } from "../src/components/profile/haar-check-edit-control"
import { RetainedPersonalPlanProducts } from "../src/components/profile/retained-personal-plan-products"
import { Badge } from "../src/components/ui/badge"
import { Button } from "../src/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "../src/components/ui/card"
import { Skeleton } from "../src/components/ui/skeleton"
import {
  getProductCompletionLabel,
  selectPlanProductRows,
} from "../src/lib/profile/product-usage-rows"
import { buildProfileToolsBlock } from "../src/lib/personal-plan/tools/profile-block"
import {
  PROFILE_FIELD_CONFIG,
  PROFILE_SECTION_META,
  PROFILE_TOOLS_NONE_LABEL,
  profileHabitsRows,
} from "../src/lib/profile/section-config"
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

// ---------------------------------------------------------------------------
// Hair Tools Profil (Task 11): Haar-Check incl. Ziele, Deine Tools, Gewohnheiten
// ---------------------------------------------------------------------------

const pageSource = sources[0]

function cardIdsOf(root: ts.Node): string[] {
  const ids: string[] = []
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      for (const attr of node.attributes.properties) {
        if (
          ts.isJsxAttribute(attr) &&
          attr.name.getText() === "id" &&
          /^"profile-section-/.test(attr.initializer?.getText() ?? "")
        ) {
          ids.push(attr.initializer!.getText().slice('"profile-section-'.length, -1))
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(root)
  return ids
}

function toolsApplicableConditional(): ts.ConditionalExpression {
  let found: ts.ConditionalExpression | undefined
  function visit(node: ts.Node) {
    if (
      ts.isConditionalExpression(node) &&
      node.condition.getText() === "toolsApplicable" &&
      cardIdsOf(node).includes("tools")
    ) {
      found = node
    }
    ts.forEachChild(node, visit)
  }
  visit(pageSource)
  assert.ok(found, "the card composition branches on toolsApplicable")
  return found
}

test("tools applicable: the Profil renders Haar-Check, Produkte, Deine Tools, Gewohnheiten; otherwise Styling and Alltag", () => {
  const all = cardIdsOf(pageSource)
  assert.deepEqual(all, [
    "quiz",
    "products",
    "tools",
    "habits",
    "styling",
    "routine",
    "memory",
    "panel-memory",
  ])
  const conditional = toolsApplicableConditional()
  assert.deepEqual(cardIdsOf(conditional.whenTrue), ["tools", "habits"])
  assert.deepEqual(cardIdsOf(conditional.whenFalse), ["styling", "routine"])
})

test("there is no Ziele card in either flag state", () => {
  assert.ok(!cardIdsOf(pageSource).includes("goals"))
  assert.doesNotMatch(pageSource.getText(), /profile-section-goals|goalsStatus|Ziele-Karte/)
})

test("toolsApplicable follows the refinement status and fails open to today's cards", () => {
  const applicable = (refinementStatus: unknown) =>
    evaluate(`${variableSource("toolsApplicable")}\nreturn toolsApplicable;`, {
      useMemo: (compute: () => unknown) => compute(),
      refinementStatus,
    })
  const modules = (tools: string | null) => ({
    modules: [
      { module: "products", status: "complete", openQuestionCount: 0 },
      ...(tools ? [{ module: "tools", status: tools, openQuestionCount: 0 }] : []),
      { module: "habits", status: "open", openQuestionCount: 2 },
    ],
  })
  assert.equal(applicable(modules("open")), true)
  assert.equal(applicable(modules("complete")), true)
  assert.equal(applicable(modules("not_applicable")), false)
  assert.equal(applicable(modules(null)), false, "a status without a tools entry")
  assert.equal(applicable(null), false, "status missing or errored")
})

const LENA_TOOLS = buildProfileToolsBlock({
  drying_textiles: ["microfiber_towel"],
  brushes_combs: ["wide_tooth_comb", "round_brush"],
  airflow: ["hair_dryer", "hot_air_brush"],
  heated_styling: ["flat_iron"],
  night_protection: ["pillowcase"],
})

function toolsSurface(overrides: Record<string, unknown> = {}) {
  const navigations: string[] = []
  const hairProfile = {
    heat_styling: "several_weekly",
    uses_heat_protection: true,
    towel_material: "mikrofaser",
    towel_technique: "gentle_press",
    drying_method: "blow_dry",
  }
  const scope = {
    React,
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    Skeleton,
    ToolThumb,
    TOOL_FAMILY_CARD_STYLES,
    cn,
    SECTION_META_BY_KEY: Object.fromEntries(PROFILE_SECTION_META.map((meta) => [meta.key, meta])),
    PROFILE_TOOLS_NONE_LABEL,
    hasPersonalPlan: true,
    profileLoading: false,
    refinementLoading: false,
    refinementTools: LENA_TOOLS,
    toolsStatus: "5 Tools",
    habitsStatus: "4/4 vollständig",
    habitsRows: profileHabitsRows(hairProfile as never, { nightWear: "pineapple" }),
    startQuizEditing: () => {},
    goToSectionStep: (_section: string, href: string) => navigations.push(href),
    ...overrides,
  }
  const helpers = [
    "refineHref",
    "SectionStatusBadge",
    "SectionHeader",
    "SectionGridSkeleton",
    "ProfileFieldCard",
    "ProfileFieldValue",
    "ProfileToolGroupCard",
    "openTarget",
  ].map(functionSource)
  const cards = ["tools", "habits"].map((key) =>
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
    [...helpers, `return <>${cards.join("\n")}</>;`].join("\n"),
    scope,
  ) as ReactElement
  return { root, html: renderToStaticMarkup(root), navigations }
}

test("Deine Tools shows the member's photo chips grouped in wash-day order with the exact copy", () => {
  const { html } = toolsSurface()

  assert.match(html, /Deine Tools/)
  assert.match(html, /5 Tools/)
  assert.match(html, /Was du schon hast, aus deinem Feinschliff\./)
  const order = [
    "drying_textiles",
    "brushes_combs",
    "airflow",
    "heated_styling",
    "night_protection",
  ].map((family) => html.indexOf(`data-profile-tool-group="${family}"`))
  assert.ok(order.every((index) => index >= 0))
  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
    "families follow the wash-day order",
  )
  for (const label of [
    "Mikrofaser-Handtuch",
    "Grobzinkiger Kamm",
    "Rundbürste",
    "Föhn",
    "Warmluftbürste",
    "Glätteisen",
    "Glatter Kissenbezug",
  ]) {
    assert.match(html, new RegExp(label))
  }
  for (const photo of ["microfiber_towel", "round", "dryer_brush", "straightener", "pillowcase"]) {
    assert.match(html, new RegExp(`/images/tools/${photo}\\.webp`))
  }
  assert.match(html, /Bürsten &amp; Kämme/)
})

test("Deine Tools says „Noch offen — tippen zum Ergänzen“ before the member confirmed anything, „Keine Tools angegeben“ after an empty answer", () => {
  const unansweredSurface = toolsSurface({ refinementTools: null, toolsStatus: "Offen" })
  const unanswered = unansweredSurface.html
  assert.match(unanswered, /Noch offen — tippen zum Ergänzen/)
  assert.doesNotMatch(unanswered, /data-profile-tool-group|Noch nicht angegeben/)
  // The open card is tappable, like every other open Profil card, and opens the tools module:
  // two handlers lead there now — „Deine Tools bearbeiten" and the card itself.
  clickHandlers(unansweredSurface.root).forEach((click) => click())
  assert.equal(
    unansweredSurface.navigations.filter((href) => href === "/plan-start?refine=tools").length,
    2,
  )

  const none = toolsSurface({
    refinementTools: buildProfileToolsBlock({ airflow: [] }),
    toolsStatus: "Keine Tools",
  }).html
  assert.match(none, /Keine Tools angegeben/)
  assert.match(none, />Keine Tools</)
  assert.doesNotMatch(none, /0 Tools|Nichts davon|Noch nicht angegeben|data-profile-tool-group/)
})

test("Deine Tools waits for the refinement read before it shows anything", () => {
  const { html } = toolsSurface({ refinementLoading: true, toolsStatus: "Wird geladen" })
  assert.match(html, /Wird geladen/)
  assert.doesNotMatch(html, /data-profile-tool-group|Noch nicht angegeben/)
})

test("the Deine Tools and Gewohnheiten buttons open their Feinschliff modules", () => {
  const { root, navigations } = toolsSurface()
  clickHandlers(root, "Deine Tools bearbeiten").forEach((click) => click())
  assert.deepEqual(navigations.splice(0), ["/plan-start?refine=tools"])
  clickHandlers(root, "Gewohnheiten bearbeiten").forEach((click) => click())
  assert.deepEqual(navigations.splice(0), ["/plan-start?refine=habits"])
})

test("Gewohnheiten shows the five rows in order and every row opens the habits module", () => {
  const { html, root, navigations } = toolsSurface()
  // Rev. 6: „Nachts" closes the card.
  const labels = ["Abtrocknen", "Trocknen", "Hitze-Häufigkeit", "Hitzeschutz", "Nachts"]
  const positions = labels.map((label) => html.indexOf(`>${label}</p>`))
  assert.ok(
    positions.every((index) => index >= 0),
    String(positions),
  )
  assert.deepEqual(
    positions,
    [...positions].sort((a, b) => a - b),
  )
  assert.match(html, /Wie du trocknest und stylst, aus deinem Feinschliff\./)
  assert.doesNotMatch(html, /Keine Hitze/)
  assert.equal(clickHandlers(root).length > 2, true)
  clickHandlers(root).forEach((click) => click())
  assert.ok(navigations.length >= 6)
  assert.deepEqual([...new Set(navigations)].sort(), [
    "/plan-start?refine=habits",
    "/plan-start?refine=tools",
  ])
})

test("Gewohnheiten without a heat tool collapses to Abtrocknen, Trocknen and one „Keine Hitze“ row", () => {
  const heatFree = {
    heat_styling: "never",
    towel_material: "mikrofaser",
    towel_technique: "gentle_press",
    drying_method: "air_dry",
  }
  const rows = profileHabitsRows(heatFree as never, { nightWear: "open" })
  const { html } = toolsSurface({ habitsRows: rows, habitsStatus: "4/4 vollständig" })
  assert.match(html, /Keine Hitze/)
  assert.doesNotMatch(html, /Hitze-Häufigkeit|Hitzeschutz/)
  // Abtrocknen, Trocknen, Hitze and (Rev. 6) Nachts.
  assert.equal(html.match(/<p class="[^"]*uppercase[^"]*">[^<]+<\/p>/g)?.length, 4)
  assert.match(html, />Nachts<\/p>/)
})

test("without a plan, the Gewohnheiten rows are static and offer no edit button", () => {
  const { html, root } = toolsSurface({ hasPersonalPlan: false })
  assert.doesNotMatch(html, /Gewohnheiten bearbeiten|Deine Tools bearbeiten|role="button"/)
  assert.equal(clickHandlers(root).length, 0)
})

function quizSurface(overrides: Record<string, unknown> = {}) {
  const navigations: string[] = []
  const profile = {
    hair_length: "long",
    diagnostics: {
      texture: "wavy",
      goals: ["moisture", "shape_definition"],
      source: { kind: "legacy_quiz", version: 1, leadId: "lead", raw: null },
    },
  }
  const fields = PROFILE_FIELD_CONFIG.map((field) => ({
    ...field,
    value: field.getValue(profile as never, null),
  }))
  const scope = {
    React,
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    Skeleton,
    HaarCheckEditControl,
    HaarCheckEditor: () => null,
    cn,
    SECTION_META_BY_KEY: Object.fromEntries(PROFILE_SECTION_META.map((meta) => [meta.key, meta])),
    hasPersonalPlan: true,
    tier: "premium",
    hairProfile: profile,
    profileLoading: false,
    quizStatus: "9/10 vollständig",
    quizEditing: false,
    quizNotice: null,
    quizSaving: false,
    quizDraft: {},
    quizInitialDraft: {},
    setQuizDraft: () => {},
    handleSaveQuiz: () => {},
    resetQuizEditing: () => {},
    quizFieldRefs: { current: {} },
    quizFields: fields.filter((field) => field.sectionKey === "quiz"),
    toolsApplicable: true,
    refinementStatusPending: false,
    startQuizEditing: (key?: string) => navigations.push(`quiz-edit:${key ?? ""}`),
    goToSectionStep: (_section: string, href: string) => navigations.push(href),
    ...overrides,
  }
  const helpers = [
    "refineHref",
    "SectionStatusBadge",
    "SectionHeader",
    "SectionGridSkeleton",
    "ProfileFieldCard",
    "ProfileFieldValue",
    "ProfileGoalsRow",
    "InlinePromptCard",
    "openTarget",
  ].map(functionSource)
  const quiz = findNode(
    (node) =>
      ts.isJsxElement(node) &&
      node.openingElement.attributes.properties.some(
        (attr) =>
          ts.isJsxAttribute(attr) &&
          attr.name.getText() === "id" &&
          attr.initializer?.getText() === '"profile-section-quiz"',
      ),
  ).getText()
  const root = evaluate([...helpers, `return ${quiz};`].join("\n"), scope) as ReactElement
  return { root, html: renderToStaticMarkup(root), navigations }
}

function handlersByProp(node: ReactNode, prop: string, typeName: string): Array<() => void> {
  if (!React.isValidElement(node)) return []
  const props = node.props as Record<string, unknown>
  const type = node.type as { name?: string }
  return [
    ...(type.name === typeName && typeof props[prop] === "function"
      ? [props[prop] as () => void]
      : []),
    ...React.Children.toArray(props.children as ReactNode).flatMap((child) =>
      handlersByProp(child, prop, typeName),
    ),
    ...React.Children.toArray(props.controls as ReactNode).flatMap((child) =>
      handlersByProp(child, prop, typeName),
    ),
  ]
}

test("the Haar-Check grid waits for the refinement status instead of swapping its density later", () => {
  const pending = quizSurface({ refinementStatusPending: true })
  assert.doesNotMatch(pending.html, /Deine Haarziele/)
  assert.match(pending.html, /animate-pulse|data-slot="skeleton"/)
  const settled = quizSurface({ refinementStatusPending: false })
  assert.match(settled.html, /Deine Haarziele/)
})

for (const toolsApplicable of [true, false]) {
  test(`Haar-Check carries the Ziele row with its own editor link (tools applicable: ${toolsApplicable})`, () => {
    const { html, root, navigations } = quizSurface({ toolsApplicable })
    assert.match(html, /Deine Haarziele/)
    assert.match(html, /Mehr Wellen-Definition|Intensive Feuchtigkeit/)
    assert.match(html, />Ziele bearbeiten</)
    assert.ok(
      html.indexOf("Deine Haarziele") > html.indexOf("Haarlänge"),
      "the Ziele row closes the grid",
    )
    const edit = handlersByProp(root, "onEdit", "ProfileGoalsRow")
    assert.equal(edit.length, 1)
    edit[0]()
    assert.deepEqual(navigations, ["/profile/edit/goals"])
  })
}

test("the Ziele row stays editable without a plan and shows its empty state", () => {
  const { html, root, navigations } = quizSurface({
    hasPersonalPlan: false,
    quizFields: PROFILE_FIELD_CONFIG.filter((field) => field.sectionKey === "quiz").map(
      (field) => ({
        ...field,
        value: field.key === "goals" ? null : "x",
      }),
    ),
  })
  assert.match(html, /Noch keine Ziele gewählt/)
  handlersByProp(root, "onEdit", "ProfileGoalsRow")[0]()
  assert.deepEqual(navigations, ["/profile/edit/goals"])
})

test("tools applicable switches the Haar-Check grid to the compact two-column layout; flag off keeps today's grid", () => {
  const compact = quizSurface({ toolsApplicable: true }).html
  assert.match(compact, /grid grid-cols-2 gap-2\.5 md:grid-cols-3 md:gap-4 xl:grid-cols-4/)
  const today = quizSurface({ toolsApplicable: false }).html
  assert.match(today, /grid gap-4 md:grid-cols-2 xl:grid-cols-3/)
  assert.doesNotMatch(today, /grid-cols-2 gap-2\.5/)
})
