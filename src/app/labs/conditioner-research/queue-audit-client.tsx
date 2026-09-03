"use client"

import { useMemo, useRef, useState } from "react"

import type {
  ConditionerProfileField,
  ConditionerPropertyReviewStatus,
  ConditionerResearchDetail,
  ConditionerResearchQueueItem,
  ConditionerResearchSummary,
} from "./research-lab-client"

const FIELD_LABELS: Record<string, string> = {
  conditioning_level: "Pflegelevel",
  weight_potential: "Gewichtspotenzial",
  care_direction: "Pflegerichtung",
  repair_support_level: "Repair-Unterstützung",
  primary_focus: "Primärer Fokus",
  secondary_focus: "Sekundäre Schwerpunkte",
  hair_thickness_fit: "Haardicken-Fit",
  damage_fit: "Schädigungs-Fit",
  texture_fit: "Textur-Fit",
}

const PROFILE_KEYS = [
  ["conditioning_level", "conditioningLevel"],
  ["weight_potential", "weightPotential"],
  ["care_direction", "careDirection"],
  ["repair_support_level", "repairSupportLevel"],
  ["primary_focus", "primaryFocus"],
  ["secondary_focus", "secondaryFocus"],
  ["hair_thickness_fit", "hairThicknessFit"],
  ["damage_fit", "damageFit"],
  ["texture_fit", "textureFit"],
] as const
type ReviewAction = "approve_property" | "request_rework" | "approve_product" | "approve_boundary"
type QueueLane = "priority" | "standard" | "rework" | "approved" | "boundary"

const QUEUE_LANE_LABELS: Record<QueueLane, string> = {
  priority: "Zuerst prüfen",
  standard: "Standardprüfung",
  rework: "Rework offen",
  approved: "Freigegeben",
  boundary: "G0-Grenzfall",
}

function nameOf(item: ConditionerResearchQueueItem | ConditionerResearchDetail) {
  return item.productName ?? item.exactName ?? "Unbenanntes Conditioner-Produkt"
}
function brandOf(item: ConditionerResearchQueueItem | ConditionerResearchDetail) {
  return item.brandName ?? item.brand ?? "Marke offen"
}
function formatValue(value: unknown): string {
  return Array.isArray(value)
    ? value.join(" · ")
    : typeof value === "string" && value
      ? value
      : "offen"
}

function fieldsFor(detail: ConditionerResearchDetail): ConditionerProfileField[] {
  if (detail.profile?.fields?.length) return detail.profile.fields
  if (!detail.profile) return []
  return PROFILE_KEYS.map(([path, key]) => ({
    path,
    label: FIELD_LABELS[path],
    value: formatValue(detail.profile?.[key]),
    acceptedValue: formatValue(detail.profile?.[key]),
    reviewStatus: detail.profile?.uncertainFields?.includes(path) ? "vorläufig" : "vollständig",
  }))
}
function queueLabel(item: ConditionerResearchQueueItem) {
  if (item.reviewStatus === "approved") return "Freigegeben"
  if (item.reviewStatus === "rework_open") return "Rework offen"
  if (item.categoryBoundaryStatus === "excluded_product_form" || item.excluded)
    return "G0-Grenzfall"
  return item.priorityGroup === "priority" ? "Zuerst prüfen" : "Standardprüfung"
}
function queueLane(item: ConditionerResearchQueueItem): QueueLane {
  if (item.reviewStatus === "approved") return "approved"
  if (item.reviewStatus === "rework_open") return "rework"
  if (item.categoryBoundaryStatus === "excluded_product_form" || item.excluded) return "boundary"
  return item.priorityGroup === "priority" ? "priority" : "standard"
}
function queueCardAction(item: ConditionerResearchQueueItem) {
  if (item.reviewStatus === "approved") return "Freigabe ansehen"
  if (item.reviewStatus === "rework_open") return "Rework prüfen"
  if (item.categoryBoundaryStatus === "excluded_product_form" || item.excluded)
    return "Grenzfall prüfen"
  return item.priorityGroup === "priority" ? "Entscheidung prüfen" : "Produkt prüfen"
}
function fieldStatus(
  detail: ConditionerResearchDetail,
  field: ConditionerProfileField,
): ConditionerPropertyReviewStatus {
  const status = detail.propertyStatuses?.[field.path] ?? field.humanReviewStatus
  return status === "approved" || status === "rework_open" ? status : "unreviewed"
}
function displayFieldStatus(status: ConditionerPropertyReviewStatus) {
  return status === "approved" ? "freigegeben" : status === "rework_open" ? "Rework offen" : "offen"
}
function evidenceSignalLabel(field: ConditionerProfileField) {
  return field.evidenceBasis === "policy_derivation"
    ? "Upstream formula signals"
    : "Formula signals"
}
function fieldGloss(field: ConditionerProfileField) {
  return field.path === "weight_potential"
    ? "Formula deposition signal: estimates how strongly the complete architecture may leave conditioning material on hair after rinsing. It is not a measured residue result and does not by itself determine the final Weight Potential class."
    : null
}
function statusTone(label: string) {
  return label === "Freigegeben"
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : label === "Rework offen" || label === "G0-Grenzfall"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : label === "Zuerst prüfen"
        ? "border-sky-200 bg-sky-50 text-sky-900"
        : "border-stone-200 bg-stone-50 text-stone-800"
}

