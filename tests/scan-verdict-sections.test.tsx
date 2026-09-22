import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { ScanResultCard } from "../src/components/scan/scan-result-card"
import {
  ScanAlternativesList,
  ScanVerdictSections,
} from "../src/components/scan/scan-verdict-sections"

import {
  SCAN_PARITY_ALTERNATIVES,
  SCAN_PARITY_DIMENSION_RESULT,
  SCAN_PARITY_MASKED_RESULT,
  SCAN_PARITY_NOT_NEEDED_RESULT,
  SCAN_PARITY_PREMIUM_RESULT,
} from "./scan-result-card.fixtures"

/**
 * The scan lane's regression net for the `ScanVerdictSections` / `ScanAlternativesList`
 * extraction (plan T5, R1–R8). `tests/scan-result-card-parity.test.tsx` proves the
 * rendered markup did not move; this file proves the RULES behind that markup, so a future
 * edit that changes both the component and the golden together still has to answer to
 * them.
 *
 *  R1  the card root stays `flex flex-col gap-4` and the sections stay its DIRECT
 *      children — `ScanVerdictSections` returns a fragment, never a wrapper
 *  R2  the product header renders name and „Marke · Kategorie"
 *  R3  the banner title is `verdictTitle` for `in_catalog` and `headline` for `not_needed`
 *  R4  dimension bars when there are dimensions; criterion rows only without them
 *  R5  the three `not_needed` sections follow `scanNotNeededSections`
 *  R6  a masked verdict renders the masked block and no identity, never the full list
 *  R7  revealed alternatives unblur only when animating; an empty reveal shows the notice
 *  R8  „Nochmal scannen" stays the last direct child, and `ScanAlternativesList` renders
 *      non-interactive rows without its callbacks
 */

type AnyElement = ReactElement<Record<string, unknown>>

function childrenOf(node: ReactNode): ReactNode[] {
  if (!React.isValidElement(node)) return []
  return React.Children.toArray((node as ReactElement<{ children?: ReactNode }>).props.children)
}

/** Expands nested function components in place; every component in these trees is hook-free. */
function deepRender(node: ReactNode, depth = 0): ReactNode {
  if (depth > 40) return node
  if (Array.isArray(node)) return node.map((child) => deepRender(child, depth))
  if (!React.isValidElement(node)) return node
  const element = node as AnyElement
  if (typeof element.type === "function") {
    try {
      return deepRender((element.type as (props: unknown) => ReactNode)(element.props), depth + 1)
    } catch {
      return element
    }
  }
  const children = (element.props as { children?: ReactNode }).children
  if (children === undefined || children === null) return element
  return React.cloneElement(
    element,
    undefined,
    ...React.Children.toArray(children).map((child) => deepRender(child, depth + 1)),
  )
}

/**
 * React hoists a fragment's children into its parent, but the element tree still carries
 * the fragment node; flattening it is what makes "direct children" in the tree mean the
 * same thing as "direct children" in the DOM.
 */
function flattenFragments(nodes: ReactNode[]): AnyElement[] {
  return nodes.filter(React.isValidElement).flatMap((node) => {
    const element = node as AnyElement
    return element.type === React.Fragment ? flattenFragments(childrenOf(element)) : [element]
  })
}

function findAll(node: ReactNode, predicate: (element: AnyElement) => boolean): AnyElement[] {
  if (!React.isValidElement(node)) return []
  const element = node as AnyElement
  const matches = predicate(element) ? [element] : []
  return [...matches, ...childrenOf(element).flatMap((child) => findAll(child, predicate))]
}

const noop = () => {}

function card(
  overrides: Partial<Parameters<typeof ScanResultCard>[0]> & {
    result: Parameters<typeof ScanResultCard>[0]["result"]
  },
): ReactNode {
  return ScanResultCard({
    onRescan: noop,
    onOpenAlternative: noop,
    onBuyAlternative: noop,
    ...overrides,
  })
}

// R1 ---------------------------------------------------------------------------

