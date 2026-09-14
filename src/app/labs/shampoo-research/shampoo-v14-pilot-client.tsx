"use client"

import { AlertTriangle, Check, ChevronRight, RefreshCw } from "lucide-react"
import { useMemo, useState } from "react"

import type {
  ShampooV14PilotPropertyKey,
  ShampooV14PilotReviewItem,
  ShampooV14ReviewAction,
  ShampooV14ReviewDatasetId,
} from "@/lib/labs/shampoo-v14-pilot-review"

type ReviewScope = "formula" | "projection" | ShampooV14PilotPropertyKey
type ReviewStatus = "pending" | "approved" | "rework_requested"
type ReadyReviewItem = ShampooV14PilotReviewItem & {
  integrity: ShampooV14PilotReviewItem["integrity"] & { status: "ready" }
  formula: NonNullable<ShampooV14PilotReviewItem["formula"]>
  projection: NonNullable<ShampooV14PilotReviewItem["projection"]>
}

const PROPERTY_LABELS: Record<ShampooV14PilotPropertyKey, string> = {
  cleansingStrength: "Reinigungsstärke",
  conditioningLevel: "Konditionierungsniveau",
  weightPotential: "Beschwerungspotenzial",
  focusPrimary: "Primärer Fokus",
  focusSecondary: "Sekundärer Fokus",
  usageRole: "Nutzungsrolle",
  scalpComfortTarget: "Kopfhaut-Komfortziel",
  dandruffSupport: "Anti-Schuppen-Unterstützung",
}

const VALUE_LABELS: Record<string, string> = {
  low: "niedrig",
  moderate: "mittel",
  high: "hoch",
  strong: "stark",
  gentle: "sanft",
  general: "allgemein",
  volume: "Volumen",
  shine: "Glanz",
  repair: "Reparatur",
  moisture: "Feuchtigkeit",
  clarifying: "Tiefenreinigung",
  scalp_active: "Kopfhaut-Ziel",
  repair_supported: "Reparatur unterstützt",
  moisture_supported: "Feuchtigkeit unterstützt",
  dual_supported: "beide Richtungen unterstützt",
  nonspecific: "nicht richtungsspezifisch",
  not_applicable: "nicht anwendbar",
  candidate: "Kandidat",
  tie_breaker: "Entscheidungshilfe",
  corroborating: "bestätigend",
  not_applicable_claim: "nicht anwendbar",
  frequent: "häufig",
  regular: "regelmäßig",
  treatment: "Behandlung",
  targeted: "gezielt",
  not_targeted: "nicht gezielt",
  supported: "unterstützt",
  not_supported: "nicht unterstützt",
  fine: "fein",
  normal: "normal",
  coarse: "kräftig",
  shampoo_everyday: "Alltagsshampoo",
  shampoo_dandruff: "Anti-Schuppen-Shampoo",
  balanced: "balanced",
  dandruff: "dandruff",
  oily: "oily",
  irritated: "irritated",
  schuppen: "schuppen",
  "dehydriert-fettig": "dehydriert-fettig",
  irritationen: "irritationen",
}

const STATUS_LABELS: Record<ReviewStatus | "blocked" | "product_approved", string> = {
  pending: "Review offen",
  approved: "Freigegeben",
  rework_requested: "Rework angefordert",
  blocked: "Blockiert",
  product_approved: "Pilotprodukt freigegeben",
}

const PRODUCT_STATUS_LABELS: typeof STATUS_LABELS = {
  ...STATUS_LABELS,
  approved: "Bereit zur Gesamtfreigabe",
}