function QueueCard({
  item,
  selected,
  disabled,
  onSelect,
}: {
  item: ConditionerResearchQueueItem
  selected: boolean
  disabled: boolean
  onSelect: () => void
}) {
  const label = queueLabel(item)
  return (
    <article
      data-conditioner-queue-card={item.productId}
      className={`min-w-[280px] flex-1 rounded-md border bg-white p-4 lg:min-w-0 ${selected ? "border-stone-950 ring-1 ring-stone-950" : "border-stone-200"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{nameOf(item)}</h3>
          <p className="mt-1 text-sm text-stone-600">
            {brandOf(item)} · {item.market ?? "DE"} · {item.packSize ?? "Packung offen"}
          </p>
        </div>
        <span
          className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(label)}`}
        >
          {label}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-stone-700">
        {item.summary ?? "Vollständiges lokales Research-Profil."}
      </p>
      {item.statusLabel ? (
        <p className="mt-2 text-xs font-medium text-stone-600">{item.statusLabel}</p>
      ) : null}
      <p className="mt-2 text-xs leading-5 text-stone-700">
        <span className="font-semibold">Jetzt prüfen:</span>{" "}
        {item.uncertainFields?.length
          ? item.uncertainFields.join(" · ")
          : item.excluded
            ? "Produktform und G0-Grenze"
            : "alle neun Vergleichseigenschaften im Überblick"}
      </p>
      {item.profileStatus ? (
        <p className="mt-1 text-xs text-stone-600">Profil: {item.profileStatus}</p>
      ) : null}
      {item.staleReview ? (
        <p className="mt-3 text-sm font-medium text-amber-900">
          Vorherige Entscheidung ist veraltet; bitte erneut prüfen.
        </p>
      ) : null}
      {item.lastReviewDecision ? (
        <p className="mt-3 text-xs text-stone-600">
          Letzte Entscheidung: {item.lastReviewDecision.action ?? "gespeichert"}
        </p>
      ) : null}
      <button
        type="button"
        aria-pressed={selected}
        disabled={disabled}
        onClick={onSelect}
        className="mt-4 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {queueCardAction(item)}
      </button>
    </article>
  )
}