test("R1: the card root keeps its column and the verdict sections stay direct children", () => {
  const root = card({ result: SCAN_PARITY_DIMENSION_RESULT }) as AnyElement
  assert.equal(root.type, "div")
  assert.equal(root.props.className, "flex flex-col gap-4")

  // Before the extraction the column's direct children were the sections themselves. A
  // fragment keeps that true; a wrapper `div` would collapse them into one gap slot.
  const sections = childrenOf(root).filter(React.isValidElement)
  const fragments = sections.filter((child) => (child as AnyElement).type === React.Fragment)
  assert.equal(fragments.length, 0, "the sections must not arrive inside a fragment element")
  const sectionsElement = sections.find(
    (child) => (child as AnyElement).type === ScanVerdictSections,
  )
  assert.ok(sectionsElement, "the card renders ScanVerdictSections")

  // The expanded column: header, banner, bars, Warum, alternatives, re-scan button — all
  // of them siblings under the one `gap-4` column, as they were before the extraction.
  const expanded = deepRender(root) as AnyElement
  assert.deepEqual(
    flattenFragments(childrenOf(expanded)).map((child) => child.type),
    ["div", "div", "section", "section", "section", "button"],
  )
})

// R2 ---------------------------------------------------------------------------

test("R2: the product header renders the name and the brand-category line", () => {
  const markup = renderToStaticMarkup(<ScanVerdictSections result={SCAN_PARITY_PREMIUM_RESULT} />)
  assert.match(markup, /<h2[^>]*>Lab Shampoo Alpha<\/h2>/)
  assert.match(markup, /Chaarlie Lab · <span[^>]*>Shampoo<\/span>/)
})

// R3 ---------------------------------------------------------------------------

test("R3: the banner shows verdictTitle for in_catalog and headline for not_needed", () => {
  const inCatalog = renderToStaticMarkup(
    <ScanVerdictSections result={SCAN_PARITY_PREMIUM_RESULT} />,
  )
  assert.ok(inCatalog.includes("Passt nicht zu deinem Haar"))
  assert.ok(inCatalog.includes("1 von 3 Zielbereichen getroffen"))
  // `verdictLabel` is the pill copy elsewhere — the banner never uses it.
  assert.ok(!inCatalog.includes(">Passt nicht<"))

  const notNeeded = renderToStaticMarkup(
    <ScanVerdictSections result={SCAN_PARITY_NOT_NEEDED_RESULT} />,
  )
  assert.ok(notNeeded.includes("Brauchst du gerade nicht"))
})

// R4 ---------------------------------------------------------------------------

test("R4: dimension bars render with dimensions, criterion rows only without them", () => {
  const dimensionMarkup = renderToStaticMarkup(
    <ScanVerdictSections result={SCAN_PARITY_DIMENSION_RESULT} />,
  )
  assert.ok(dimensionMarkup.includes("Pflegegewicht"))
  assert.ok(dimensionMarkup.includes("reichhaltig"))
  // The criterion fallback must not double up next to the bars.
  assert.ok(!dimensionMarkup.includes("Reinigungsstärke"))

  const criteriaMarkup = renderToStaticMarkup(
    <ScanVerdictSections result={SCAN_PARITY_PREMIUM_RESULT} />,
  )
  assert.ok(criteriaMarkup.includes("Reinigungsstärke"))
  assert.ok(criteriaMarkup.includes("Reinigt mild genug für deine Kopfhaut."))
})

// R5 ---------------------------------------------------------------------------

test("R5: the not_needed sections follow scanNotNeededSections", () => {
  const full = renderToStaticMarkup(<ScanVerdictSections result={SCAN_PARITY_NOT_NEEDED_RESULT} />)
  assert.ok(full.includes("Deine Längen sind nicht strapaziert."))
  assert.ok(full.includes("Gut zu wissen"))
  assert.ok(full.includes("Das übernimmt bei dir:"))
  assert.ok(full.includes("Feuchtigkeitspflege"))

  const bare = renderToStaticMarkup(
    <ScanVerdictSections
      result={{ ...SCAN_PARITY_NOT_NEEDED_RESULT, reasons: [], coveredBy: [] }}
    />,
  )
  // With neither reasons nor coverage the sheet stops after headline + subtitle.
  assert.ok(!bare.includes("Gut zu wissen"))
  assert.ok(!bare.includes("Das übernimmt bei dir:"))
})

