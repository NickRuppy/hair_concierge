// The jsdom globals must exist before React DOM and @testing-library load.
import "./helpers/dom"

import assert from "node:assert/strict"
import { afterEach, mock, test } from "node:test"

import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import React from "react"

import { DiscoveryCallCockpit } from "../src/components/discovery/cockpit/discovery-call-cockpit"
import type {
  DiscoveryCockpitStepView,
  DiscoveryCockpitSwapOption,
} from "../src/lib/discovery/cockpit"
import type { PersonalPlanCategory } from "../src/lib/personal-plan/products/contracts"

/**
 * Cockpit call-ready A2 in a real DOM: „Testlauf zurücksetzen" — shown only while something is
 * decided and the call is not finalised, asks first, then DELETEs and refreshes.
 */

afterEach(() => {
  cleanup()
  mock.restoreAll()
})

function recommendation(): DiscoveryCockpitSwapOption {
  return {
    productId: "rec-mask",
    name: "Olaplex No. 8",
    brand: "Olaplex",
    label: "Olaplex No. 8",
    verdictLabel: "Passt",
    priceLabel: null,
    imageUrl: null,
    origin: "ideal_recommendation",
    propertyRows: null,
  }
}

type StepInput = Partial<DiscoveryCockpitStepView> & {
  decisionKey: string
  category: PersonalPlanCategory
  categoryLabel: string
}

function step(input: StepInput): DiscoveryCockpitStepView {
  return {
    roleLabel: input.category,
    roleDescription: null,
    frequencyLabel: "1× pro Woche",
    depth: null,
    section: "basis",
    outcome: input.intakeItemId ? "undecided" : "ideal",
    ownedLabel: null,
    intakeItemId: null,
    ownedProductId: null,
    ownedUsageRole: null,
    stepEntryCount: 1,
    ownedFrequencyLabel: null,
    ownedFrequency: null,
    idealAllowedRange: null,
    canDrop: false,
    unanswered: false,
    verdict: null,
    swapOptions: [],
    swapProductId: null,
    swapProductLabel: null,
    idealRecommendation: null,
    recommendationLabel: null,
    ownedUsageLabel: null,
    ownedImageUrl: null,
    swapProductImageUrl: null,
    recommendationImageUrl: null,
    usageDifference: null,
    ...input,
  }
}

const mask = recommendation()

function steps(decided: boolean): DiscoveryCockpitStepView[] {
  return [
    step({
      decisionKey: "decision:mask",
      category: "mask",
      categoryLabel: "Maske",
      swapOptions: [mask],
      idealRecommendation: mask,
      recommendationLabel: mask.label,
      ...(decided ? { outcome: "swapped" as const, swapProductId: mask.productId } : {}),
    }),
  ]
}

function renderCockpit(props: { decided: boolean; finalizedAt?: string | null }) {
  const router = {
    refresh: mock.fn(),
    push() {},
    replace() {},
    prefetch() {},
    back() {},
    forward() {},
  }
  render(
    <AppRouterContext.Provider value={router as never}>
      <DiscoveryCallCockpit
        enrollmentId="enrollment-1"
        steps={steps(props.decided)}
        submitted
        initialFinalizedAt={props.finalizedAt ?? null}
        complexity={null}
        complexityLocked={false}
      />
    </AppRouterContext.Provider>,
  )
  return router
}

function resetButton(): HTMLButtonElement | null {
  return document.getElementById("runsheet-reset-decisions") as HTMLButtonElement | null
}

test("A2: no reset while nothing is decided, and none once finalised", () => {
  renderCockpit({ decided: false })
  assert.equal(resetButton(), null)
  cleanup()
  renderCockpit({ decided: true, finalizedAt: "2026-10-09T10:00:00Z" })
  assert.equal(resetButton(), null)
})

test("A2: confirmed reset DELETEs this call's decisions and refreshes; declined does nothing", async () => {
  const calls: Array<{ url: string; method: string | undefined }> = []
  mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method })
    return new Response(JSON.stringify({ deleted: 1 }), { status: 200 })
  })
  const answers = [false, true]
  const prompts: string[] = []
  mock.method(window, "confirm", (message: string) => {
    prompts.push(message)
    return answers.shift() ?? false
  })
  const router = renderCockpit({ decided: true })
  const button = resetButton()
  assert.ok(button)
  assert.equal(button.textContent, "Testlauf zurücksetzen")

  await act(async () => fireEvent.click(button))
  assert.deepEqual(calls, [])

  await act(async () => fireEvent.click(button))
  assert.deepEqual(calls, [{ url: "/api/admin/beratung/enrollment-1/decisions", method: "DELETE" }])
  assert.match(
    prompts[0]!,
    /^Alle 1 Entscheidung zurücksetzen\? Score, Brief und Notizen bleiben\.$/,
  )
  assert.equal(router.refresh.mock.callCount(), 1)
})

test("A2: a finalised-in-between refusal names it and keeps the decisions", async () => {
  mock.method(
    globalThis,
    "fetch",
    async () => new Response(JSON.stringify({ code: "finalized" }), { status: 409 }),
  )
  mock.method(window, "confirm", () => true)
  const router = renderCockpit({ decided: true })
  await act(async () => fireEvent.click(resetButton()!))
  assert.ok(document.body.textContent?.includes("Der Call ist finalisiert"))
  assert.equal(router.refresh.mock.callCount(), 0)
  assert.ok(resetButton())
})