const OUTCOME_LABELS: Record<string, string> = {
  agreement: "Lane A/B identisch",
  product_correction: "Aufgelöste Produktkorrektur",
  policy_update: "Fokus-Policy aktualisiert",
  policy_confirmed: "Fokus-Policy bestätigt",
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function text(value: unknown, fallback = "Nicht angegeben") {
  if (value === null || value === undefined || value === "") return fallback
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}

function rawValueLabel(value: unknown, key?: ShampooV14PilotPropertyKey): string {
  if (Array.isArray(value)) {
    if (value.length === 0 && key === "focusSecondary") return "Kein sekundärer Fokus"
    if (value.length === 0) return "[]"
    return value.map((entry) => rawValueLabel(entry)).join(", ")
  }
  if (typeof value !== "string") return text(value)
  const label = VALUE_LABELS[value]
  return label && label !== value ? `${label} (${value})` : value
}

function compactStatusClass(status: ReviewStatus | "blocked" | "product_approved") {
  if (status === "approved" || status === "product_approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800"
  }
  if (status === "rework_requested") return "border-amber-300 bg-amber-50 text-amber-900"
  if (status === "blocked") return "border-red-200 bg-red-50 text-red-800"
  return "border-stone-300 bg-stone-50 text-stone-800"
}

function isReadyItem(item: ShampooV14PilotReviewItem): item is ReadyReviewItem {
  return item.integrity.status === "ready" && Boolean(item.formula) && Boolean(item.projection)
}

function canApproveProduct(item: ShampooV14PilotReviewItem) {
  return (
    item.integrity.status === "ready" &&
    item.review.formula.status === "approved" &&
    item.review.projection.status === "approved" &&
    item.properties.every((property) => item.review.properties[property.key]?.status === "approved")
  )
}

function reworkScopes(item: ShampooV14PilotReviewItem) {
  const scopes: Array<{ scope: string; comment?: string }> = []
  if (item.review.formula.status === "rework_requested") {
    scopes.push({ scope: "Formel", comment: item.review.formula.comment })
  }
  for (const property of item.properties) {
    const state = item.review.properties[property.key]
    if (state?.status === "rework_requested") {
      scopes.push({ scope: PROPERTY_LABELS[property.key], comment: state.comment })
    }
  }
  if (item.review.projection.status === "rework_requested") {
    scopes.push({ scope: "Production Light", comment: item.review.projection.comment })
  }
  return scopes
}

function productStatus(
  item: ShampooV14PilotReviewItem,
): ReviewStatus | "blocked" | "product_approved" {
  if (item.integrity.status === "blocked") return "blocked"
  if (item.review.product.status === "approved") return "product_approved"
  if (reworkScopes(item).length > 0) return "rework_requested"
  if (canApproveProduct(item)) return "approved"
  return "pending"
}

function nextAction(item: ShampooV14PilotReviewItem) {
  if (item.integrity.status === "blocked") return "Artefakt reparieren"
  if (item.review.product.status === "approved") return "Freigabe ansehen"
  const rework = reworkScopes(item)[0]
  if (rework) return `${rework.scope} nach Rework erneut prüfen`
  if (item.review.formula.status !== "approved") return "Formelpaket prüfen"
  const openProperty = item.properties.find(
    (property) => item.review.properties[property.key]?.status !== "approved",
  )
  if (openProperty) return `${PROPERTY_LABELS[openProperty.key]} prüfen`
  if (item.review.projection.status !== "approved") return "Production Light prüfen"
  return "Gesamtfreigabe möglich"
}

function identity(item: ShampooV14PilotReviewItem) {
  return asRecord(item.formula?.identity)
}

function productName(item: ShampooV14PilotReviewItem) {
  const sourceIdentity = identity(item)
  return text(
    sourceIdentity.exact_current_de_name ?? asRecord(item.projection?.outcome?.summary).productName,
    item.id,
  )
}

function brandName(item: ShampooV14PilotReviewItem) {
  return text(identity(item).brand, "Marke offen")
}

function sourceLabel(source: unknown) {
  const record = asRecord(source)
  return text(record.label ?? record.id ?? record.url, "Quelle")
}

function sourceFacts(source: unknown) {
  const record = asRecord(source)
  return Array.isArray(record.facts)
    ? record.facts.map((fact) => text(fact)).join(", ")
    : "Fakten offen"
}

function sourceUrl(source: unknown) {
  const record = asRecord(source)
  return typeof record.url === "string" ? record.url : null
}

function correctionCount(item: ShampooV14PilotReviewItem) {
  return item.properties.filter(
    (property) =>
      (property.historicalAdjudication ?? property.adjudication).outcome === "product_correction",
  ).length
}

function SourceEvidenceList({ title, values }: { title: string; values: unknown[] }) {
  if (values.length === 0) return null
  return (
    <section>
      <h4 className="text-xs font-semibold uppercase text-stone-500">{title}</h4>
      <div className="mt-2 space-y-2">
        {values.map((value, index) => {
          const record = asRecord(value)
          const url = typeof record.source_url === "string" ? record.source_url : null
          const evidenceText =
            record.source_text ?? record.text ?? record.description ?? record.question ?? value
          const sourceLabel = record.source_type ?? record.source_id
          return (
            <article
              key={`${text(record.id ?? title)}-${index}`}
              className="rounded-md border border-stone-200 bg-stone-50 p-3"
            >
              <p className="text-sm leading-6 text-stone-800">{text(evidenceText)}</p>
              <p className="mt-2 text-xs text-stone-500">
                {text(sourceLabel, "Quelle")} · {text(record.captured_at, "Zeitpunkt offen")}
              </p>
              {url ? (
                <a
                  className="mt-1 block break-all text-xs text-stone-600 underline"
                  href={url}
                  rel="noreferrer"
                  target="_blank"
                >
                  Quelle öffnen
                </a>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function StatusPill({
  status,
  label,
}: {
  status: ReviewStatus | "blocked" | "product_approved"
  label?: string
}) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${compactStatusClass(status)}`}
    >
      {label ?? STATUS_LABELS[status]}
    </span>
  )
}

function QueueCard({
  item,
  selected,
  onSelect,
}: {
  item: ShampooV14PilotReviewItem
  selected: boolean
  onSelect: () => void
}) {
  const status = productStatus(item)
  return (
    <article
      className={`min-w-[280px] rounded-md border bg-white p-4 lg:min-w-0 ${selected ? "border-stone-950 ring-1 ring-stone-950" : "border-stone-200"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-stone-950">{productName(item)}</h3>
          <p className="mt-1 text-sm text-stone-600">
            {brandName(item)} · GTIN {text(identity(item).gtin, "offen")}
          </p>
        </div>
        <StatusPill status={status} label={PRODUCT_STATUS_LABELS[status]} />
      </div>
      <p className="mt-3 text-sm leading-6 text-stone-700">{nextAction(item)}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="font-semibold text-stone-950">Formel</dt>
          <dd className="break-all text-stone-700">
            {item.integrity.status === "ready" ? "prüfbar" : "blockiert"}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-stone-950">Korrekturen</dt>
          <dd className="text-stone-700">{correctionCount(item)} aufgelöste Produktkorrektur</dd>
        </div>
      </dl>
      {item.integrity.status === "blocked" ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {item.integrity.diagnostic}
        </p>
      ) : null}
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="mt-4 inline-flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold"
      >
        {status === "blocked" ? "Blocker ansehen" : "Produkt prüfen"}
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </article>
  )
}

function ReviewButtons({
  status,
  pending,
  approveLabel,
  reworkLabel,
  onApprove,
  onRework,
}: {
  status: ReviewStatus
  pending: boolean
  approveLabel: string
  reworkLabel: string
  onApprove: () => void
  onRework: () => void
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending || status === "approved"}
        onClick={onApprove}
        className="inline-flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold disabled:opacity-45"
      >
        <Check className="size-4" aria-hidden="true" />
        {status === "approved" ? "Freigegeben" : approveLabel}
      </button>
      <button
        type="button"
        disabled={pending || status === "rework_requested"}
        onClick={onRework}
        className="inline-flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold disabled:opacity-45"
      >
        <RefreshCw className="size-4" aria-hidden="true" />
        {status === "rework_requested" ? "Rework angefordert" : reworkLabel}
      </button>
    </div>
  )
}

function FormulaSection({
  item,
  pending,
  onAction,
}: {
  item: ReadyReviewItem
  pending: boolean
  onAction: (action: ShampooV14ReviewAction, scope?: ReviewScope) => void
}) {
  const productIdentity = identity(item)
  const size = asRecord(productIdentity.size)
  return (
    <section className="mt-5 rounded-md border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-stone-950">Formel, Identität & Quellen</h3>
          <p className="mt-1 text-sm leading-6 text-stone-700">
            {text(productIdentity.market, "Markt offen")} ·{" "}
            {text(size.display, "Packungsgröße offen")} · Formelstatus {text(item.formula.status)}
          </p>
        </div>
        <StatusPill status={item.review.formula.status} />
      </div>
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div>
          <dt className="font-semibold text-stone-950">Exakter deutscher Name</dt>
          <dd className="text-stone-700">{productName(item)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-stone-950">GTIN</dt>
          <dd className="text-stone-700">{text(productIdentity.gtin)}</dd>
        </div>
        <div className="md:col-span-2">
          <dt className="font-semibold text-stone-950">Formel-Fingerprint</dt>
          <dd className="break-all font-mono text-xs text-stone-700">{item.formula.fingerprint}</dd>
        </div>
        <div className="md:col-span-2">
          <dt className="font-semibold text-stone-950">Vollständige kanonische INCI</dt>
          <dd className="mt-1 text-stone-700">{item.formula.canonicalInci}</dd>
        </div>
      </dl>
      {item.formula.conflicts.length > 0 ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-semibold">Aufgelöster Quellen-/Formelkonflikt</p>
          <ul className="mt-2 space-y-2">
            {item.formula.conflicts.map((conflict, index) => (
              <li key={`${item.id}-conflict-${index}`}>
                {text(asRecord(conflict).description ?? conflict)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SourceEvidenceList title="Claims & Positionierung" values={item.formula.claims} />
        <SourceEvidenceList title="Anwendungstexte" values={item.formula.directions} />
        <SourceEvidenceList title="Quellenwarnungen" values={item.formula.warnings} />
        {item.formula.openQuestions.length > 0 ? (
          <section>
            <h4 className="text-xs font-semibold uppercase text-stone-500">
              Offene Forschungsfragen
            </h4>
            <ul className="mt-2 space-y-2 text-sm text-stone-700">
              {item.formula.openQuestions.map((question, index) => (
                <li key={`${item.id}-question-${index}`} className="rounded-md bg-stone-50 p-3">
                  {text(asRecord(question).question ?? question)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <div className="mt-4 overflow-x-auto rounded-md border border-stone-200">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-stone-50 text-stone-700">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                Quelle
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Typ
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Tier
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Fakten
              </th>
            </tr>
          </thead>
          <tbody>
            {item.formula.sources.map((source) => {
              const record = asRecord(source)
              const url = sourceUrl(source)
              return (
                <tr
                  key={text(record.id ?? record.url)}
                  className="border-t border-stone-200 align-top"
                >
                  <td className="px-4 py-3 text-stone-800">
                    <span className="font-medium">{sourceLabel(source)}</span>
                    {url ? (
                      <a
                        className="mt-1 block break-all text-xs text-stone-600 underline"
                        href={url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {url}
                      </a>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-stone-700">{text(record.source_type)}</td>
                  <td className="px-4 py-3 text-stone-700">{text(record.tier)}</td>
                  <td className="px-4 py-3 text-stone-700">{sourceFacts(source)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <ReviewButtons
        status={item.review.formula.status}
        pending={pending}
        approveLabel="Formelpaket freigeben"
        reworkLabel="Formel-Rework anfordern"
        onApprove={() => onAction("approve_formula", "formula")}
        onRework={() => onAction("request_rework", "formula")}
      />
    </section>
  )
}

function PropertyOverview({ item }: { item: ShampooV14PilotReviewItem }) {
  return (
    <section className="mt-5 overflow-hidden rounded-md border border-stone-300 bg-white">
      <div className="border-b border-stone-200 bg-[#f7efe6] px-4 py-3">
        <h3 className="font-semibold text-stone-950">Acht Klassifikationen · Fokus v1.5</h3>
        <p className="mt-1 text-sm text-stone-700">
          Finale Arbeitswerte mit historischem v1.4-Lane-Vergleich und lokalen Freigaben.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead className="bg-stone-50 text-stone-700">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                Eigenschaft
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Finaler Wert
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Konfidenz
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Lane A
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Lane B
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Entscheid
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Review
              </th>
            </tr>
          </thead>
          <tbody>
            {item.properties.map((property) => (
              <tr key={property.key} className="border-t border-stone-200 align-top">
                <th scope="row" className="px-4 py-3 font-medium text-stone-950">
                  {PROPERTY_LABELS[property.key]}
                  <span className="mt-0.5 block font-mono text-xs font-normal text-stone-500">
                    {property.key}
                  </span>
                </th>
                <td className="px-4 py-3 font-semibold text-stone-950">
                  {rawValueLabel(property.value, property.key)}
                </td>
                <td className="px-4 py-3 text-stone-700">{rawValueLabel(property.confidence)}</td>
                <td className="px-4 py-3 text-stone-700">
                  {rawValueLabel(property.laneA.value, property.key)}
                  <span className="block text-xs text-stone-500">
                    {rawValueLabel(property.laneA.confidence)}
                  </span>
                </td>
                <td className="px-4 py-3 text-stone-700">
                  {rawValueLabel(property.laneB.value, property.key)}
                  <span className="block text-xs text-stone-500">
                    {rawValueLabel(property.laneB.confidence)}
                  </span>
                </td>
                <td className="px-4 py-3 text-stone-700">
                  {OUTCOME_LABELS[property.adjudication.outcome] ?? property.adjudication.outcome}
                  <span className="block text-xs text-stone-500">
                    {property.exactAgreement ? "exakte Übereinstimmung" : "Lane-Differenz gelöst"}
                  </span>
                </td>
                <td className="px-4 py-3 text-stone-700">
                  {STATUS_LABELS[item.review.properties[property.key]?.status ?? "pending"]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function EvidenceFacts({ values }: { values: unknown[] }) {
  if (values.length === 0)
    return <p className="text-sm text-stone-600">Keine separaten Formel-Fakten.</p>
  return (
    <ul className="space-y-2 text-sm text-stone-700">
      {values.map((value, index) => {
        const record = asRecord(value)
        return (
          <li
            key={`${text(record.factId ?? record.ingredient ?? index)}-${index}`}
            className="rounded-md bg-stone-50 p-2"
          >
            <span className="font-medium">
              {text(record.ingredient ?? record.factId ?? `Fakt ${index + 1}`)}
            </span>
            <span className="block text-xs text-stone-500">
              {[record.position ? `Position ${record.position}` : null, record.observation]
                .filter(Boolean)
                .map((entry) => text(entry))
                .join(" · ")}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function FocusPolicySection({ item }: { item: ReadyReviewItem }) {
  const policy = item.focusPolicy
  if (!policy) return null
  const routes = [
    ["Feuchtigkeitsrouten", policy.careDirection.moistureRoutes],
    ["Repair-Routen", policy.careDirection.repairRoutes],
    ["Gemeinsame Pflegerouten", policy.careDirection.sharedConditioningRoutes],
  ] as const
  const claimRole =
    policy.claimRole === "not_applicable"
      ? VALUE_LABELS.not_applicable_claim
      : rawValueLabel(policy.claimRole)

  return (
    <section className="mt-5 rounded-md border border-sky-200 bg-sky-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-stone-950">Fokus-Policy v1.5</h3>
          <p className="mt-1 text-sm leading-6 text-stone-700">
            Formelgeleitete Fokusentscheidung als Overlay; die v1.4-Lanes und Production Light
            bleiben unverändert.
          </p>
        </div>
        <span className="rounded-full border border-sky-300 bg-white px-2.5 py-1 text-xs font-semibold text-sky-900">
          {rawValueLabel(policy.effective.primary)}
        </span>
      </div>
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <div>
          <dt className="font-semibold text-stone-950">Effektiv v1.5</dt>
          <dd className="mt-1 text-stone-700">
            {rawValueLabel(policy.effective.primary)}
            {policy.effective.secondary.length > 0
              ? ` · sekundär ${rawValueLabel(policy.effective.secondary)}`
              : " · kein sekundärer Fokus"}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-stone-950">Historischer Vergleich</dt>
          <dd className="mt-1 text-stone-700">
            Vorher v1.4: {rawValueLabel(policy.priorV14.primary)}
            {policy.priorV14.secondary.length > 0
              ? ` · sekundär ${rawValueLabel(policy.priorV14.secondary)}`
              : " · kein sekundärer Fokus"}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-stone-950">Formelurteil</dt>
          <dd className="mt-1 text-stone-700">{rawValueLabel(policy.careDirection.verdict)}</dd>
        </div>
      </dl>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold uppercase text-stone-500">Formel-Fakten</h4>
          <div className="mt-2">
            <EvidenceFacts values={policy.effective.formulaFacts} />
          </div>
        </div>
        <div className="space-y-3 text-sm text-stone-700">
          {routes.map(([label, values]) => (
            <div key={label}>
              <h4 className="text-xs font-semibold uppercase text-stone-500">{label}</h4>
              <p className="mt-1">{values.length > 0 ? values.join(" · ") : "Keine"}</p>
            </div>
          ))}
          <div>
            <h4 className="text-xs font-semibold uppercase text-stone-500">Claim-Rolle</h4>
            <p className="mt-1">{claimRole}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-2 rounded-md border border-sky-200 bg-white p-3 text-sm text-stone-700">
        <p>
          <strong className="text-stone-950">Entscheidungsweg:</strong> {policy.decisionTrace}
        </p>
        <p>
          <strong className="text-stone-950">Grenze:</strong> {policy.careDirection.limitation}
        </p>
        <p>
          <strong className="text-stone-950">Gegensignal:</strong> {policy.effective.counterSignal}
        </p>
      </div>
    </section>
  )
}

function PropertyDetail({
  item,
  pending,
  onAction,
}: {
  item: ReadyReviewItem
  pending: boolean
  onAction: (action: ShampooV14ReviewAction, scope?: ReviewScope) => void
}) {
  return (
    <section className="mt-5 space-y-3">
      <h3 className="text-lg font-semibold text-stone-950">Eigenschafts-Evidenz</h3>
      {item.properties.map((property) => {
        const status = item.review.properties[property.key]?.status ?? "pending"
        return (
          <article
            key={`${item.id}-${property.key}`}
            className="rounded-md border border-stone-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold text-stone-950">{PROPERTY_LABELS[property.key]}</h4>
                <p className="mt-1 text-sm text-stone-600">
                  {property.key} · {rawValueLabel(property.value, property.key)} ·{" "}
                  {rawValueLabel(property.confidence)}
                </p>
              </div>
              <StatusPill status={status} />
            </div>
            <p className="mt-3 text-sm leading-6 text-stone-800">{property.rationale}</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <h5 className="text-xs font-semibold uppercase text-stone-500">Formel-Fakten</h5>
                <div className="mt-2">
                  <EvidenceFacts values={property.formulaFacts} />
                </div>
              </div>
              <div className="space-y-3 text-sm text-stone-700">
                <div>
                  <h5 className="text-xs font-semibold uppercase text-stone-500">Gegensignal</h5>
                  <p className="mt-1">
                    {text(property.counterSignal, "Kein Gegensignal angegeben")}
                  </p>
                </div>
                <div>
                  <h5 className="text-xs font-semibold uppercase text-stone-500">
                    Nachbaralternative
                  </h5>
                  <p className="mt-1">
                    {rawValueLabel(property.neighboringAlternative, property.key)}
                  </p>
                </div>
                <div>
                  <h5 className="text-xs font-semibold uppercase text-stone-500">Adjudikation</h5>
                  <p className="mt-1">
                    <span className="font-semibold">
                      {OUTCOME_LABELS[property.adjudication.outcome] ??
                        property.adjudication.outcome}
                    </span>
                    {property.adjudication.outcome === "product_correction" ? (
                      <span className="font-mono text-xs"> (product_correction)</span>
                    ) : null}
                    {" · "}
                    {property.adjudication.rationale}
                  </p>
                </div>
                {property.historicalAdjudication ? (
                  <div>
                    <h5 className="text-xs font-semibold uppercase text-stone-500">
                      Historische v1.4-Adjudikation
                    </h5>
                    <p className="mt-1">
                      <span className="font-semibold">
                        {OUTCOME_LABELS[property.historicalAdjudication.outcome] ??
                          property.historicalAdjudication.outcome}
                      </span>
                      {" · "}
                      {property.historicalAdjudication.rationale}
                    </p>
                  </div>
                ) : null}
                <div>
                  <h5 className="text-xs font-semibold uppercase text-stone-500">Evidenz-Refs</h5>
                  <p className="mt-1 break-words font-mono text-xs">
                    {property.evidenceRefs.map((reference) => text(reference)).join(" · ")}
                  </p>
                </div>
              </div>
            </div>
            <ReviewButtons
              status={status}
              pending={pending}
              approveLabel="Eigenschaft freigeben"
              reworkLabel="Eigenschaft-Rework anfordern"
              onApprove={() => onAction("approve_property", property.key)}
              onRework={() => onAction("request_rework", property.key)}
            />
          </article>
        )
      })}
    </section>
  )
}

function ProjectionSection({
  item,
  pending,
  onAction,
}: {
  item: ReadyReviewItem
  pending: boolean
  onAction: (action: ShampooV14ReviewAction, scope?: ReviewScope) => void
}) {
  const rows = item.projection.rows.map(asRecord)
  const fieldRationales = Object.entries(item.projection.fieldRationales)
  return (
    <section className="mt-5 rounded-md border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-stone-950">Production Light Projektion</h3>
          <p className="mt-1 text-sm leading-6 text-stone-700">
            Status {item.projection.status} · exakte Projektion aus production-light.json. Nicht neu
            berechnet.
          </p>
        </div>
        <StatusPill status={item.review.projection.status} />
      </div>
      <div className="mt-4 overflow-x-auto rounded-md border border-stone-200">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-stone-50 text-stone-700">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                Haardicke
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                shampoo_bucket
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                scalp_route
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                cleansing_intensity
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${item.id}-projection-${index}`} className="border-t border-stone-200">
                <td className="px-4 py-3 font-mono text-xs text-stone-800">
                  {rawValueLabel(row.thickness)}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-stone-800">
                  {text(row.shampoo_bucket)}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-stone-800">
                  {text(row.scalp_route)}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-stone-800">
                  {text(row.cleansing_intensity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <div>
          <dt className="font-semibold text-stone-950">Geeignete Haardicken</dt>
          <dd className="text-stone-700">
            {item.projection.suitableThicknesses.map((value) => rawValueLabel(value)).join(", ") ||
              "Keine"}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-stone-950">Konditional, nicht emittiert</dt>
          <dd className="text-stone-700">
            {item.projection.conditionalThicknesses
              .map((value) => rawValueLabel(value))
              .join(", ") || "Keine"}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-stone-950">Benötigte Protokollrollen</dt>
          <dd className="text-stone-700">
            {item.projection.requiredProtocolRoles
              .map((value) => rawValueLabel(value))
              .join(", ") || "Keine"}
          </dd>
        </div>
      </dl>
      <div className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
        <p className="font-semibold text-stone-950">Warnungen</p>
        {item.projection.warnings.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {item.projection.warnings.map((warning, index) => (
              <li key={`${item.id}-warning-${index}`}>{text(warning)}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1">Keine</p>
        )}
      </div>
      <div className="mt-4 space-y-2">
        <h4 className="text-xs font-semibold uppercase text-stone-500">Feldbegründungen</h4>
        {fieldRationales.map(([key, value]) => {
          const rationale = asRecord(value)
          return (
            <details
              key={key}
              className="rounded-md border border-stone-200 bg-stone-50 p-3"
              open={key === "category_specs.product_shampoo_specs"}
            >
              <summary className="cursor-pointer text-sm font-semibold text-stone-950">
                {key}
              </summary>
              <p className="mt-2 text-sm leading-6 text-stone-700">{text(rationale.rationale)}</p>
              <p className="mt-2 text-xs text-stone-500">
                confidence: {text(rationale.confidence)}
              </p>
            </details>
          )
        })}
      </div>
      <ReviewButtons
        status={item.review.projection.status}
        pending={pending}
        approveLabel="Projektion freigeben"
        reworkLabel="Projektions-Rework anfordern"
        onApprove={() => onAction("approve_projection", "projection")}
        onRework={() => onAction("request_rework", "projection")}
      />
    </section>
  )
}

function AuditDetail({
  item,
  pending,
  feedback,
  comment,
  onCommentChange,
  onAction,
}: {
  item: ShampooV14PilotReviewItem
  pending: boolean
  feedback: string | null
  comment: string
  onCommentChange: (value: string) => void
  onAction: (action: ShampooV14ReviewAction, scope?: ReviewScope) => void
}) {
  if (!isReadyItem(item)) {
    return (
      <section className="rounded-md border border-red-200 bg-red-50 p-5 text-red-950">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5" aria-hidden="true" />
          <h2 className="text-lg font-semibold">{productName(item)} ist blockiert</h2>
        </div>
        <p className="mt-3 text-sm leading-6">
          {item.integrity.diagnostic ?? "Formel- oder Projektionsdaten fehlen."}
        </p>
      </section>
    )
  }

  const approvalHint =
    item.review.product.status === "approved"
      ? "Dieses Pilotprodukt ist lokal für diesen exakten Artefaktstand freigegeben."
      : canApproveProduct(item)
        ? "Alle Teilbereiche sind freigegeben; die lokale Gesamtfreigabe ist jetzt möglich."
        : "Formel, alle acht Eigenschaften und Production Light müssen zuerst freigegeben sein."
  const openRework = reworkScopes(item)

  return (
    <section className="min-w-0 rounded-md border border-stone-200 bg-stone-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-stone-500">Produkt-Audit</p>
          <h2 className="mt-1 text-2xl font-semibold text-stone-950">{productName(item)}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-700">
            {brandName(item)} · lokale Forschung · keine Katalogfreigabe
          </p>
        </div>
        <div className="max-w-sm text-right">
          <button
            type="button"
            disabled={
              !canApproveProduct(item) || pending || item.review.product.status === "approved"
            }
            onClick={() => onAction("approve_product")}
            className="rounded-md border border-emerald-800 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-200 disabled:text-stone-600"
          >
            {item.review.product.status === "approved"
              ? "Pilotprodukt freigegeben"
              : "Gesamtes Pilotprodukt freigeben"}
          </button>
          <p className="mt-2 text-xs leading-5 text-stone-600">{approvalHint}</p>
        </div>
      </div>
      {item.integrity.previousReviewHash || item.review.archived.length > 0 ? (
        <section className="mt-5 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <h3 className="font-semibold">Frühere Entscheidungen sind archiviert</h3>
          <p className="mt-1 leading-6">
            Die Research-Artefakte haben sich geändert. Frühere Freigaben werden für diesen Stand
            nicht wiederverwendet; bitte alle Bereiche erneut prüfen.
          </p>
          {item.integrity.previousReviewHash ? (
            <p className="mt-2 break-all font-mono text-xs">
              Vorheriger Artefakt-Hash: {item.integrity.previousReviewHash}
            </p>
          ) : null}
          {item.review.archived.length > 0 ? (
            <ul className="mt-2 space-y-1 font-mono text-xs">
              {item.review.archived.map((entry) => (
                <li key={`${item.id}-${entry.hash}-${entry.archivedAt}`}>
                  {entry.hash} · archiviert {entry.archivedAt} · {entry.history.length}{" "}
                  Entscheidungen
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      {feedback ? (
        <div
          className="mt-5 rounded-md border border-stone-300 bg-white p-3 text-sm text-stone-800"
          role="status"
        >
          {feedback}
        </div>
      ) : null}
      {openRework.length > 0 ? (
        <section className="mt-5 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <h3 className="font-semibold">Offene Rework-Aufträge</h3>
          <ul className="mt-2 space-y-2">
            {openRework.map((entry) => (
              <li key={entry.scope} className="rounded-md border border-amber-200 bg-white p-3">
                <strong>{entry.scope}</strong>
                <p className="mt-1">{entry.comment}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="mt-5 rounded-md border border-stone-200 bg-white p-4">
        <label
          htmlFor="shampoo-v14-review-comment"
          className="text-sm font-semibold text-stone-950"
        >
          Reviewer-Kommentar
        </label>
        <textarea
          id="shampoo-v14-review-comment"
          value={comment}
          onChange={(event) => onCommentChange(event.target.value)}
          placeholder="Pflichtfeld für Rework; optional für deine Notizen"
          className="mt-2 min-h-20 w-full rounded-md border border-stone-300 p-3 text-sm"
        />
      </div>
      <FormulaSection item={item} pending={pending} onAction={onAction} />
      <FocusPolicySection item={item} />
      <PropertyOverview item={item} />
      <PropertyDetail item={item} pending={pending} onAction={onAction} />
      <ProjectionSection item={item} pending={pending} onAction={onAction} />
    </section>
  )
}

export function ShampooV14PilotClient({
  datasetId,
  initialItems,
  initialItemId,
}: {
  datasetId: ShampooV14ReviewDatasetId
  initialItems: ShampooV14PilotReviewItem[]
  initialItemId: string | null
}) {
  const [items, setItems] = useState(initialItems)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialItemId ?? initialItems[0]?.id ?? null,
  )
  const [comment, setComment] = useState("")
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  )
  const counts = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          acc[productStatus(item)] += 1
          return acc
        },
        { pending: 0, approved: 0, rework_requested: 0, blocked: 0, product_approved: 0 } as Record<
          ReviewStatus | "blocked" | "product_approved",
          number
        >,
      ),
    [items],
  )

  async function submitAction(action: ShampooV14ReviewAction, scope?: ReviewScope) {
    if (!selectedItem || selectedItem.integrity.status !== "ready") return
    if (action === "request_rework" && !comment.trim()) {
      setFeedback("Bitte zuerst einen Rework-Kommentar notieren.")
      document.getElementById("shampoo-v14-review-comment")?.focus()
      return
    }
    setPending(true)
    setFeedback("Entscheidung wird lokal gespeichert ...")
    try {
      const response = await fetch("/api/labs/shampoo-research/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          datasetId,
          productId: selectedItem.id,
          expectedHash: selectedItem.integrity.hash,
          ...(action === "approve_property" && scope ? { property: scope } : {}),
          ...(action === "request_rework" && scope ? { scope, comment: comment.trim() } : {}),
        }),
      })
      const payload = (await response.json()) as {
        error?: string
        item?: ShampooV14PilotReviewItem
        items?: ShampooV14PilotReviewItem[]
      }
      if (!response.ok || !payload.item || !payload.items) {
        if (payload.items) {
          setItems(payload.items)
          setSelectedId((current) =>
            payload.items?.some((item) => item.id === current)
              ? current
              : (payload.items?.[0]?.id ?? null),
          )
        }
        setFeedback(
          response.status === 409
            ? `${payload.error ?? "Artefaktstand geändert."} Die aktuelle Version wurde geladen.`
            : (payload.error ?? "Review konnte nicht gespeichert werden."),
        )
        return
      }
      setItems(payload.items)
      setSelectedId(payload.item.id)
      setComment("")
      setFeedback(
        action === "request_rework"
          ? "Rework-Auftrag lokal gespeichert."
          : action === "approve_product"
            ? "Pilotprodukt lokal freigegeben."
            : "Freigabe lokal gespeichert.",
      )
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Review konnte nicht gespeichert werden.",
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f5eee5] text-stone-950">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Nur Entwicklung ·{" "}
            {datasetId === "pilot"
              ? "Shampoo-v1.4-Pilot"
              : `Shampoo-v1.4-Welle ${datasetId.slice(-2)}`}{" "}
            · keine Katalogfreigabe
          </p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold">Shampoo Research Lab</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-700">
                {datasetId === "pilot"
                  ? "Fünf Shampoo-v1.4-Pilotprodukte"
                  : `${items.length} Shampoo-Forschungsprodukte`}{" "}
                mit unveränderten Lane-A/B-Artefakten, formelgeleiteter Fokus-Policy v1.5 und
                Production-Light-Projektion. Diese Ansicht speichert nur lokale
                Review-Entscheidungen im Research-Artefakt und hat keine produktive Schreibaktion.
              </p>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                Review-Fortschritt
              </p>
              <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-5">
                {Object.entries(counts).map(([status, count]) => (
                  <div
                    key={status}
                    className="rounded-md border border-stone-200 bg-white px-3 py-2"
                  >
                    <strong className="block text-lg">{count}</strong>
                    <span>
                      {PRODUCT_STATUS_LABELS[status as keyof typeof PRODUCT_STATUS_LABELS]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>
        <section className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="min-w-0 space-y-3">
            <h2 className="text-lg font-semibold">Recherche-Queue</h2>
            {items.length === 0 ? (
              <div className="rounded-md border border-stone-200 bg-white p-4 text-sm text-stone-700">
                Keine Pilotprodukte gefunden.
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 lg:block lg:space-y-3 lg:overflow-visible">
                {items.map((item) => (
                  <QueueCard
                    key={item.id}
                    item={item}
                    selected={item.id === selectedItem?.id}
                    onSelect={() => {
                      setSelectedId(item.id)
                      setComment("")
                      setFeedback(null)
                    }}
                  />
                ))}
              </div>
            )}
          </aside>
          {selectedItem ? (
            <AuditDetail
              item={selectedItem}
              pending={pending}
              feedback={feedback}
              comment={comment}
              onCommentChange={setComment}
              onAction={submitAction}
            />
          ) : (
            <section className="rounded-md border border-stone-200 bg-stone-50 p-5 text-sm text-stone-700">
              Sobald ein Pilotprodukt vorhanden ist, erscheinen hier Formel, Eigenschaften und
              Production Light.
            </section>
          )}
        </section>
      </div>
    </main>
  )
}