// R6 ---------------------------------------------------------------------------

test("R6: a masked verdict keeps the masked block and never renders an identity", () => {
  const tree = deepRender(card({ result: SCAN_PARITY_MASKED_RESULT }))
  assert.equal(
    findAll(tree, (element) => element.props["data-scan-masked-alternatives"] !== undefined).length,
    1,
  )
  const markup = renderToStaticMarkup(<>{card({ result: SCAN_PARITY_MASKED_RESULT })}</>)
  assert.ok(markup.includes("Noch verdeckt"))
  for (const identity of ["Lab Shampoo Gamma", "Lab Shampoo Delta", "p-alternative-a"]) {
    assert.ok(!markup.includes(identity), `masked card must not leak ${identity}`)
  }
})

// R7 ---------------------------------------------------------------------------

test("R7: a revealed list unblurs only when animating, and an empty reveal explains itself", () => {
  const animating = deepRender(
    card({
      result: SCAN_PARITY_MASKED_RESULT,
      revealedAlternatives: SCAN_PARITY_ALTERNATIVES,
    }),
  )
  const animatingWrapper = findAll(
    animating,
    (element) => element.props["data-scan-revealed-alternatives"] !== undefined,
  )
  assert.equal(animatingWrapper.length, 1)
  assert.equal(animatingWrapper[0].props.className, "scan-reveal-unblur")

  const staticReveal = deepRender(
    card({
      result: SCAN_PARITY_MASKED_RESULT,
      revealedAlternatives: SCAN_PARITY_ALTERNATIVES,
      revealAnimates: false,
    }),
  )
  const staticWrapper = findAll(
    staticReveal,
    (element) => element.props["data-scan-revealed-alternatives"] !== undefined,
  )
  assert.equal(staticWrapper.length, 1)
  assert.equal(staticWrapper[0].props.className, undefined)

  const empty = deepRender(card({ result: SCAN_PARITY_MASKED_RESULT, revealedAlternatives: [] }))
  assert.equal(
    findAll(empty, (element) => element.props["data-scan-reveal-empty"] !== undefined).length,
    1,
  )
})

// R8 ---------------------------------------------------------------------------

test("R8: the re-scan link stays last, and the alternatives list is inert without callbacks", () => {
  const rescans: string[] = []
  const root = card({
    result: SCAN_PARITY_PREMIUM_RESULT,
    onRescan: () => rescans.push("rescan"),
  }) as AnyElement
  const directChildren = childrenOf(root).filter(React.isValidElement) as AnyElement[]
  const last = directChildren[directChildren.length - 1]
  assert.equal(last.type, "button")
  ;(last.props.onClick as () => void)()
  assert.deepEqual(rescans, ["rescan"])

  const opened: string[] = []
  const bought: string[] = []
  const interactive = deepRender(
    <ScanAlternativesList
      alternatives={SCAN_PARITY_ALTERNATIVES}
      onOpen={(productId) => opened.push(productId)}
      onBuy={(productId) => bought.push(productId)}
    />,
  )
  const rowButtons = findAll(interactive, (element) => element.type === "button")
  assert.equal(rowButtons.length, 2)
  ;(rowButtons[0].props.onClick as () => void)()
  const links = findAll(interactive, (element) => element.type === "a")
  assert.equal(links.length, 1)
  ;(links[0].props.onClick as () => void)()
  assert.deepEqual(opened, ["p-alternative-a"])
  assert.deepEqual(bought, ["p-alternative-a"])

  const readOnly = deepRender(<ScanAlternativesList alternatives={SCAN_PARITY_ALTERNATIVES} />)
  assert.equal(
    findAll(readOnly, (element) => element.type === "button" || element.type === "a").length,
    0,
  )
  const readOnlyMarkup = renderToStaticMarkup(
    <ScanAlternativesList alternatives={SCAN_PARITY_ALTERNATIVES} />,
  )
  // The identity and the verdict pill still read; only the affordances are gone.
  assert.ok(readOnlyMarkup.includes("Lab Shampoo Gamma"))
  assert.ok(readOnlyMarkup.includes("Passt mit Einschränkung"))
  assert.ok(!readOnlyMarkup.includes("Kaufen"))
})
