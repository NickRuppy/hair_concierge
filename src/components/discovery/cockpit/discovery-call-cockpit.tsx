"use client"

import { useState } from "react"

import { DISCOVERY_INTAKE_CATEGORY_COPY } from "@/components/discovery/intake/categories"
import { ScanVerdictSections } from "@/components/scan/scan-verdict-sections"
import type { DiscoveryCockpitStepView } from "@/lib/discovery/cockpit"
import type { DiscoveryVerdictStatus } from "@/lib/discovery/load-participant-verdicts"

import { formatDiscoveryTimestamp } from "./format"

/**
 * The call surface: one block per routine step, the engine's verdict on the left, the
 * single interaction on the right — keep what the participant owns, or swap it for one of
 * the products the engine already put in front of them.
 *
 * Voice: this screen is Nick's, not the participant's, so its own copy is third person
 * („Ihr Produkt"). The verdict block underneath is the participant's own scan result,
 * rendered by the SAME component their scanner uses (`ScanVerdictSections`) — its second
 * person is the engine's wording, and re-writing it here would mean the cockpit and the
 * participant's app could say different things about the same product.
 *
 * Every write goes to `/api/admin/beratung/<id>/decisions`, which re-composes the routine
 * server-side and refuses anything the cockpit did not display. The optimistic selection
 * here is a convenience; the server is the authority, and a refusal rolls it back.
 */

const COL_PRODUCT = "Ihr Produkt"
const COL_DECISION = "Entscheidung"
const KEEP_LABEL = "Behalten"
const KEEP_EMPTY_LABEL = "Ohne Produkt weiter"
const KEEP_EMPTY_HINT = "Schritt bleibt offen."
const SWAP_PREFIX = "Tauschen zu "
const NEW_PREFIX = "Neu: "
const GAP_TITLE = "Lücke in der Idealroutine"
const GAP_BODY = "Sie benutzt für diesen Schritt aktuell nichts."
const NO_PRODUCT = "Kein Produkt angegeben"
const UNDECIDED_HINT = "Noch nicht entschieden."
const FROZEN_HINT =
  "Diese Beratung ist inzwischen finalisiert. Seite neu laden, dann die Finalisierung aufheben."
const WRITE_ERROR = "Nicht gespeichert. Bitte noch einmal."
const NO_OPTIONS_HINT = "Keine Alternative im Katalog. Nur behalten oder offen lassen."

const FINALIZE_LABEL = "Finalisieren"
const UNFINALIZE_LABEL = "Finalisierung aufheben"
const FINALIZE_HINT =
  "Entscheidungen bleiben bis dahin änderbar. Das PDF entsteht erst aus dem finalisierten Stand."
const FINALIZE_OPEN = "noch nicht finalisiert"
const FINALIZE_BUSY = "Wird gespeichert"
const PDF_LOCKED = "PDF: gesperrt"
const PDF_OPEN = "PDF öffnen"
const NOT_SUBMITTED_HINT = "Die Checkliste ist noch nicht abgeschickt."

/** Why a bound product carries no verdict — internal, factual, no medical claim. */
const VERDICT_FAILURE_COPY: Record<Exclude<DiscoveryVerdictStatus, "verdict">, string> = {
  product_unavailable: "Produkt ist nicht mehr im Katalog.",
  quarantined: "Produkt ist im Katalog gesperrt.",
  target_mismatch: "Der Katalog führt das Produkt in einer anderen Kategorie.",
  decision_missing: "Der Plan hat für diese Kategorie keinen Eintrag.",
  unavailable: "Bewertung gerade nicht verfügbar.",
}

type Selection = { decision: "keep" | "swap"; swapProductId: string | null } | null

function initialSelection(step: DiscoveryCockpitStepView): Selection {
  if (step.outcome === "kept") return { decision: "keep", swapProductId: null }
  if (step.outcome === "swapped") return { decision: "swap", swapProductId: step.swapProductId }
  return null
}

function selectionValue(selection: Selection): string {
  if (!selection) return ""
  return selection.decision === "keep" ? "keep" : (selection.swapProductId ?? "")
}

