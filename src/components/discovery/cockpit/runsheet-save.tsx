"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import type { DiscoveryCallSheetPatch } from "@/lib/discovery/call-sheet"

/**
 * Saving the runsheet's own row (consult-runsheet T5): one explicit „Speichern" per client
 * island — the brief (score, Diagnose, Hebel, Gewohnheiten) and Phase 5 (Feedback,
 * Touchpoints). Each sends only its own columns to `PATCH …/call-sheet`, so the two never
 * overwrite each other.
 *
 * Explicit instead of the decisions' write-per-click: these are free-text fields typed
 * during the call; a write per keystroke (or a debounce racing the refresh) would be the
 * wrong shape. The button is live only while something differs from the saved state.
 */

export const RUNSHEET_SAVE_COPY = {
  save: "Speichern",
  saving: "Speichert …",
  saved: "Gespeichert.",
  dirty: "Nicht gespeicherte Änderungen.",
  failed: "Nicht gespeichert. Bitte noch einmal.",
  invalid: "Nicht gespeichert — eine Eingabe hat ein ungültiges Format.",
  notFound: "Nicht gespeichert — diese Anmeldung gibt es nicht mehr.",
  locked: "Call-Sheet nicht geladen — Seite neu laden, dann speichern.",
} as const

/** The German line for a finished save; `null` = stored. */
export function discoveryCallSheetWriteOutcome(
  ok: boolean,
  body: { code?: string; callSheet?: unknown } | null,
): { error: string | null } {
  if (ok && body?.callSheet) return { error: null }
  if (body?.code === "invalid_body") return { error: RUNSHEET_SAVE_COPY.invalid }
  if (body?.code === "not_found") return { error: RUNSHEET_SAVE_COPY.notFound }
  return { error: RUNSHEET_SAVE_COPY.failed }
}

export type RunsheetSaveStatus = "idle" | "saving" | "saved" | "error"

/**
 * The PATCH plus its status. On success the page refreshes, so the server-derived parts
 * (e.g. the „Vor dem Call" score line) catch up; the island itself decides whether the
 * refreshed props may re-seed it (only when it holds no unsaved edits).
 */
export function useRunsheetSave(enrollmentId: string) {
  const router = useRouter()
  const [status, setStatus] = useState<RunsheetSaveStatus>("idle")
  const [message, setMessage] = useState<string | null>(null)

  function fail(text: string) {
    setStatus("error")
    setMessage(text)
  }

  /** `onSaved` runs before the refresh, so the island knows its saved state first. */
  async function save(patch: DiscoveryCallSheetPatch, onSaved: () => void): Promise<void> {
    setStatus("saving")
    setMessage(null)
    try {
      const response = await fetch(`/api/admin/beratung/${enrollmentId}/call-sheet`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const body = (await response.json().catch(() => null)) as {
        code?: string
        callSheet?: unknown
      } | null
      const outcome = discoveryCallSheetWriteOutcome(response.ok, body)
      if (outcome.error) {
        fail(outcome.error)
        return
      }
      setStatus("saved")
      onSaved()
      router.refresh()
    } catch {
      fail(RUNSHEET_SAVE_COPY.failed)
    }
  }

  return { status, message, save, fail }
}

export function RunsheetSaveBar({
  id,
  scope,
  dirty,
  status,
  message,
  locked,
  pausedHint = null,
  onSave,
}: {
  id: string
  /** What the button saves, e.g. „Score, Diagnose, Hebel und Gewohnheiten". */
  scope: string
  dirty: boolean
  status: RunsheetSaveStatus
  message: string | null
  /** The row could not be read: saving would overwrite it with the empty form. */
  locked: boolean
  /** Saving is paused (e.g. a brief generation is in flight); the line says why. */
  pausedHint?: string | null
  onSave: () => void
}) {
  const saving = status === "saving"
  const line = locked
    ? RUNSHEET_SAVE_COPY.locked
    : pausedHint
      ? pausedHint
      : status === "error"
        ? message
        : dirty
          ? RUNSHEET_SAVE_COPY.dirty
          : status === "saved"
            ? RUNSHEET_SAVE_COPY.saved
            : null
  const tone =
    locked || status === "error"
      ? "text-[var(--status-danger-text)]"
      : dirty
        ? "text-[var(--status-pending-text)]"
        : "text-muted-foreground"
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        id={id}
        type="button"
        disabled={locked || pausedHint !== null || saving || !dirty}
        onClick={onSave}
        className="rounded-lg bg-[var(--brand-plum)] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
      >
        {saving ? RUNSHEET_SAVE_COPY.saving : RUNSHEET_SAVE_COPY.save}
      </button>
      <span className="text-[12px] text-muted-foreground">{scope}</span>
      {line ? (
        <span role="status" className={`text-[12px] font-bold ${tone}`}>
          {line}
        </span>
      ) : null}
    </div>
  )
}
