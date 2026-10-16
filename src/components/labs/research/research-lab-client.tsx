"use client"

import { useMemo, useRef, useState } from "react"
import {
  RESEARCH_CATEGORIES,
  confidenceLabel,
  researchStatusLabel,
  type ResearchAction,
  type ResearchEvidence,
  type ResearchLabData,
  type ResearchProperty,
} from "@/lib/labs/research/model"

const buttonBase =
  "min-h-9 rounded-lg border px-3 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-default disabled:opacity-45"
const button = `${buttonBase} border-stone-300 bg-white text-stone-800 hover:bg-stone-50`
const primary = `${buttonBase} border-stone-800 bg-stone-800 text-white hover:bg-stone-700`
const muted = "text-xs leading-5 text-stone-500"

function Evidence({ section }: { section: ResearchEvidence }) {
  if (!section.text && !section.items?.length && section.original == null) return null
  return (
    <details className="min-w-0 border-t border-stone-200 py-3">
      <summary className="cursor-pointer text-xs font-medium text-stone-700 focus-visible:outline-2 focus-visible:outline-emerald-700">
        {section.title}
      </summary>
      {section.text && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">{section.text}</p>
      )}
      {section.items?.length ? (
        <ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-5 text-stone-700">
          {section.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : null}
      {section.original != null && (
        <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-stone-50 p-3 text-[11px] leading-5 text-stone-700">
          {typeof section.original === "string"
            ? section.original
            : JSON.stringify(section.original, null, 2)}
        </pre>
      )}
    </details>
  )
}

function LaneComparison({ property }: { property: ResearchProperty }) {
  const available = property.lanes.filter((lane) => lane.value !== null)
  const comparable = available.length > 1 && available.every((lane) => lane.comparable)
  const valueEqual = comparable && available.every((lane) => lane.value === available[0].value)
  const confidenceMissing = available.some((lane) => !lane.confidence)
  const confidenceEqual =
    comparable && available.every((lane) => lane.confidence === available[0].confidence)
  const label = !comparable
    ? available.length > 1
      ? "Verschiedene Vergleichsgrundlagen"
      : "Ein gespeichertes Ergebnis"
    : !valueEqual
      ? "Werte verschieden"
      : confidenceMissing
        ? "Wert gleich · Konfidenz fehlt"
        : confidenceEqual
          ? "Wert und Konfidenz gleich"
          : "Wert gleich · Konfidenz verschieden"
  return (
    <div className="mt-2 text-[11px] leading-5 text-stone-500">
      <p>{label}</p>
      {property.lanes.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer font-medium text-stone-700 focus-visible:outline-2 focus-visible:outline-emerald-700">
            Begründungen vergleichen
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {property.lanes.map((lane) => (
              <section
                key={lane.id}
                className="min-w-0 rounded-lg border border-stone-200 bg-stone-50 p-3"
              >
                <h4 className="font-semibold text-stone-800">
                  {lane.id} · {lane.label}
                </h4>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-stone-700">
                  {lane.reasoning ??
                    lane.unavailableReason ??
                    "Keine separate Begründung gespeichert."}
                </p>
                <p className="mt-2">Konfidenz: {confidenceLabel(lane.confidence)}</p>
                <p className="mt-1 break-words">{lane.provenance}</p>
                {!lane.comparable && lane.value && (
                  <p className="mt-1 text-amber-800">
                    Kein direkter Vergleich mit der aktuellen Referenz.
                  </p>
                )}
                {lane.original != null && (
                  <Evidence
                    section={{ title: `Original aus ${lane.id}`, original: lane.original }}
                  />
                )}
              </section>
            ))}
          </div>
          {property.comparisonNote && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              {property.comparisonNote}
            </p>
          )}
        </details>
      )}
    </div>
  )
}