export function DiscoveryCallCockpit({
  enrollmentId,
  steps,
  submitted,
  initialFinalizedAt,
}: {
  enrollmentId: string
  steps: DiscoveryCockpitStepView[]
  submitted: boolean
  initialFinalizedAt: string | null
}) {
  const [selections, setSelections] = useState<Record<string, Selection>>(() =>
    Object.fromEntries(steps.map((step) => [step.decisionKey, initialSelection(step)])),
  )
  const [finalizedAt, setFinalizedAt] = useState<string | null>(initialFinalizedAt)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [finalizePending, setFinalizePending] = useState(false)

  const frozen = finalizedAt !== null

  async function choose(step: DiscoveryCockpitStepView, value: string) {
    const previous = selections[step.decisionKey] ?? null
    const next: Selection =
      value === "keep"
        ? { decision: "keep", swapProductId: null }
        : { decision: "swap", swapProductId: value }
    setSelections((current) => ({ ...current, [step.decisionKey]: next }))
    setPending(step.decisionKey)
    setError(null)
    try {
      const response = await fetch(`/api/admin/beratung/${enrollmentId}/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decisionKey: step.decisionKey,
          decision: next.decision,
          swapProductId: next.swapProductId,
        }),
      })
      if (!response.ok) {
        setSelections((current) => ({ ...current, [step.decisionKey]: previous }))
        const body = (await response.json().catch(() => null)) as { code?: string } | null
        if (body?.code === "finalized") {
          // Someone (or another tab) finalised in the meantime. The stored timestamp is
          // not ours to invent, so the screen says what happened instead of faking it.
          setError(FROZEN_HINT)
        } else {
          setError(WRITE_ERROR)
        }
      }
    } catch {
      setSelections((current) => ({ ...current, [step.decisionKey]: previous }))
      setError(WRITE_ERROR)
    } finally {
      setPending(null)
    }
  }

  async function toggleFinalize() {
    setFinalizePending(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/beratung/${enrollmentId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalized: !frozen }),
      })
      const body = (await response.json().catch(() => null)) as {
        callFinalizedAt?: string | null
        code?: string
      } | null
      if (!response.ok) {
        setError(body?.code === "not_submitted" ? NOT_SUBMITTED_HINT : WRITE_ERROR)
        return
      }
      setFinalizedAt(body?.callFinalizedAt ?? null)
    } catch {
      setError(WRITE_ERROR)
    } finally {
      setFinalizePending(false)
    }
  }

  return (
    <>
      <section className="rounded-xl border bg-card">
        <h2 className="border-b px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Produkte &amp; Entscheidung
        </h2>
        {steps.map((step, index) => (
          <div key={step.decisionKey} className="border-b last:border-0">
            <div className="flex items-baseline gap-3 border-b bg-muted/40 px-4 py-2.5">
              <span className="text-xs text-muted-foreground">{index + 1}</span>
              <span className="text-[15px] font-bold text-foreground">{step.categoryLabel}</span>
              <span className="text-xs text-muted-foreground">{step.roleLabel}</span>
              {step.section === "optional" ? (
                <span className="text-xs text-muted-foreground">· optional</span>
              ) : null}
            </div>
            <div className="grid gap-0 md:grid-cols-2">
              <div className="border-b p-4 md:border-b-0 md:border-r">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  {COL_PRODUCT}
                </p>
                <StepVerdict step={step} />
              </div>
              <div className="p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  {COL_DECISION}
                </p>
                <StepDecision
                  step={step}
                  value={selectionValue(selections[step.decisionKey] ?? null)}
                  disabled={frozen || pending === step.decisionKey}
                  onChoose={(value) => void choose(step, value)}
                />
              </div>
            </div>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4">
        <button
          type="button"
          onClick={() => void toggleFinalize()}
          disabled={finalizePending || (!frozen && !submitted)}
          className="rounded-lg bg-[var(--brand-coral)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {finalizePending ? FINALIZE_BUSY : frozen ? UNFINALIZE_LABEL : FINALIZE_LABEL}
        </button>
        <p className="text-[13px] leading-5 text-muted-foreground">{FINALIZE_HINT}</p>
        {frozen ? (
          // The document exists only for a finalised call, so the link exists only then too —
          // in a new tab, so the cockpit stays where it is while Nick prints.
          <a
            href={`/admin/beratung/${enrollmentId}/pdf`}
            target="_blank"
            rel="noopener"
            className="text-xs font-bold text-[var(--brand-plum)] underline"
          >
            {PDF_OPEN}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">{PDF_LOCKED}</span>
        )}
        <span className="ml-auto rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
          {frozen ? `finalisiert am ${formatDiscoveryTimestamp(finalizedAt)}` : FINALIZE_OPEN}
        </span>
      </div>

      {error ? (
        <p role="status" className="text-[13px] text-[var(--status-danger-text)]">
          {error}
        </p>
      ) : null}
      {!submitted ? (
        <p className="text-[13px] text-muted-foreground">{NOT_SUBMITTED_HINT}</p>
      ) : null}
    </>
  )
}

function StepVerdict({ step }: { step: DiscoveryCockpitStepView }) {
  if (step.verdict?.status === "verdict") {
    // The scan header's label is the scan feature's own; the call names the category the
    // way the participant's checklist did („Kopfhautpflege", not „Kopfhautprodukt").
    const product = {
      ...step.verdict.product,
      categoryLabel: DISCOVERY_INTAKE_CATEGORY_COPY[step.verdict.product.category].label,
    }
    return (
      <div className="flex flex-col gap-4">
        <ScanVerdictSections result={{ ...step.verdict.payload, product }} />
      </div>
    )
  }
  if (step.verdict) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[15px] font-semibold text-foreground">{step.ownedLabel}</p>
        <p className="rounded-[14px] bg-muted px-3 py-2 text-[13px] text-muted-foreground">
          {VERDICT_FAILURE_COPY[step.verdict.status]}
        </p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[15px] font-semibold text-muted-foreground">{NO_PRODUCT}</p>
      <div className="rounded-[14px] bg-muted px-3 py-2">
        <p className="text-[13px] font-bold text-foreground">{GAP_TITLE}</p>
        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{GAP_BODY}</p>
      </div>
      <p className="text-[12px] text-muted-foreground">{step.frequencyLabel}</p>
    </div>
  )
}

function StepDecision({
  step,
  value,
  disabled,
  onChoose,
}: {
  step: DiscoveryCockpitStepView
  value: string
  disabled: boolean
  onChoose: (value: string) => void
}) {
  const empty = step.intakeItemId === null
  return (
    <div className="flex flex-col gap-2">
      <Choice
        name={step.decisionKey}
        value="keep"
        checked={value === "keep"}
        disabled={disabled}
        title={empty ? KEEP_EMPTY_LABEL : KEEP_LABEL}
        subtitle={empty ? KEEP_EMPTY_HINT : step.ownedLabel}
        onChoose={onChoose}
      />
      {step.swapOptions.map((option) => (
        <Choice
          key={option.productId}
          name={step.decisionKey}
          value={option.productId}
          checked={value === option.productId}
          disabled={disabled}
          title={`${empty ? NEW_PREFIX : SWAP_PREFIX}${option.name}`}
          subtitle={option.brand}
          pill={option.verdictLabel}
          onChoose={onChoose}
        />
      ))}
      {step.swapOptions.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">{NO_OPTIONS_HINT}</p>
      ) : null}
      {value === "" ? <p className="text-[12px] text-muted-foreground">{UNDECIDED_HINT}</p> : null}
    </div>
  )
}

function Choice({
  name,
  value,
  checked,
  disabled,
  title,
  subtitle,
  pill,
  onChoose,
}: {
  name: string
  value: string
  checked: boolean
  disabled: boolean
  title: string
  subtitle?: string | null
  pill?: string
  onChoose: (value: string) => void
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
        checked ? "border-[var(--brand-plum)] bg-[var(--brand-plum-ice)]" : "border-border bg-card"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <input
        type="radio"
        name={`decision-${name}`}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChoose(value)}
        className="mt-1 accent-[var(--brand-plum)]"
      />
      <span className="min-w-0">
        <span className="text-sm font-semibold text-foreground">
          {title}
          {pill ? (
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
              {pill}
            </span>
          ) : null}
        </span>
        {subtitle ? (
          <span className="mt-0.5 block text-[12px] leading-5 text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
      </span>
    </label>
  )
}
