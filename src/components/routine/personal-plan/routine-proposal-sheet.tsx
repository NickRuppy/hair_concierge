"use client"

import * as React from "react"

import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"

export type RoutineProposalSheetDeltaEntry = {
  changeKey: string
  label: string
  description?: string
}

export type RoutineProposalSheetVariant = "initial" | "successor"

export type RoutineProposalSheetBodyProps = {
  variant: RoutineProposalSheetVariant
  directChanges: RoutineProposalSheetDeltaEntry[]
  consequentialChanges: RoutineProposalSheetDeltaEntry[]
  unchangedItemCount: number
  submitting?: boolean
  retrying?: boolean
  errorMessage?: string | null
  onAccept: () => void
  onBackToEditor?: () => void
  onDiscardCandidate?: () => void
  onDismissForVisit?: () => void
  onReject?: () => void
}

export type RoutineProposalSheetProps = RoutineProposalSheetBodyProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  returnFocusRef?: React.RefObject<HTMLElement | null>
}

function ChangeList({
  title,
  emptyLabel,
  entries,
}: {
  title: string
  emptyLabel: string
  entries: RoutineProposalSheetDeltaEntry[]
}) {
  return (
    <section className="space-y-2" aria-labelledby={`${title}-title`}>
      <h3 id={`${title}-title`} className="text-sm font-semibold">
        {title}
      </h3>
      {entries.length > 0 ? (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.changeKey} className="rounded-[8px] border border-border p-3 text-sm">
              <p className="font-medium">{entry.label}</p>
              {entry.description ? (
                <p className="mt-1 text-muted-foreground">{entry.description}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </section>
  )
}

export function RoutineProposalSheetBody({
  variant,
  directChanges,
  consequentialChanges,
  unchangedItemCount,
  submitting = false,
  retrying = false,
  errorMessage,
  onAccept,
  onBackToEditor,
  onDiscardCandidate,
  onDismissForVisit,
  onReject,
}: RoutineProposalSheetBodyProps) {
  const isInitial = variant === "initial"
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-primary">
          {isInitial ? "Erster Routine-Vorschlag" : "Neuer Routine-Vorschlag"}
        </p>
        <p className="text-sm text-muted-foreground">
          {isInitial
            ? "Bestätige die vollständige Routine, wenn die Produkt- und Aufgabenverteilung passt."
            : "Deine aktive Routine bleibt unverändert, bis du diesen Vorschlag übernimmst."}
        </p>
      </div>

      <ChangeList
        title={isInitial ? "Vorgeschlagene Routine" : "Von dir geändert"}
        emptyLabel={
          isInitial
            ? "Keine Einzeländerungen, weil dies dein erster vollständiger Vorschlag ist."
            : "Keine direkten Änderungen in diesem Vorschlag."
        }
        entries={directChanges}
      />
      {!isInitial ? (
        <ChangeList
          title="Dadurch außerdem angepasst"
          emptyLabel="Keine weiteren Bausteine wurden angepasst."
          entries={consequentialChanges}
        />
      ) : null}

      <p className="rounded-[8px] bg-muted px-3 py-2 text-sm">
        {unchangedItemCount === 1
          ? "1 Baustein bleibt unverändert."
          : `${unchangedItemCount} Bausteine bleiben unverändert.`}
      </p>

      {errorMessage ? (
        <p className="rounded-[8px] border border-destructive/40 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {!isInitial && onDismissForVisit ? (
          <Button type="button" variant="ghost" disabled={submitting} onClick={onDismissForVisit}>
            Später
          </Button>
        ) : null}
        {onBackToEditor ? (
          <Button type="button" variant="outline" disabled={submitting} onClick={onBackToEditor}>
            Zurück zum Bearbeiten
          </Button>
        ) : null}
        {!isInitial && onDiscardCandidate ? (
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={onDiscardCandidate}
          >
            Änderungen verwerfen
          </Button>
        ) : null}
        {!isInitial && onReject ? (
          <Button type="button" variant="destructive" disabled={submitting} onClick={onReject}>
            Ablehnen
          </Button>
        ) : null}
        <Button type="button" variant="cta" disabled={submitting} onClick={onAccept}>
          {submitting
            ? "Wird gespeichert …"
            : retrying
              ? "Erneut versuchen"
              : isInitial
                ? "Routine bestätigen"
                : "Änderungen übernehmen"}
        </Button>
      </div>
    </div>
  )
}

export function RoutineProposalSheet({
  open,
  onOpenChange,
  returnFocusRef,
  variant,
  directChanges,
  consequentialChanges,
  unchangedItemCount,
  submitting,
  retrying,
  errorMessage,
  onAccept,
  onBackToEditor,
  onDiscardCandidate,
  onDismissForVisit,
  onReject,
}: RoutineProposalSheetProps) {
  const title = variant === "initial" ? "Routine bestätigen" : "Routine-Vorschlag prüfen"
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent
        contentClassName="space-y-4"
        restoreFocusRef={returnFocusRef}
        rootClassName="z-[110] [&_.bottom-sheet-backdrop]:bg-black/40"
        onDismissRequest={() => {
          if (variant === "successor") onDismissForVisit?.()
          onOpenChange(false)
        }}
      >
        <BottomSheetTitle>{title}</BottomSheetTitle>
        <BottomSheetDescription>
          {variant === "initial"
            ? "Es gibt noch keine alte Routine, deshalb gibt es hier kein Ablehnen."
            : "Du entscheidest bewusst, ob dieser Nachfolger aktiv wird."}
        </BottomSheetDescription>
        <RoutineProposalSheetBody
          variant={variant}
          directChanges={directChanges}
          consequentialChanges={consequentialChanges}
          unchangedItemCount={unchangedItemCount}
          submitting={submitting}
          retrying={retrying}
          errorMessage={errorMessage}
          onAccept={onAccept}
          onBackToEditor={onBackToEditor}
          onDiscardCandidate={onDiscardCandidate}
          onDismissForVisit={onDismissForVisit}
          onReject={variant === "initial" ? undefined : onReject}
        />
      </BottomSheetContent>
    </BottomSheet>
  )
}
