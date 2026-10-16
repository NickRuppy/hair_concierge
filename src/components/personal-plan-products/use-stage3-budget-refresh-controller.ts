"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { Stage3BootstrapBudgetEnvelope } from "@/lib/personal-plan/products/gateway"
import type { ShoppingBudget } from "@/lib/user-facts/schema"
import type { Stage3BudgetSaveResult } from "./stage3-budget-api"
import {
  initialStage3BudgetRefreshState,
  stage3BudgetRefreshReducer,
  stage3BudgetRefreshView,
  type Stage3BudgetRefreshEvent,
} from "./stage3-budget-refresh-state"

export class Stage3ReviewRequestSupersededError extends Error {
  constructor() {
    super("stage3_review_request_superseded")
  }
}

export type Stage3ReviewRequest = {
  token: number
  isCurrent: () => boolean
  assertCurrent: () => void
}

type ReviewOperation<T> = {
  load: (request: Stage3ReviewRequest) => Promise<T>
  /** Runs synchronously after admission and before readiness is published. */
  commit: (value: T) => void
  onAccepted?: (value: T) => void
  onFailure?: (error: unknown) => void
}

type ProjectionOperation<T> = ReviewOperation<T> & {
  /** A conflict can rebase and start a replacement operation; the old operation cannot settle it. */
  recover?: (value: T, request: Stage3ReviewRequest) => Promise<boolean>
}

export function useStage3BudgetRefreshController(input: {
  initialEnvelope?: Stage3BootstrapBudgetEnvelope | null
  primaryReady?: boolean
  saveShoppingBudget: (budget: ShoppingBudget) => Promise<Stage3BudgetSaveResult>
}) {
  const [state, setState] = useState(() => initialStage3BudgetRefreshState(input))
  // Commands and callbacks use this snapshot before React has rendered their state updates.
  // There is no separate save lock, preview generation, or freshness mirror.
  const snapshot = useRef(state)
  const saveOperation = useRef(input.saveShoppingBudget)
  useLayoutEffect(() => {
    saveOperation.current = input.saveShoppingBudget
  }, [input.saveShoppingBudget])

  const commands = useMemo(() => {
    function transition(event: Stage3BudgetRefreshEvent) {
      snapshot.current = stage3BudgetRefreshReducer(snapshot.current, event)
      if (snapshot.current.active) setState(snapshot.current)
    }
    function request(): Stage3ReviewRequest {
      const token = snapshot.current.sequence
      const isCurrent = () => snapshot.current.active && snapshot.current.sequence === token
      return {
        token,
        isCurrent,
        assertCurrent: () => {
          if (!isCurrent()) throw new Stage3ReviewRequestSupersededError()
        },
      }
    }
    async function runPrimary<T>(operation: ReviewOperation<T>, postSave = false): Promise<T> {
      if (!snapshot.current.active) throw new Stage3ReviewRequestSupersededError()
      transition({ type: "primary_requested", purpose: postSave ? "post_save" : "entry" })
      const owned = request()
      try {
        const value = await operation.load(owned)
        owned.assertCurrent()
        operation.commit(value)
        owned.assertCurrent()
        transition({ type: "primary_accepted", request: owned.token })
        operation.onAccepted?.(value)
        return value
      } catch (error) {
        if (!owned.isCurrent()) throw new Stage3ReviewRequestSupersededError()
        transition({ type: "primary_failed", request: owned.token })
        operation.onFailure?.(error)
        throw error
      }
    }
    return {
      getSnapshot: () => stage3BudgetRefreshView(snapshot.current),
      currentRequest: request,
      applyEnvelope: (envelope: Stage3BootstrapBudgetEnvelope | null | undefined) =>
        transition({ type: "envelope", envelope }),
      resetSaveFailure: () => transition({ type: "save_reset" }),
      invalidateReviews: (options: { captureReopened?: boolean } = {}) =>
        transition({ type: "invalidated", ...options }),
      bypassPrimary: (
        reason: "need_revision" | "inventory_only",
        commit: () => void = () => {},
      ) => {
        if (!snapshot.current.active) return
        if (reason === "inventory_only") transition({ type: "envelope", envelope: null })
        commit()
        transition({ type: "primary_bypassed" })
      },
      runPrimary: <T>(operation: ReviewOperation<T>) => runPrimary(operation),
      refreshAfterBudgetSave: async <T>(operation: ReviewOperation<T>): Promise<void> => {
        try {
          await runPrimary(operation, true)
        } catch (error) {
          if (!(error instanceof Stage3ReviewRequestSupersededError) && !operation.onFailure)
            throw error
        }
      },
      saveBudget: async (budget: ShoppingBudget, refresh: () => Promise<void>): Promise<void> => {
        if (
          !snapshot.current.active ||
          stage3BudgetRefreshView(snapshot.current).budgetSaveStatus === "saving"
        )
          return
        transition({ type: "save_requested" })
        const owned = request()
        let result: Stage3BudgetSaveResult
        try {
          result = await saveOperation.current(budget)
        } catch {
          result = { status: "unavailable" }
        }
        if (!owned.isCurrent()) return
        if (result.status !== "saved") {
          transition({ type: "save_failed", request: owned.token, reason: result.status })
          return
        }
        transition({ type: "save_saved", request: owned.token, value: result.budget })
        await refresh()
      },
      previewChoices: async <T>(operation: ProjectionOperation<T>): Promise<void> => {
        if (!snapshot.current.active) return
        transition({
          type: "projection_requested",
          blocking: snapshot.current.authority.status === "saved",
        })
        const owned = request()
        try {
          const value = await operation.load(owned)
          owned.assertCurrent()
          if (operation.recover && (await operation.recover(value, owned))) return
          owned.assertCurrent()
          operation.commit(value)
          owned.assertCurrent()
          transition({ type: "projection_accepted", request: owned.token })
          operation.onAccepted?.(value)
        } catch (error) {
          if (!owned.isCurrent()) return
          transition({ type: "projection_failed", request: owned.token })
          operation.onFailure?.(error)
        }
      },
    }
  }, [])

  useEffect(() => {
    // StrictMode replays setup after cleanup on the same hook instance. Reactivation permits
    // new work while the incremented sequence continues to reject pre-cleanup responses.
    snapshot.current = stage3BudgetRefreshReducer(snapshot.current, { type: "activated" })
    setState(snapshot.current)
    return () => {
      snapshot.current = stage3BudgetRefreshReducer(snapshot.current, { type: "disposed" })
    }
  }, [])

  return { ...commands, view: stage3BudgetRefreshView(state) }
}
