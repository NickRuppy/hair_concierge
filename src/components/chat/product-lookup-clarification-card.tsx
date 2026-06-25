"use client"

import { useState } from "react"
import { Check, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ProductLookupClarification } from "@/lib/types"
import { ProductIntakeCard } from "./product-intake-card"

type ProductLookupClarificationCardProps = {
  clarification: ProductLookupClarification
  conversationId: string
  onSelectProduct?: (params: {
    clarificationId: string
    selectedProductId: string
    sourceAssistantMessageId?: string
  }) => Promise<void> | void
  assistantMessageId?: string
  selectionDisabled?: boolean
}

export function ProductLookupClarificationCard({
  clarification,
  conversationId,
  onSelectProduct,
  assistantMessageId,
  selectionDisabled = false,
}: ProductLookupClarificationCardProps) {
  const [showIntake, setShowIntake] = useState(false)
  const [selectingProductId, setSelectingProductId] = useState<string | null>(null)
  const [selectionError, setSelectionError] = useState<string | null>(null)

  const canSelect =
    Boolean(onSelectProduct) &&
    Boolean(conversationId) &&
    Boolean(assistantMessageId) &&
    !assistantMessageId?.startsWith("temp-") &&
    !selectionDisabled

  if (
    !clarification?.id ||
    !clarification.copy?.prompt_de ||
    !Array.isArray(clarification.candidates) ||
    clarification.candidates.length === 0 ||
    !clarification.none_action?.product_intake_offer
  ) {
    return null
  }

  async function selectProduct(productId: string) {
    if (!onSelectProduct || !canSelect || selectingProductId) return
    setSelectingProductId(productId)
    setSelectionError(null)
    try {
      await onSelectProduct({
        clarificationId: clarification.id,
        selectedProductId: productId,
        sourceAssistantMessageId: assistantMessageId,
      })
    } catch (error) {
      setSelectionError(
        error instanceof Error
          ? error.message
          : "Das Produkt konnte nicht ausgewählt werden. Bitte versuche es erneut.",
      )
    } finally {
      setSelectingProductId(null)
    }
  }

  return (
    <div className="w-full min-w-0 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
      <p className="text-sm leading-relaxed text-foreground">{clarification.copy.prompt_de}</p>

      <div className="mt-3 space-y-2">
        {clarification.candidates.map((candidate) => (
          <div
            key={candidate.product_id}
            className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-background p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--text-heading)]">
                {candidate.name}
              </p>
              <span className="mt-1 inline-flex max-w-full items-center rounded-full bg-[var(--brand-plum-ice)] px-2 py-0.5 text-[11px] font-medium text-primary">
                {candidate.category_label_de}
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canSelect || selectingProductId !== null}
              onClick={() => selectProduct(candidate.product_id)}
              className="shrink-0 gap-1.5"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {selectingProductId === candidate.product_id ? "Wird ausgewählt" : "Auswählen"}
            </Button>
          </div>
        ))}
      </div>

      {selectionError ? (
        <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {selectionError}
        </p>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setShowIntake((value) => !value)}
        className="mt-3 w-full justify-center gap-1.5"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {clarification.none_action.label_de}
      </Button>

      {showIntake ? (
        <div className="mt-3">
          <ProductIntakeCard
            offer={clarification.none_action.product_intake_offer}
            conversationId={conversationId}
          />
        </div>
      ) : null}
    </div>
  )
}