function ClassificationOverview({ detail }: { detail: ConditionerResearchDetail }) {
  const fields = fieldsFor(detail)
  const uncertainFields = new Set([
    ...(detail.uncertainFields ?? []),
    ...(detail.profile?.uncertainFields ?? []),
  ])

  return (
    <section className="mt-5 min-w-0 overflow-hidden rounded-md border border-stone-300 bg-white">
      <div className="border-b border-stone-200 bg-[#f7efe6] px-4 py-3">
        <h3 className="font-semibold">Vorgeschlagene Conditioner-Klassifikation</h3>
        <p className="mt-1 text-sm text-stone-700">
          Kompakter Überblick aus dem INCI-Audit. Die ausführliche Herleitung und die
          Review-Aktionen folgen weiter unten.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-stone-50 text-stone-700">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                Eigenschaft
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Datenbankwert
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Reviewstatus
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Reasoning
              </th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => {
              const status = fieldStatus(detail, field)
              const uncertain = uncertainFields.has(field.path) || uncertainFields.has(field.label)
              return (
                <tr
                  key={field.path}
                  className={`border-t border-stone-200 align-top ${uncertain ? "bg-sky-50/70" : ""}`}
                >
                  <th scope="row" className="px-4 py-3 font-medium text-stone-950">
                    {FIELD_LABELS[field.path] ?? field.label}
                    {uncertain ? (
                      <span className="ml-2 inline-flex rounded-full border border-sky-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                        Zuerst prüfen
                      </span>
                    ) : null}
                    <span className="mt-0.5 block font-mono text-xs font-normal text-stone-500">
                      {field.path}
                    </span>
                  </th>
                  <td className="px-4 py-3 font-semibold text-stone-950">
                    {field.acceptedValue ?? field.value}
                  </td>
                  <td className="px-4 py-3 text-stone-700">{displayFieldStatus(status)}</td>
                  <td className="max-w-xl px-4 py-3 text-stone-700">
                    {fieldGloss(field) ? (
                      <p className="mb-2 rounded-md bg-stone-50 p-2 text-xs leading-5 text-stone-600">
                        {fieldGloss(field)}
                      </p>
                    ) : null}
                    {field.thresholdReasoning?.length ? (
                      <ul className="list-disc space-y-1 pl-5 leading-6">
                        {field.thresholdReasoning.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    ) : (
                      (field.rationale ?? "Reasoning is missing; rework is required.")
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ProfileReview({
  detail,
  pending,
  onAction,
}: {
  detail: ConditionerResearchDetail
  pending: boolean
  onAction: (action: ReviewAction, path?: string) => void
}) {
  const fields = fieldsFor(detail)
  if (!detail.profile) return null
  return (
    <section className="mt-5 rounded-md border border-stone-300 bg-white">
      <div className="border-b border-stone-200 px-4 py-3">
        <h3 className="font-semibold">Audit-Evidenz</h3>
        <p className="mt-1 text-sm text-stone-700">
          Alle neun Vergleichseigenschaften bleiben sichtbar. Formula signals, derivation, exact
          classification reasoning, and the evidence ceiling are shown in English.
        </p>
      </div>
      <div className="divide-y divide-stone-200">
        {fields.map((field) => {
          const status = fieldStatus(detail, field)
          return (
            <article key={field.path} className="p-4" data-conditioner-profile-field={field.path}>
              <div className="flex flex-col justify-between gap-3 md:flex-row">
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold">{FIELD_LABELS[field.path] ?? field.label}</h4>
                  <p className="font-mono text-xs text-stone-500">{field.path}</p>
                  <p className="mt-2 text-sm font-semibold text-stone-950">
                    {field.acceptedValue ?? field.value}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-stone-700">
                    {field.rationale ??
                      "Reasoning is missing. Please request rework for this property."}
                  </p>
                  {fieldGloss(field) ? (
                    <p className="mt-3 rounded-md border border-stone-200 bg-stone-50 p-3 text-sm leading-6 text-stone-700">
                      {fieldGloss(field)}
                    </p>
                  ) : null}
                  {field.evidenceSignals?.length ? (
                    <div className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-3">
                      <h5 className="text-xs font-semibold uppercase tracking-wide text-stone-600">
                        {evidenceSignalLabel(field)}
                      </h5>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-800">
                        {field.evidenceSignals.map((signal) => (
                          <li key={signal}>{signal}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {field.derivation ? (
                    <div className="mt-3">
                      <h5 className="text-xs font-semibold uppercase tracking-wide text-stone-600">
                        Derivation
                      </h5>
                      <p className="mt-1 text-sm leading-6 text-stone-700">{field.derivation}</p>
                    </div>
                  ) : null}
                  {field.thresholdReasoning?.length ? (
                    <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3">
                      <h5 className="text-xs font-semibold uppercase tracking-wide text-sky-900">
                        Why this exact classification?
                      </h5>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-sky-950">
                        {field.thresholdReasoning.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {field.limitations?.length ? (
                    <div className="mt-3">
                      <h5 className="text-xs font-semibold uppercase tracking-wide text-stone-600">
                        Evidence ceiling
                      </h5>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-stone-600">
                        {field.limitations.map((limitation) => (
                          <li key={limitation}>{limitation}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
                  <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-xs">
                    {displayFieldStatus(status)}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending || status === "approved"}
                      onClick={() => onAction("approve_property", field.path)}
                      className="rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Eigenschaft freigeben
                    </button>
                    <button
                      type="button"
                      disabled={pending || status === "rework_open"}
                      onClick={() => onAction("request_rework", field.path)}
                      className="rounded-md border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-950 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {status === "rework_open" ? "Rework offen" : "Rework anfordern"}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function DetailPanel({
  detail,
  comment,
  setComment,
  pending,
  onAction,
}: {
  detail: ConditionerResearchDetail
  comment: string
  setComment: (value: string) => void
  pending: boolean
  onAction: (action: ReviewAction, path?: string) => void
}) {
  const excluded = detail.categoryBoundaryStatus === "excluded_product_form" || detail.excluded
  const blocks = detail.reviewBlockers ?? []
  const rawInci = detail.formula?.rawInci ?? detail.rawInci ?? "offen"
  const normalizedInci = formatValue(detail.formula?.normalizedInci ?? detail.normalizedInci)
  const fields = fieldsFor(detail)
  const openFields = fields.filter((field) => fieldStatus(detail, field) !== "approved")
  const approvalHint = detail.canApproveProduct
    ? `Gibt alle ${fields.length} Eigenschaften und die lokale Analyse für diese exakte Version frei. Keine Katalogfreigabe.`
    : blocks.length
      ? `Nicht möglich: ${blocks[0]}`
      : "Nicht möglich, solange ein Rework-Punkt oder eine Evidenzgrenze offen ist."

  return (
    <section className="min-w-0 self-start rounded-md border border-stone-200 bg-stone-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-stone-500">
            Produkt-Audit · nur lokal
          </p>
          <h2 className="mt-1 text-2xl font-semibold">{nameOf(detail)}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-700">
            {brandOf(detail)} · {detail.identity?.market ?? detail.market ?? "DE"} ·{" "}
            {detail.identity?.packSize ?? detail.packSize ?? "Packung offen"}
          </p>
          {!excluded ? (
            <p className="mt-1 text-sm text-stone-600">
              {openFields.length} von {fields.length} Eigenschaften sind noch offen.
            </p>
          ) : null}
        </div>
        {!excluded ? (
          <div className="ml-auto w-full max-w-sm text-left sm:text-right">
            <button
              type="button"
              disabled={pending || !detail.canApproveProduct}
              onClick={() => onAction("approve_product")}
              className="rounded-md border border-emerald-800 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-200 disabled:text-stone-600"
            >
              {pending ? "Speichert …" : "Gesamtes Produkt freigeben"}
            </button>
            <p className="mt-2 text-xs leading-5 text-stone-600">{approvalHint}</p>
          </div>
        ) : null}
      </div>

      {detail.staleReview ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          Die Formel, Analyse oder Standardversion hat sich geändert. Nur Eigenschaften mit
          verändertem Wert oder Reasoning öffnen erneut; unveränderte Eigenschaftsfreigaben bleiben
          erhalten. Die Produktfreigabe muss anschließend erneut bestätigt werden.
        </p>
      ) : null}
      {blocks.length ? (
        <section className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-950">Freigabe blockiert</h3>
          <ul className="mt-2 list-disc pl-5 text-sm text-amber-950">
            {blocks.map((block) => (
              <li key={block}>{block}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {excluded ? (
        <section className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-950">Gate G0 · kein Conditioner-Profil</h3>
          <p className="mt-2 text-sm leading-6 text-amber-950">
            {detail.boundaryExplanation ??
              "Dieses Produkt ist kein auszuspülender Conditioner und wird im Pilot nicht klassifiziert."}
          </p>
          <button
            type="button"
            disabled={pending || !detail.canApproveBoundary}
            onClick={() => onAction("approve_boundary")}
            className="mt-4 rounded-md border border-amber-400 px-3 py-2 text-sm font-semibold text-amber-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            G0-Ausschluss bestätigen
          </button>
        </section>
      ) : (
        <>
          <section className="mt-5 rounded-md border border-sky-200 bg-sky-50 p-4">
            <h3 className="font-semibold text-stone-950">Dein Prüfauftrag</h3>
            <p className="mt-2 text-sm leading-6 text-stone-800">
              Beginne mit dem kompakten Überblick. Nutze die ausführliche Evidenz darunter für
              Eigenschaften, deren Wert oder Herleitung du genauer prüfen möchtest.
            </p>
            {detail.profile?.uncertainFields?.length ? (
              <p className="mt-2 text-sm text-sky-900">
                <span className="font-semibold">Kritische Eigenschaften zuerst:</span>{" "}
                {detail.profile.uncertainFields
                  .map((field) => FIELD_LABELS[field] ?? field)
                  .join(" · ")}
              </p>
            ) : null}
          </section>
          {detail.uncertaintyNotes?.length ? (
            <section className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-semibold text-amber-950">Annahmen &amp; offene Grenzen</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-950">
                {detail.uncertaintyNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>
          ) : null}
          <ClassificationOverview detail={detail} />
          <section className="mt-5 rounded-md border border-stone-200 bg-white p-4">
            <label htmlFor="conditioner-review-comment" className="font-semibold">
              Reviewer-Kommentar
            </label>
            <p className="mt-1 text-sm text-stone-700">
              Für Rework ist ein konkreter Kommentar erforderlich. Für Freigaben ist er optional.
            </p>
            <textarea
              id="conditioner-review-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              className="mt-3 min-h-24 w-full rounded-md border border-stone-300 p-3 text-sm"
              placeholder="Zum Beispiel: Bitte Gewichtspotenzial erneut begründen."
            />
          </section>
        </>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="rounded-md border border-stone-200 bg-white p-4">
          <h3 className="font-semibold">Formelidentität</h3>
          <p className="mt-2 text-sm text-stone-700">
            GTIN: {detail.identity?.gtinEan ?? "Nicht belegt"}
          </p>
          <p className="mt-1 break-all text-xs text-stone-600">
            Formel: {detail.formulaFingerprint ?? "nicht ausgewiesen"}
            <br />
            Profil: {detail.profileFingerprint ?? "nicht ausgewiesen"}
            <br />
            Standard: {detail.standardVersion ?? "nicht ausgewiesen"}
          </p>
          <p className="mt-2 text-xs leading-5 text-stone-600">
            Unveränderte Weight-/Thickness-Derivations können v1.4 und Damage-Fit-Derivations v1.5
            als Regelherkunft nennen; der aktive Profilstandard ist v1.6.
          </p>
        </section>
        <section className="rounded-md border border-stone-200 bg-white p-4">
          <h3 className="font-semibold">Anwendung</h3>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            {detail.directions?.raw ?? detail.directions?.normalized ?? "offen"}
          </p>
        </section>
        <section className="rounded-md border border-stone-200 bg-white p-4">
          <h3 className="font-semibold">Original-INCI</h3>
          <p className="mt-2 text-sm leading-6 text-stone-700">{rawInci}</p>
        </section>
        <section className="rounded-md border border-stone-200 bg-white p-4">
          <h3 className="font-semibold">Normalisierte Formelzeichenfolge</h3>
          <p className="mt-2 text-xs leading-5 text-stone-600">
            Kanonische Vergleichszeichenfolge; die Original-INCI bewahrt die Zutaten-Grenzen.
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-700">{normalizedInci}</p>
        </section>
      </div>
      {!excluded ? <ProfileReview detail={detail} pending={pending} onAction={onAction} /> : null}
    </section>
  )
}

export function ConditionerResearchQueueAuditClient({
  summary,
  queueItems,
  initialDetail,
}: {
  summary: ConditionerResearchSummary
  queueItems: ConditionerResearchQueueItem[]
  initialDetail: ConditionerResearchDetail | null
}) {
  const [items, setItems] = useState(queueItems),
    [currentSummary, setCurrentSummary] = useState(summary),
    [selectedId, setSelectedId] = useState(initialDetail?.productId ?? null),
    [selectedDetail, setSelectedDetail] = useState(initialDetail),
    [comment, setComment] = useState(""),
    [feedback, setFeedback] = useState<string | null>(null),
    [pending, setPending] = useState(false)
  const initialSummary =
    queueItems.find((item) => item.productId === initialDetail?.productId) ?? queueItems[0] ?? null
  const [activeLane, setActiveLane] = useState<QueueLane>(
    initialSummary ? queueLane(initialSummary) : "priority",
  )
  const requestSequence = useRef(0)
  const selectedSummary = useMemo(
    () => items.find((item) => item.productId === selectedId) ?? null,
    [items, selectedId],
  )
  const reviewCounts = currentSummary.reviewCounts ?? {
    approved: items.filter((item) => item.reviewStatus === "approved").length,
    reworkOpen: items.filter((item) => item.reviewStatus === "rework_open").length,
    needsReview: items.filter((item) => item.reviewStatus === "needs_review").length,
    excluded: items.filter((item) => item.reviewStatus === "excluded" || item.excluded).length,
  }
  const laneCounts = useMemo(
    () =>
      items.reduce(
        (counts, item) => {
          counts[queueLane(item)] += 1
          return counts
        },
        { priority: 0, standard: 0, rework: 0, approved: 0, boundary: 0 } as Record<
          QueueLane,
          number
        >,
      ),
    [items],
  )
  const visibleItems = useMemo(
    () => items.filter((item) => queueLane(item) === activeLane),
    [activeLane, items],
  )

  async function selectItem(productId: string) {
    const sequence = ++requestSequence.current
    setSelectedId(productId)
    setSelectedDetail(null)
    setFeedback("Audit wird geladen ...")
    try {
      const response = await fetch(
          `/api/labs/conditioner-research/queue?productId=${encodeURIComponent(productId)}`,
        ),
        payload = await response.json()
      if (!response.ok || !payload.detail)
        throw new Error(payload.error ?? "Conditioner-Audit konnte nicht geladen werden.")
      if (requestSequence.current === sequence) {
        setSelectedDetail(payload.detail as ConditionerResearchDetail)
        setFeedback(null)
        setComment("")
      }
    } catch (error) {
      if (requestSequence.current === sequence)
        setFeedback(
          error instanceof Error ? error.message : "Conditioner-Audit konnte nicht geladen werden.",
        )
    }
  }
  async function submit(action: ReviewAction, propertyPath?: string) {
    if (!selectedDetail || pending) return
    if (action === "request_rework" && !comment.trim()) {
      setFeedback("Bitte begründe den Rework-Auftrag im Reviewer-Kommentar.")
      document.getElementById("conditioner-review-comment")?.focus()
      return
    }
    const sequence = ++requestSequence.current
    const reviewedProductId = selectedDetail.productId
    const reviewedProductName = nameOf(selectedDetail)
    setPending(true)
    setFeedback("Entscheidung wird gespeichert …")
    try {
      const response = await fetch("/api/labs/conditioner-research/review", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action,
            itemId: reviewedProductId,
            ...(propertyPath ? { propertyPath } : {}),
            ...(comment.trim() ? { comment: comment.trim() } : {}),
          }),
        }),
        payload = await response.json()
      if (!response.ok || !payload.detail || !payload.data) {
        const blockers = Array.isArray(payload.blockers)
          ? payload.blockers.filter((entry: unknown): entry is string => typeof entry === "string")
          : []
        throw new Error(
          [
            payload.error ?? "Review-Entscheidung konnte nicht gespeichert werden.",
            ...blockers,
          ].join(" "),
        )
      }
      const nextItems = (payload.data.queueItems ?? []) as ConditionerResearchQueueItem[]
      setItems(nextItems)
      if (payload.data.summary)
        setCurrentSummary(payload.data.summary as ConditionerResearchSummary)
      const stillViewingReviewedProduct = requestSequence.current === sequence
      if (stillViewingReviewedProduct) {
        setSelectedDetail(payload.detail as ConditionerResearchDetail)
        const nextSummary = nextItems.find((item) => item.productId === reviewedProductId)
        if (nextSummary) setActiveLane(queueLane(nextSummary))
        setComment("")
      }
      setFeedback(
        action === "request_rework"
          ? `Rework-Auftrag für ${reviewedProductName} wurde lokal gespeichert.`
          : `Lokale Review-Entscheidung für ${reviewedProductName} wurde gespeichert.`,
      )
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Review-Entscheidung konnte nicht gespeichert werden. Bitte erneut versuchen.",
      )
    } finally {
      setPending(false)
    }
  }

  function selectLane(lane: QueueLane) {
    setActiveLane(lane)
    const firstItem = items.find((item) => queueLane(item) === lane)
    if (firstItem && firstItem.productId !== selectedId) {
      void selectItem(firstItem.productId)
      return
    }
    if (!firstItem) {
      requestSequence.current += 1
      setSelectedId(null)
      setSelectedDetail(null)
      setFeedback(null)
      setComment("")
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 text-stone-950 sm:p-6">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Nur Entwicklung · lokale Research-Review · keine Produktionsdatenbank
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Conditioner Research Lab</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-700">
              Bearbeite alle zwölf Pilotprodukte. Die Arbeitsqueue führt dich zum nächsten
              Prüfpunkt; im Produkt siehst du zuerst den kompakten Überblick und danach die
              vollständige Evidenz. Keine Katalogfreigabe und keine Product-Intake-Aktion.
            </p>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Review-Fortschritt
            </p>
            <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
              <div className="rounded-md border bg-white px-3 py-2">
                <strong className="block text-lg">{reviewCounts.needsReview}</strong>
                <span>Zu prüfen</span>
              </div>
              <div className="rounded-md border bg-white px-3 py-2">
                <strong className="block text-lg">{reviewCounts.reworkOpen}</strong>
                <span>Rework offen</span>
              </div>
              <div className="rounded-md border bg-white px-3 py-2">
                <strong className="block text-lg">{reviewCounts.approved}</strong>
                <span>Freigegeben</span>
              </div>
              <div className="rounded-md border bg-white px-3 py-2">
                <strong className="block text-lg">{reviewCounts.excluded}</strong>
                <span>G0 bestätigt</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-3">
          <h2 className="text-lg font-semibold">Recherche-Queue</h2>
          <div
            className="grid grid-cols-2 gap-2"
            role="radiogroup"
            aria-label="Arbeitsqueue filtern"
          >
            {(Object.keys(QUEUE_LANE_LABELS) as QueueLane[]).map((lane) => (
              <button
                key={lane}
                type="button"
                role="radio"
                aria-checked={activeLane === lane}
                disabled={pending}
                onClick={() => selectLane(lane)}
                className={`rounded-md border px-3 py-2 text-left text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${activeLane === lane ? "border-stone-950 bg-stone-950 text-white" : "border-stone-200 bg-white text-stone-800"}`}
              >
                <span className="block text-base">{laneCounts[lane]}</span>
                {QUEUE_LANE_LABELS[lane]}
              </button>
            ))}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 lg:block lg:space-y-3 lg:overflow-visible">
            {visibleItems.map((item) => (
              <QueueCard
                key={item.productId}
                item={item}
                selected={item.productId === selectedSummary?.productId}
                disabled={pending}
                onSelect={() => void selectItem(item.productId)}
              />
            ))}
            {visibleItems.length === 0 ? (
              <div className="rounded-md border border-stone-200 bg-white p-4 text-sm text-stone-700">
                In dieser Arbeitsqueue sind aktuell keine Produkte.
              </div>
            ) : null}
          </div>
        </aside>
        {selectedDetail ? (
          <DetailPanel
            detail={selectedDetail}
            comment={comment}
            setComment={setComment}
            pending={pending}
            onAction={(action, path) => void submit(action, path)}
          />
        ) : selectedSummary ? (
          <section className="rounded-md border border-stone-200 bg-stone-50 p-5 text-sm text-stone-700">
            <h2 className="font-semibold text-stone-950">{nameOf(selectedSummary)}</h2>
            <p className="mt-2">{feedback ?? "Audit wird geladen ..."}</p>
          </section>
        ) : (
          <section className="rounded-md border border-stone-200 bg-stone-50 p-5 text-sm text-stone-700">
            Wähle links eine Arbeitsqueue mit Produkten aus, um den nächsten Audit zu öffnen.
          </section>
        )}
      </section>
      <div>
        {feedback ? (
          <div
            role="status"
            aria-atomic="true"
            className="fixed bottom-5 left-4 right-4 z-50 max-w-md rounded-md border border-stone-300 bg-stone-950 px-4 py-3 text-sm font-medium text-white shadow-lg sm:left-auto sm:right-5"
          >
            {feedback}
          </div>
        ) : null}
      </div>
    </main>
  )
}
