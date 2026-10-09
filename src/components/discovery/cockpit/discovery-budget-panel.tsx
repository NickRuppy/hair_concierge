"use client"

import { useRouter } from "next/navigation"
import { useId, useState } from "react"

import { budgetLineValue } from "@/components/personal-plan-products/stage3-product-copy"
import type { ShoppingBudget } from "@/lib/user-facts/schema"

import { beginDiscoveryDecisionWrite } from "./decision-writes"

/**
 * „Kundenbudget" in Phase 3 of the call cockpit (Profi-tier plan, Task 8): the budget the
 * customer stated, and — in staff voice — the one place Nick corrects it mid-call.
 *
 * Read mode shows the value as the customer's own budget line reads it, with „Ändern". Edit
 * mode is two inline radio groups (limit; for a capped answer, whether it binds every product)
 * and „Speichern" / „Abbrechen". Optimistic like the decisions (`ComplexityChoice`): the new
 * value shows at once, `PUT /api/admin/beratung/<id>/shopping-preferences` runs behind it, a
 * refusal rolls the value back and reopens the editor with the choice still in it, and a
 * success refreshes the page so the recommendations below follow the new budget.
 *
 * Frozen once the call is finalised: the route refuses too, this only says so first.
 */

export const BUDGET_PANEL_TITLE = "Kundenbudget"
export const BUDGET_PANEL_EDIT_TITLE = "Kundenbudget ändern"
export const BUDGET_PANEL_SOURCE = "Angabe der Kundin / des Kunden"
export const BUDGET_PANEL_NONE = "Noch kein Budget angegeben"
export const BUDGET_PANEL_CHANGE = "Ändern"
export const BUDGET_PANEL_LIMIT_LEGEND = "Preis pro Packung"
export const BUDGET_PANEL_EXCEPTIONS_LEGEND = "Gilt die Grenze für jedes Produkt?"
export const BUDGET_PANEL_SAVE = "Speichern"
export const BUDGET_PANEL_SAVE_BUSY = "Wird gespeichert"
export const BUDGET_PANEL_CANCEL = "Abbrechen"
export const BUDGET_PANEL_FROZEN = "Erst Finalisierung aufheben."
export const BUDGET_PANEL_ERROR = "Nicht gespeichert. Bitte noch einmal."
export const BUDGET_PANEL_CONFLICT =
  "Das Budget wurde zwischenzeitlich geändert. Seite neu laden, dann noch einmal."

const LIMIT_OPTIONS: ReadonlyArray<[BudgetLimit, string]> = [
  ["5", "Bis 5 €"],
  ["15", "Bis 15 €"],
  ["uncapped", "Keine feste Preisgrenze"],
]
const EXCEPTION_OPTIONS: ReadonlyArray<[boolean, string]> = [
  [false, "Ja, für jedes"],
  [true, "Einzelne dürfen mehr kosten"],
]

type BudgetLimit = "5" | "15" | "uncapped"
type Draft = { limit: BudgetLimit | null; allowExceptions: boolean | null }

/** The value line: „Bis 5 € für jedes Produkt", „Ohne feste Preisgrenze", … */
export function discoveryBudgetValueLabel(budget: ShoppingBudget | null): string {
  return budget ? budgetLineValue(budget) : BUDGET_PANEL_NONE
}

function draftFrom(budget: ShoppingBudget | null): Draft {
  if (!budget) return { limit: null, allowExceptions: null }
  if (budget.kind === "uncapped") return { limit: "uncapped", allowExceptions: null }
  return { limit: budget.limitEur === 5 ? "5" : "15", allowExceptions: budget.allowExceptions }
}

/** The answer as the facts door stores it; null while it is not complete. */
export function discoveryBudgetFromDraft(draft: Draft): ShoppingBudget | null {
  if (draft.limit === "uncapped") return { kind: "uncapped" }
  if ((draft.limit === "5" || draft.limit === "15") && draft.allowExceptions !== null) {
    return {
      kind: "capped",
      limitEur: draft.limit === "5" ? 5 : 15,
      allowExceptions: draft.allowExceptions,
    }
  }
  return null
}

