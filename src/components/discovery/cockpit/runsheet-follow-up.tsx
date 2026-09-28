"use client"

import { useState } from "react"

import type {
  DiscoveryCallSheetPatch,
  DiscoveryCallSheetTouchpoint,
  DiscoveryCallSheetTouchpointKind,
} from "@/lib/discovery/call-sheet"

import { RunsheetCard, RunsheetChip, RunsheetEyebrow, RunsheetPhase } from "./runsheet-parts"
import { RunsheetSaveBar, useRunsheetSave } from "./runsheet-save"

/**
 * Phase 5 „Feedback & nächste Schritte" (consult-runsheet T3): her feedback on the call and
 * the agreed touchpoints — the `discovery_call_sheets.feedback` / `.touchpoints` contracts.
 *
 * Saving (T5): its own „Speichern" sends only these two columns. Re-sync after a refresh as
 * the brief (`runsheet-brief.tsx`): new server props re-seed the phase only while it holds
 * no unsaved edits.
 */

const TITLE = "Feedback & nächste Schritte"
const FEEDBACK_LABEL = "Ihr Feedback zum Call"
const FEEDBACK_PLACEHOLDER = "Was war hilfreich? Was hat gefehlt?"
const TOUCHPOINTS_TITLE = "Vereinbarte Touchpoints"
const TOUCHPOINTS_EMPTY = "Noch keine Touchpoints vereinbart."
const TOUCHPOINT_REMOVE = "entfernen"
const RESCORE_NOTE = "Beim Re-Score wieder 1–10 abfragen."

export const RUNSHEET_TOUCHPOINT_LABEL: Record<DiscoveryCallSheetTouchpointKind, string> = {
  text_checkin: "Kurz-Check",
  rescore_call: "Re-Score-Call",
}

const PRESETS: Array<{ kind: DiscoveryCallSheetTouchpointKind; weeks: number; label: string }> = [
  { kind: "text_checkin", weeks: 2, label: "Kurz-Check +2 Wochen" },
  { kind: "rescore_call", weeks: 4, label: "Re-Score-Call +4 Wochen" },
]

/** Today (local calendar day) plus `weeks`, as `YYYY-MM-DD`. */
export function runsheetDueOn(today: Date, weeks: number): string {
  const due = new Date(today.getFullYear(), today.getMonth(), today.getDate() + weeks * 7)
  const month = String(due.getMonth() + 1).padStart(2, "0")
  const day = String(due.getDate()).padStart(2, "0")
  return `${due.getFullYear()}-${month}-${day}`
}

/** `2026-10-11` → „11.10.2026" (from the string itself — no time-zone conversion). */
export function formatRunsheetDueOn(value: string): string {
  const [year, month, day] = value.split("-")
  return `${day}.${month}.${year}`
}

const SAVE_SCOPE = "Feedback und Touchpoints"

/** The save payload: an empty feedback is stored as none. */
export function runsheetFollowUpPatch(state: {
  feedback: string
  touchpoints: DiscoveryCallSheetTouchpoint[]
}): DiscoveryCallSheetPatch {
  return {
    feedback: state.feedback.trim() === "" ? null : state.feedback,
    touchpoints: state.touchpoints,
  }
}

export function DiscoveryRunsheetFollowUp({
  enrollmentId,
  initialFeedback,
  initialTouchpoints,
  saveLocked = false,
}: {
  enrollmentId: string
  initialFeedback: string | null
  initialTouchpoints: DiscoveryCallSheetTouchpoint[]
  /** The row could not be read: an empty form must not overwrite it. */
  saveLocked?: boolean
}) {
  const [feedback, setFeedback] = useState(initialFeedback ?? "")
  const [touchpoints, setTouchpoints] = useState(initialTouchpoints)
  const currentKey = JSON.stringify(runsheetFollowUpPatch({ feedback, touchpoints }))
  const propsKey = JSON.stringify(
    runsheetFollowUpPatch({ feedback: initialFeedback ?? "", touchpoints: initialTouchpoints }),
  )
  const [savedKey, setSavedKey] = useState(propsKey)
  const [syncedProps, setSyncedProps] = useState(propsKey)
  const dirty = currentKey !== savedKey
  if (propsKey !== syncedProps) {
    setSyncedProps(propsKey)
    if (!dirty) {
      if (propsKey !== currentKey) {
        setFeedback(initialFeedback ?? "")
        setTouchpoints(initialTouchpoints)
      }
      setSavedKey(propsKey)
    }
  }
  const { status, message, save } = useRunsheetSave(enrollmentId)

  function handleSave() {
    const sentKey = currentKey
    // Edits typed while the request ran stay „nicht gespeichert“.
    void save(runsheetFollowUpPatch({ feedback, touchpoints }), () => setSavedKey(sentKey))
  }

  return (
    <RunsheetPhase number={5} title={TITLE} id="runsheet-phase-5">
      <RunsheetCard>
        <label htmlFor="runsheet-feedback" className="text-[13px] font-bold text-foreground">
          {FEEDBACK_LABEL}
        </label>
        <textarea
          id="runsheet-feedback"
          rows={4}
          value={feedback}
          placeholder={FEEDBACK_PLACEHOLDER}
          onChange={(event) => setFeedback(event.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm leading-6 text-foreground"
        />
        <RunsheetEyebrow>{TOUCHPOINTS_TITLE}</RunsheetEyebrow>
        {touchpoints.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">{TOUCHPOINTS_EMPTY}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {touchpoints.map((touchpoint, index) => (
              <li
                key={`${touchpoint.kind}:${touchpoint.due_on}:${index}`}
                className="flex items-center gap-1"
              >
                <RunsheetChip tone="plum">
                  {`${formatRunsheetDueOn(touchpoint.due_on)} · ${RUNSHEET_TOUCHPOINT_LABEL[touchpoint.kind]}`}
                </RunsheetChip>
                <button
                  type="button"
                  aria-label={`${RUNSHEET_TOUCHPOINT_LABEL[touchpoint.kind]} ${TOUCHPOINT_REMOVE}`}
                  onClick={() =>
                    setTouchpoints((current) => current.filter((_, at) => at !== index))
                  }
                  className="text-[11px] text-muted-foreground underline"
                >
                  {TOUCHPOINT_REMOVE}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.kind}
              id={`runsheet-touchpoint-${preset.kind}`}
              type="button"
              onClick={() =>
                setTouchpoints((current) => [
                  ...current,
                  {
                    kind: preset.kind,
                    due_on: runsheetDueOn(new Date(), preset.weeks),
                    done_at: null,
                  },
                ])
              }
              className="rounded-lg border border-[var(--brand-plum)] px-3 py-1.5 text-xs font-bold text-[var(--brand-plum)]"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-muted-foreground">{RESCORE_NOTE}</p>
        <RunsheetSaveBar
          id="runsheet-follow-up-save"
          scope={SAVE_SCOPE}
          dirty={dirty}
          status={status}
          message={message}
          locked={saveLocked}
          onSave={handleSave}
        />
      </RunsheetCard>
    </RunsheetPhase>
  )
}
