import assert from "node:assert/strict"
import test from "node:test"
import React from "react"

import { FeinschliffJourneyClient } from "../src/app/labs/feinschliff-journey/journey-client"
import { refinementStatus } from "../src/app/labs/feinschliff-journey/fixtures"
import {
  journeyNeedSnapshot,
  journeyRoutineToolSection,
  type JourneyToolSessionInput,
} from "../src/app/labs/feinschliff-journey/routine-tools"
import { adaptInitialNeedSnapshotToPlanStartViewModel } from "../src/components/personal-plan-start"

/**
 * Hair Tools port, Task 10: `/labs/feinschliff-journey` shows the tools-ON journey. No
 * Playwright spec drives this lab (`personal-plan-feinschliff-journey.spec.ts` drives
 * `/labs/personal-plan-start`), so the checkpoint step is covered here in jsdom: walk the tools
 * module, land on „Das hast du schon", continue to the Routine with the Gewohnheiten banner.
 */

test("the journey's status fixture counts five steps with tools on, four with tools off", () => {
  assert.deepEqual(refinementStatus("complete", "complete", "complete").progress, {
    completedSteps: 5,
    totalSteps: 5,
  })
  const afterTools = refinementStatus("complete", "complete", "open")
  assert.deepEqual(afterTools.progress, { completedSteps: 4, totalSteps: 5 })
  assert.equal(afterTools.banner.module, "habits")
  assert.equal(refinementStatus("complete", "open", "open").banner.module, "tools")
  assert.deepEqual(refinementStatus("complete", "not_applicable", "open").progress, {
    completedSteps: 3,
    totalSteps: 4,
  })
})

function journeyProps() {
  const snapshot = journeyNeedSnapshot()
  if (!snapshot) throw new Error("fixture plan unavailable")
  const plan = adaptInitialNeedSnapshotToPlanStartViewModel(snapshot, { toolsEnabled: true })
  if (!plan) throw new Error("fixture plan unavailable")
  // In-process stand-in for the page's labs-only server action; records every call.
  const calls: JourneyToolSessionInput[] = []
  const resolveRoutineToolSection = async (input: JourneyToolSessionInput) => {
    calls.push(input)
    return journeyRoutineToolSection(input, snapshot)
  }
  return { plan, resolveRoutineToolSection, calls }
}

async function withMountedDom<T>(
  element: React.ReactElement,
  run: (container: HTMLElement) => T | Promise<T>,
): Promise<T> {
  const { JSDOM } = await import("jsdom")
  const { createRoot } = await import("react-dom/client")
  const { flushSync } = await import("react-dom")
  const dom = new JSDOM(
    '<!doctype html><html lang="de"><body><div id="root"></div></body></html>',
    { url: "http://localhost/labs/feinschliff-journey?step=module-tools", pretendToBeVisual: true },
  )
  Object.defineProperty(dom.window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
  const globals = globalThis as unknown as Record<string, unknown>
  const previous: Record<string, PropertyDescriptor | undefined> = {}
  const installed: Record<string, unknown> = {
    window: dom.window,
    // `next/link` (the Routine shell's nav) schedules prefetches through `self`.
    self: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    sessionStorage: dom.window.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: false,
  }
  for (const [key, value] of Object.entries(installed)) {
    previous[key] = Object.getOwnPropertyDescriptor(globals, key)
    Object.defineProperty(globals, key, { value, configurable: true, writable: true })
  }
  const container = dom.window.document.getElementById("root")!
  const root = createRoot(container)
  try {
    flushSync(() => root.render(element))
    return await run(container)
  } finally {
    flushSync(() => root.unmount())
    await new Promise((resolve) => setTimeout(resolve, 50))
    for (const key of Object.keys(installed)) {
      const descriptor = previous[key]
      if (descriptor) Object.defineProperty(globals, key, descriptor)
      else delete globals[key]
    }
    dom.window.close()
  }
}

function click(element: Element): void {
  const view = element.ownerDocument.defaultView!
  element.dispatchEvent(new view.MouseEvent("click", { bubbles: true, cancelable: true }))
}

const pause = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms))

function enabledButton(document: Document, text: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === text && !button.disabled,
  ) as HTMLButtonElement | undefined
}

/** Walks the tools module page by page: keep the pre-fill where there is one, else „Nichts davon". */
async function walkToolsModule(container: HTMLElement): Promise<string[]> {
  const document = container.ownerDocument
  const seen: string[] = []
  const started = Date.now()
  while (!container.querySelector("[data-tool-checkpoint]")) {
    if (Date.now() - started > 8000) throw new Error(`stuck after ${seen.join(" → ")}`)
    const heading = document.querySelector("h1, h2")?.textContent?.trim() ?? ""
    const next = enabledButton(document, "Weiter")
    if (next) {
      if (seen.at(-1) !== heading) seen.push(heading)
      click(next)
      await pause(30)
      continue
    }
    const nothing = document.querySelector("[data-tool-nothing-option] button")
    if (nothing && nothing.getAttribute("aria-pressed") !== "true") click(nothing)
    await pause()
  }
  return seen
}

