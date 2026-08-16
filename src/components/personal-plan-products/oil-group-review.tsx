"use client"

import { Check } from "lucide-react"
import type { ReactElement, ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Stage3StickyAction } from "./stage3-sticky-action"

export type OilGroupReviewCase = {
  role: string
  roleTitle: string
  roleSubtitle: string
  decisionKey: string
  /** Only shown when the recommendations diverge across use cases. */
  productName: string | null
}

export const OIL_GROUP_USE_CASE_INTRO =
  "Deine Einsätze aus dem Feinschliff — antippen zum Abwählen:"

/**
 * The one Öl review screen: the anchor's comparison content, the pre-checked use
 * cases the user named in the Feinschliff, and a single commit action for every
 * case that is still checked. Deselected cases stay pending and surface later as
 * their own scoped follow-up review.
 */
export function OilGroupReview({
  group,
  uniformProposition,
  checkedKeys,
  onToggle,
  onCommit,
  disabled = false,
  children,
}: {
  group: OilGroupReviewCase[]
  uniformProposition: boolean
  checkedKeys: ReadonlySet<string>
  onToggle: (decisionKey: string) => void
  onCommit: () => void
  disabled?: boolean
  children: ReactNode
}): ReactElement {
  const checkedCount = group.filter((useCase) => checkedKeys.has(useCase.decisionKey)).length

  return (
    <div className="min-w-0">
      {children}
      <section className="mt-5" aria-labelledby="oil-group-use-cases-title">
        <p id="oil-group-use-cases-title" className="text-sm text-muted-foreground">
          {OIL_GROUP_USE_CASE_INTRO}
        </p>
        <div className="mt-2 grid gap-2">
          {group.map((useCase) => {
            const checked = checkedKeys.has(useCase.decisionKey)
            return (
              <button
                key={useCase.decisionKey}
                type="button"
                role="checkbox"
                aria-checked={checked}
                disabled={disabled}
                onClick={() => onToggle(useCase.decisionKey)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                  checked
                    ? "border-[var(--plum)] bg-card"
                    : "border-border bg-muted/30 text-muted-foreground",
                  disabled ? "opacity-60" : "hover:bg-muted/40",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-[18px] w-[18px] flex-none place-items-center rounded-md border-2",
                    checked
                      ? "border-[var(--plum)] bg-[var(--plum)] text-white"
                      : "border-border bg-transparent",
                  )}
                >
                  {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{useCase.roleTitle}</span>
                  <span className="block text-xs text-muted-foreground">
                    {useCase.roleSubtitle}
                  </span>
                  {!uniformProposition && useCase.productName ? (
                    <span className="block text-xs text-muted-foreground">
                      {useCase.productName}
                    </span>
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
      </section>
      {checkedCount > 0 ? (
        <Stage3StickyAction>
          <Button
            type="button"
            variant="funnelCta"
            className="h-auto min-h-14 w-full whitespace-normal px-5 py-3 text-center leading-tight"
            disabled={disabled}
            onClick={onCommit}
          >
            {oilGroupCommitLabel(checkedCount, group.length, uniformProposition)}
          </Button>
        </Stage3StickyAction>
      ) : null}
    </div>
  )
}

export function oilGroupCommitLabel(
  checkedCount: number,
  totalCount: number,
  uniformProposition: boolean,
): string {
  if (checkedCount === 1) return "Für diesen Einsatz einplanen"
  if (checkedCount === totalCount) {
    return uniformProposition
      ? `Für alle ${totalCount} Einsätze einplanen`
      : `Empfehlungen für alle ${totalCount} einplanen`
  }
  return `Für ${checkedCount} Einsätze einplanen`
}
