// Install jsdom before React DOM / Testing Library.
import "./helpers/dom"

import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { act, cleanup, renderHook } from "@testing-library/react"
import React, { StrictMode } from "react"

import { useStage3BudgetRefreshController } from "../src/components/personal-plan-products/use-stage3-budget-refresh-controller"
import type { ShoppingBudget } from "../src/lib/user-facts/schema"

afterEach(cleanup)

const budget: ShoppingBudget = { kind: "capped", limitEur: 15, allowExceptions: true }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

function strictMode({ children }: { children: React.ReactNode }) {
  return <StrictMode>{children}</StrictMode>
}

function mountController() {
  return renderHook(
    () =>
      useStage3BudgetRefreshController({
        initialEnvelope: { status: "saved", value: budget },
        primaryReady: true,
        saveShoppingBudget: async (value) => ({ status: "saved", budget: value }),
      }),
    { wrapper: strictMode },
  )
}

// Distinct from the component's simulated dispatcher: real effect replay, cleanup, and a new
// mounted owner must not let an old post-save response publish or continue the old journey.
test("post-save refresh ignores its response and continuation after disposal and remount", async () => {
  const response = deferred<string>()
  const committed: string[] = []
  const continued: string[] = []
  const old = mountController()
  let pending!: Promise<unknown>
  act(() => {
    pending = old.result.current.refreshAfterBudgetSave({
      load: () => response.promise,
      commit: (value) => committed.push(value),
      onAccepted: (value) => continued.push(value),
    })
  })
  assert.equal(old.result.current.view.budgetSaveStatus, "saving")
  old.unmount()

  const current = mountController()
  await act(async () => {
    response.resolve("obsolete recommendations")
    await pending
  })
  assert.deepEqual(committed, [])
  assert.deepEqual(continued, [])
  assert.equal(current.result.current.view.authorityStatus, "ready")
  assert.equal(current.result.current.view.budgetSaveStatus, "idle")
})

// The custom dispatcher cannot establish React batching: the production callback must publish
// its bundle/choice update before readiness, and both must be visible after the same act turn.
test("accepted refresh publishes its result before readiness and the continuation", async () => {
  const response = deferred<string>()
  const order: string[] = []
  const owner = mountController()
  let pending!: Promise<unknown>
  act(() => {
    pending = owner.result.current.refreshAfterBudgetSave({
      load: () => response.promise,
      commit: (value) => {
        assert.equal(owner.result.current.getSnapshot().authorityStatus, "loading")
        order.push(value)
      },
      onAccepted: () => {
        assert.deepEqual(order, ["current recommendations"])
        order.push("continue")
      },
    })
  })
  assert.equal(owner.result.current.view.authorityStatus, "loading")
  await act(async () => {
    response.resolve("current recommendations")
    await pending
  })
  assert.deepEqual(order, ["current recommendations", "continue"])
  assert.equal(owner.result.current.view.authorityStatus, "ready")
  assert.equal(owner.result.current.view.budgetSaveStatus, "idle")
})

// Existing helper coverage compares generation numbers only. Here the actual asynchronous
// production owner must reject old success, rejection, and cleanup while a replacement runs.
for (const staleOutcome of ["success", "failure"] as const) {
  test(`superseded projection ${staleOutcome} cannot publish or unblock a newer projection`, async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const commits: string[] = []
    const failures: string[] = []
    const owner = mountController()
    let oldPending!: Promise<unknown>
    let newPending!: Promise<unknown>
    act(() => {
      oldPending = owner.result.current.previewChoices({
        load: () => first.promise,
        commit: (value) => commits.push(value),
        onFailure: () => failures.push("obsolete failure"),
      })
    })
    act(() => {
      owner.result.current.invalidateReviews()
      newPending = owner.result.current.previewChoices({
        load: () => second.promise,
        commit: (value) => commits.push(value),
        onFailure: () => failures.push("current failure"),
      })
    })
    assert.equal(owner.result.current.view.budgetPreviewBlocked, true)
    await act(async () => {
      if (staleOutcome === "success") first.resolve("obsolete recommendations")
      else first.reject(new Error("obsolete network error"))
      await oldPending
    })
    assert.deepEqual(commits, [])
    assert.deepEqual(failures, [])
    assert.equal(owner.result.current.view.budgetPreviewBlocked, true)
    assert.equal(owner.result.current.view.budgetPreviewStatus, "loading")

    await act(async () => {
      second.resolve("current recommendations")
      await newPending
    })
    assert.deepEqual(commits, ["current recommendations"])
    assert.deepEqual(failures, [])
    assert.equal(owner.result.current.view.budgetPreviewBlocked, false)
  })
}

test("same-turn repeated budget confirmation admits one save and one refresh", async () => {
  const response = deferred<{ status: "saved"; budget: ShoppingBudget }>()
  const saves: ShoppingBudget[] = []
  let refreshes = 0
  const owner = renderHook(() =>
    useStage3BudgetRefreshController({
      initialEnvelope: { status: "budget_required", suggestion: null },
      primaryReady: true,
      saveShoppingBudget: (value) => {
        saves.push(value)
        return response.promise
      },
    }),
  )
  let pending!: Promise<unknown>
  let duplicate!: Promise<unknown>
  const refresh = async () => {
    refreshes += 1
  }
  act(() => {
    pending = owner.result.current.saveBudget(budget, refresh)
    duplicate = owner.result.current.saveBudget(budget, refresh)
  })
  assert.equal(saves.length, 1)
  await act(async () => {
    response.resolve({ status: "saved", budget })
    await Promise.all([pending, duplicate])
  })
  assert.deepEqual(saves, [budget])
  assert.equal(refreshes, 1)
  assert.deepEqual(owner.result.current.view.savedBudget, budget)
})