test("journey lab: the tools module returns to the Tool-Checkpoint, whose CTA opens the Routine at 4 von 5", async () => {
  const { plan, resolveRoutineToolSection } = journeyProps()
  await withMountedDom(
    <FeinschliffJourneyClient
      plan={plan}
      stage3EntryContext={null}
      resolveRoutineToolSection={resolveRoutineToolSection}
      initialStep="module-tools"
    />,
    async (container) => {
      const pages = await walkToolsModule(container)
      assert.equal(pages[0], "Was hast du schon?")
      const checkpoint = container.querySelector("[data-tool-checkpoint]")!
      assert.match(checkpoint.textContent ?? "", /Deine Tools/)
      assert.match(checkpoint.textContent ?? "", /Das hast du schon/)
      assert.match(checkpoint.textContent ?? "", /Damit planen wir ab jetzt deine Routine\./)

      click(container.querySelector("[data-tool-checkpoint-continue]")!)
      await pause(30)
      assert.equal(container.querySelector("[data-tool-checkpoint]"), null)
      const text = container.ownerDocument.body.textContent ?? ""
      assert.match(text, /Letzter Schritt: deine Gewohnheiten\./)
      assert.match(text, /4 von 5/)
      assert.doesNotMatch(text, /Plan aktualisiert/)
      assert.ok(container.ownerDocument.querySelector("[data-routine-tool-section]"))
    },
  )
})

test("journey lab: „Tools ergänzen“ on the checkpoint goes back into the tools module", async () => {
  const { plan, resolveRoutineToolSection } = journeyProps()
  await withMountedDom(
    <FeinschliffJourneyClient
      plan={plan}
      stage3EntryContext={null}
      resolveRoutineToolSection={resolveRoutineToolSection}
      initialStep="module-tools"
    />,
    async (container) => {
      await walkToolsModule(container)
      click(container.querySelector("[data-tool-checkpoint-add-tools]")!)
      await pause(30)
      assert.equal(container.querySelector("[data-tool-checkpoint]"), null)
      assert.ok(container.querySelector('[data-stage2-preview-scenario="module-tools"]'))
    },
  )
})

/** On the overview, also tick „Waschen & Auftragen“ — a pick neither the fixture nor the pre-fill makes. */
async function tickWashSectionOnOverview(container: HTMLElement): Promise<void> {
  const started = Date.now()
  let card = container.querySelector('[data-tool-option="waschen_auftragen"]')
  while (!card) {
    if (Date.now() - started > 4000) throw new Error("the tools overview never rendered")
    await pause()
    card = container.querySelector('[data-tool-option="waschen_auftragen"]')
  }
  if (card.getAttribute("aria-pressed") !== "true") click(card)
  await pause()
}

test("journey lab: the Routine's Deine Tools follow the answers just given, not a fixture", async () => {
  const { plan, resolveRoutineToolSection, calls } = journeyProps()
  await withMountedDom(
    <FeinschliffJourneyClient
      plan={plan}
      stage3EntryContext={null}
      resolveRoutineToolSection={resolveRoutineToolSection}
      initialStep="module-tools"
    />,
    async (container) => {
      await walkToolsModule(container)
      await pause(30)
      assert.equal(calls.length, 1, "the section is derived once the tools module is done")
      // The walk answered every page itself („Nichts davon" unless pre-filled).
      assert.ok(calls[0].answers.toolForms, "the session's own tool answers are handed over")
      assert.ok(calls[0].completedQuestionIds.includes("tools_overview"))

      click(container.querySelector("[data-tool-checkpoint-continue]")!)
      await pause(30)
      const document = container.ownerDocument
      const rows = [...document.querySelectorAll("[data-routine-tool-row]")].map((row) =>
        row.getAttribute("data-routine-tool-row"),
      )
      assert.ok(rows.length > 0, "the Routine shows Deine Tools")
      const expected = journeyRoutineToolSection(calls[0], journeyNeedSnapshot())
      assert.deepEqual(
        rows,
        expected?.assets.map((asset) => asset.assetKey),
      )
      // The fixed lab fixture (Lena) owns a Glätteisen; the walk named none.
      assert.equal(rows.includes("asset:heated_styling:flat_iron"), false)
    },
  )
})

test("journey lab: „Tools ergänzen“ re-enters the tools module on the saved picks", async () => {
  const { plan, resolveRoutineToolSection } = journeyProps()
  await withMountedDom(
    <FeinschliffJourneyClient
      plan={plan}
      stage3EntryContext={null}
      resolveRoutineToolSection={resolveRoutineToolSection}
      initialStep="module-tools"
    />,
    async (container) => {
      await tickWashSectionOnOverview(container)
      await walkToolsModule(container)
      click(container.querySelector("[data-tool-checkpoint-add-tools]")!)
      await pause(30)
      const wash = container.querySelector('[data-tool-option="waschen_auftragen"]')
      assert.ok(wash, "re-entry opens on the overview")
      assert.equal(
        wash.getAttribute("aria-pressed"),
        "true",
        "the earlier pick survives the re-entry instead of the fixture's starting value",
      )
    },
  )
})