export function DiscoveryBudgetPanel({
  enrollmentId,
  budget,
  finalized,
}: {
  enrollmentId: string
  /** The customer's saved budget; null = none yet. */
  budget: ShoppingBudget | null
  /** The call is finalised: the budget is frozen with the decisions. */
  finalized: boolean
}) {
  const router = useRouter()
  const groupId = useId()
  const [value, setValue] = useState<ShoppingBudget | null>(budget)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => draftFrom(budget))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const next = discoveryBudgetFromDraft(draft)

  function startEditing() {
    if (finalized || pending) return
    setDraft(draftFrom(value))
    setError(null)
    setEditing(true)
  }

  async function save() {
    if (!next || pending || finalized) return
    const previous = value
    setValue(next)
    setEditing(false)
    setPending(true)
    setError(null)
    const endWrite = beginDiscoveryDecisionWrite()
    const rollback = (message: string) => {
      setValue(previous)
      setEditing(true)
      setError(message)
    }
    try {
      const response = await fetch(`/api/admin/beratung/${enrollmentId}/shopping-preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budget: next }),
      })
      if (response.ok) {
        // The recommendations below were composed under the old budget: reload them.
        router.refresh()
        return
      }
      const body = (await response.json().catch(() => null)) as { code?: string } | null
      rollback(
        body?.code === "finalized"
          ? BUDGET_PANEL_FROZEN
          : body?.code === "profile_conflict"
            ? BUDGET_PANEL_CONFLICT
            : BUDGET_PANEL_ERROR,
      )
    } catch {
      rollback(BUDGET_PANEL_ERROR)
    } finally {
      endWrite()
      setPending(false)
    }
  }

  const titleId = `${groupId}-title`

  if (!editing) {
    return (
      <section
        id="runsheet-budget"
        aria-labelledby={titleId}
        className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border bg-card px-4 py-3"
      >
        <div className="min-w-0">
          <h3 id={titleId} className="text-[13px] font-bold text-foreground">
            {BUDGET_PANEL_TITLE}
          </h3>
          <p className="text-[11px] text-muted-foreground">{BUDGET_PANEL_SOURCE}</p>
        </div>
        <p className="text-sm font-semibold text-foreground" data-budget-value="true">
          {discoveryBudgetValueLabel(value)}
        </p>
        <button
          type="button"
          onClick={startEditing}
          disabled={finalized || pending}
          className="ml-auto text-[13px] font-bold text-[var(--brand-plum)] underline disabled:no-underline disabled:opacity-60"
        >
          {BUDGET_PANEL_CHANGE}
        </button>
        {finalized ? (
          <p role="status" className="basis-full text-[12px] text-muted-foreground">
            {BUDGET_PANEL_FROZEN}
          </p>
        ) : error ? (
          <p
            role="status"
            className="basis-full text-[12px] font-bold text-[var(--status-danger-text)]"
          >
            {error}
          </p>
        ) : null}
      </section>
    )
  }

  const capped = draft.limit === "5" || draft.limit === "15"
  return (
    <section
      id="runsheet-budget"
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3"
    >
      <h3 id={titleId} className="text-[13px] font-bold text-foreground">
        {BUDGET_PANEL_EDIT_TITLE}
      </h3>
      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <legend className="mb-1 text-[12px] font-bold text-muted-foreground">
          {BUDGET_PANEL_LIMIT_LEGEND}
        </legend>
        {LIMIT_OPTIONS.map(([id, label]) => (
          <label key={id} className="flex items-center gap-1.5 text-sm text-foreground">
            <input
              type="radio"
              name={`${groupId}-limit`}
              value={id}
              checked={draft.limit === id}
              onChange={() =>
                setDraft((current) => ({
                  limit: id,
                  // A new limit asks the follow-up again; the same one keeps its answer.
                  allowExceptions:
                    id === "uncapped" || current.limit !== id ? null : current.allowExceptions,
                }))
              }
              className="accent-[var(--brand-plum)]"
            />
            {label}
          </label>
        ))}
      </fieldset>
      {capped ? (
        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <legend className="mb-1 text-[12px] font-bold text-muted-foreground">
            {BUDGET_PANEL_EXCEPTIONS_LEGEND}
          </legend>
          {EXCEPTION_OPTIONS.map(([allow, label]) => (
            <label key={label} className="flex items-center gap-1.5 text-sm text-foreground">
              <input
                type="radio"
                name={`${groupId}-exceptions`}
                value={allow ? "flex" : "strict"}
                checked={draft.allowExceptions === allow}
                onChange={() => setDraft((current) => ({ ...current, allowExceptions: allow }))}
                className="accent-[var(--brand-plum)]"
              />
              {label}
            </label>
          ))}
        </fieldset>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!next || pending}
          className="rounded-lg border-[1.5px] border-[var(--brand-plum)] px-4 py-1.5 text-[13px] font-bold text-[var(--brand-plum)] disabled:opacity-50"
        >
          {pending ? BUDGET_PANEL_SAVE_BUSY : BUDGET_PANEL_SAVE}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false)
            setError(null)
          }}
          disabled={pending}
          className="text-[13px] font-bold text-muted-foreground underline disabled:opacity-60"
        >
          {BUDGET_PANEL_CANCEL}
        </button>
        {error ? (
          <p role="status" className="text-[12px] font-bold text-[var(--status-danger-text)]">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  )
}