function PropertyRow({
  property,
  disabled,
  onAction,
  reworkOpen,
  draft,
  onDraft,
  onCancel,
  onReload,
  error,
  busy,
}: {
  property: ResearchProperty
  disabled: boolean
  onAction: (action: ResearchAction) => void
  reworkOpen: boolean
  draft: string
  onDraft: (value: string) => void
  onCancel: () => void
  onReload: () => void
  error: string | null
  busy: boolean
}) {
  return (
    <article aria-label={property.label} className="border-t border-stone-200 px-4 py-5 sm:px-6">
      <div className="grid min-w-0 gap-3 xl:grid-cols-[145px_150px_minmax(0,1fr)_auto]">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">{property.label}</h3>
          <p className={muted}>{researchStatusLabel(property.status)}</p>
        </div>
        <div className="flex flex-wrap items-start gap-2 xl:flex-col">
          {(property.valueLabel !== "Referenz" || !property.lanes.length) && (
            <div className="max-w-full break-words rounded-lg bg-stone-100 px-2.5 py-1.5 text-xs">
              <strong>{property.value}</strong>
              <p className="mt-1 text-[10px] text-stone-500">
                {property.valueLabel} · Konf.: {confidenceLabel(property.confidence)}
              </p>
            </div>
          )}
          {property.lanes.map((lane) => (
            <div key={lane.id} className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs">
              <strong>
                {lane.id}: {lane.value ?? "Nicht verfügbar"}
              </strong>
              <p className="mt-1 text-[10px] text-stone-500">
                Konf.: {confidenceLabel(lane.confidence)}
              </p>
            </div>
          ))}
        </div>
        <div className="min-w-0">
          <p className="whitespace-pre-wrap text-sm leading-6 text-stone-700">
            {property.reasoning ?? "Keine Kurzbegründung gespeichert; Originalbelege prüfen."}
          </p>
          {property.warning && (
            <p className="mt-2 text-xs leading-5 text-amber-800">{property.warning}</p>
          )}
          {property.lanes.length > 0 && <LaneComparison property={property} />}
          {property.annotations.map((annotation, index) => (
            <p key={index} className="mt-2 text-xs leading-5 text-stone-500">
              → {annotation}
            </p>
          ))}
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-stone-600 focus-visible:outline-2 focus-visible:outline-emerald-700">
              Vollständige Belege & Grenzen
            </summary>
            <div className="mt-2">
              {property.evidence.map((section, index) => (
                <Evidence key={index} section={section} />
              ))}
            </div>
          </details>
        </div>
        <div className="flex flex-wrap items-start gap-2 xl:flex-col">
          {property.actions.map((action) => (
            <button
              key={action.id}
              className={button}
              disabled={disabled || !action.enabled}
              onClick={() => onAction(action)}
            >
              {action.kind === "approve" && property.status === "approved"
                ? "Freigegeben"
                : action.label}
            </button>
          ))}
        </div>
      </div>
      {reworkOpen && (
        <form
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4"
          onSubmit={(event) => {
            event.preventDefault()
            const action = property.actions.find((candidate) => candidate.kind === "rework")
            if (action) onAction(action)
          }}
        >
          <label className="block text-xs font-medium text-stone-800">
            Prüfauftrag für {property.label}
            <textarea
              value={draft}
              onChange={(event) => onDraft(event.target.value)}
              required
              maxLength={4000}
              disabled={busy}
              className="mt-2 block min-h-24 w-full rounded-lg border border-stone-300 bg-white p-3 text-sm focus-visible:outline-2 focus-visible:outline-emerald-700"
              placeholder="Was soll erneut geprüft werden?"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="submit" className={primary} disabled={disabled || !draft.trim()}>
              {busy ? "Speichert …" : "Nacharbeit speichern"}
            </button>
            <button type="button" className={button} onClick={onCancel} disabled={busy}>
              Abbrechen
            </button>
          </div>
        </form>
      )}
      {error && (
        <div className="mt-3">
          <p role="alert" className="text-xs text-red-800">
            {error}
          </p>
          <button className={`${button} mt-2`} onClick={onReload}>
            Stand neu laden · Kommentar behalten
          </button>
        </div>
      )}
    </article>
  )
}

export function ResearchLabClient({ initialData }: { initialData: ResearchLabData }) {
  const [data, setData] = useState(initialData)
  const [selectedId, setSelectedId] = useState(initialData.detail.id)
  const [filter, setFilter] = useState("all")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<{ actionId: string; message: string } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [reworkKey, setReworkKey] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<ResearchAction | null>(null)
  const requestSequence = useRef(0)
  const draftKey = (propertyId: string) =>
    `${data.category}:${data.dataset}:${data.detail.id}:${propertyId}`
  const visible = useMemo(
    () =>
      data.queue.filter(
        (item) =>
          (filter === "all" ||
            (filter === "open"
              ? ["open", "pending", "blocked"].includes(item.status)
              : item.status === filter)) &&
          `${item.fullName} ${item.brand} ${item.packSize}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [data.queue, filter, query],
  )

  async function selectItem(id: string) {
    const sequence = ++requestSequence.current
    setSelectedId(id)
    setLoading(true)
    setLoadError(null)
    setSaveError(null)
    setMessage(null)
    setBusyAction(null)
    setConfirmation(null)
    try {
      const response = await fetch(
        `/api/labs/research/queue?${new URLSearchParams({ category: data.category, dataset: data.dataset, itemId: id })}`,
        { cache: "no-store" },
      )
      const payload = await response.json()
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "Laden fehlgeschlagen.")
      if (requestSequence.current === sequence) {
        setData(payload.data)
        setNeedsRefresh(false)
      }
    } catch (error) {
      if (requestSequence.current === sequence)
        setLoadError(error instanceof Error ? error.message : "Laden fehlgeschlagen.")
    } finally {
      if (requestSequence.current === sequence) setLoading(false)
    }
  }

  async function save(action: ResearchAction) {
    const sequence = ++requestSequence.current
    const key = action.propertyId ? draftKey(action.propertyId) : ""
    const comment = drafts[key] ?? ""
    setBusyAction(action.id)
    setSaveError(null)
    setMessage(null)
    setConfirmation(null)
    try {
      const response = await fetch("/api/labs/research/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: data.category,
          dataset: data.dataset,
          itemId: data.detail.id,
          displayFingerprint: data.detail.displayFingerprint,
          actionId: action.id,
          ...(action.kind === "rework" ? { comment } : {}),
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.saved)
        throw new Error(
          [payload.error ?? "Speichern fehlgeschlagen.", ...(payload.blockers ?? [])].join(" "),
        )
      if (requestSequence.current !== sequence) return
      if (payload.data) setData(payload.data)
      setNeedsRefresh(!payload.data)
      setMessage(payload.refreshError ?? "Review gespeichert. Nur lokale Lab-Freigabe.")
      if (action.kind === "rework") {
        setReworkKey(null)
        setDrafts((previous) => {
          if (previous[key] !== comment) return previous
          const next = { ...previous }
          delete next[key]
          return next
        })
      }
    } catch (error) {
      if (requestSequence.current === sequence)
        setSaveError({
          actionId: action.id,
          message: `${error instanceof Error ? error.message : "Speichern fehlgeschlagen."}${action.kind === "rework" ? " Dein Kommentar bleibt erhalten." : ""}`,
        })
    } finally {
      if (requestSequence.current === sequence) setBusyAction(null)
    }
  }

  function act(action: ResearchAction) {
    if (loading || busyAction || loadError || needsRefresh || !action.enabled) return
    if (
      action.kind === "rework" &&
      action.propertyId &&
      reworkKey !== draftKey(action.propertyId)
    ) {
      setReworkKey(draftKey(action.propertyId))
      setSaveError(null)
      return
    }
    if (action.confirmation) {
      setConfirmation(action)
      return
    }
    void save(action)
  }

  const detail = data.detail
  const disabled = loading || Boolean(busyAction) || Boolean(loadError) || needsRefresh
  return (
    <main className="min-h-screen bg-[#f5eee5] text-stone-950">
      <div className="mx-auto max-w-[1480px] p-4 sm:p-7">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">Research Lab</h1>
              <span className="rounded-full border border-stone-300 px-2 py-1 text-[10px] text-stone-600">
                Nur Entwicklung
              </span>
            </div>
            <p className="mt-2 text-xs text-stone-500">
              Gespeicherte Forschung prüfen · Freigaben gelten nur im lokalen Lab.
            </p>
          </div>
          {data.category !== "oil" && (
            <a href={data.legacyHref} className={`${button} inline-flex items-center`}>
              Bisherige {data.categoryLabel}-Ansicht
            </a>
          )}
        </header>
        <nav aria-label="Produktkategorie" className="mb-5 flex flex-wrap gap-2">
          {RESEARCH_CATEGORIES.map((category) => (
            <a
              key={category.id}
              href={`/labs/research?category=${category.id}`}
              aria-current={category.id === data.category ? "page" : undefined}
              className={`${category.id === data.category ? primary : button} inline-flex items-center`}
            >
              {category.label}
            </a>
          ))}
        </nav>
        {data.category === "oil" && (
          <nav aria-label="Öl-Datensatz" className="mb-4 flex flex-wrap gap-2">
            {[
              { id: "default", label: "Forschungsset" },
              { id: "candidate", label: "Neue Forschung" },
              { id: "intake", label: "Intake-Prüfpakete" },
            ].map((dataset) => (
              <a
                key={dataset.id}
                href={`/labs/research?category=oil&dataset=${dataset.id}`}
                aria-current={data.dataset === dataset.id ? "page" : undefined}
                className={data.dataset === dataset.id ? primary : button}
              >
                {dataset.label}
              </a>
            ))}
          </nav>
        )}
        {data.category === "shampoo" && (
          <nav aria-label="Shampoo-Datensatz" className="mb-5 flex flex-wrap gap-2">
            {[
              { id: "pilot", label: "Pilot" },
              { id: "wave-01", label: "Welle 01" },
              { id: "wave-02", label: "Welle 02" },
            ].map((dataset) => (
              <a
                key={dataset.id}
                href={`/labs/research?category=shampoo&dataset=${dataset.id}`}
                aria-current={data.dataset === dataset.id ? "page" : undefined}
                className={data.dataset === dataset.id ? primary : button}
              >
                {dataset.label}
              </a>
            ))}
          </nav>
        )}
        <div className="grid items-start gap-5 lg:grid-cols-[245px_minmax(0,1fr)]">
          <aside aria-label="Prüfwarteschlange" className="min-w-0">
            <div className="mb-3 flex justify-between">
              <h2 className="text-sm font-semibold">{data.categoryLabel}</h2>
              <span className={muted}>{data.queue.length} Produkte</span>
            </div>
            <label className="block text-xs text-stone-600">
              Produkt suchen
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="mb-3 mt-1 min-h-9 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-emerald-700"
                type="search"
              />
            </label>
            <div aria-label="Review-Status filtern" className="mb-3 flex flex-wrap gap-1">
              {[
                { id: "all", label: "Alle" },
                { id: "open", label: "Offen" },
                { id: "rework", label: "Nacharbeit" },
                { id: "approved", label: "Freigegeben" },
                { id: "excluded", label: "G0 bestätigt" },
              ].map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setFilter(entry.id)}
                  aria-pressed={filter === entry.id}
                  className={filter === entry.id ? primary : button}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <div className="grid max-h-[45vh] gap-2 overflow-auto pr-1 lg:max-h-[75vh]">
              {visible.map((item) => (
                <button
                  key={item.id}
                  aria-pressed={selectedId === item.id}
                  title={item.fullName}
                  onClick={() => void selectItem(item.id)}
                  className={`min-w-0 rounded-lg border p-3 text-left focus-visible:outline-2 focus-visible:outline-emerald-700 ${selectedId === item.id ? "border-stone-800 bg-white shadow-[inset_3px_0_0_#292824]" : "border-stone-300 bg-white/60 hover:bg-white"}`}
                >
                  <span className="text-[10px] text-stone-500">
                    {item.brand} · {item.packSize}
                  </span>
                  <strong className="mt-1 block break-words text-sm font-semibold">
                    {item.name}
                  </strong>
                  <span className="mt-1 block text-[11px] text-stone-500">
                    {researchStatusLabel(item.status)}
                    {item.openCount > 0 ? ` · ${item.openCount} offen` : ""}
                  </span>
                  {item.hint && (
                    <span className="mt-1 block text-[11px] text-amber-800">{item.hint}</span>
                  )}
                </button>
              ))}
            </div>
            {!visible.length && (
              <div className="rounded-lg border border-stone-300 bg-white p-4 text-sm">
                <p>Keine Produkte für diese Auswahl.</p>
                <button
                  className={`${button} mt-3`}
                  onClick={() => {
                    setFilter("all")
                    setQuery("")
                  }}
                >
                  Filter zurücksetzen
                </button>
              </div>
            )}
            <p className="mt-4 text-[11px] leading-5 text-stone-500">
              Bondbuilder: noch keine Review-Anbindung. Weitere Kategorien benötigen zuerst passende
              Forschungsartefakte.
            </p>
          </aside>
          <section
            aria-label="Ausgewähltes Produkt"
            aria-busy={loading}
            className="min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-white"
          >
            <header className="px-4 pb-4 pt-6 sm:px-6">
              <p className="text-xs text-stone-500">
                {detail.brand} · {detail.packSize}
              </p>
              <h2 className="mt-1 break-words text-2xl font-semibold tracking-tight">
                {detail.name}
              </h2>
              <p className="mt-2 text-xs text-stone-500">
                {detail.standard} · {detail.valueAuthority}
              </p>
              {detail.notices.map((notice) => (
                <p key={notice} className="mt-2 text-xs leading-5 text-amber-800">
                  {notice}
                </p>
              ))}
            </header>
            <div className="px-4 sm:px-6">
              <Evidence section={detail.evidence[0]} />
            </div>
            {loading && (
              <p role="status" className="mx-4 mb-4 rounded-lg bg-stone-50 p-3 text-sm sm:mx-6">
                Produkt wird geladen …
              </p>
            )}
            {loadError && (
              <div role="alert" className="mx-4 mb-4 rounded-lg bg-red-50 p-3 text-sm sm:mx-6">
                <p>{loadError}</p>
                <button className={`${button} mt-2`} onClick={() => void selectItem(selectedId)}>
                  Erneut laden
                </button>
              </div>
            )}
            <div className="flex flex-wrap justify-between gap-2 border-t border-stone-200 bg-stone-50 px-4 py-3 sm:px-6">
              <h3 className="text-sm font-semibold">Eigenschaften · Referenz & Vergleich</h3>
              <span className={muted}>
                {detail.totalCount - detail.openCount} von {detail.totalCount} freigegeben
              </span>
            </div>
            {!detail.properties.length && (
              <p className="px-6 py-5 text-sm text-stone-600">
                {detail.status === "pending"
                  ? "Der gespeicherte Klassifizierungslauf steht noch aus."
                  : "Für diese Produktform liegt kein freizugebendes Profil vor. Ausschluss in der Produktakte prüfen."}
              </p>
            )}
            {detail.properties.map((property) => (
              <PropertyRow
                key={`${detail.id}:${property.id}`}
                property={property}
                disabled={disabled}
                onAction={act}
                reworkOpen={reworkKey === draftKey(property.id)}
                draft={drafts[draftKey(property.id)] ?? ""}
                onDraft={(value) =>
                  setDrafts((previous) => ({ ...previous, [draftKey(property.id)]: value }))
                }
                onCancel={() => setReworkKey(null)}
                onReload={() => void selectItem(detail.id)}
                error={
                  saveError && property.actions.some((action) => action.id === saveError.actionId)
                    ? saveError.message
                    : null
                }
                busy={Boolean(busyAction)}
              />
            ))}
            <footer className="border-t border-stone-200 bg-stone-50 px-4 py-5 sm:px-6">
              {detail.blockers.length > 0 && (
                <ul className="mb-3 list-disc space-y-1 pl-4 text-xs leading-5 text-amber-900">
                  {detail.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                {detail.actions.map((action) => (
                  <button
                    key={action.id}
                    className={primary}
                    disabled={disabled || !action.enabled}
                    onClick={() => act(action)}
                  >
                    {busyAction === action.id ? "Speichert …" : action.label}
                  </button>
                ))}
              </div>
              {confirmation && (
                <div
                  role="alertdialog"
                  aria-label="Freigabe bestätigen"
                  className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm"
                >
                  <p>{confirmation.confirmation}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button autoFocus className={primary} onClick={() => void save(confirmation)}>
                      Freigabe bestätigen
                    </button>
                    <button className={button} onClick={() => setConfirmation(null)}>
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
              {saveError && detail.actions.some((action) => action.id === saveError.actionId) && (
                <div className="mt-3">
                  <p role="alert" className="text-xs text-red-800">
                    {saveError.message}
                  </p>
                  <button className={`${button} mt-2`} onClick={() => void selectItem(detail.id)}>
                    Stand neu laden
                  </button>
                </div>
              )}
              {message && (
                <div role="status" className="mt-3 text-xs leading-5 text-emerald-900">
                  <p>{message}</p>
                  <button className={`${button} mt-2`} onClick={() => void selectItem(detail.id)}>
                    Stand neu laden
                  </button>
                </div>
              )}
              <p className="mt-3 text-[11px] text-stone-500">
                Die Freigabe aktiviert kein Produkt im Katalog.
              </p>
              {detail.lastDecision && (
                <p className="mt-2 break-words text-[11px] text-stone-500">
                  Zuletzt gespeichert: {detail.lastDecision}
                </p>
              )}
            </footer>
            <div className="px-4 py-3 sm:px-6">
              {detail.evidence.slice(1).map((section, index) => (
                <Evidence key={index} section={section} />
              ))}
              {data.evidence.map((section, index) => (
                <Evidence key={`cohort-${index}`} section={section} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
